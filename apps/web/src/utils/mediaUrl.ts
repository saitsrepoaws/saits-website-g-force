/**
 * Media URL Helper
 * 
 * Gets presigned URLs from Amplify Storage for secure S3 access
 * URLs are cached via CloudFront CDN
 */

import { getUrl } from 'aws-amplify/storage'

// Debug: Log on module load
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📦 MEDIA URL HELPER LOADED')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Using Amplify Storage (presigned URLs)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

/**
 * Convert a file path to a presigned URL
 * 
 * @param path - S3 path (e.g., "public/audio/track.mp3")
 * @returns Promise with presigned URL (1 hour expiry)
 */
export async function getMediaUrl(path: string | undefined | null): Promise<string> {
  if (!path) return ''
  
  // If already a full URL (starts with http:// or https://), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  try {
    // Get presigned URL from Amplify Storage
    const result = await getUrl({ path })
    const presignedUrl = result.url.toString()
    
    console.log('🔗 Media URL (Presigned):')
    console.log('   Input:', path)
    console.log('   Output:', presignedUrl.substring(0, 100) + '...')
    
    return presignedUrl
  } catch (error) {
    console.error('❌ Failed to get presigned URL for:', path, error)
    return ''
  }
}

/**
 * Get audio file URL
 */
export async function getAudioUrl(path: string | undefined | null): Promise<string> {
  return getMediaUrl(path)
}

/**
 * Get cover art URL
 */
export async function getCoverArtUrl(path: string | undefined | null): Promise<string> {
  return getMediaUrl(path)
}

/**
 * Get waveform URL
 */
export async function getWaveformUrl(path: string | undefined | null): Promise<string> {
  return getMediaUrl(path)
}
