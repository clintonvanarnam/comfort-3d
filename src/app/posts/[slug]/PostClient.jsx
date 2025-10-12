'use client';

import { useEffect, useState, useRef } from 'react';
import { getPostBySlug } from '@/lib/getPosts';
import { useParams } from 'next/navigation';
import { PortableText } from '@portabletext/react';
import client from '@/lib/sanity';
import gsap from 'gsap';
import NavBar from '@/components/NavBar';
import PostCarousel from '@/components/PostCarousel';
import RelatedContent from '@/components/RelatedContent';
import { getPosts } from '@/lib/getPosts';

export default function PostPage() {
  const params = useParams();
  const [post, setPost] = useState(null);
  const [transitionDone, setTransitionDone] = useState(false);
  const transitionImageRef = useRef();
  const contentRef = useRef();
  const [floatingVisible, setFloatingVisible] = useState(false);
  const headerRef = useRef(null);
  const [headerOut, setHeaderOut] = useState(false);
  const [relatedInView, setRelatedInView] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  // track whether the header has ever been observed in-view; this prevents
  // immediately treating it as "out" on the first observer callback which
  // may report ratio=0 when the page loads or when layout shifts happen.
  const headerSeenRef = useRef(false);
  const headerOutTimerRef = useRef(null);

  // Cleanup effect for iOS memory management
  useEffect(() => {
    return () => {
      // Clear any pending timers
      if (headerOutTimerRef.current) {
        clearTimeout(headerOutTimerRef.current);
        headerOutTimerRef.current = null;
      }

      // Kill GSAP animations more selectively
      if (typeof gsap !== 'undefined') {
        // Kill animations on elements that might be in this component
        gsap.killTweensOf('.floating-nav');
        gsap.killTweensOf('[data-post-client]');
      }

      // Clear speech synthesis if active
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // Reset body cursor and classes
      try {
        document.body.classList.remove('lightbox-open');
        document.body.style.cursor = '';
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    async function loadPost() {
      const fetched = await getPostBySlug(params.slug);
      setPost(fetched);
      // Update the browser title on the client so the
      // tab shows the article title immediately even if server metadata isn't applied.
      try {
  const siteSuffix = 'COMFORT';
  // Prefer author for the page title (Author | Comfort), fall back to fetched title, then siteSuffix
  const pageTitle = fetched?.author ? `${fetched.author} | ${siteSuffix}` : (fetched?.title ? `${fetched.title} | ${siteSuffix}` : siteSuffix);
  document.title = pageTitle;
      } catch (e) {
        // noop
      }
    }
    loadPost();
  }, [params.slug]);

  // Safari detection for image stabilization
  useEffect(() => {
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);
    if (isSafariBrowser) {
      document.body.classList.add('safari-browser');
    }
  }, []);

  useEffect(() => {
    const data = sessionStorage.getItem('transitionPost');
    if (data) {
      const { slug, image } = JSON.parse(data);
      if (slug === params.slug && transitionImageRef.current) {
        const el = transitionImageRef.current;

        el.src = image;
        el.style.display = 'block';

        gsap.fromTo(
          el,
          {
            scale: 1,
            opacity: 1,
          },
          {
            scale: 0.5,
            opacity: 0,
            duration: 1.2,
            ease: 'power3.inOut',
            onComplete: () => {
              el.style.display = 'none';
              setTransitionDone(true);
              sessionStorage.removeItem('transitionPost');

              // Animate content upward
              if (contentRef.current) {
                gsap.fromTo(
                  contentRef.current,
                  { y: 50, opacity: 0 },
                  { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' }
                );
              }
            },
          }
        );
      } else {
        setTransitionDone(true);
      }
    } else {
      setTransitionDone(true);
    }
  }, [params.slug]);

  const [urlFor, setUrlFor] = useState(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [preloadHref, setPreloadHref] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState(null); // { src, alt, caption }
  const lightboxRef = useRef();
  const lightboxImgRef = useRef();

  useEffect(() => {
    let mounted = true;
    // dynamic import so build doesn't fail if the package isn't installed
    import('@sanity/image-url')
      .then((mod) => {
        if (!mounted) return;
        const builder = mod.default(client);
        setUrlFor(() => (source) => builder.image(source).auto('format').fit('clip'));
      })
      .catch(() => {
        // ignore: we'll fallback to value.asset?.url when builder isn't available
      });
    return () => {
      mounted = false;
    };
  }, []);

  // entrance animations once the transition image animation is complete
  useEffect(() => {
    // wait for the post to be loaded and the transition to complete
    if (!transitionDone || !post) return;
    // ensure we pass the actual DOM node as the scope
    const scope = contentRef.current || undefined;
    const ctx = gsap.context(() => {
      // debugging: confirm the effect runs (dev-only)
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('GSAP entrance animation triggered for', params?.slug || post?.slug);
      }

      // ensure known start state so animations are visible even if CSS changed
  gsap.set(['.post-main-image'], { y: 24, opacity: 0 });
  gsap.set(['.post-title'], { y: 100, opacity: 0 });
  gsap.set(['.post-author'], { y: 20, opacity: 0 });
  gsap.set(['.post-body'], { y: 20, opacity: 0 });

      const tl = gsap.timeline();
      // animate the hero image upward (translateY only, no scale)
      tl
        .to('.post-title', { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, '-=0.45')        
        .to('.post-author', { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, '-=0.4')
        .to('.post-main-image', { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, '-=0.4')
        .to('.post-body', { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.45')
        .call(() => {
          // Dispatch page ready event after entrance animation completes
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('page:ready'));
          }
        });
    }, scope);
    return () => ctx.revert();
  }, [transitionDone, post]);

  // Show floating side labels only after the header/main image has scrolled out of view
  // and hide them again once the related-content section is reached.
  useEffect(() => {
    if (!post) return;

    const headerNode = document.querySelector('.post-main-image');
    const relatedNode = document.querySelector('.related-content-outer');

    // debug: report whether nodes are present when effect runs (dev-only)
    if (process.env.NODE_ENV !== 'production') {
      try {
        // use console.log so it's visible in devtools by default
        console.log('floating-debug: effect init', { headerNode: Boolean(headerNode), relatedNode: Boolean(relatedNode) });
      } catch (e) {}
    }

    // If there's no header image, consider it already scrolled out so labels can appear
      if (!headerNode) {
        // If headerNode is unexpectedly missing, log for debugging and set headerOut (dev-only)
        if (process.env.NODE_ENV !== 'production') {
          try { console.log('floating-debug: no headerNode found — setting headerOut=true'); } catch (e) {}
        }
        setHeaderOut(true);
      }

  // Use a conservative scroll/resize check to decide when the header has
    // been fully scrolled past. This avoids noisy intersectionRatio changes
    // that occur during fast scrolling and layout churn.
  let rafId = null;
  let relatedObserver = null;
    const checkHeaderOut = () => {
      rafId = null;
      try {
        const node = document.querySelector('.post-main-image');
        if (!node) {
          // No header image — consider it out
          headerSeenRef.current = true;
          setHeaderOut(true);
          return;
        }
        const rect = node.getBoundingClientRect();
        // header is considered 'out' when its bottom is at or above the
        // top of the viewport (scrolled past)
        const out = rect.bottom <= 0;
        if (out) headerSeenRef.current = true;
        // cancel any pending debounce timer and set headerOut directly
        if (headerOutTimerRef.current) {
          clearTimeout(headerOutTimerRef.current);
          headerOutTimerRef.current = null;
        }
        setHeaderOut(out);
        if (process.env.NODE_ENV !== 'production') {
          try { console.log('floating-debug: checkHeaderOut', { bottom: rect.bottom, out }); } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    };

    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(checkHeaderOut);
    };

    // run once immediately to establish starting state
    onScrollOrResize();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('orientationchange', onScrollOrResize);

    if (relatedNode) {
      relatedObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // relatedInView is true when any part of the related content enters the viewport
            if (process.env.NODE_ENV !== 'production') {
              try { console.log('floating-debug: relatedObserver', { isIntersecting: entry.isIntersecting, ratio: entry.intersectionRatio }); } catch (e) {}
            }
            setRelatedInView(entry.isIntersecting && entry.intersectionRatio > 0);
          });
        },
        { root: null, threshold: [0, 0.01, 0.25] }
      );
      relatedObserver.observe(relatedNode);
    }

    return () => {
      try { window.removeEventListener('scroll', onScrollOrResize); } catch (e) {}
      try { window.removeEventListener('resize', onScrollOrResize); } catch (e) {}
      try { window.removeEventListener('orientationchange', onScrollOrResize); } catch (e) {}
      try { if (rafId) cancelAnimationFrame(rafId); } catch (e) {}
      try { if (headerOutTimerRef.current) { clearTimeout(headerOutTimerRef.current); headerOutTimerRef.current = null; } } catch (e) {}
      try { if (relatedObserver) relatedObserver.disconnect(); } catch (e) {}
    };
  }, [post]);

  // derive the visible state from headerOut and relatedInView so labels hide
  // once related content appears.
  useEffect(() => {
  const visible = Boolean(headerOut && !relatedInView);
  if (process.env.NODE_ENV !== 'production') {
    try { console.log('floating-debug: derived visible', { headerOut, relatedInView, visible }); } catch (e) {}
  }
  setFloatingVisible(visible);
  }, [headerOut, relatedInView]);

  // animate multi-image items on scroll using GSAP ScrollTrigger
  useEffect(() => {
    if (!post) return;
    if (typeof window === 'undefined') return;
    // respect prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let mounted = true;
    let ScrollTrigger;

    const setup = async () => {
      try {
        const mod = await import('gsap/ScrollTrigger');
        ScrollTrigger = mod.ScrollTrigger || mod.default || mod;
        gsap.registerPlugin(ScrollTrigger);
      } catch (e) {
        // if ScrollTrigger isn't available, bail
        return;
      }

      if (!mounted) return;

      const ctx = gsap.context(() => {
        // include multi-image grid items plus inline images and imageWithCaption images
        const selector = '.multi-image-item, .post-body-image, .post-body-figure .post-body-image';
        const nodes = gsap.utils.toArray(selector);
        nodes.forEach((el, i) => {
          // skip the hero/main image which is handled elsewhere
          if (el.classList && el.classList.contains('post-main-image')) return;

          // normalize target: animate the element itself (figure or img)
          const target = el;

          gsap.fromTo(
            target,
            { y: 50, opacity: 0.95 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: target,
                start: 'top 85%',
                end: 'bottom 60%',
                scrub: true,
                // markers: true,
              },
            }
          );
        });
      }, contentRef);

      // cleanup when unmounting or post changes
      return () => {
        try { ctx.revert(); } catch (e) {}
        try { ScrollTrigger && ScrollTrigger.kill(); } catch (e) {}
      };
    };

    let cleanupFn;
    setup().then((maybeCleanup) => {
      if (typeof maybeCleanup === 'function') cleanupFn = maybeCleanup;
    });

    return () => {
      mounted = false;
      if (cleanupFn) cleanupFn();
    };
  }, [post]);

  // preload the hero image early to reduce perceived load time
  useEffect(() => {
    if (!post) return;
    const widths = [480, 768, 1024, 1365, 1600, 2000, 2400];
    let href = null;
    if (urlFor) {
      try {
        href = urlFor(post.mainImage).width(1365).url();
      } catch (e) {
        href = post.mainImage?.asset?.url || null;
      }
    } else {
      href = post.mainImage?.asset?.url || null;
    }
    if (!href) return;
    setPreloadHref(href);
  }, [post, urlFor]);

  // lightbox handlers
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && lightboxOpen) closeLightbox();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  function openLightbox({ src, alt = '', caption = null }) {
    setLightboxData({ src, alt, caption });
    setLightboxOpen(true);
    // ensure the cursor updates immediately (some browsers only change
    // cursors on mousemove when elements mount). Set body cursor and a
    // class to allow CSS transitions on the visible plus overlay.
    try {
      document.body.classList.add('lightbox-open');
      document.body.offsetWidth;
      const xCursor = "url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 48 48\'><rect x=\'22\' y=\'6\' width=\'4\' height=\'36\' fill=\'white\' transform=\'rotate(45 24 24)\'/><rect x=\'6\' y=\'22\' width=\'36\' height=\'4\' fill=\'white\' transform=\'rotate(45 24 24)\'/></svg>') 24 24, pointer";
      document.body.style.cursor = xCursor;
      if (lightboxRef.current) {
        lightboxRef.current.style.cursor = xCursor;
      }
    } catch (e) {}
    // animate in after next tick
    requestAnimationFrame(() => {
      const overlay = lightboxRef.current;
      const img = lightboxImgRef.current;
      if (!overlay || !img) return;
      gsap.set(overlay, { autoAlpha: 0 });
      gsap.set(img, { scale: 0.95 });
      gsap.to(overlay, { autoAlpha: 1, duration: 0.28, ease: 'power1.out' });
      gsap.to(img, { scale: 1, duration: 0.45, ease: 'power3.out' });
    });
  }

  function closeLightbox() {
    const overlay = lightboxRef.current;
    const img = lightboxImgRef.current;
    if (!overlay || !img) {
      setLightboxOpen(false);
      setLightboxData(null);
      try {
        document.body.classList.remove('lightbox-open');
        document.body.style.cursor = '';
        if (lightboxRef.current) {
          lightboxRef.current.style.cursor = '';
        }
      } catch (e) {}
      return;
    }
    gsap.to(img, { scale: 0.95, duration: 0.28, ease: 'power2.in' });
    gsap.to(overlay, {
      autoAlpha: 0,
      duration: 0.28,
      ease: 'power1.in',
      onComplete: () => {
        setLightboxOpen(false);
        setLightboxData(null);
        try {
          document.body.classList.remove('lightbox-open');
          document.body.style.cursor = '';
        } catch (e) {}
      },
    });
  }

  if (!post) return <div></div>;

  return (
    <>
  <div className="post-page">
  <NavBar />
  {/* Desktop-only floating side labels: left = title, right = author */}
  <div aria-hidden className={`floating-side floating-title-left ${floatingVisible ? 'visible' : 'hidden'}`}>{post.title}</div>
  <div aria-hidden className={`floating-side floating-author-right ${floatingVisible ? 'visible' : 'hidden'}`}>{post.author}</div>
      {/* Floating image transition layer */}
      <img
        ref={transitionImageRef}
        alt=""
        className="post-transition-img"
      />

      {/* Actual Post Content */}
      <div
        ref={contentRef}
        className={`post-content ${transitionDone ? 'is-visible' : ''}`}
      >

        <div className="post-header">
          <div className="post-meta-row">
            <h1 className="post-title">{post.title}</h1>
            <h2 className="post-author">{post.author}</h2>
          </div>

          {post.mainImage && (
            <figure className="post-main-figure">
              {/* main image */}
                {(() => {
                  // build responsive srcset when urlFor is available
                  const widths = [480, 768, 1024, 1365, 1600, 2000, 2400];
                  const assetUrl = post.mainImage.asset?.url || null;
                  let src = assetUrl || '';
                  let srcSet = null;
                  if (urlFor) {
                    try {
                      // ensure we use the image builder chained for each width
                      srcSet = widths
                        .map((w) => `${urlFor(post.mainImage).width(w).url()} ${w}w`)
                        .join(', ');
                      // choose a sensible default src (HD quality)
                      src = urlFor(post.mainImage).width(1920).url();
                    } catch (e) {
                      srcSet = null;
                    }
                  }

                  const lqip = post.mainImage.asset?.metadata?.lqip || null;
                  // Get dimensions for Safari stabilization
                  const w = post.mainImage.asset?.metadata?.dimensions?.width || 1365;
                  const h = post.mainImage.asset?.metadata?.dimensions?.height || 910;

                  return (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {/* Safari-specific placeholder */}
                      {!heroLoaded && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: lqip ? `url(${lqip}) center/cover` : '#f0f0f0',
                          filter: isSafari ? 'none' : (lqip ? 'blur(8px)' : 'none'),
                          zIndex: 1,
                        }} />
                      )}
                      <img
                        src={src}
                        {...(srcSet ? { srcSet } : {})}
                        sizes="100vw"
                        alt={post.mainImage.alt || post.title}
                        className={`post-main-image flip-image ${heroLoaded ? 'is-loaded' : 'not-loaded'}`}
                        loading="eager"
                        fetchPriority="high"
                        decoding={isSafari ? "sync" : "async"}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: 'auto',
                          position: 'relative',
                          zIndex: 2,
                          background: lqip ? `url(${lqip}) center/cover` : undefined,
                        }}
                        onLoad={() => setHeroLoaded(true)}
                        onClick={(e) => {
                          e.stopPropagation();
                          const imgSrc = src;
                          openLightbox({ src: imgSrc, alt: post.mainImage.alt || post.title, caption: post.mainImage.caption || null });
                        }}
                        role="button"
                        tabIndex={0}
                      />
                    </div>
                  );
                })()}
              {/* caption (rich text) */}
              {post.mainImage.caption && (
                <figcaption className="post-main-caption">
                  <PortableText value={post.mainImage.caption} />
                </figcaption>
              )}
            </figure>
          )}

          
        </div>

        <div className="post-body">
          <PortableText
            value={post.body}
            components={{
              types: {
                image: ({ value }) => {
                  if (!value) return null;
                  // Prefer direct URL if available, otherwise build one when available
                  let src = value.asset?.url || null;
                  if (!src && urlFor) {
                    try {
                      src = urlFor(value).width(1920).url();
                    } catch (e) {
                      src = null;
                    }
                  }
                  if (!src) return null;
                  const alt = value.alt || post.title || '';
                  return (
                    <img
                      src={src}
                      alt={alt}
                      className="post-body-image"
                      role="button"
                      tabIndex={0}
                      loading={isSafari ? "eager" : "lazy"}
                      decoding={isSafari ? "sync" : "async"}
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox({ src, alt });
                      }}
                    />
                  );
                },
                // Serializer for the custom imageWithCaption type in blockContent
                imageWithCaption: ({ value }) => {
                  if (!value) return null;
                  let src = value.asset?.url || null;
                  if (!src && urlFor) {
                    try {
                      src = urlFor(value).width(1920).url();
                    } catch (e) {
                      src = null;
                    }
                  }
                  if (!src) return null;
                  const alt = value.alt || post.title || '';
                  const isFull = value.display === 'fullWidth';
                  const isFullHeight = Boolean(value.fullHeight);
                  const isWideMargins = Boolean(value.wideMargins);
                  // Get dimensions for Safari stabilization
                  const w = value.asset?.metadata?.dimensions?.width || 1200;
                  const h = value.asset?.metadata?.dimensions?.height || 800;

                  return (
                    <figure className={`post-body-figure ${isFull ? 'fullwidth' : ''} ${isFullHeight ? 'fullheight' : ''} ${isWideMargins ? 'wide-margins' : ''}`}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        {/* Safari-specific placeholder */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: '#f0f0f0',
                          zIndex: 1,
                        }} />
                        <img
                          src={src}
                          alt={alt}
                          className={`post-body-image ${isFull ? 'fullwidth' : ''} ${isFullHeight ? 'fullheight' : ''} ${isWideMargins ? 'wide-margins' : ''}`}
                          role="button"
                          tabIndex={0}
                          loading={isSafari ? "eager" : "lazy"}
                          decoding={isSafari ? "sync" : "async"}
                          style={{
                            display: 'block',
                            width: '100%',
                            height: 'auto',
                            position: 'relative',
                            zIndex: 2,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox({ src, alt, caption: value.caption || null });
                          }}
                        />
                      </div>
                      {value.caption && (
                        <figcaption className="post-body-caption">
                          <PortableText value={value.caption} />
                        </figcaption>
                      )}
                    </figure>
                  );
                },
                // Removed twoImageSpread: prefer multiImageSpread or imageWithCaption
                multiImageSpread: ({ value }) => {
                  if (!value || !Array.isArray(value.images) || value.images.length === 0) return null;
                  const gutter = (typeof value.gutter === 'number') ? value.gutter : 12;
                  const imgCount = Array.isArray(value.images) ? value.images.length : 0;
                  const cols = Math.min(Math.max(imgCount, 1), 4); // 1-4 columns
                  const isGrid = cols > 1;

                  const buildSrc = (img) => {
                    if (!img) return null;
                    let src = img.asset?.url || null;
                    if (!src && urlFor) {
                      try {
                        src = urlFor(img).width(1920).url();
                      } catch (e) {
                        src = null;
                      }
                    }
                    return src;
                  };

                  const padTopToken = value.paddingTopToken || 'space-md';
                  const padBottomToken = value.paddingBottomToken || 'space-md';
                  const padTopVar = `var(--${padTopToken})`;
                  const padBottomVar = `var(--${padBottomToken})`;

                  // Render as either an auto grid (N columns) or a vertical stack for single image
                  // Build captions but skip spacer items entirely so they don't get numbers/captions
                  const captions = value.images.map((img) => {
                    if (!img) return null;
                    if (img._type === 'spacer') return null; // explicit spacer: no caption or number
                    // prefer explicit caption rich text, fallback to credit or empty
                    if (img.caption) return img.caption;
                    if (img.credit) return [{ _type: 'block', children: [{ text: img.credit }] }];
                    return null;
                  });

                  // only show the captions list if there is at least one non-empty caption (excluding spacers)
                  const visibleCaptions = captions
                    .map((cap, idx) => ({ cap, idx }))
                    .filter((c) => {
                      if (!c.cap) return false;
                      if (Array.isArray(c.cap)) return c.cap.length > 0;
                      return true;
                    });
                  const hasCaptions = visibleCaptions.length > 0;

                  // compute aspect ratios for images where possible so spacers can match
                  const aspectRatios = value.images.map((img) => {
                    if (!img || img._type === 'spacer') return null;
                    const w = img?.asset?.metadata?.dimensions?.width;
                    const h = img?.asset?.metadata?.dimensions?.height;
                    if (w && h) return w / h;
                    return null;
                  });

                  return (
                    <>
                      {/**
                       * Wrapper layout for multi-image spreads.
                       * Always expose the padding CSS variables so downstream
                       * layout can reference them. Use explicit paddingTop on
                       * the wrapper and only omit paddingBottom when captions
                       * exist for a grid (the captions block will provide the
                       * bottom spacing). This ensures spreads without captions
                       * keep their bottom spacing even when `stackOnMobile` is set.
                       */}
                      <div
                        className={`multi-image-spread ${isGrid ? 'auto-columns' : 'vertical-stack'} ${value.stackOnMobile ? 'stack-on-mobile' : ''}`}
                        style={{
                          ['--gutter']: `${gutter}px`,
                          ['--pad-top']: padTopVar,
                          ['--pad-bottom']: padBottomVar,
                          paddingTop: padTopVar,
                          // If captions exist and we're rendering a grid, the
                          // captions list will carry the bottom padding. Otherwise
                          // ensure the wrapper provides bottom padding so the
                          // spread never collapses against following content.
                          ...(hasCaptions && isGrid ? {} : { paddingBottom: padBottomVar }),
                          ...(isGrid ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : {}),
                        }}
                      >
                        {value.images.map((img, i) => {
                          // spacer object (from Sanity schema)
                          if (img && img._type === 'spacer') {
                            // try to use the aspect ratio from the corresponding aspectRatios[i]
                            const ratio = aspectRatios[i] || aspectRatios.find(r => r) || 1.5;
                            const paddingTop = `${(1 / ratio) * 100}%`;
                            return (
                              <figure key={i} className="multi-image-item">
                                <div
                                  className="multi-image-spacer"
                                  style={{ width: '100%', paddingTop }}
                                  aria-hidden="true"
                                />
                              </figure>
                            );
                          }

                          const src = buildSrc(img);
                          if (!src) return null;
                          // Get dimensions for Safari stabilization
                          const w = img?.asset?.metadata?.dimensions?.width || 1200;
                          const h = img?.asset?.metadata?.dimensions?.height || 800;

                          return (
                            <figure key={i} className="multi-image-item">
                              <div style={{ position: 'relative', width: '100%' }}>
                                {/* Safari-specific placeholder */}
                                <div style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: '#f0f0f0',
                                  zIndex: 1,
                                }} />
                                <img
                                  src={src}
                                  alt={img.alt || ''}
                                  className="multi-image-row"
                                  loading={isSafari ? "eager" : "lazy"}
                                  decoding={isSafari ? "sync" : "async"}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    height: 'auto',
                                    position: 'relative',
                                    zIndex: 2,
                                  }}
                                  onClick={(e) => { e.stopPropagation(); openLightbox({ src, alt: img.alt || '', caption: img.caption || null }); }}
                                  role="button"
                                  tabIndex={0}
                                />
                              </div>
                              {/* per-image captions removed — captions are shown in the stacked list below */}
                            </figure>
                          );
                        })}
                      </div>

                      {/* stacked numbered captions that correspond left-to-right with images */}
                      {isGrid && hasCaptions && (
                        <div className="multi-image-captions-list" style={{ paddingBottom: padBottomVar }}>
                              {visibleCaptions.map((item, i) => {
                                const num = String(i + 1).padStart(2, '0');
                                return (
                                  <div key={item.idx} className="multi-image-captions-item">
                                    <span className="multi-image-captions-index">{num}</span>
                                    <span className="multi-image-captions-text"><PortableText value={item.cap} /></span>
                                  </div>
                                );
                              })}
                        </div>
                      )}
                    </>
                  );
                },
                carousel: ({ value }) => {
                  if (!value || !Array.isArray(value.images) || value.images.length === 0) return null;
                  const slides = value.images.map((img) => {
                    const src = img?.asset?.url || (urlFor ? (() => { try { return urlFor(img).width(1200).url(); } catch (e) { return null; } })() : null);
                    return { src, alt: img?.alt || '', caption: img?.caption || null };
                  }).filter(s => s.src);

                  // respect Sanity padding tokens for top/bottom spacing by
                  // wrapping the carousel in a full-bleed container. This keeps
                  // the carousel logic unchanged while honoring editor-controlled spacing.
                  const padTopToken = value.paddingTopToken || 'space-md';
                  const padBottomToken = value.paddingBottomToken || 'space-md';
                  const padTopVar = `var(--${padTopToken})`;
                  const padBottomVar = `var(--${padBottomToken})`;

                  return (
                    <div
                      className="post-carousel-bleed"
                      style={{
                        width: '100vw',
                        maxWidth: '100vw',
                        overflowX: 'hidden',
                        marginLeft: 'calc(50% - 50vw)',
                        marginRight: 'calc(50% - 50vw)',
                        paddingTop: padTopVar,
                        paddingBottom: padBottomVar,
                      }}
                    >
                      <PostCarousel
                        slides={slides}
                        speed={typeof value.speed === 'number' ? value.speed : 1}
                        openLightbox={(opts) => openLightbox(opts)}
                        disableLightbox={true}
                      />
                    </div>
                  );
                },
              },
            }}
          />
        </div>
      </div>

      {/* Lightbox overlay (rendered outside post-content) */}
      {lightboxOpen && (
        <div
          ref={lightboxRef}
          className="post-lightbox-overlay"
          onClick={() => closeLightbox()}
          style={{ display: lightboxOpen ? 'flex' : 'none' }}
        >
          {/* allow clicks anywhere inside the overlay (including the image) to close the lightbox */}
          <div className="post-lightbox-inner">
            <img ref={lightboxImgRef} src={lightboxData?.src} alt={lightboxData?.alt} className="post-lightbox-image" />
            {lightboxData?.caption && <div className="post-lightbox-caption"><PortableText value={lightboxData.caption} /></div>}
          </div>
        </div>
      )}
      </div>

      {/* Related content placed after the post page container and before the footer wrapper */}
      <div className="related-content-outer" aria-label="Related content wrapper">
        <RelatedContent currentSlug={post.slug?.current || post.slug || ''} />
      </div>
    </>
  );
}

// RelatedContent is implemented as a separate component in src/components/RelatedContent.jsx