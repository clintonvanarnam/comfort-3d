'use client';

import { useEffect, useRef, useState } from 'react';

export default function PostCarousel({ slides = [], autoplay = false, autoplayDelay = 4000, showControls = true, openLightbox, disableLightbox = false }) {
  const [index, setIndex] = useState(0);
  const virtualIndexRef = useRef(0);
  const CLONES = 3; // number of repeated blocks for seamless looping
  const TRANSITION_MS = 700;
  const [noTransition, setNoTransition] = useState(false);
  // 3D tuning constants — tweak these for stronger/weaker depth
  const PERSPECTIVE = 700; // lower value -> more dramatic perspective
  const DEPTH_MULT = 480; // pixels per step on Z axis (larger -> more depth)
  const ROTATE_MULT = 18; // degrees per step for Y rotation
  const SIDE_SCALE = 0.78; // scale for non-active slides
  const BACK_Z_ROTATE = 10; // degrees to rotate back-two slides around Z axis
  const wrapRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, moving: false });
  const autoplayRef = useRef(null);
  const progressRefs = useRef([]);
  const interactionResumeTimerRef = useRef(null);
  // slide percent is calculated from the browser width so the peek scales
  const [slidePercent, setSlidePercent] = useState(86);
  const [slideWidthPx, setSlideWidthPx] = useState(0);
  const [slideWidths, setSlideWidths] = useState([]);
  const imageRefs = useRef([]);
  const indexRef = useRef(index);
  const pausedRef = useRef(false);
  const allowAutoplayStartRef = useRef(true);
  // Toggle this to true while debugging to fully disable autoplay
  const DEBUG_DISABLE_AUTOPLAY = false;

  useEffect(() => { indexRef.current = index; }, [index]);

  // guarded setter: prevent index changes while lightbox is open or carousel is paused
  function safeSetIndex(i, force = false) {
    try {
      if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) {
        dbg('safeSetIndex blocked (lightbox open)', i);
        return;
      }
    } catch (e) {}
    if (pausedRef.current && !force) { dbg('safeSetIndex blocked (paused)', i); return; }
    indexRef.current = i;
    setIndex(i);
  }

  // debug helper: set `window.__CAROUSEL_DEBUG = true` in the browser to enable
  function dbg(...args) {
    try {
      if (typeof window !== 'undefined' && window.__CAROUSEL_DEBUG) console.log('[CAROUSEL]', ...args);
    } catch (e) { }
  }

  function clearInteractionTimer() {
    if (interactionResumeTimerRef.current) {
      clearTimeout(interactionResumeTimerRef.current);
      interactionResumeTimerRef.current = null;
    }
  }

  function pauseForInteraction(ms = Math.max(1200, autoplayDelay)) {
    dbg('pauseForInteraction', ms);
    // mark paused so other paths don't restart autoplay prematurely
    pausedRef.current = true;
    stopAutoplay();
    clearInteractionTimer();
    interactionResumeTimerRef.current = setTimeout(() => {
      // don't resume if lightbox is open
      try {
        if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) {
          dbg('pauseForInteraction: lightbox open, skipping resume');
          pausedRef.current = true;
          interactionResumeTimerRef.current = null;
          return;
        }
      } catch (e) {}
      pausedRef.current = false;
      dbg('pauseForInteraction: resuming autoplay');
      if (autoplay) startAutoplay(indexRef.current);
      interactionResumeTimerRef.current = null;
    }, ms);
  }

  useEffect(() => {
    if (!wrapRef.current) return;
  function recalc() {
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const wrapRect = wrapRef.current.getBoundingClientRect();
      const wrapW = wrapRect.width || vw;
      // Make slides full viewport width so they sit flush next to each other
      const percent = 100;
      // compute pixel widths; we'll measure images after render
      const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const gapInPx = 0;
      let slidePx = wrapW;
      try {
        const track = wrapRef.current.querySelector('.post-carousel-track');
        const firstSlide = track ? track.querySelector('.post-carousel-slide-3d') : null;
        if (firstSlide) {
          const r = firstSlide.getBoundingClientRect();
          if (r.width && r.width > 10) {
            slidePx = r.width; // use float width
          }
        }
      } catch (e) {
        // ignore, fall back to percent-based value
      }
      // ensure slide width never exceeds the available wrap width
      const maxAllowed = Math.max(100, wrapW);
      if (slidePx > maxAllowed) slidePx = maxAllowed;
      setSlidePercent(percent);
      setSlideWidthPx(slidePx);
      // schedule a measurement of each image's rendered width
      requestAnimationFrame(measureSlides);
    }

    recalc();
    let raf = null;
    function onResize() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    }
    window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); try { if (wrapRef.current) wrapRef.current.style.pointerEvents = ''; } catch (e) {} };
  }, []);

  useEffect(() => {
    return () => {
      clearInteractionTimer();
    };
  }, []);

  // when slides count changes, reset virtual index to the middle block
  useEffect(() => {
    const n = slides.length || 0;
    if (n === 0) return;
  virtualIndexRef.current = n; // start in the middle clone block
  safeSetIndex(0);
    requestAnimationFrame(measureSlides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  function measureSlides() {
    try {
      const track = wrapRef.current ? wrapRef.current.querySelector('.post-carousel-track') : null;
      if (!track) return;
      const imgs = imageRefs.current || [];
      const widths = imgs.map((img) => {
        if (!img) return 0;
        const r = img.getBoundingClientRect();
        return r.width; // keep float precision
      });
      setSlideWidths(widths);
    } catch (e) {
      // ignore
    }
  }

  // re-measure when slides change or images load
  useEffect(() => {
    measureSlides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  useEffect(() => {
    progressRefs.current = progressRefs.current.slice(0, slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!autoplay) return;
    startAutoplay();
    return stopAutoplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, autoplayDelay, slides.length]);

  useEffect(() => {
    // when index changes, restart the active progress bar animation
    resetProgressBars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Pause carousel activity while a global lightbox overlay is open.
  // The posts page adds `body.lightbox-open` when the lightbox is displayed.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    const savedVirtual = { current: null };
    let pendingRestart = null;
    const clearPending = () => {
      if (pendingRestart) {
        clearTimeout(pendingRestart);
        pendingRestart = null;
      }
    };
    const check = () => {
      const open = document.body.classList.contains('lightbox-open');
      if (open) {
        dbg('lightbox OPEN detected');
        // save current virtual index and stop autoplay; freeze transitions so carousel doesn't animate
        savedVirtual.current = virtualIndexRef.current;
        dbg('saved virtual index', { virtual: savedVirtual.current });
  // set paused flag to prevent any restart races and block any autoplay starts
  pausedRef.current = true;
  allowAutoplayStartRef.current = false;
        dbg('pausedRef set -> true');
  clearPending();
  stopAutoplay();
  // ensure pointer interactions can't reach the carousel while paused
  try { if (wrapRef.current) wrapRef.current.style.pointerEvents = 'none'; } catch (e) {}
  setNoTransition(true);
      } else {
        dbg('lightbox CLOSE detected');
        // when closing, restore the saved virtual index and snap without transition,
        // then re-enable transitions and resume autoplay if desired.
        if (savedVirtual.current != null) {
          // ensure we snap to the saved position without animation
          setNoTransition(true);
          virtualIndexRef.current = savedVirtual.current;
          dbg('restoring virtual index', { virtual: virtualIndexRef.current });
          // also sync the logical index state so progress bars and autoplay align
          const n = slides.length || 0;
            if (n > 0) {
            const logical = ((savedVirtual.current % n) + n) % n;
            safeSetIndex(logical);
            // immediately sync the ref so restarts use the correct index
            indexRef.current = logical;
          }
          // force a reflow so the transform is applied immediately
          // eslint-disable-next-line no-unused-expressions
          wrapRef.current && wrapRef.current.offsetHeight;
          // next frame: re-enable transitions and resume autoplay
          requestAnimationFrame(() => {
            setNoTransition(false);
            // small delay to avoid immediate tick races
            clearPending();
            dbg('scheduling paused clear + autoplay restart in 120ms');
      const restartIndex = ((savedVirtual.current % (slides.length || 1)) + (slides.length || 1)) % (slides.length || 1);
            pendingRestart = setTimeout(() => {
              // clear paused flag only when we're sure the UI has settled
              pausedRef.current = false;
              dbg('pausedRef cleared -> false');
              // allow explicit autoplay starts now
              allowAutoplayStartRef.current = true;
              try { if (wrapRef.current) wrapRef.current.style.pointerEvents = ''; } catch (e) {}
              if (autoplay) {
                dbg('restarting autoplay after lightbox close');
                // startAutoplay with current logical index to avoid starting at stale 0
        startAutoplay(restartIndex);
              }
              pendingRestart = null;
            }, 120);
            savedVirtual.current = null;
          });
        } else {
          // fallback: just re-enable transitions and autoplay
          setNoTransition(false);
          // ensure we clear paused flag and any pending restart before starting
          clearPending();
          dbg('scheduling paused clear + autoplay restart (fallback) in 120ms');
          pendingRestart = setTimeout(() => {
            pausedRef.current = false;
            dbg('pausedRef cleared -> false (fallback)');
            try { if (wrapRef.current) wrapRef.current.style.pointerEvents = ''; } catch (e) {}
            // compute a safe logical index from the current virtual index
            const n2 = slides.length || 1;
            const logicalFallback = ((virtualIndexRef.current % n2) + n2) % n2;
            indexRef.current = logicalFallback;
            // allow explicit autoplay starts now
            allowAutoplayStartRef.current = true;
            if (autoplay) startAutoplay(logicalFallback);
            pendingRestart = null;
          }, 120);
        }
      }
    };
    const obs = new MutationObserver(() => check());
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // initial check in case lightbox is already open
    check();
    return () => { obs.disconnect(); clearPending(); };
    // keep autoplay in deps so resuming matches user preference
  }, [autoplay, autoplayDelay, slides.length]);

  function startAutoplay() {
  if (DEBUG_DISABLE_AUTOPLAY) { dbg('startAutoplay skipped (DEBUG_DISABLE_AUTOPLAY)'); return; }
  // backwards-compatible: optional first arg may be passed by caller to set starting index
  const args = Array.prototype.slice.call(arguments);
  const n = slides.length || 1;
  const defaultIdx = ((virtualIndexRef.current % n) + n) % n;
  const startIdx = typeof args[0] === 'number' ? args[0] : defaultIdx;
  dbg('startAutoplay', { index: startIdx, autoplayDelay });
  if (pausedRef.current) { dbg('startAutoplay blocked (paused)'); return; }
  if (!allowAutoplayStartRef.current) { dbg('startAutoplay blocked (not allowed yet)'); return; }
    stopAutoplay();
    // ensure indexRef matches the starting index immediately to avoid races
    indexRef.current = startIdx;
    animateProgressBar(startIdx);
    autoplayRef.current = setInterval(() => {
      dbg('autoplay tick -> goNext');
      goNext();
    }, autoplayDelay);
  }

  function stopAutoplay() {
    dbg('stopAutoplay');
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
    // clear progress transitions
    progressRefs.current.forEach((el) => {
      if (el) { el.style.transition = 'none'; el.style.width = '0%'; }
    });
  }

  function animateProgressBar(i) {
    const el = progressRefs.current[i];
    if (!el) return;
    // reset then animate
    el.style.transition = 'none';
    el.style.width = '0%';
    // next tick
    requestAnimationFrame(() => {
      el.style.transition = `width ${autoplayDelay}ms linear`;
      el.style.width = '100%';
    });
  }

  function resetProgressBars() {
    progressRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.width = i === index && autoplay ? '100%' : '0%';
    });
    if (autoplay) animateProgressBar(index);
  }

  function goNext(force = false) {
  dbg('goNext start', { virtual: virtualIndexRef.current, force });
  if (pausedRef.current && !force) { dbg('goNext blocked (paused)'); return; }
  try { if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) { dbg('goNext blocked by lightbox'); return; } } catch (e) {}
  virtualIndexRef.current = virtualIndexRef.current + 1;
  const newIndex = ((virtualIndexRef.current % slides.length) + slides.length) % slides.length;
  dbg('goNext ->', { virtual: virtualIndexRef.current, index: newIndex });
  safeSetIndex(newIndex, force);
  }
  function goPrev(force = false) {
  dbg('goPrev start', { virtual: virtualIndexRef.current, force });
  if (pausedRef.current && !force) { dbg('goPrev blocked (paused)'); return; }
  try { if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) { dbg('goPrev blocked by lightbox'); return; } } catch (e) {}
  virtualIndexRef.current = virtualIndexRef.current - 1;
  const newIndex = ((virtualIndexRef.current % slides.length) + slides.length) % slides.length;
  dbg('goPrev ->', { virtual: virtualIndexRef.current, index: newIndex });
  safeSetIndex(newIndex, force);
  }

  // ensure virtual index stays within the middle clone; snap without transition when crossing
  useEffect(() => {
    const n = slides.length || 0;
    if (n === 0) return;
    const handle = () => {
      const v = virtualIndexRef.current;
      const block = Math.floor(v / n);
      // target middle block index
      const middle = Math.floor(CLONES / 2);
      if (block !== middle) {
        // compute equivalent index in middle block
        const inBlock = ((v % n) + n) % n;
        const target = middle * n + inBlock;
        // snap without transition
        setNoTransition(true);
        virtualIndexRef.current = target;
        // force a reflow then re-enable transition on next frame
        requestAnimationFrame(() => {
          // small timeout to ensure DOM updates
          setTimeout(() => setNoTransition(false), 20);
        });
      }
    };
    // listen to transition end on the track to check snapping
    const track = wrapRef.current ? wrapRef.current.querySelector('.post-carousel-track') : null;
    if (track) track.addEventListener('transitionend', handle);
    return () => { if (track) track.removeEventListener('transitionend', handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  function onPointerDown(e) {
  dbg('onPointerDown', { target: e.target && e.target.className, pointerId: e.pointerId, clientX: e.clientX });
  if (pausedRef.current) { dbg('onPointerDown blocked (paused)'); return; }
  try { if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) return; } catch (err) {}
    // ignore interactions that start on images or interactive elements
    try {
      const t = e.target;
      if (t && t.closest && t.closest('.post-carousel-image, [role="button"]')) return;
    } catch (err) {
      // ignore
    }
    touchRef.current.startX = e.clientX;
    touchRef.current.startY = e.clientY;
    touchRef.current.moving = true;
    touchRef.current.pointerId = e.pointerId;
    // capture the pointer so move/up pair with this element
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { }
    }
    if (autoplay) {
      stopAutoplay();
      pauseForInteraction();
    }
  }

  function onPointerMove(e) {
  dbg('onPointerMove', { clientX: e.clientX, pointerId: e.pointerId });
  if (pausedRef.current) { dbg('onPointerMove blocked (paused)'); return; }
  try { if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) return; } catch (err) {}
    if (!touchRef.current.moving) return;
    // ensure this move belongs to the captured pointer
    if (touchRef.current.pointerId != null && e.pointerId !== touchRef.current.pointerId) return;
    const dx = e.clientX - touchRef.current.startX;
    if (Math.abs(dx) > 40) {
      touchRef.current.moving = false;
      // release pointer capture
      if (e.currentTarget && e.currentTarget.releasePointerCapture && touchRef.current.pointerId != null) {
        try { e.currentTarget.releasePointerCapture(touchRef.current.pointerId); } catch (err) { }
      }
      touchRef.current.pointerId = null;
      if (dx > 0) goPrev(); else goNext();
    }
  }

  function onPointerUp(e) {
  dbg('onPointerUp', { clientX: e.clientX, pointerId: e.pointerId });
  if (pausedRef.current) { dbg('onPointerUp blocked (paused)'); return; }
  try { if (typeof document !== 'undefined' && document.body && document.body.classList.contains('lightbox-open')) return; } catch (err) {}
    // ensure this up belongs to the captured pointer, or ignore
    if (touchRef.current.pointerId != null && e.pointerId !== touchRef.current.pointerId) return;
    if (!touchRef.current.moving) {
      // still release pointer capture if any
      if (e.currentTarget && e.currentTarget.releasePointerCapture && touchRef.current.pointerId != null) {
        try { e.currentTarget.releasePointerCapture(touchRef.current.pointerId); } catch (err) { }
      }
      touchRef.current.pointerId = null;
      return;
    }
    const dx = e.clientX - touchRef.current.startX;
    const dy = e.clientY - touchRef.current.startY;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      // treat as tap: if center slide clicked, open lightbox
      const rect = e.currentTarget.getBoundingClientRect ? e.currentTarget.getBoundingClientRect() : null;
      if (rect) {
        // determine if click was near center
        const cx = rect.left + rect.width / 2;
          if (Math.abs(e.clientX - cx) < rect.width * 0.45) {
            // open lightbox for current slide (respect disableLightbox)
            const slide = slides[index];
            if (openLightbox && !disableLightbox && slide) openLightbox({ src: slide.src, alt: slide.alt || '', caption: slide.caption || null });
          }
      }
    }
    touchRef.current.moving = false;
    if (e.currentTarget && e.currentTarget.releasePointerCapture && touchRef.current.pointerId != null) {
      try { e.currentTarget.releasePointerCapture(touchRef.current.pointerId); } catch (err) { }
    }
    touchRef.current.pointerId = null;
  if (autoplay) startAutoplay(indexRef.current);
  }

  if (!slides || slides.length === 0) return null;

  return (
    <div className="post-carousel-wrap">
      <div
        className="post-carousel-3d"
        ref={wrapRef}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
  onMouseEnter={(e) => { if (e && e.isTrusted) pauseForInteraction(); }}
  onMouseLeave={(e) => { if (e && e.isTrusted) pauseForInteraction(500); }}
  onFocus={(e) => { if (e && e.isTrusted) pauseForInteraction(); }}
  onBlur={(e) => { if (e && e.isTrusted) pauseForInteraction(500); }}
        style={{ height: '56vh' }}
      >
        {/* simple horizontal track with clones for looping */}
        <div
          className="post-carousel-track"
          style={{
            display: 'flex',
            height: '100%',
            transform: (() => {
              const n = slides.length || 0;
              if (n === 0) return 'translateX(0)';
              const virtual = virtualIndexRef.current;
              // if we've measured slide widths, compute offsets across the repeated blocks
              if (slideWidths && slideWidths.length === n) {
                const wrapRect = wrapRef.current ? wrapRef.current.getBoundingClientRect() : { width: window.innerWidth };
                const wrapW = wrapRect.width;
                // build offsets for one block
                const baseOffsets = [];
                let acc = 0;
                for (let i = 0; i < slideWidths.length; i++) {
                  baseOffsets.push(acc);
                  acc += slideWidths[i] || 0;
                }
                const blockWidth = acc;
                // compute offset for virtual index across repeated blocks
                const blockIndex = Math.floor(virtual / n);
                const inBlockIndex = virtual % n;
                const offsets = blockIndex * blockWidth + baseOffsets[inBlockIndex];
                const centerOffset = (wrapW - (slideWidths[inBlockIndex] || 0)) / 2;
                const tx = offsets - centerOffset;
                return `translateX(-${tx.toFixed(3)}px)`;
              }
              // fallback: percent translate based on virtual index
              if (!slideWidthPx) return `translateX(-${(virtual) * slidePercent}%)`;
              const wrapRect = wrapRef.current ? wrapRef.current.getBoundingClientRect() : { width: window.innerWidth };
              const wrapW = wrapRect.width;
              const slidePlusGap = slideWidthPx; // no gap
              const centerOffset = Math.round((wrapW - slideWidthPx) / 2);
              const tx = Math.round(virtual * slidePlusGap - centerOffset);
              return `translateX(-${tx}px)`;
            })(),
            transition: noTransition ? 'none' : `transform ${TRANSITION_MS}ms cubic-bezier(.2,.9,.2,1)`
          }}
        >
          {Array.from({ length: CLONES }).map((_, block) => (
            slides.map((s, i) => {
              const vi = block * slides.length + i; // virtual index for this slide
              const activeVirtual = virtualIndexRef.current;
              const isActive = vi === activeVirtual;
              const isPrev = vi === activeVirtual - 1;
              const isNext = vi === activeVirtual + 1;
              const interactive = isActive || isPrev || isNext;
              // cursor: left or right arrows on side images; default cursor on active
              const cursorStyle = isPrev ? 'w-resize' : (isNext ? 'e-resize' : 'default');
              return (
                <div
                  key={`${block}-${i}`}
                  className={`post-carousel-slide-3d ${isPrev ? 'is-prev' : ''} ${isNext ? 'is-next' : ''}`}
                  style={{
                    position: 'relative',
                    flex: '0 0 auto',
                    boxSizing: 'border-box',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: interactive ? 'auto' : 'none'
                  }}
                >
                  <img
                    ref={(el) => { if (block === 1) imageRefs.current[i] = el; }}
                    src={s.src}
                    alt={s.alt || ''}
                    className="post-carousel-image"
                    // only mark side images as buttons so the center slide doesn't pick up
                    // global img[role="button"] styles (the white plus cursor/overlay)
                    role={(isPrev || isNext) ? 'button' : undefined}
                    tabIndex={(isPrev || isNext) ? 0 : undefined}
                    aria-label={isPrev ? 'Previous slide' : isNext ? 'Next slide' : undefined}
                    // cursor handled via CSS classes (.is-prev / .is-next) so custom SVG cursors can apply
                    onLoad={() => { requestAnimationFrame(measureSlides); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // side images navigate; center opens lightbox (unless disabled)
                      if (isPrev) { goPrev(true); }
                      else if (isNext) { goNext(true); }
                      else if (openLightbox && !disableLightbox) { openLightbox({ src: s.src, alt: s.alt || '', caption: s.caption || null }); }
                    }}
                    onKeyDown={(e) => {
                      if (!interactive) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                          if (isPrev) { goPrev(true); }
                          else if (isNext) { goNext(true); }
                        else if (openLightbox && !disableLightbox) { openLightbox({ src: s.src, alt: s.alt || '', caption: s.caption || null }); }
                      }
                    }}
                    onMouseEnter={(e) => { if (e && e.isTrusted) pauseForInteraction(); }}
                    onMouseLeave={(e) => { if (e && e.isTrusted) pauseForInteraction(500); }}
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onPointerMove={(e) => { e.stopPropagation(); }}
                    onPointerUp={(e) => { e.stopPropagation(); }}
                  />
          {/* centered plus overlay (matches site lightbox +/X size: 48x48)
            Render only on side images (prev/next), not on the active center slide */}
                  {/* overlay removed: no plus/X glyph shown on slides */}
                </div>
              );
            })
          ))}
        </div>
      </div>

      <div className="post-carousel-progress">
        {slides.map((_, i) => (
          <div key={i} className="post-carousel-progress-item">
            <div
              ref={(el) => (progressRefs.current[i] = el)}
              className="post-carousel-progress-bar"
            />
          </div>
        ))}
      </div>
      {showControls && (
        <div className="post-carousel-controls" style={{ pointerEvents: 'auto', zIndex: 9999 }}>
          <button className="post-carousel-prev" onClick={() => { goPrev(true); if (autoplay) startAutoplay(indexRef.current); }} aria-label="Previous">‹</button>
          <button className="post-carousel-next" onClick={() => { goNext(true); if (autoplay) startAutoplay(indexRef.current); }} aria-label="Next">›</button>
        </div>
      )}
    </div>
  );
}
