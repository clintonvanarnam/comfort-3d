"use client";
import React, { useState } from "react";

export default function ShopCart({ products }) {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [showCheckoutDetails, setShowCheckoutDetails] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [checkingVariants, setCheckingVariants] = useState({});

  function addToCart(variantId) {
    // Check inventory via Admin API (if available) before mutating local cart
    // prevent concurrent checks for the same variant
    if (checkingVariants[variantId]) return;
    setCheckingVariants((s) => ({ ...s, [variantId]: true }));
    (async () => {
      try {
        const res = await fetch('/api/shopify-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId }),
        });
        const info = await res.json();
        // (dev) inventory info - removed in prod

        // Find product and variant locally for availableForSale fallback
        const product = products.find((p) => p.variants.some((v) => v.id === variantId));
        const variant = product ? product.variants.find((v) => v.id === variantId) : null;

        // If Admin API provided an inventoryQuantity, enforce numeric cap
        const maxQty = info && typeof info.inventoryQuantity === 'number' ? info.inventoryQuantity : null;

  setCart((prev) => {
          // If variant not available for sale (and Admin didn't say different), block
          if (variant && variant.availableForSale === false && maxQty === null) {
            alert('This variant is currently unavailable');
            return prev;
          }

          const found = prev.find((item) => item.variantId === variantId);

          if (found) {
            // If we have a max and adding would exceed it, block
            if (maxQty !== null && found.quantity + 1 > maxQty) {
              alert('Cannot add more than the available inventory for this variant');
              return prev;
            }
            return prev.map((item) =>
              item.variantId === variantId ? { ...item, quantity: item.quantity + 1 } : item
            );
          }

          // If maxQty is 0, treat as sold out
          if (maxQty !== null && maxQty <= 0) {
            alert('This variant is out of stock');
            return prev;
          }

          return [...prev, { variantId, quantity: 1 }];
        });
      } catch (err) {
        // If inventory lookup fails, fall back to availableForSale boolean
        const product = products.find((p) => p.variants.some((v) => v.id === variantId));
        const variant = product ? product.variants.find((v) => v.id === variantId) : null;
        if (variant && variant.availableForSale === false) {
          alert('This variant is currently unavailable');
          return;
        }
        setCart((prev) => {
          // (dev) cart logging removed for production
          const found = prev.find((item) => item.variantId === variantId);
          if (found) {
            const updated = prev.map((item) =>
              item.variantId === variantId ? { ...item, quantity: item.quantity + 1 } : item
            );
            // (dev) cart after add - removed for production
            return updated;
          }
          const updated = [...prev, { variantId, quantity: 1 }];
          // (dev) cart after add - removed for production
          return updated;
        });
      }
      finally {
        // release lock
        setCheckingVariants((s) => {
          const next = { ...s };
          delete next[variantId];
          return next;
        });
      }
    })();
  }

  async function checkout() {
    setLoading(true);
    try {
      const res = await fetch("/api/shopify-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      const data = await res.json();
      setCheckoutResult(data);
      if (data.checkoutUrl) {
        // give a small delay so UI updates then redirect
        setTimeout(() => (window.location = data.checkoutUrl), 250);
      }
    } catch (err) {
      alert("Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="shop-grid">
        {products.map((p) => (
          <article key={p.id} className="shop-card">
            <div>
              <h3>{p.title}</h3>
              <div dangerouslySetInnerHTML={{ __html: p.descriptionHtml || "" }} />
            </div>
            <div style={{ marginTop: 12 }}>
              {p.images[0] ? (
                <img src={p.images[0].url} alt={p.images[0].altText || p.title} style={{ width: "100%", borderRadius: 8 }} />
              ) : null}
            </div>
            <div>
              {p.variants && p.variants.length > 1 ? (
                <div>
                  <label style={{ display: 'block', marginBottom: 8 }}>Size</label>
                  <select
                    value={selectedVariants[p.id] || p.variants[0].id}
                    onChange={(e) => setSelectedVariants((s) => ({ ...s, [p.id]: e.target.value }))}
                  >
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id}>{v.title || v.selectedOptions?.map(o=>o.value).join(' / ') || v.id}</option>
                    ))}
                  </select>
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="btn"
                      onClick={() => addToCart(selectedVariants[p.id] || p.variants[0].id)}
                      disabled={checkingVariants[selectedVariants[p.id] || p.variants[0].id]}
                    >
                      {checkingVariants[selectedVariants[p.id] || p.variants[0].id] ? 'Checking...' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              ) : p.variants && p.variants.length === 1 ? (
                <button
                  className="btn"
                  onClick={() => addToCart(p.variants[0].id)}
                  disabled={checkingVariants[p.variants[0].id]}
                >
                  {checkingVariants[p.variants[0].id] ? 'Checking...' : 'Add to Cart'}
                </button>
              ) : (
                <span style={{ color: "#888" }}>Out of stock</span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div style={{ margin: "32px 0" }}>
        <h4>Cart</h4>
        {cart.length === 0 ? (
          <div>Your cart is empty.</div>
        ) : (
          <ul>
            {cart.map((item) => {
              // Find product and variant info
              const product = products.find((p) => p.variants.some((v) => v.id === item.variantId));
              const variant = product ? product.variants.find((v) => v.id === item.variantId) : null;
              return (
                <li key={item.variantId}>
                  {product ? product.title : 'Product'}
                  {variant ? ` — $${variant.price.amount} ${variant.price.currencyCode}` : ''}
                  {` × ${item.quantity}`}
                </li>
              );
            })}
          </ul>
        )}
        <button className="btn" onClick={checkout} disabled={cart.length === 0 || loading}>
          {loading ? "Redirecting..." : "Checkout"}
        </button>
        {checkoutResult && (
          <div style={{ marginTop: 12 }}>
            {checkoutResult.checkoutUrl ? (
              <div style={{ padding: 12, background: '#e6ffed', border: '1px solid #c6f6d5', borderRadius: 8 }}>
                Redirecting to checkout…
                <div style={{ marginTop: 8 }}>
                  <a href={checkoutResult.checkoutUrl} target="_blank" rel="noreferrer" className="btn">Open checkout</a>
                </div>
              </div>
            ) : (
              <div style={{ padding: 12, background: '#fff3f3', border: '1px solid #ffd6d6', borderRadius: 8 }}>
                <strong>Checkout failed</strong>
                <div style={{ marginTop: 8 }}>
                  There was a problem creating the checkout. You can view details below or try again.
                </div>
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => setShowCheckoutDetails((s) => !s)}>
                {showCheckoutDetails ? 'Hide details' : 'View details'}
              </button>
            </div>

            {showCheckoutDetails && (
              <div style={{ marginTop: 8, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(checkoutResult, null, 2)}</pre>
                {checkoutResult.cartId && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(checkoutResult.cartId || '');
                          alert('Cart id copied to clipboard');
                        } catch (e) {
                          // ignore
                        }
                      }}
                      className="btn"
                    >
                      Copy cart id
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
