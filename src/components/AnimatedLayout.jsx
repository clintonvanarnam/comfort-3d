// src/components/AnimatedLayout.jsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import dynamic from 'next/dynamic';
import AboutSlideOver from './AboutSlideOver';
const CartSlideOver = dynamic(() => import('./CartSlideOver'), { ssr: false });

// Load Footer only on the client (prevents SSR flash/hydration issues)
const FooterClient = dynamic(() => import('./Footer'), { ssr: false });

// Optional: routes that should *not* delay the footer (empty to always delay)
const BYPASS_DELAY_ON_ROUTES = new Set([
  // '/',             // uncomment if you want the home page to show footer immediately
  // '/about',
]);

export default function AnimatedLayout({ children }) {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [contentPainted, setContentPainted] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  const footerWrapperRef = useRef(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [aboutPrefetchBody, setAboutPrefetchBody] = useState(null);
  const [aboutPrefetchStatus, setAboutPrefetchStatus] = useState('idle');

  // Mark mounted (client only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state on route change
  useEffect(() => {
    setPageReady(false);
    setFooterVisible(false);
    setContentPainted(false); // re-detect FCP per route
  }, [pathname]);

  // Listen for page’s “ready” signal (dispatch this from your page’s GSAP onComplete)
  useEffect(() => {
    const onReady = () => setPageReady(true);
    // listen for page ready
    window.addEventListener('page:ready', onReady);
    // listen for nav intent to open About
    const onAboutOpen = () => setAboutOpen(true);
    const onAboutClose = () => setAboutOpen(false);
    const onCartOpen = () => setCartOpen(true);
    const onCartClose = () => setCartOpen(false);
    window.addEventListener('about:open', onAboutOpen);
    window.addEventListener('about:close', onAboutClose);
    window.addEventListener('cart:open', onCartOpen);
    window.addEventListener('cart:close', onCartClose);
    return () => {
      window.removeEventListener('page:ready', onReady);
      window.removeEventListener('about:open', onAboutOpen);
      window.removeEventListener('about:close', onAboutClose);
      window.removeEventListener('cart:open', onCartOpen);
      window.removeEventListener('cart:close', onCartClose);
    };
  }, []);

  // Prefetch About content in the background so opening the panel shows content immediately
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setAboutPrefetchStatus('loading');
        const res = await fetch('/api/about', { signal: controller.signal });
        if (!res.ok) {
          setAboutPrefetchStatus('error');
          return;
        }
        const data = await res.json();
        const blocks = Array.isArray(data?.body) ? data.body : [];
        if (blocks.length) {
          setAboutPrefetchBody(blocks);
          setAboutPrefetchStatus('ready');
        } else {
          setAboutPrefetchStatus('error');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setAboutPrefetchStatus('error');
      }
    })();

    return () => controller.abort();
  }, []);

  // Fallback so footer won’t get stuck hidden if the event never fires
  useEffect(() => {
    if (BYPASS_DELAY_ON_ROUTES.has(pathname)) return; // don’t arm fallback if bypassing
    const t = setTimeout(() => setPageReady((v) => v || true), 1800);
    return () => clearTimeout(t);
  }, [pathname]);

  // Detect first (contentful) paint so we never show the footer before anything else has painted
  useEffect(() => {
    if (contentPainted) return;

    let alive = true;

    // Prefer PerformanceObserver('paint') for accuracy
    if (
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.includes('paint')
    ) {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!alive) return;
          if (entry.name === 'first-contentful-paint' || entry.name === 'first-paint') {
            setContentPainted(true);
            try { obs.disconnect(); } catch {}
            return;
          }
        }
      });
      try {
        obs.observe({ type: 'paint', buffered: true });
      } catch {
        // fall through to RAF
      }
      return () => {
        alive = false;
        try { obs.disconnect(); } catch {}
      };
    }

    // RAF fallback (two ticks gives the browser time to paint something)
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (alive) setContentPainted(true);
      });
    });
    return () => {
      alive = false;
      if (r1) cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
  }, [contentPainted]);

  // Decide when the footer can become visible
  useEffect(() => {
    const bypass = BYPASS_DELAY_ON_ROUTES.has(pathname);
    // If bypassing, only wait for mount + paint; otherwise require pageReady too.
    const canShow = mounted && contentPainted && (bypass ? true : pageReady);
    setFooterVisible(canShow);
  }, [mounted, contentPainted, pageReady, pathname]);

  // Sync a body class for CSS-only guards (prevents any flash before hydration)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (footerVisible) body.classList.add('footer-visible');
    else body.classList.remove('footer-visible');
    return () => body.classList.remove('footer-visible');
  }, [footerVisible]);

  // Animate the footer *when* it becomes visible (so it enters last)
  useEffect(() => {
    if (!footerVisible) return;
    const el = footerWrapperRef.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, y: 16, pointerEvents: 'none' });
    const tl = gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
      pointerEvents: 'auto',
    });

    return () => {
      try { tl.kill(); } catch {}
    };
  }, [footerVisible]);

  return (
    <>
      {children}

      {/* Global About slide-over mounted at app root to avoid nav blend issues */}
      <AboutSlideOver
        open={aboutOpen}
        onClose={() => {
          setAboutOpen(false);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('about:close'));
        }}
        initialBody={aboutPrefetchBody}
        // Avoid passing a 'loading' initial status from the background prefetch.
        // Treat an in-progress prefetch as 'idle' so the slide-over doesn't render
        // a loading UI when opened.
        initialStatus={aboutPrefetchStatus === 'loading' ? 'idle' : aboutPrefetchStatus}
      />

      {/* Global Cart slide-over mounted at app root */}
      <CartSlideOver
        open={cartOpen}
        onClose={() => {
          setCartOpen(false);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:close'));
        }}
      />

      {/* Only render once we decide it’s allowed to be visible */}
      {footerVisible && (
        <div ref={footerWrapperRef} className="animated-footer-wrapper">
          <FooterClient />
        </div>
      )}
    </>
  );
}
