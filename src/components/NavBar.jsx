"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import gsap from 'gsap';

export default function NavBar() {
  const router = useRouter();
  const navRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  // nav no longer mounts the slide-over; it will dispatch an event to open it
  const pathname = usePathname();
  const useDifference = pathname !== '/';
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll distance before hiding/showing

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { y: -300, opacity: 0 },
      { y: 0, opacity: 1, duration: .6, ease: 'power2.out' }
    );
    return () => {
      tween.kill();
      gsap.killTweensOf(el);
    };
  }, []);

  // Track small viewport to adjust nav layout (shop left, about right on mobile)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(!!mq.matches);
    update();
    mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update);
    };
  }, []);

  // Track cart count from localStorage (persisted cart)
  useEffect(() => {
    const readCount = () => {
      try {
        const raw = localStorage.getItem('comfort_cart');
        const arr = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(arr) ? arr.reduce((s, it) => s + (it.quantity || 0), 0) : 0;
        setCartCount(count);
      } catch (e) {
        setCartCount(0);
      }
    };

    readCount();

    const onStorage = (e) => {
      if (e.key && e.key !== 'comfort_cart') return;
      readCount();
    };
    const onCartChanged = () => readCount();
    window.addEventListener('storage', onStorage);
    window.addEventListener('cart:changed', onCartChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cart:changed', onCartChanged);
    };
  }, []);

  // Hide nav when scrolling down, show when scrolling up.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    // Initial values
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;

    const showNav = () => {
      if (isMobile) {
        gsap.to(el, {
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
          onComplete: () => {
            el.style.pointerEvents = 'auto';
          }
        });
      } else {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      }
    };

    const hideNav = () => {
      if (isMobile) {
        gsap.to(el, {
          y: '-100%',
          opacity: 0,
          duration: 0.4,
          ease: 'power2.in',
          onComplete: () => {
            el.style.pointerEvents = 'none';
          }
        });
      } else {
        el.style.transform = 'translateY(calc(-100% - env(safe-area-inset-top) - 20px))';
        el.style.opacity = '1';
        el.style.pointerEvents = 'none';
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;

        // small threshold to avoid jitter
        if (Math.abs(delta) > 6) {
          if (delta > 0 && currentY > 60) {
            // scrolling down
            hideNav();
          } else {
            // scrolling up
            showNav();
          }
        }

        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // ensure nav is visible initially
    showNav();

    return () => {
      window.removeEventListener('scroll', onScroll);
      // reset styles
      if (el) {
        el.style.transform = '';
        el.style.pointerEvents = '';
      }
    };
  }, []);

  return (
  <nav
      ref={navRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 2147483647,
        background: 'transparent',
        transition: 'transform 360ms cubic-bezier(.22,1,.36,1), opacity 360ms cubic-bezier(.22,1,.36,1)',
        willChange: 'transform, opacity',
        opacity: 1,
        // use difference blend mode only when not on the root 3D page
        mixBlendMode: useDifference ? 'difference' : 'normal',
        WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
      }}
      aria-label="Main navigation"
    >
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        padding: `0 var(--site-gutter)`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
    <button
        onClick={() => router.push('/')}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '64px',
      alignSelf: 'center',
        }}
        aria-label="Home"
      >
        <img
          src="/COMFORT_MAG_LOGO_WHITE.svg"
          alt="COMFORT Home"
          style={{
            height: 20,
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
            mixBlendMode: useDifference ? 'difference' : 'normal',
            WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
          }}
        />
      </button>
      {/* Left action container (always positioned left) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
          height: '64px',
          marginLeft: 'var(--site-gutter)',
        }}
      >
        {isMobile && (
          <button
            onClick={() => router.push('/shop')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontFamily: 'var(--font-monument)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '64px',
              textDecoration: pathname && pathname.startsWith('/shop') ? 'underline' : 'none',
              mixBlendMode: useDifference ? 'difference' : 'normal',
              WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
            }}
            aria-label="Shop"
          >
            SHOP
          </button>
        )}

        {/* Cart button - on left margin for desktop, absolutely positioned below SHOP on mobile */}
        {cartCount > 0 && (
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:open'));
            }}
            style={{
              position: isMobile ? 'absolute' : 'relative',
              left: isMobile ? 0 : 'auto',
              top: isMobile ? '25px' : 'auto',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              padding: 0,
              margin: 0,
              fontFamily: 'var(--font-monument)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '64px',
              zIndex: isMobile ? 2147483648 : 'auto',
            }}
            aria-label={`Cart with ${cartCount} items`}
          >
            CART
            <span className="cart-badge" style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 18,
              padding: '0 6px',
              borderRadius: 9,
              background: '#ffffff',
              color: '#000000',
              fontSize: 12,
              marginLeft: 8,
              mixBlendMode: 'normal',
              WebkitMixBlendMode: 'normal',
              isolation: 'isolate',
            }}>{cartCount}</span>
          </button>
        )}
      </div>

    {/* Right action container (always positioned right) */}
      <div
        style={{
      position: 'absolute',
      right: 0,
      top: 0,
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
          height: '64px',
          marginRight: 'var(--site-gutter)',
        }}
      >
        {!isMobile && (
          <button
            onClick={() => router.push('/shop')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontFamily: 'var(--font-monument)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '64px',
              textDecoration: pathname && pathname.startsWith('/shop') ? 'underline' : 'none',
              mixBlendMode: useDifference ? 'difference' : 'normal',
              WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
            }}
            aria-label="Shop"
          >
            SHOP
          </button>
        )}

        

        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('about:open'));
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontFamily: 'var(--font-monument)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '64px',
            mixBlendMode: useDifference ? 'difference' : 'normal',
            WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
          }}
          aria-label="About"
        >
          ABOUT
        </button>
      </div>
    </div>
    </nav>
  );

}
