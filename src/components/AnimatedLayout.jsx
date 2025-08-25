// src/components/AnimatedLayout.jsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';

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
    window.addEventListener('page:ready', onReady);
    return () => window.removeEventListener('page:ready', onReady);
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

      {/* Only render once we decide it’s allowed to be visible */}
      {footerVisible && (
        <div ref={footerWrapperRef} className="animated-footer-wrapper">
          <FooterClient />
        </div>
      )}
    </>
  );
}