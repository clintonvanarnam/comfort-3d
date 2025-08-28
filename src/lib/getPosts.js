// src/lib/getPosts.js
import client from './sanity';
import imageUrlBuilder from '@sanity/image-url';

const builder = imageUrlBuilder(client);

// Get all posts for homepage / 3D view
export async function getPosts() {
  // Fetch the image object (so we can build a resized URL) and also the
  // original asset URL as a fallback.
  const query = `*[_type == "post"]{
    _id,
    title,
    slug,
    author->{name},
    mainImage,
    "imageUrl": mainImage.asset->url
  }`;

  const data = await client.fetch(query);

  // Format for 3D sprite usage; build a small thumbnail URL where possible
  return data.map(post => {
    let image = '';
    try {
      if (post.mainImage) {
        // builder.image accepts the image object (including asset ref)
        image = builder.image(post.mainImage).width(600).auto('format').url();
      } else if (post.imageUrl) {
        image = post.imageUrl;
      }
    } catch (e) {
      // fallback to the raw URL if builder fails for any reason
      image = post.imageUrl || '';
    }

    return {
      slug: post.slug,
      title: post.title,
      author: post.author?.name || '',
      image,
    };
  });
}

// Get a single post by its slug
export async function getPostBySlug(slug) {
  const query = `*[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    slug,
    author->{name},
    mainImage,
    "imageUrl": mainImage.asset->url,
    caption, alt, body
  }`;

  const post = await client.fetch(query, { slug });

  const mainImage = post?.mainImage || null;
  return {
    slug: post?.slug,
    title: post?.title,
    mainImage,
    // also expose a usable URL for non-builder contexts
    imageUrl: post?.imageUrl || null,
    author: post?.author?.name || '',
    body: post?.body || null,
  };
}