"use client";
import React, { useState, useEffect } from 'react';
import styles from './ProductPage.module.css';

export default function ProductPage({ product }) {
  // When multiple variants exist, start with no selection so the user must choose
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants && product.variants.length > 1 ? '' : (product.variants[0]?.id || null)
  );
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (product.images && product.images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [product.images]);

  async function addToCart(variantId) {
    if (!variantId) return;
    if (checking) return;
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shopify-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });
      const info = await res.json();
      const maxQty = info && typeof info.inventoryQuantity === 'number' ? info.inventoryQuantity : null;

      if (maxQty !== null && maxQty <= 0) {
        setMessage('This variant is out of stock');
        return;
      }

      const variant = product.variants.find((v) => v.id === variantId);
      if (variant && variant.availableForSale === false && maxQty === null) {
        setMessage('This variant is currently unavailable');
        return;
      }

      // Update the shared local cart (comfort_cart) so the site has a persistent cart
      try {
        const raw = localStorage.getItem('comfort_cart');
        const current = raw ? JSON.parse(raw) : [];
        const found = current.find((it) => it.variantId === variantId);
        if (found) {
          // if maxQty provided, enforce cap
          if (maxQty !== null && found.quantity + 1 > maxQty) {
            setMessage('Cannot add more than available inventory');
            return;
          }
          const updated = current.map((it) => it.variantId === variantId ? { ...it, quantity: it.quantity + 1 } : it);
          localStorage.setItem('comfort_cart', JSON.stringify(updated));
        } else {
          // check maxQty
          if (maxQty !== null && maxQty <= 0) {
            setMessage('This variant is out of stock');
            return;
          }
          const updated = [...current, { variantId, quantity: 1 }];
          localStorage.setItem('comfort_cart', JSON.stringify(updated));
        }
  setMessage('Added to cart');
  // notify other components in the same tab
  try { window.dispatchEvent(new Event('cart:changed')); } catch (e) {}
      } catch (err) {
        setMessage('Failed to update cart');
      }
    } catch (err) {
      setMessage('Error adding to cart');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="product-page-layout">
      <div className="product-description">
        <h1>{product.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml || '' }} />
      </div>

      <div className="product-image">
        {product.images && product.images.length > 0 && (
          <div className={styles.imageCarousel}>
            <img 
              src={product.images[currentImageIndex].url} 
              alt={product.images[currentImageIndex].altText || product.title} 
            />
          </div>
        )}
      </div>

      <div className="product-controls">
        <div>
          {/* Show price of selected variant or first variant */}
          {(() => {
            const variant = selectedVariant ? product.variants.find(v => v.id === selectedVariant) : product.variants[0];
            return variant ? (
              <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-monument)', fontWeight: 700, marginBottom: 16 }}>
                ${Number(variant.price.amount).toFixed(2)}
              </div>
            ) : null;
          })()}

          {product.variants && product.variants.length > 1 ? (
            <div>
              <div className="select-wrap">
                <select aria-label="Select size" className="size-select" value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)}>
                  <option value="" disabled>SELECT AN OPTION</option>
                  {product.variants.map((v) => {
                    const soldOut = v.availableForSale === false;
                    const label = (v.title || v.selectedOptions?.map(o=>o.value).join(' / ') || v.id) + (soldOut ? ' - SOLD OUT' : '');
                    return (
                      <option key={v.id} value={v.id} disabled={soldOut} aria-disabled={soldOut}>{label}</option>
                    );
                  })}
                </select>
                {/* arrow is handled by the wrapper ::after pseudo-element */}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 12 }}>
            <button
              className="btn"
              onClick={() => addToCart(selectedVariant)}
              disabled={checking || !selectedVariant}
              aria-disabled={checking || !selectedVariant}
            >
              {checking ? 'Checking...' : 'Add to Cart'}
            </button>
          </div>

          <div className="product-message">
            {message ? (
              <div className="product-message-inner" role="status" aria-live="polite">{message}</div>
            ) : (
              /* empty placeholder to reserve space when no message */
              <div className="product-message-inner" aria-hidden="true">&nbsp;</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


