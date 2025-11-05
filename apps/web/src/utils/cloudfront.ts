/**
 * CloudFront CDN utilities for faster asset delivery
 * 
 * CloudFront provides:
 * - Shorter URLs (no presigned tokens)
 * - Global edge caching (24h default)
 * - Faster load times
 * - Lower S3 transfer costs
 */

const CLOUDFRONT_DOMAIN = 'd31p5rl3s8h3a0.cloudfront.net'

/**
 * Convert S3 path to CloudFront URL
 * 
 * @param s3PathOrUrl - S3 object key (e.g., "public/audio/track.mp3") or full S3 URL
 * @returns CloudFront URL (e.g., "https://d31p5rl3s8h3a0.cloudfront.net/public/audio/track.mp3")
 * 
 * @example
 * ```ts
 * const url = getCloudFrontUrl('public/audio/1234-track.mp3')
 * // Returns: https://d31p5rl3s8h3a0.cloudfront.net/public/audio/1234-track.mp3
 * ```
 */
export function getCloudFrontUrl(s3PathOrUrl: string): string {
  let cleanPath = s3PathOrUrl
  
  // If it's a full S3 URL, extract just the path
  if (s3PathOrUrl.includes('amazonaws.com')) {
    try {
      const url = new URL(s3PathOrUrl)
      // Extract path after bucket name
      // e.g., /public/audio/track.mp3 or https://bucket.s3.region.amazonaws.com/public/audio/track.mp3
      cleanPath = url.pathname.replace(/^\/+/, '')
    } catch (e) {
      console.warn('Failed to parse S3 URL, using as-is:', e)
    }
  }
  
  // Remove any leading slashes
  cleanPath = cleanPath.replace(/^\/+/, '')
  
  // If path starts with "public/", it's already clean
  // Otherwise, it might be just the filename
  if (!cleanPath.startsWith('public/')) {
    console.warn('Path does not start with public/, might be incorrect:', cleanPath)
  }
  
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
