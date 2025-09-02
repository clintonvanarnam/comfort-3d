"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { PortableText } from '@portabletext/react';

const DEFAULT_SPEED = 1; // pixels per frame (stable constant to avoid changing deps)


export default function PostCarousel({ slides = [], openLightbox: externalOpen, disableLightbox = false }) {
  const stripRef = useRef();
  const [lightbox, setLightbox] = useState(null);

  // Marquee effect: auto-scroll the strip. Render slides twice and when
  // we've scrolled past the first copy, subtract half the scrollWidth to loop
  // seamlessly without a visible jump.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let rafId;
    const step = () => {
      el.scrollLeft += DEFAULT_SPEED;
      const half = el.scrollWidth / 2;
      if (half > 0 && el.scrollLeft >= half) {
        // subtract the width of one copy to continue seamlessly
        el.scrollLeft -= half;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!slides || slides.length === 0) return null;
  return (
    <>
      <div
        ref={stripRef}
        style={{
          width: "100vw",
          maxWidth: "100vw",
          overflowX: "hidden",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Render two copies of the slides so the marquee can loop smoothly */}
        {slides.concat(slides).map((s, i) => (
          <img
            key={`slide-${i}`}
            src={s.src}
            alt={s.alt || ""}
            className="post-carousel-image embla__slide__img"
            style={{ height: "50vh", width: "auto", display: "inline-block", objectFit: "contain", margin: 0, padding: 0 }}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (externalOpen && disableLightbox) {
                // prefer the page-level lightbox when requested
                externalOpen(s);
                return;
              }
              setLightbox(s);
            }}
          />
        ))}
      </div>
      {/* Lightbox portal */}
      {lightbox && typeof document !== 'undefined' ? createPortal(
        <div
          className="post-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 10000 }}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <img src={lightbox.src} alt={lightbox.alt || ''} style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain' }} />
            {lightbox.caption ? (
              <div className="post-lightbox-caption" style={{ color: 'white', maxWidth: '90vw' }}>
                <PortableText value={lightbox.caption} />
              </div>
            ) : null}
          </div>
        </div>, document.body) : null}
    </>
  );
}
