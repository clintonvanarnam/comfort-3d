// src/components/CartSlideOver.jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function CartSlideOver({ open, onClose }) {
  const panelRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const [panelWidth, setPanelWidth] = useState('min(420px, 100vw)');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Animate panel in
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    isAnimatingRef.current = true;
    gsap.fromTo(el, { x: '100%' }, { x: '0%', duration: 0.4, ease: 'power2.out', onComplete: () => (isAnimatingRef.current = false) });
  }, [open]);

  // Responsive width
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setPanelWidth(w <= 640 ? '100vw' : '420px');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Read cart from localStorage whenever opened or when storage changes
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('comfort_cart');
        const parsed = raw ? JSON.parse(raw) : [];
        const arr = Array.isArray(parsed) ? parsed : [];
        setCart(arr);

        // Enrich with product/variant metadata from Storefront API
        if (arr.length) {
          (async () => {
            try {
              const variantIds = arr.map((it) => it.variantId);
              const res = await fetch('/api/shopify-variant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantIds }) });
              const json = await res.json().catch(() => null);
              const map = json?.data || {};
              const merged = arr.map((it) => ({
                ...it,
                title: map[it.variantId]?.productTitle || it.title || null,
                variantTitle: map[it.variantId]?.variantTitle || it.variantTitle || null,
                image: map[it.variantId]?.image?.url || it.image || null,
                // copy numeric price fields returned by the variant API
                priceAmount: typeof map[it.variantId]?.priceAmount === 'number' ? map[it.variantId].priceAmount : (it.priceAmount || null),
                priceCurrency: map[it.variantId]?.priceCurrency || it.priceCurrency || null,
                // fallback legacy string price
                price: map[it.variantId]?.price || it.price || null,
              }));
              setCart(merged);
            } catch (err) {
              // ignore, we'll display fallback info
            }
          })();
        }
      } catch (e) {
        setCart([]);
      }
    };
    if (open) read();
    const onStorage = (e) => {
      if (e.key && e.key !== 'comfort_cart') return;
      read();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('cart:changed', read);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cart:changed', read);
    };
  }, [open]);

  // Helpers to update quantities/remove items
  async function updateQuantity(variantId, delta) {
    if (delta > 0) {
      // Check inventory before increasing
      try {
        const res = await fetch('/api/shopify-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId }),
        });
        const info = await res.json();
        const maxQty = info && typeof info.inventoryQuantity === 'number' ? info.inventoryQuantity : null;
        if (maxQty !== null) {
          const currentQty = cart.find(it => it.variantId === variantId)?.quantity || 0;
          if (currentQty + delta > maxQty) {
            alert('Cannot add more than available inventory');
            return;
          }
        }
      } catch (err) {
        console.error('Failed to check inventory', err);
        // Proceed anyway if check fails
      }
    }

    try {
      const raw = localStorage.getItem('comfort_cart');
      const arr = raw ? JSON.parse(raw) : [];
      let changed = false;
      const updated = arr.map((it) => {
        if (it.variantId !== variantId) return it;
        const newQty = (it.quantity || 0) + delta;
        changed = true;
        return { ...it, quantity: Math.max(0, newQty) };
      }).filter(it => it.quantity > 0);
      if (!changed) return;
      localStorage.setItem('comfort_cart', JSON.stringify(updated));
      // update local UI immediately and notify others
      setCart(updated);
      try { window.dispatchEvent(new Event('cart:changed')); } catch (e) {}
    } catch (e) {
      console.error('Failed to update cart quantity', e);
    }
  }

  function removeItem(variantId) {
    try {
      const raw = localStorage.getItem('comfort_cart');
      const arr = raw ? JSON.parse(raw) : [];
      const updated = (arr || []).filter(it => it.variantId !== variantId);
      localStorage.setItem('comfort_cart', JSON.stringify(updated));
      setCart(updated);
      try { window.dispatchEvent(new Event('cart:changed')); } catch (e) {}
    } catch (e) {
      console.error('Failed to remove cart item', e);
    }
  }

  if (!open) return null;

  async function startCheckout() {
    if (!cart || !cart.length) return;
    setLoading(true);
    try {
      const res = await fetch('/api/shopify-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart }) });
      const json = await res.json().catch(() => null);
      if (json?.checkoutUrl) {
        setCheckoutUrl(json.checkoutUrl);
        window.location.href = json.checkoutUrl;
        return;
      }
      if (json?.cartId) {
        // no checkout URL; copy cart id and show message
        try { await navigator.clipboard.writeText(json.cartId || ''); } catch (e) {}
        alert('Cart created. Cart id copied to clipboard.');
      } else if (json?.error) {
        console.error(json);
        alert('Failed to start checkout');
      }
    } catch (err) {
      console.error(err);
      alert('Checkout failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483648, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={() => {
          if (isAnimatingRef.current) return;
          isAnimatingRef.current = true;
          gsap.to(panelRef.current, {
            x: '100%',
            duration: 0.35,
            ease: 'power2.in',
            onComplete: () => {
              isAnimatingRef.current = false;
              onClose?.();
            },
          });
        }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}
      />

      <aside
        ref={panelRef}
        style={{
          position: 'relative',
          width: panelWidth,
          height: '100%',
          background: '#fff',
          color: '#000',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: 0 }}>Your cart</h3>
          <div>
            <button
              onClick={() => {
                if (isAnimatingRef.current) return;
                isAnimatingRef.current = true;
                gsap.to(panelRef.current, {
                  x: '100%',
                  duration: 0.35,
                  ease: 'power2.in',
                  onComplete: () => {
                    isAnimatingRef.current = false;
                    onClose?.();
                  },
                });
              }}
              aria-label="Close cart"
              style={{ background: 'transparent', border: 'none', padding: 6, fontSize: '1.25rem', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1rem' }}>
          {(!cart || cart.length === 0) && <div>Your cart is empty.</div>}
          {cart && cart.length > 0 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {cart.map((item) => (
                <div key={item.variantId} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ width: 64, height: 64, background: '#f6f6f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {item.image ? <img src={item.image} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: '1 1 auto' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.title || 'Item'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{item.variantTitle || ''}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button aria-label={`Decrease quantity for ${item.title}`} onClick={() => updateQuantity(item.variantId, -1)} style={{ border: '1px solid #ddd', background: 'transparent', padding: '4px 8px', cursor: 'pointer' }}>−</button>
                        <div style={{ minWidth: 28, textAlign: 'center' }}>{item.quantity}</div>
                        <button aria-label={`Increase quantity for ${item.title}`} onClick={async () => await updateQuantity(item.variantId, 1)} style={{ border: '1px solid #ddd', background: 'transparent', padding: '4px 8px', cursor: 'pointer' }}>+</button>
                      </div>
                      <button aria-label={`Remove ${item.title}`} onClick={() => removeItem(item.variantId)} style={{ border: 'none', background: 'transparent', color: '#900', cursor: 'pointer', marginLeft: 8 }}>Remove</button>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {typeof item.priceAmount === 'number' ? `$${Number(item.priceAmount).toFixed(2)}` : (item.price || '')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          flexShrink: 0,
          padding: '1rem',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          <div style={{ fontSize: '0.9rem' }}>{cart?.reduce((s, it) => s + (it.quantity || 0), 0)} items</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={startCheckout} disabled={loading || !cart || cart.length === 0}>
              {loading ? 'Starting…' : 'Checkout'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
