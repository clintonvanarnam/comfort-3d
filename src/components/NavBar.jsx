"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import gsap from 'gsap';

export default function NavBar() {
  const router = useRouter();
  const navRef = useRef(null);
  // nav no longer mounts the slide-over; it will dispatch an event to open it
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
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        justifyItems: 'center',
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
          gridColumn: '2',
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
      {/* Right-aligned action group: ABOUT + SHOP */}
      <div
        style={{
          gridColumn: '3',
          justifySelf: 'end',
          alignSelf: 'center',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          height: '100%',
          marginRight: '1rem',
        }}
      >
        <button
          onClick={() => router.push('/shop')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontFamily: 'var(--font-monument)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: '0.25rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            mixBlendMode: useDifference ? 'difference' : 'normal',
            WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
          }}
          aria-label="Shop"
        >
          SHOP
        </button>

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
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: '0.25rem 0.5rem',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            mixBlendMode: useDifference ? 'difference' : 'normal',
            WebkitMixBlendMode: useDifference ? 'difference' : 'normal',
          }}
          aria-label="About"
        >
          ABOUT
        </button>
      </div>
    </nav>
  );
}
