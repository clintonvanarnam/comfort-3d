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
  const isAnimatingRef = useRef(false);
  const [panelWidth, setPanelWidth] = useState('min(400px, 100vw)');

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Animate panel in
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    isAnimatingRef.current = true;
    gsap.fromTo(el, { x: '100%' }, { x: '0%', duration: 0.45, ease: 'power2.out', onComplete: () => (isAnimatingRef.current = false) });
  }, [open]);

  // Responsive width
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setPanelWidth(w <= 640 ? '100vw' : '400px');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Fetch About content
  useEffect(() => {
    if (!open || (body && status === 'ready')) return;
    setStatus('loading');
    setErrMsg(null);

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/about', { signal: controller.signal });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        const blocks = Array.isArray(data?.body) ? data.body : [];
        if (!blocks.length) throw new Error('No about content');
        setBody(blocks);
        setStatus('ready');
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err);
          setErrMsg(err?.message || 'Failed to load');
          setStatus('error');
        }
      }
    })();

    return () => controller.abort();
  }, [open, body, status]);

  if (!open) return null;

  const ptComponents = {
    block: {
      normal: ({ children }) => (
        <p style={{ margin: '0 0 .9rem', lineHeight: 'normal' }}>{children}</p>
      ),
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483648,
        display: 'flex',
        justifyContent: 'flex-end',
        height: 'calc(100vh + env(safe-area-inset-bottom))',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => {
          if (isAnimatingRef.current) return;
          isAnimatingRef.current = true;
          gsap.to(panelRef.current, {
            x: '100%',
            duration: 0.4,
            ease: 'power2.in',
            onComplete: () => {
              isAnimatingRef.current = false;
              onClose?.();
            },
          });
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
        }}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        style={{
          position: 'relative',
          width: panelWidth,
          height: '100%',
          background: '#000',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          fontSize: '1.25rem',
          overflow: 'hidden',
          zIndex: 2147483649,
            // Ensure black bg covers safe area
            paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button row */}
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              if (isAnimatingRef.current) return;
              isAnimatingRef.current = true;
              gsap.to(panelRef.current, {
                x: '100%',
                duration: 0.4,
                ease: 'power2.in',
                onComplete: () => {
                  isAnimatingRef.current = false;
                  onClose?.();
                },
              });
            }}
            aria-label="Close about"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              fontSize: '1.5rem',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1rem' }}>
          {/* Intentionally do not render a visible "Loading…" string.
              Keep errors visible so users see problems; when content is loading
              we silently fetch and show the content when ready to avoid jarring
              loading screens. */}
          {status === 'error' && <p style={{ color: '#ff6b6b' }}>{errMsg}</p>}
          {status === 'ready' && Array.isArray(body) && (
            <PortableText value={body} components={ptComponents} />
          )}
        </div>

        {/* Logo (bottom of panel, outside scroll area) */}
        <style>{`@keyframes logoBlink{0%,49%{opacity:1}50%,100%{opacity:0}} @media (prefers-reduced-motion: reduce){ .logoBlink{animation:none !important;}}`}</style>
        <div
            style={{
              flexShrink: 0,
              width: '100%',
              background: '#000',
              // Ensure logo/footer bg covers safe area
              paddingTop: 0,
              paddingRight: '1rem',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: '1rem',
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
            }}
        >
          <img
            src="/COMFORT_MAG_LOGO_WHITE.svg"
            alt="COMFORT"
            className="logoBlink"
            style={{ display: 'block', width: 'auto', maxWidth: 280, height: 'auto', animation: 'logoBlink 1s steps(1,start) infinite' }}
          />
        </div>
      </aside>
    </div>
  );
}