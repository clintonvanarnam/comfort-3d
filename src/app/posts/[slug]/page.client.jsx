// Client-only post page (moved from page.jsx)
"use client";

import { useEffect, useState } from 'react';
import { getPostBySlug } from '@/lib/getPosts';
import { useParams } from 'next/navigation';
import { PortableText } from '@portabletext/react';
import NavBar from '@/components/NavBar';

export default function PostPage() {
  const params = useParams();
  const [post, setPost] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const p = await getPostBySlug(params.slug);
        if (mounted) setPost(p);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load post', e);
      }
    }
    if (params?.slug) load();
    return () => {
      mounted = false;
    };
  }, [params?.slug]);

  if (!post) return (
    <div className="post-page">
      <NavBar />
      <main className="post-content">
        <div>Loading…</div>
      </main>
    </div>
  );

  return (
    <div className="post-page">
      <NavBar />
      <main className="post-content">
        <h1 className="post-title">{post.title}</h1>
        {post.mainImage?.asset?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="post-main-image" src={post.mainImage.asset.url} alt={post.mainImage.alt || post.title} />
        )}
        <article className="post-body">
          <PortableText value={post.body || []} />
        </article>
      </main>
    </div>
  );
}
