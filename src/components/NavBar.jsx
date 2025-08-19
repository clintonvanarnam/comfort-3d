"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';

export default function NavBar() {
  const router = useRouter();
  const navRef = useRef(null);

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
            height: 40,
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </button>
    </nav>
  );
}
