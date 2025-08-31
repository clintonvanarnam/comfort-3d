
"use client";


import React, { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";


export default function PostCarousel({ slides = [] }) {
  // Lightbox disabled
  const stripRef = useRef();
  const speed = 5; // pixels per frame

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
  }, [stripRef]);

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
            style={{ height: "40vh", width: "auto", display: "inline-block", objectFit: "contain", margin: 0, padding: 0, cursor: "pointer" }}
            // Lightbox disabled
          />
        ))}
      </div>
  {/* Lightbox disabled */}
    </>
  );
}
