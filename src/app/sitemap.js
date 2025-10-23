import { getAllPosts } from '@/lib/getPosts';

export default async function sitemap() {
  const baseUrl = 'https://www.comfortmagazine.world';

  try {
    // Get all posts
    const posts = await getAllPosts();
    
    // Create post URLs
    const postUrls = posts.map((post) => ({
      url: `${baseUrl}/posts/${post.slug.current}`,
      lastModified: new Date(post._updatedAt || post.publishedAt || post._createdAt),
      changeFrequency: 'monthly',
      priority: 0.8,
    }));

    // Static pages
    const staticPages = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
      {
        url: `${baseUrl}/shop`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
    ];

    return [...staticPages, ...postUrls];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
    ];
  }
}