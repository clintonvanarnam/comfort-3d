"use client";
import React, { useState } from "react";

export default function ShopCart({ products }) {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState({});

  function addToCart(variantId) {
    setCart((prev) => {
      const found = prev.find((item) => item.variantId === variantId);
      if (found) {
        return prev.map((item) =>
          item.variantId === variantId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { variantId, quantity: 1 }];
    });
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
                    <button className="btn" onClick={() => addToCart(selectedVariants[p.id] || p.variants[0].id)}>
                      Add to Cart
                    </button>
                  </div>
                </div>
              ) : p.variants && p.variants.length === 1 ? (
                <button className="btn" onClick={() => addToCart(p.variants[0].id)}>
                  Add to Cart
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
          <div style={{ marginTop: 12, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
            <strong>Checkout response</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(checkoutResult, null, 2)}</pre>
            {checkoutResult.cartId && (
              <div>
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
            {checkoutResult.checkoutUrl && (
              <div style={{ marginTop: 8 }}>
                <a href={checkoutResult.checkoutUrl} target="_blank" rel="noreferrer" className="btn">Open checkout</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
