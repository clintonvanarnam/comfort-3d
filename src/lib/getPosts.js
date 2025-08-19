// src/lib/getPosts.js
import client from './sanity';

// Get all posts for homepage / 3D view
export async function getPosts() {
  const query = `*[_type == "post"]{
    _id,
    title,
    slug,
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
    slug: post.slug,
    image: post.mainImage?.asset?.url || '',
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
    body
  }`;

  const post = await client.fetch(query, { slug });

  return {
    slug: post.slug,
    title: post.title,
    image: post.mainImage?.asset?.url || '',
    body: post.body || null,
  };
}