"use client";

import React, { useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { PortableText } from '@portabletext/react';

const DEFAULT_SPEED = 1; // pixels per frame (legacy value). We convert to px/ms inside the effect for stable timing.
// Multiplier applied to pointer velocity when converting to momentum on release.
// Increase to make flicks faster; lower to make them gentler.
const MOMENTUM_MULT = 1.8;


export default function PostCarousel({ slides = [], openLightbox: externalOpen, disableLightbox = false }) {
  const stripRef = useRef();
  const innerRef = useRef();
  // position within a single copy (px)
  const posRef = useRef(0);
  // cached single-copy width (px)
  const copyWidthRef = useRef(0);
  // lightbox removed: carousel no longer opens an overlay on click
  // Dragging / pointer state
  const draggingRef = useRef(false);
  const pointerIdRef = useRef(null);
  const startXRef = useRef(0);
  const startPosRef = useRef(0);
  const pausedRef = useRef(false);
  const momentumRef = useRef(0); // px per ms

  // Marquee effect: auto-scroll the strip. Render slides twice and when
  // we've scrolled past the first copy, subtract half the scrollWidth to loop
  // seamlessly without a visible jump.
  // Recalculate the copy width and preserve fractional progress
  const recalcCopy = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;
    // If any modal/overlay is present in the document (including external/page-level lightboxes),
    // skip recalculation to avoid layout-driven snaps while the overlay is open.
    if (typeof document !== 'undefined') {
      const overlay = document.querySelector('.post-lightbox-overlay, [aria-modal="true"]');
      if (overlay) return;
    }
  const prev = copyWidthRef.current || 0;
  const cw = inner.scrollWidth / 2 || 0;
  const TRACE = (typeof window !== 'undefined' && window.__postCarouselTrace);
  if (TRACE) console.debug('[PostCarousel] recalcCopy overlay skip?', !!(typeof document !== 'undefined' && document.querySelector('.post-lightbox-overlay, [aria-modal="true"]')), { prev, cw, pos: posRef.current });
    if (prev > 0 && cw > 0) {
      // preserve fraction of progress
      const frac = (posRef.current % prev) / prev;
      posRef.current = frac * cw;
    } else if (cw > 0) {
      posRef.current = Math.floor(cw / 2) % cw;
    } else {
      posRef.current = 0;
    }
    copyWidthRef.current = cw;
    // apply transform immediately to avoid jumps
    inner.style.transform = `translateX(-${posRef.current}px)`;
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;

    // Restore persisted position if present (survive remounts)
    try {
      if (typeof window !== 'undefined' && window.__postCarouselPos != null) {
        posRef.current = Number(window.__postCarouselPos) || posRef.current;
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && window.__postCarouselCopyWidth != null) {
        copyWidthRef.current = Number(window.__postCarouselCopyWidth) || copyWidthRef.current;
      }
    } catch (e) {}

    const pxPerMs = DEFAULT_SPEED / 16.6667;

    // initial calc
    recalcCopy();

    let last = performance.now();
    let rafId;

    const step = (now) => {
      const dt = Math.max(0, now - last);
      last = now;
      const cw = copyWidthRef.current || 0;
      // autoplay movement when not paused
      if (!pausedRef.current) posRef.current += pxPerMs * dt;
      // momentum from a recent drag
      if (momentumRef.current) {
        posRef.current += momentumRef.current * dt;
        // decay momentum per frame
        const decay = Math.pow(0.95, dt / 16.6667);
        momentumRef.current *= decay;
        if (Math.abs(momentumRef.current) < 0.0005) momentumRef.current = 0;
      }
      if (cw > 0 && posRef.current >= cw) posRef.current = posRef.current % cw;
  inner.style.transform = `translateX(-${posRef.current}px)`;
  if (typeof window !== 'undefined' && window.__postCarouselTrace) console.debug('[PostCarousel] step', { dt, pos: posRef.current, cw });
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    // Recompute on resize/load and when images finish loading
    const onResize = () => recalcCopy();
    const onLoad = () => recalcCopy();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('load', onLoad);
    const imgs = Array.from(inner.querySelectorAll('img'));
    imgs.forEach((img) => { if (!img.complete) img.addEventListener('load', recalcCopy); });

    // If an overlay/modal is added/removed, we want to resync only when it's removed.
    let observer = null;
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            // If an overlay was removed, attempt a recalc
            const removed = Array.from(m.removedNodes || []).some(n => {
              try { return n instanceof Element && (n.matches && (n.matches('.post-lightbox-overlay') || n.getAttribute && n.getAttribute('aria-modal') === 'true')); } catch (e) { return false; }
            });
            if (removed) {
              if (typeof window !== 'undefined' && window.__postCarouselTrace) console.debug('[PostCarousel] overlay removed, scheduling recalc');
              // schedule a recalc on next frame to allow layout to settle
              requestAnimationFrame(() => recalcCopy());
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onLoad);
      imgs.forEach((img) => { if (!img.complete) img.removeEventListener('load', recalcCopy); });
      if (observer) observer.disconnect();
      // Persist position and cached width so remounted carousels continue without snapping
      try {
        if (typeof window !== 'undefined') {
          window.__postCarouselPos = posRef.current;
          window.__postCarouselCopyWidth = copyWidthRef.current;
        }
      } catch (e) {}
    };
  }, [recalcCopy]);

  // Pointer-based dragging handlers
  useEffect(() => {
    const strip = stripRef.current;
    const inner = innerRef.current;
    if (!strip || !inner) return;

    // allow vertical scrolling while capturing horizontal drags
    strip.style.touchAction = 'pan-y';

    const mod = (v, m) => ((v % m) + m) % m;

    const onPointerDown = (ev) => {
      // Only left button or touch/pen
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      draggingRef.current = true;
      pointerIdRef.current = ev.pointerId;
      startXRef.current = ev.clientX;
      startPosRef.current = posRef.current;
      pausedRef.current = true; // pause autoplay while dragging
      momentumRef.current = 0;
      try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
    };

    const onPointerMove = (ev) => {
      if (!draggingRef.current || pointerIdRef.current !== ev.pointerId) return;
      const cw = copyWidthRef.current || 0;
      if (!cw) return;
      const dx = ev.clientX - startXRef.current;
      // dragging right (dx>0) should rewind (pos decreases)
      let next = startPosRef.current - dx;
      next = mod(next, cw);
      posRef.current = next;
      inner.style.transform = `translateX(-${posRef.current}px)`;
      // record recent movement for velocity (simple): store last positions on the event
      // attach to ref for use on up
      draggingRef.current = true;
      // stash recent velocity sample
      draggingRef._last = draggingRef._last || [];
      draggingRef._last.push({ t: performance.now(), x: ev.clientX });
      if (draggingRef._last.length > 6) draggingRef._last.shift();
    };

    const onPointerUp = (ev) => {
      if (!draggingRef.current || pointerIdRef.current !== ev.pointerId) return;
      draggingRef.current = false;
      pointerIdRef.current = null;
      try { ev.target.releasePointerCapture(ev.pointerId); } catch (e) {}

      // compute simple velocity from recorded samples
      const samples = draggingRef._last || [];
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(1, last.t - first.t);
        const dx = last.x - first.x; // px over dt
        const vx = dx / dt; // px per ms (pointer)
        // pos change velocity is -vx (since pos = startPos - dx)
        // Apply multiplier so user flicks are faster/stronger
        momentumRef.current = -vx * MOMENTUM_MULT;
      }
      draggingRef._last = [];
      // resume autoplay; momentum (if any) will be applied in the RAF loop
      pausedRef.current = false;
    };

    strip.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      strip.style.touchAction = '';
      strip.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  // Ensure the transform is immediately reapplied after any React render or layout changes
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = `translateX(-${posRef.current}px)`;
  });

  // Reapply transform on user scroll or visibility changes to avoid interference
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const onScroll = () => { inner.style.transform = `translateX(-${posRef.current}px)`; };
    const onVis = () => { inner.style.transform = `translateX(-${posRef.current}px)`; };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!slides || slides.length === 0) return null;
  return (
    <>
      <div
        ref={stripRef}
        style={{
          width: "100vw",
          maxWidth: "100vw",
          overflow: "hidden",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          display: "block",
        }}
      >
        <div ref={innerRef} style={{ display: 'flex', alignItems: 'center', gap: 0, willChange: 'transform' }}>
          {/* Render two copies of the slides so the marquee can loop smoothly */}
          {slides.concat(slides).map((s, i) => (
            <img
              key={`slide-${i}`}
              src={s.src}
              alt={s.alt || ""}
              className="post-carousel-image embla__slide__img"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{ height: "50vh", width: "auto", display: "inline-block", objectFit: "contain", margin: 0, padding: 0, WebkitUserDrag: 'none', userSelect: 'none' }}
            />
          ))}
        </div>
      </div>
      {/* lightbox removed */}
    </>
  );
}
