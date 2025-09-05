'use client';

import { useEffect, useState } from 'react';
import { getPosts } from '@/lib/getPosts';

export default function RelatedContent({ currentSlug = '' }) {
  const [related, setRelated] = useState([]);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Detect Safari
    const safariCheck = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(safariCheck);

    let mounted = true;
    async function load() {
      const all = await getPosts();
      if (!mounted) return;
      const filtered = all.filter(p => (p.slug || p._id) && (p.slug !== currentSlug) && (p._id !== currentSlug));
      // shuffle
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      setRelated(filtered.slice(0, 6));
    }
    load();
    return () => { mounted = false; };
  }, [currentSlug]);

  if (!related || related.length === 0) return null;

  return (
    <section className="related-grid-outer">
      <h3 style={{ margin: '0 0 12px 0' }}>RELATED CONTENT</h3>
      <div className="related-grid">
        {related.map((r) => (
          <a key={r._id || r.slug} href={`/posts/${r.slug}`} className="related-card">
            <div className="related-thumb-wrap">
              <img
                src={r.image}
                alt={r.title}
                className="related-thumb"
                loading={isSafari ? "eager" : "lazy"}
                decoding={isSafari ? "sync" : "async"}
              />
            </div>
            <div className="related-meta">
              <div className="related-title">{r.title}</div>
              {r.author && <div className="related-author">{r.author}</div>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
