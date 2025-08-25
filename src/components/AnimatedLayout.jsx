// src/components/AnimatedLayout.jsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import Flip from 'gsap/Flip';
import dynamic from 'next/dynamic';

// Load Footer only on the client to avoid any server-side flash/hydration issues
const FooterClient = dynamic(() => import('./Footer'), { ssr: false });

// Register GSAP Flip plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}

export default function AnimatedLayout({ children }) {
  const pathname = usePathname();

  // control delayed footer rendering specifically for the /projects page
  // start hidden to avoid any initial flash; we'll reveal as appropriate
  const [projectsFooterVisible, setProjectsFooterVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [contentPainted, setContentPainted] = useState(false);
  const footerWrapperRef = useRef(null);

  useEffect(() => {
    const flipElements = document.querySelectorAll('.flip-image');
    if (flipElements.length === 0) {
      // No flip elements — reveal the footer on /projects after a short fallback
      // so it doesn't stay hidden indefinitely.
      if (pathname === '/projects') {
        const t = setTimeout(() => setProjectsFooterVisible(true), 250);
        return () => clearTimeout(t);
      }
      return;
    }

    const state = Flip.getState(flipElements);

    Flip.from(state, {
      duration: 0.8,
      ease: 'power2.inOut',
      absolute: true,
      onEnter: (el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
        );
      },
      onComplete: () => {
        // After the Flip/GSAP entrance finishes, reveal the footer on /projects
        if (pathname === '/projects') {
          setProjectsFooterVisible(true);
        }
      },
    });
  }, [pathname]);


  // Ensure we don't show the footer on initial render; once mounted, show it
  // immediately on non-/projects pages, otherwise keep hidden until Flip/fallback.
  useEffect(() => {
  setMounted(true);
    if (pathname === '/projects') {
      // Keep hidden until Flip/onComplete or fallback timeout handles it.
      setProjectsFooterVisible(false);
      return;
    }

    // For all other pages, defer revealing the footer until after the first
    // visible paint. Using two RAF ticks gives the browser a chance to paint
    // main content so the footer doesn't appear before other page content.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setProjectsFooterVisible(true);
      });
    });

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [pathname]);


  // Detect first content paint so we can reveal footer only after the page
  // has painted. Prefer PerformanceObserver('paint') but fall back to two RAFs.
  useEffect(() => {
    if (contentPainted) return;

    let mountedLocal = true;

    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('paint')) {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint' || entry.name === 'first-paint') {
            if (mountedLocal) setContentPainted(true);
            obs.disconnect();
            return;
          }
        }
      });
      try {
        obs.observe({ type: 'paint', buffered: true });
      } catch (e) {
        // ignore and fall back to RAF
      }
      return () => {
        mountedLocal = false;
        try { obs.disconnect(); } catch (e) {}
      };
    }

    // Fallback: wait two RAFs which gives the browser a chance to paint.
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (mountedLocal) setContentPainted(true);
      });
    });
    return () => {
      mountedLocal = false;
      if (r1) cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
  }, [contentPainted]);

  // Sync a body class so CSS can hide the footer before hydration and show it
  // only when JS says it's visible. This prevents an initial flash.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
  if (mounted && projectsFooterVisible && contentPainted && pathname !== '/') {
      body.classList.add('footer-visible');
    } else {
      body.classList.remove('footer-visible');
    }

    return () => body.classList.remove('footer-visible');
  }, [mounted, projectsFooterVisible, pathname, contentPainted]);


  // Animate footer wrapper when it becomes visible so it enters last.
  useEffect(() => {
    if (!mounted || !contentPainted || !projectsFooterVisible || pathname === '/') return;
    const wrapper = footerWrapperRef.current;
    if (!wrapper) return;

    // Start hidden (in case CSS or earlier state made it visible)
    gsap.set(wrapper, { opacity: 0, y: 18, pointerEvents: 'none' });

    const tl = gsap.to(wrapper, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
      pointerEvents: 'auto',
    });

    return () => {
      try { tl.kill(); } catch (e) {}
    };
  }, [mounted, contentPainted, projectsFooterVisible, pathname]);

  return (
    <>
      {children}
      {mounted && contentPainted && pathname !== '/' && projectsFooterVisible && (
        <div ref={footerWrapperRef} className="animated-footer-wrapper">
          <FooterClient />
        </div>
      )}
    </>
  );
}

