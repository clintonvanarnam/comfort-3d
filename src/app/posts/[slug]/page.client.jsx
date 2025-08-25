// Client-only post page (moved from page.jsx)
"use client";

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

+ (file truncated)
