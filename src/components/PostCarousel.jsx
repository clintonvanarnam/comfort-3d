"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

// Embla carousel with variable-width slides, progress sync, and lightbox-aware autoplay.
export default function PostCarousel({ slides = [], autoplay = false, autoplayDelay = 4000, showControls = true, openLightbox, disableLightbox = false }) {
  const [selected, setSelected] = useState(0);

  // Keep a stable autoplay plugin instance so we can call play/stop on it later.
  const autoplayPluginRef = useRef(Autoplay({ delay: autoplayDelay, stopOnInteraction: false }));
  const plugins = autoplay ? [autoplayPluginRef.current] : [];

  // Embla options: loop + center alignment. Variable-width mode is achieved by
  // giving slides natural widths (flex: 0 0 auto) in CSS — Embla will measure them.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center", skipSnaps: false }, plugins);
  const emblaApiRef = useRef(null);
  const progressRefs = useRef([]);

  useEffect(() => {
    emblaApiRef.current = emblaApi;
    if (!emblaApi) return;

    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setSelected(idx);
      syncProgress(idx);
    };

    emblaApi.on("select", onSelect);
    // initialize selected state
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emblaApi]);

  // Keyboard nav
  const scrollPrev = useCallback(() => { if (emblaApiRef.current) emblaApiRef.current.scrollPrev(); }, []);
  const scrollNext = useCallback(() => { if (emblaApiRef.current) emblaApiRef.current.scrollNext(); }, []);

  useEffect(() => {
    function onKey(e) {
      if (!emblaApiRef.current) return;
      if (e.key === "ArrowLeft") scrollPrev();
      if (e.key === "ArrowRight") scrollNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollPrev, scrollNext]);

  // Progress bar helpers
  function resetProgress() {
    progressRefs.current.forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.width = "0%";
    });
  }

  function syncProgress(activeIndex) {
    resetProgress();
    const active = progressRefs.current[activeIndex];
    if (!active) return;
    if (!autoplay) return;
    // animate width to 100% over autoplayDelay
    requestAnimationFrame(() => {
      active.style.transition = `width ${autoplayDelay}ms linear`;
      active.style.width = "100%";
    });
  }

  // Observe page-level lightbox via body.lightbox-open and pause autoplay plugin when open.
  useEffect(() => {
    const plugin = autoplayPluginRef.current;
    if (!plugin) return;

    const applyState = () => {
      try {
        const open = typeof document !== "undefined" && document.body.classList.contains("lightbox-open");
        if (open) {
          // pause plugin
          if (plugin.stop) plugin.stop();
          resetProgress();
        } else {
          if (plugin.play) plugin.play();
          // restart progress for current selection
          const idx = emblaApiRef.current ? emblaApiRef.current.selectedScrollSnap() : 0;
          syncProgress(idx);
        }
      } catch (e) {}
    };

    // watch for class changes on body
    if (typeof document !== "undefined" && document.body) {
      const obs = new MutationObserver(applyState);
      obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      // initial apply
      applyState();
      return () => obs.disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  // When autoplayDelay changes, update the plugin object's internal delay if present.
  useEffect(() => {
    const p = autoplayPluginRef.current;
    if (p && p.set) {
      try { p.set({ delay: autoplayDelay }); } catch (e) {}
    }
  }, [autoplayDelay]);

  // When component mounts, if autoplay is enabled start progress animation for the selected slide.
  useEffect(() => {
    if (!autoplay) return;
    const idx = emblaApiRef.current ? emblaApiRef.current.selectedScrollSnap() : 0;
    syncProgress(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, autoplayDelay]);

  if (!slides || slides.length === 0) return null;

  return (
    <div className="post-carousel-wrap">
      <div className="post-carousel-3d embla" ref={emblaRef}>
        <div className="embla__container post-carousel-track">
          {slides.map((s, i) => {
            const prevIndex = (selected - 1 + slides.length) % slides.length;
            const nextIndex = (selected + 1) % slides.length;
            const isPrev = i === prevIndex;
            const isNext = i === nextIndex;
            const isCenter = i === selected;
            const canOpenLightbox = !!openLightbox && !disableLightbox;
            const isInteractiveCenter = isCenter && canOpenLightbox;
            const isInteractive = isPrev || isNext || isInteractiveCenter;
            return (
            <div className={`embla__slide post-carousel-slide-3d ${isPrev ? 'is-prev' : ''} ${isNext ? 'is-next' : ''}`} key={i}>
              <img
                className="post-carousel-image embla__slide__img"
                src={s.src}
                alt={s.alt || ""}
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                aria-label={isPrev ? 'Previous slide' : isNext ? 'Next slide' : isCenter ? 'Open image' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  // side images act as prev/next; center opens lightbox (if allowed)
                  if (isPrev) { if (emblaApiRef.current) emblaApiRef.current.scrollPrev(); }
                  else if (isNext) { if (emblaApiRef.current) emblaApiRef.current.scrollNext(); }
                  else if (isCenter) {
                    if (canOpenLightbox) openLightbox({ src: s.src, alt: s.alt || "", caption: s.caption || null });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isPrev) { if (emblaApiRef.current) emblaApiRef.current.scrollPrev(); }
                    else if (isNext) { if (emblaApiRef.current) emblaApiRef.current.scrollNext(); }
                    else if (isCenter) { if (canOpenLightbox) openLightbox({ src: s.src, alt: s.alt || "", caption: s.caption || null }); }
                  }
                }}
              />
            </div>
          );
          })}
        </div>
      </div>

      {showControls && (
        <div className="post-carousel-controls">
          <button className="post-carousel-prev" onClick={scrollPrev} aria-label="Previous">‹</button>
          <button className="post-carousel-next" onClick={scrollNext} aria-label="Next">›</button>
        </div>
      )}

      <div className="post-carousel-progress" aria-hidden>
        {slides.map((_, i) => (
          <div key={i} className="post-carousel-progress-item"><div ref={(el) => (progressRefs.current[i] = el)} className="post-carousel-progress-bar" /></div>
        ))}
      </div>
    </div>
  );
}
