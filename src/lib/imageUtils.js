// src/lib/imageUtils.js
import imageUrlBuilder from '@sanity/image-url';
import client from './sanity';

const builder = imageUrlBuilder(client);

/**
 * Generate an optimized Sanity image URL with maximum dimensions
 * @param {Object} source - Sanity image asset reference
 * @param {number} maxSize - Maximum width or height in pixels (default: 500)
 * @returns {string} Optimized image URL
 */
export function getOptimizedImageUrl(source, maxSize = 500) {
  if (!source) return '';
  // Downsize more aggressively for Three.js textures
  const downsized = 128;
  return builder
    .image(source)
    .maxWidth(downsized)
    .maxHeight(downsized)
    .fit('max')
    .format('webp') // Force WebP for smallest size
    .quality(60) // Lower quality for speed
    .url();
}

/**
 * Generate an optimized image URL from a Sanity asset URL
 * @param {string} assetUrl - Full Sanity asset URL
 * @param {number} maxSize - Maximum width or height in pixels (default: 500)
 * @returns {string} Optimized image URL
 */
export function getOptimizedImageUrlFromAssetUrl(assetUrl, maxSize = 500) {
  if (!assetUrl) return '';
  // Extract asset ID from URL
  const match = assetUrl.match(/\/images\/[^\/]+\/[^\/]+\/([^\/]+)/);
  if (!match) return assetUrl;
  const assetId = match[1];
  const downsized = 128;
  return builder
    .image({ _ref: assetId })
    .maxWidth(downsized)
    .maxHeight(downsized)
    .fit('max')
    .format('webp')
    .quality(60)
    .url();
}