/**
 * Player Service
 * 
 * Handles audio playback, track loading, and player state management
 */

import { getUrl } from 'aws-amplify/storage'

export interface Track {
  id: string
  title?: string | null
  artist?: string | null
  album?: string | null
  genre?: string | null
  year?: number | null
  bpm?: number | null
  key?: string | null
  energy?: number | null
  danceability?: number | null
  valence?: number | null
  duration?: number | null
  audioUrl?: string | null
  coverArtUrl?: string | null
  waveformUrl?: string | null
  fileUrl?: string | null
}

export interface PlayerAssets {
  coverArtUrl: string | null
  waveformUrl: string | null
}

/**
 * Load track assets (cover art and waveform)
 */
export async function loadTrackAssets(track: Track): Promise<PlayerAssets> {
  const assets: PlayerAssets = {
    coverArtUrl: null,
    waveformUrl: null
  }

  // Load cover art
  if (track.coverArtUrl) {
    try {
      const url = await getUrl({ path: track.coverArtUrl })
      assets.coverArtUrl = url.url.toString()
      console.log('✅ Cover art loaded')
    } catch (e) {
      console.log('⚠️ Cover art not found')
    }
  }

  // Load waveform
  if (track.waveformUrl) {
    try {
      const url = await getUrl({ path: track.waveformUrl })
      assets.waveformUrl = url.url.toString()
      console.log('✅ Waveform loaded')
    } catch (e) {
      console.log('⚠️ Waveform not found')
    }
  }

  return assets
}

/**
 * Resolve audio URL from track
 */
export async function resolveAudioUrl(track: Track): Promise<string | null> {
  console.log('🔍 Resolving audio URL...')
  console.log('   - Has audioUrl:', !!track.audioUrl)
  console.log('   - Has fileUrl:', !!(track as any).fileUrl)

  // Try audioUrl first (direct URL)
  if (track.audioUrl) {
    console.log('✅ Using direct audioUrl')
    return track.audioUrl
  }

  // Try fileUrl (S3 path)
  const fileUrl = (track as any).fileUrl
  if (fileUrl) {
    try {
      console.log('🔄 Resolving S3 path:', fileUrl)
      const result = await getUrl({ path: fileUrl })
      const resolvedUrl = result.url.toString()
      console.log('✅ Audio URL resolved from S3')
      return resolvedUrl
    } catch (error) {
      console.error('❌ Failed to resolve S3 path:', error)
      return null
    }
  }

  console.error('❌ No audio URL available')
  return null
}

/**
 * Format time in MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(currentTime: number, duration: number): number {
  return duration > 0 ? (currentTime / duration) * 100 : 0
}
