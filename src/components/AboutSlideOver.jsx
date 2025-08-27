// app/components/AboutSlideOver.jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { PortableText } from '@portabletext/react';

export default function AboutSlideOver({ open, onClose, initialBody = null, initialStatus = 'idle' }) {
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState(initialStatus); // idle | loading | error | ready
  const [errMsg, setErrMsg] = useState(null);
  const panelRef = useRef(null);
  const abortRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const [panelWidth, setPanelWidth] = useState('min(200px, 100vw)');

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // GSAP enter animation on mount
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    isAnimatingRef.current = true;
    gsap.fromTo(
      el,
      { x: '100%' },
      { x: '0%', duration: 0.45, ease: 'power2.out', onComplete: () => (isAnimatingRef.current = false) }
    );
  }, [open]);

  // Responsive width: use full viewport width on small screens
  useEffect(() => {
    const update = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
  // assume "mobile" when viewport is <= 640px
  setPanelWidth(w <= 640 ? '100vw' : '200px');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Fetch About content when opened
  useEffect(() => {
    if (!open) return;

    // if we already have prefetched content, use it and skip fetching
    if (body && status === 'ready') return;

    setStatus('loading');
    setErrMsg(null);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch('/api/about', { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.error('About API non-OK:', res.status, txt);
          throw new Error(`Server error ${res.status}`);
        }
        const data = await res.json();

        const blocks = Array.isArray(data?.body) ? data.body : [];
        if (!blocks.length) {
          setErrMsg('sanity not loaded');
          setStatus('error');
          return;
        }
        setBody(blocks);
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return; // ignore aborts
        console.error('About API error:', err);
        setErrMsg(err?.message || 'Failed to load');
        setStatus('error');
      }
    })();

    return () => controller.abort();
  }, [open]);

  if (!open) return null;

  const ptComponents = {
    block: {
      h1: ({ children }) => <h1 style={{ margin: '1rem 0 .5rem' }}>{children}</h1>,
      h2: ({ children }) => <h2 style={{ margin: '1rem 0 .5rem' }}>{children}</h2>,
  normal: ({ children }) => <p style={{ margin: '0 0 .9rem', lineHeight: 'normal' }}>{children}</p>,
    },
    list: {
      bullet: ({ children }) => <ul style={{ paddingLeft: '1.25rem', margin: '.5rem 0' }}>{children}</ul>,
      number: ({ children }) => <ol style={{ paddingLeft: '1.25rem', margin: '.5rem 0' }}>{children}</ol>,
    },
    listItem: {
      bullet: ({ children }) => <li style={{ margin: '.25rem 0' }}>{children}</li>,
      number: ({ children }) => <li style={{ margin: '.25rem 0' }}>{children}</li>,
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483648,
        display: 'flex',
        justifyContent: 'flex-end',
        pointerEvents: 'auto',
      }}
    >
      {/* Backdrop (click to close) */}
      <div
        onClick={() => {
          // animate out then call onClose
          if (isAnimatingRef.current) return;
          isAnimatingRef.current = true;
          const el = panelRef.current;
          gsap.to(el, {
            x: '100%',
            duration: 0.4,
            ease: 'power2.in',
            onComplete: () => {
              isAnimatingRef.current = false;
              onClose && onClose();
            },
          });
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 2147483648,
          // prevent parent/backdrop filters and blend modes from affecting this overlay
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          mixBlendMode: 'normal',
          WebkitMixBlendMode: 'normal',
          isolation: 'isolate',
        }}
      />

      {/* Panel */}
    <aside
        ref={panelRef}
        style={{
          position: 'relative',
          // width controlled responsively (100vw on mobile, 200px max on desktop)
          width: panelWidth,
          height: '100vh',
          background: '#000',
          color: '#fff',
          boxShadow: 'none',
          // Prevent mix-blend-mode from parent elements affecting this panel
          isolation: 'isolate',
          mixBlendMode: 'normal',
          WebkitMixBlendMode: 'normal',
          padding: '1rem',
          // match post body text size
          fontSize: '1.25rem',
          lineHeight: 'normal',
          overflowY: 'auto',
          zIndex: 2147483649,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button in flow so it lines up with content */}
        <button
          onClick={() => {
            if (isAnimatingRef.current) return;
            isAnimatingRef.current = true;
            const el = panelRef.current;
            gsap.to(el, {
              x: '100%',
              duration: 0.4,
              ease: 'power2.in',
              onComplete: () => {
                isAnimatingRef.current = false;
                onClose && onClose();
              },
            });
          }}
          aria-label="Close about"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 6,
            lineHeight: 1,
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#fff',
            mixBlendMode: 'normal',
            WebkitMixBlendMode: 'normal',
            margin: 0,
            display: 'inline-block',
          }}
        >
          ×
        </button>

        {/* Body */}
        <div style={{ marginTop: '1rem' }}>
          {status === 'loading' && <p style={{ color: '#fff' }}>Loading…</p>}
          {status === 'error' && <p style={{ color: '#ff6b6b' }}>{errMsg}</p>}

          {status === 'ready' && Array.isArray(body) && (
            <>
              <PortableText value={body} components={ptComponents} />

              {/* debug UI removed */}
            </>
          )}
        </div>

        {/* ASCII art footer */}
        <div style={{ paddingTop: '1rem', minHeight: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <pre style={{ color: '#fff', fontFamily: 'var(--font-monument)', fontSize: 'inherit', lineHeight: 'normal', textAlign: 'center', whiteSpace: 'pre' }}>
{`  CCCC   OOO  MM  MM  FFFFF  OOO  RRRR  TTTTT
 C      O   O M MM M  F     O   O R   R   T
 C      O   O M    M  FFF   O   O RRRR    T
 C      O   O M    M  F     O   O R R     T
  CCCC   OOO  M    M  F      OOO  R  R    T`}
          </pre>
        </div>
      </aside>
    </div>
  );
}