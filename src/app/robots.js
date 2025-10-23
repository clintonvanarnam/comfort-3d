export default function robots() {
  const baseUrl = 'https://www.comfortmagazine.world';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}