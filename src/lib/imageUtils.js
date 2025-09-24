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
  
  return builder
    .image(source)
    .width(maxSize)
    .height(maxSize)
    .fit('max') // Ensures image fits within bounds while maintaining aspect ratio
    .auto('format') // Automatically choose best format (WebP, JPEG, etc.)
    .quality(85) // Good balance between quality and file size
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
  // URL format: https://cdn.sanity.io/images/projectId/dataset/assetId-widthxheight.format
  const match = assetUrl.match(/\/images\/[^\/]+\/[^\/]+\/([^\/]+)/);
  if (!match) return assetUrl; // Return original if can't parse
  
  const assetId = match[1];
  
  return builder
    .image({ _ref: assetId })
    .width(maxSize)
    .height(maxSize)
    .fit('max')
    .auto('format')
    .quality(85)
    .url();
}