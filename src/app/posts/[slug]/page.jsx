'use client';

import { useEffect, useState, useRef } from 'react';
import { getPostBySlug } from '@/lib/getPosts';
import { useParams } from 'next/navigation';
import { PortableText } from '@portabletext/react';
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

          {post.image && (
            <img
              src={post.image}
              alt={post.title}
              className="post-header-image flip-image"
            />
          )}
        </div>

        <div className="post-body">
          <PortableText value={post.body} />
        </div>
      </div>
    </div>
  );
}