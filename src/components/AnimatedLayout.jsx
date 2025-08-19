// src/components/AnimatedLayout.jsx
'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import gsap from 'gsap';
import Flip from 'gsap/Flip';

// Register GSAP Flip plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}

export default function AnimatedLayout({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    const flipElements = document.querySelectorAll('.flip-image');
    if (flipElements.length === 0) return;

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
    });
  }, [pathname]);

  return children;
}
