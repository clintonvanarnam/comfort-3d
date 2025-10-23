// src/lib/getPosts.js
import client from './sanity';
import { getOptimizedImageUrl } from './imageUtils';

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
    },
    thumbnail {
      asset->{
        _id,
        url
      }
    }
  }`;

  try {
    console.log('getPosts: Attempting to fetch from Sanity...');
    const data = await client.fetch(query);
    console.log('getPosts: Successfully fetched', data.length, 'posts from Sanity');

    // Format for 3D sprite usage with optimized images
    const formatted = data.map(post => ({
      _id: post._id,
      title: post.title || '',
      slug: post.slug?.current || (typeof post.slug === 'string' ? post.slug : ''),
      image: post.thumbnail ? getOptimizedImageUrl(post.thumbnail, 800) : (post.mainImage ? getOptimizedImageUrl(post.mainImage, 500) : ''), // Use thumbnail for 3D sprites, fallback to mainImage
      mainImage: post.mainImage ? getOptimizedImageUrl(post.mainImage, 500) : '', // Keep mainImage for other uses
      author: post.author?.name || '',
    }));

    console.log('getPosts: Formatted', formatted.length, 'posts with optimized images');
    return formatted;
  } catch (error) {
    console.error('getPosts: Error fetching from Sanity:', error);
    console.error('getPosts: Error type:', error.constructor?.name || typeof error);
    console.error('getPosts: Error properties:', Object.getOwnPropertyNames(error));
    console.error('getPosts: Error details:', {
      message: error?.message,
      statusCode: error?.statusCode,
      response: error?.response,
      stack: error?.stack,
      name: error?.name,
      code: error?.code
    });

    // Return empty array so the app can continue with dummy posts
    return [];
  }
}

// Get all posts for sitemap generation (simpler query)
export async function getAllPosts() {
  const query = `*[_type == "post"]{
    _id,
    slug,
    _createdAt,
    _updatedAt,
    publishedAt
  }`;

  try {
    const data = await client.fetch(query);
    return data;
  } catch (error) {
    console.error('getAllPosts: Error fetching from Sanity:', error);
    return [];
  }
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