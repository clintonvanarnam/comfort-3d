"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import gsap from 'gsap';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef(null);
  const maskRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isNavigatingHome, setIsNavigatingHome] = useState(false);
  const useDifference = pathname !== '/';
  const lastNavigationTime = useRef(0);

  // Entrance animation
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const tween = gsap.fromTo(el, { y: -300, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' });
    return () => {
      tween.kill();
      gsap.killTweensOf(el);
    };
  }, []);

  // Mobile detection
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

  // Cart count from localStorage
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

  // Hide on scroll (desktop only). Keep nav fixed and visible on mobile.
  useEffect(() => {
    const el = navRef.current;
    const maskEl = maskRef.current;
    if (!el) return;

    // If mobile, reset and keep visible
    if (isMobile) {
      gsap.killTweensOf(el);
      if (maskEl) {
        gsap.killTweensOf(maskEl);
        maskEl.style.opacity = '0';
        maskEl.style.display = 'none';
      }
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      return;
    }

    let lastY = window.scrollY || 0;
    let ticking = false;

    const showNav = () => {
      gsap.to(el, { y: 0, opacity: 1, duration: 0.38, ease: 'power2.out', onComplete: () => { el.style.pointerEvents = 'auto'; } });
      if (maskEl) gsap.to(maskEl, { opacity: 0, duration: 0.28, ease: 'power2.out', onComplete: () => { maskEl.style.display = 'none'; } });
    };

    const hideNav = () => {
      gsap.to(el, { y: '-110%', opacity: 0, duration: 0.38, ease: 'power2.in', onComplete: () => { el.style.pointerEvents = 'none'; } });
      if (maskEl) {
        maskEl.style.display = 'block';
        gsap.to(maskEl, { opacity: 1, duration: 0.28, ease: 'power2.in' });
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;
        if (Math.abs(delta) > 6) {
          if (delta > 0 && currentY > 60) hideNav(); else showNav();
        }
        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    showNav();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (el) {
        el.style.transform = '';
        el.style.pointerEvents = '';
        el.style.opacity = '';
      }
      if (maskEl) {
        maskEl.style.display = 'none';
        maskEl.style.opacity = '';
      }
    };
  }, [isMobile]);

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 2147483647,
        background: 'transparent',
        transition: 'transform 360ms cubic-bezier(.22,1,.36,1), opacity 360ms cubic-bezier(.22,1,.36,1)',
        willChange: 'transform, opacity',
        opacity: 1,
        mixBlendMode: useDifference ? 'difference' : 'normal',
        WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
      }}
      aria-label="Main navigation"
    >
      <div
        ref={maskRef}
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: '#000',
          zIndex: 2147483650,
          pointerEvents: 'none',
          opacity: 0,
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          margin: '0 auto',
          padding: '0 var(--site-gutter)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Left actions */}
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

          {cartCount > 0 && (
            <button
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:open')); }}
              style={{
                position: isMobile ? 'absolute' : 'relative',
                left: isMobile ? 0 : 'auto',
                top: isMobile ? 25 : 'auto',
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

        {/* Center logo */}
        <button
          onClick={() => {
            // Prevent rapid navigation that can cause WebGL context issues
            const now = Date.now();
            const timeSinceLastNav = now - lastNavigationTime.current;
            if (timeSinceLastNav < 2000) {
              console.log('Navigation blocked - too soon since last navigation');
              return;
            }
            lastNavigationTime.current = now;

            // Use router.push on iOS to avoid forced reloads that corrupt WebGL context
            const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
              // Show loading screen immediately
              setIsNavigatingHome(true);
              // Delay to allow cleanup and show loading screen, then use router.push
              setTimeout(() => {
                router.push('/');
              }, 800);
            } else {
              router.push('/');
            }
          }}
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

        {/* Right actions */}
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
            onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('about:open')); }}
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

      {/* Loading screen during home navigation on iOS */}
      {isNavigatingHome && (
        <>
          <style>
            {`
              @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.3; }
              }
            `}
          </style>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'black',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999999999,
              color: '#fff',
              fontFamily: 'var(--font-monument)',
            }}
          >
            <img
              src="/COMFORT_MAG_LOGO_RED.svg"
              alt="COMFORT"
              style={{
                width: '200px',
                height: 'auto',
                animation: 'blink 1s infinite',
              }}
            />
          </div>
        </>
      )}
    </nav>
  );
}
