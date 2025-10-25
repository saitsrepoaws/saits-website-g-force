/**
 * CloudFront CDN utilities for faster asset delivery
 * 
 * CloudFront provides:
 * - Shorter URLs (no presigned tokens)
 * - Global edge caching (24h default)
 * - Faster load times
 * - Lower S3 transfer costs
 */

const CLOUDFRONT_DOMAIN = 'd80d0cwbzav1v.cloudfront.net'

/**
 * Convert S3 path to CloudFront URL
 * 
 * @param s3Path - S3 object key (e.g., "public/audio/track.mp3")
 * @returns CloudFront URL (e.g., "https://d80d0cwbzav1v.cloudfront.net/public/audio/track.mp3")
 * 
 * @example
 * ```ts
 * const url = getCloudFrontUrl('public/audio/1234-track.mp3')
 * // Returns: https://d80d0cwbzav1v.cloudfront.net/public/audio/1234-track.mp3
 * ```
 */
export function getCloudFrontUrl(s3Path: string): string {
  // Remove any leading slashes
  const cleanPath = s3Path.replace(/^\/+/, '')
  
  return `https://${CLOUDFRONT_DOMAIN}/${cleanPath}`
}

/**
 * Check if a path should use CloudFront
 * 
 * Use CloudFront for:
 * - Public audio files
 * - Cover art
 * - Waveforms
 * 
 * @param s3Path - S3 object key
 * @returns True if path is suitable for CloudFront
 */
export function shouldUseCloudFront(s3Path: string): boolean {
  // Only use CloudFront for public paths
  return s3Path.startsWith('public/')
}

/**
 * Get asset URL with automatic CloudFront routing
 * 
 * @param s3Path - S3 object key
 * @returns CloudFront URL for public paths, or original path for private
 */
export function getAssetUrl(s3Path: string): string {
  if (shouldUseCloudFront(s3Path)) {
    return getCloudFrontUrl(s3Path)
  }
  
  // For private paths, use presigned URLs via getUrl()
  return s3Path
}
