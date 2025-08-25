'use client';

import { useEffect, useState, useRef } from 'react';
import { getPostBySlug } from '@/lib/getPosts';
import { useParams } from 'next/navigation';
import { PortableText } from '@portabletext/react';
import client from '@/lib/sanity';
import gsap from 'gsap';
import NavBar from '@/components/NavBar';

export default function PostPage() {
  const params = useParams();
  const [post, setPost] = useState(null);
  const [transitionDone, setTransitionDone] = useState(false);
  const transitionImageRef = useRef();
  const contentRef = useRef();

  useEffect(() => {
    async function loadPost() {
      const fetched = await getPostBySlug(params.slug);
      setPost(fetched);
      // Update the browser title and meta description on the client so the
      // tab shows the article title immediately even if server metadata isn't applied.
      try {
        const siteName = 'COMFORT';
        if (fetched?.title) {
          document.title = `${fetched.title} — ${siteName}`;
        }
        // description: try to extract a short excerpt from the first block
        let desc = '';
        if (fetched?.body && Array.isArray(fetched.body)) {
          const firstText = fetched.body.find(b => b._type === 'block' && Array.isArray(b.children));
          if (firstText) desc = firstText.children.map(c => c.text || '').join(' ').trim().slice(0, 160);
        }
        if (desc) {
          let meta = document.querySelector('meta[name="description"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'description';
            document.head.appendChild(meta);
          }
          meta.content = desc;
        }
        // Open Graph image
        const og = fetched?.mainImage?.asset?.url || null;
        if (og) {
          let ogTag = document.querySelector('meta[property="og:image"]');
          if (!ogTag) {
            ogTag = document.createElement('meta');
            ogTag.setAttribute('property', 'og:image');
            document.head.appendChild(ogTag);
          }
          ogTag.content = og;
        }
      } catch (e) {
        // noop
      }
    }
    loadPost();
  }, [params.slug]);

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
      // debugging: confirm the effect runs
      // eslint-disable-next-line no-console
      console.log('GSAP entrance animation triggered for', params?.slug || post?.slug);

      // ensure known start state so animations are visible even if CSS changed
  gsap.set(['.post-main-image'], { y: 24, opacity: 0 });
  gsap.set(['.post-title'], { y: 30, opacity: 0 });
  gsap.set(['.post-author'], { y: 20, opacity: 0 });
  gsap.set(['.post-body'], { y: 20, opacity: 0 });

      const tl = gsap.timeline();
      // animate the hero image upward (translateY only, no scale)
      tl.to('.post-main-image', { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' })
        .to('.post-title', { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.45')
        .to('.post-author', { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.4')
        .to('.post-body', { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.45');
    }, scope);
    return () => ctx.revert();
  }, [transitionDone, post]);

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
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.setAttribute('data-generated-by', 'post-hero-preload');
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch (e) {}
    };
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
      },
    });
  }

  if (!post) return <div></div>;

  return (
    <div className="post-page">
      <NavBar />
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
                      // choose a sensible default src (medium size)
                      src = urlFor(post.mainImage).width(1365).url();
                    } catch (e) {
                      srcSet = null;
                    }
                  }

                  const lqip = post.mainImage.asset?.metadata?.lqip || null;

                  return (
                    <img
                      src={src}
                      {...(srcSet ? { srcSet } : {})}
                      sizes="100vw"
                      alt={post.mainImage.alt || post.title}
                      className={`post-main-image flip-image ${heroLoaded ? 'is-loaded' : 'not-loaded'}`}
                      loading="eager"
                      fetchPriority="high"
                      style={lqip ? { backgroundImage: `url(${lqip})`, backgroundSize: 'cover' } : undefined}
                      onLoad={() => setHeroLoaded(true)}
                      onClick={(e) => {
                        e.stopPropagation();
                        const imgSrc = src;
                        openLightbox({ src: imgSrc, alt: post.mainImage.alt || post.title, caption: post.mainImage.caption || null });
                      }}
                      role="button"
                      tabIndex={0}
                    />
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
                      src = urlFor(value).width(1200).url();
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
                      loading="lazy"
                      decoding="async"
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
                      src = urlFor(value).width(1200).url();
                    } catch (e) {
                      src = null;
                    }
                  }
                  if (!src) return null;
                  const alt = value.alt || post.title || '';
                  const isFull = value.display === 'fullWidth';
                  const isFullHeight = Boolean(value.fullHeight);
                  const isWideMargins = Boolean(value.wideMargins);
                  return (
                    <figure className={`post-body-figure ${isFull ? 'fullwidth' : ''} ${isFullHeight ? 'fullheight' : ''} ${isWideMargins ? 'wide-margins' : ''}`}>
                      <img
                        src={src}
                        alt={alt}
                        className={`post-body-image ${isFull ? 'fullwidth' : ''} ${isFullHeight ? 'fullheight' : ''} ${isWideMargins ? 'wide-margins' : ''}`}
                        role="button"
                        tabIndex={0}
                        loading="lazy"
                        decoding="async"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLightbox({ src, alt, caption: value.caption || null });
                        }}
                      />
                      {value.caption && (
                        <figcaption className="post-body-caption">
                          <PortableText value={value.caption} />
                        </figcaption>
                      )}
                    </figure>
                  );
                },
                // Serializer for the twoImageSpread custom type
                twoImageSpread: ({ value }) => {
                  if (!value) return null;
                  const left = value.leftImage || null;
                  const right = value.rightImage || null;

                  const buildSrc = (img) => {
                    if (!img) return null;
                    let src = img.asset?.url || null;
                    if (!src && urlFor) {
                      try {
                        src = urlFor(img).width(1200).url();
                      } catch (e) {
                        src = null;
                      }
                    }
                    return src;
                  };

                  const leftSrc = buildSrc(left);
                  const rightSrc = buildSrc(right);

                  // If neither image has a source, nothing to render
                  if (!leftSrc && !rightSrc) return null;

                  // compute grid style for a 12-column layout on wide screens
                  const colStart = (offset, span) => {
                    // css grid uses 1-based column lines; convert offset (0-based) to start line
                    const start = (offset || 0) + 1;
                    const end = start + (span || 6);
                    return `${start} / ${end}`;
                  };

                  return (
                    <div className={`two-image-spread ${value.stackOnMobile ? 'stack-on-mobile fullwidth' : ''}`}>
                      {leftSrc && (
                        <figure
                          className="two-image-side left"
                          style={{ gridColumn: colStart(value.leftOffset, value.leftSpan) }}
                        >
                          <img
                            src={leftSrc}
                            alt={left?.alt || ''}
                            className="two-image"
                            loading="lazy"
                            decoding="async"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox({ src: leftSrc, alt: left?.alt || '', caption: left?.caption || null });
                            }}
                          />
                          {(left?.caption || left?.credit) && (
                            <figcaption className="two-image-caption">
                              {left?.caption && <PortableText value={left.caption} />}
                              {left?.credit && <div className="image-credit">{left.credit}</div>}
                            </figcaption>
                          )}
                        </figure>
                      )}

                      {rightSrc && (
                        <figure
                          className="two-image-side right"
                          style={{ gridColumn: colStart(value.rightOffset, value.rightSpan) }}
                        >
                          <img
                            src={rightSrc}
                            alt={right?.alt || ''}
                            className="two-image"
                            loading="lazy"
                            decoding="async"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox({ src: rightSrc, alt: right?.alt || '', caption: right?.caption || null });
                            }}
                          />
                          {(right?.caption || right?.credit) && (
                            <figcaption className="two-image-caption">
                              {right?.caption && <PortableText value={right.caption} />}
                              {right?.credit && <div className="image-credit">{right.credit}</div>}
                            </figcaption>
                          )}
                        </figure>
                      )}
                    </div>
                  );
                },
                multiImageSpread: ({ value }) => {
                  if (!value || !Array.isArray(value.images) || value.images.length === 0) return null;
                  const cols = value.columnsDesktop || 3;
                  const gutter = (typeof value.gutter === 'number') ? value.gutter : 16;

                  const buildSrc = (img) => {
                    if (!img) return null;
                    let src = img.asset?.url || null;
                    if (!src && urlFor) {
                      try {
                        src = urlFor(img).width(1200).url();
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
                  return (
                    <div
                      className={`multi-image-spread ${value.stackOnMobile ? 'stack-on-mobile' : ''}`}
                      style={{
                        ['--cols']: cols,
                        ['--gutter']: `${gutter}px`,
                        ['--pad-top']: padTopVar,
                        ['--pad-bottom']: padBottomVar,
                        paddingTop: padTopVar,
                        paddingBottom: padBottomVar,
                      }}
                    >
                      {value.images.map((img, i) => {
                        const src = buildSrc(img);
                        if (!src) return null;
                        return (
                          <figure key={i} className="multi-image-item">
                            <img
                              src={src}
                              alt={img.alt || ''}
                              loading="lazy"
                              decoding="async"
                              onClick={(e) => { e.stopPropagation(); openLightbox({ src, alt: img.alt || '', caption: img.caption || null }); }}
                              role="button"
                              tabIndex={0}
                            />
                            {(img.caption || img.credit) && (
                              <figcaption className="multi-image-caption">
                                {img.caption && <PortableText value={img.caption} />}
                                {img.credit && <div className="image-credit">{img.credit}</div>}
                              </figcaption>
                            )}
                          </figure>
                        );
                      })}
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
  );
}