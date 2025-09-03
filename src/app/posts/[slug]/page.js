// Server wrapper for the client post page.
// Exports generateMetadata so Next.js can set per-post <title> and meta description,
// while delegating the interactive client UI to the existing `page.jsx` component.
import { getPostBySlug } from '@/lib/getPosts';
import PostClient from './page.jsx';

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  if (!slug) return {};
  try {
    const post = await getPostBySlug(slug);
  const siteSuffix = 'COMFORT';
  // Prefer author for the page title (Author | Comfort). Fall back to post title, then site suffix.
  const title = post?.author ? `${post.author} | ${siteSuffix}` : (post?.title ? `${post.title} | ${siteSuffix}` : siteSuffix);
    // try to use a short excerpt/first block as description if available
    let description = '';
    if (post?.body && Array.isArray(post.body)) {
      // find first text block and take a short slice
      const firstText = post.body.find(b => b._type === 'block' && Array.isArray(b.children));
      if (firstText) {
        const plain = firstText.children.map(c => c.text || '').join(' ').trim();
        description = plain.slice(0, 160);
      }
    }
    const ogImage = post?.mainImage?.asset?.url || null;
    // Force Open Graph description to brand message per request
    const ogDescription = 'COMFORT ideas for a better tomorrow.';

    return {
      title,
      description: description || undefined,
      openGraph: {
        title,
        description: ogDescription,
        siteName: 'COMFORT',
        type: 'article',
        images: ogImage ? [{ url: ogImage, alt: post?.mainImage?.alt || post?.title || '' }] : undefined,
      },
      twitter: {
        card: ogImage ? 'summary_large_image' : 'summary',
        title,
        description: ogDescription,
        images: ogImage ? [ogImage] : undefined,
      },
    };
  } catch (e) {
    return {};
  }
}

export default function PostPageServer(props) {
  // Render the client component which handles fetching/display and interactions
  // `page.jsx` expects to run as a client component.
  return <PostClient {...props} />;
}
