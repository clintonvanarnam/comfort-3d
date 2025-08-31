// src/lib/getPosts.js
import client from './sanity';

// Get all posts for homepage / 3D view
export async function getPosts() {
  const query = `*[_type == "post"]{
    _id,
    title,
    slug,
  author-> { name },
    mainImage {
      asset->{
        _id,
        url
      }
    }
  }`;

  const data = await client.fetch(query);

  // Format for 3D sprite usage
  return data.map(post => ({
    _id: post._id,
    title: post.title || '',
    slug: post.slug?.current || (typeof post.slug === 'string' ? post.slug : ''),
    image: post.mainImage?.asset?.url || '',
    author: post.author?.name || '',
  }));
}

// Get a single post by its slug
export async function getPostBySlug(slug) {
  const query = `*[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    slug,
  mainImage {
      asset->{
        _id,
        url
      }
    },
  body,
  author-> { name },
  publishedAt
  }`;

  const post = await client.fetch(query, { slug });

  return {
  slug: post.slug?.current || (typeof post.slug === 'string' ? post.slug : ''),
    title: post.title,
  // keep the original mainImage object so UI code that expects
  // `post.mainImage.asset.url`, alt, caption etc continues to work
  mainImage: post.mainImage || null,
  image: post.mainImage?.asset?.url || '',
  body: post.body || null,
  author: post.author?.name || null,
  publishedAt: post.publishedAt || null,
  };
}