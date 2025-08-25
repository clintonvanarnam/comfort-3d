"use client";

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import gsap from 'gsap';

export default function NavBar() {
  const router = useRouter();
  const navRef = useRef(null);
  const pathname = usePathname();
  const useDifference = pathname !== '/';

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

  // Hide nav when scrolling down, show when scrolling up.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    // Initial values
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    let ticking = false;

    const showNav = () => {
      el.style.transform = 'translateY(0)';
      el.style.pointerEvents = 'auto';
    };

    const hideNav = () => {
      el.style.transform = 'translateY(-100%)';
      // while hidden, avoid accidental clicks
      el.style.pointerEvents = 'none';
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
  transition: 'transform 360ms cubic-bezier(.22,1,.36,1)',
  willChange: 'transform',
        // use difference blend mode only when not on the root 3D page
        mixBlendMode: useDifference ? 'difference' : 'normal',
        WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
      }}
      aria-label="Main navigation"
    >
      <button
        onClick={() => router.push('/')}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
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
    </nav>
  );
}
