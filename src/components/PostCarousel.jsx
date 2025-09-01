
"use client";


import React, { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { createPortal } from 'react-dom';


export default function PostCarousel({ slides = [] }) {
  const stripRef = useRef();
  const [lightbox, setLightbox] = useState(null);
  const speed = 1; // pixels per frame

  // Marquee effect: auto-scroll the strip
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let rafId;
    const step = () => {
      el.scrollLeft += speed;
      // Loop: if reached end, jump back to start
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth) {
        el.scrollLeft = 0;
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
        {slides.map((s, i) => (
          <img
            key={i}
            src={s.src}
            alt={s.alt || ""}
            className="post-carousel-image embla__slide__img"
            style={{ height: "50vh", width: "auto", display: "inline-block", objectFit: "contain", margin: 0, padding: 0 }}
            role="button"
            tabIndex={0}
            onClick={() => setLightbox(s)}
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
          <img src={lightbox.src} alt={lightbox.alt || ''} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>, document.body) : null}
    </>
  );
}
