'use client';

import { useEffect, useState, useRef } from 'react';
import { getPostBySlug } from '@/lib/getPosts';
import { useParams } from 'next/navigation';
import { PortableText } from '@portabletext/react';
import gsap from 'gsap';

export default function PostPage() {
  const params = useParams();
  const [post, setPost] = useState(null);
  const [transitionDone, setTransitionDone] = useState(false);
  const transitionImageRef = useRef();
  const contentRef = useRef();

  useEffect(() => {
    async function loadPost() {
      const fetched = await getPostBySlug(params.slug);
    console.log('Fetched post:', fetched); // Debug: see what is returned
      setPost(fetched);
    }
    loadPost();
  }, [params.slug]);

  useEffect(() => {
    const animateContentUp = () => {
      if (contentRef.current) {
        const title = contentRef.current.querySelector('h1');
        const img = contentRef.current.querySelector('.flip-image');
        const body = contentRef.current.querySelector('.pt-body');

        if (title) {
          gsap.fromTo(title, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' });
        }
        if (img) {
          gsap.fromTo(img, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.15 });
        }
        if (body) {
          gsap.fromTo(body, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.3 });
        }
      }
    };

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
              animateContentUp();
            },
          }
        );
      } else {
        setTransitionDone(true);
        animateContentUp();
      }
    } else {
      setTransitionDone(true);
      animateContentUp();
    }
  }, [params.slug, post]);

  if (!post) return <div>Loading...</div>;

  return (
    <div style={{ position: 'relative', padding: '2rem' }}>
      {/* Floating image transition layer */}
      <img
        ref={transitionImageRef}
        alt=""
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: 'auto',
          height: '80vh',
          transform: 'translate(-50%, -50%) scale(1)',
          zIndex: 1000,
          display: 'none',
        }}
      />

      {/* Actual Post Content */}
      <div
        ref={contentRef}
        style={{
          opacity: transitionDone ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{post.title}</h1>
        {post.image && (
          <img
            src={post.image}
            alt={post.title}
            className="flip-image"
            style={{
              width: '100%',
              height: 'auto',
              marginBottom: '2rem',
              borderRadius: '8px',
            }}
          />
        )}
        <div className="pt-body">
          <PortableText value={post.body} />
        </div>
      </div>
    </div>
  );
}