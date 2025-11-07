/**
 * Stream Status Service
 * 
 * Fetches live stream status from Icecast server
 * Provides current track, playlist queue, and stream metadata
 */

const ICECAST_URL = 'http://46.137.184.91:8000'

export interface StreamStatus {
  isLive: boolean
  currentTrack: {
    artist: string
    title: string
    duration?: number
    elapsed?: number
  } | null
  listeners: number
  bitrate: number
  serverName: string
  serverDescription: string
}

export interface StreamPlaylist {
  currentTrack: string | null
  queue: string[]
  played: string[]
}

/**
 * Get current stream status from Icecast
 */
export async function getStreamStatus(): Promise<StreamStatus | null> {
  try {
    const response = await fetch(`${ICECAST_URL}/status-json.xsl`, {
      mode: 'cors',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const source = data.icestats?.source
    
    if (!source) {
      return {
        isLive: false,
        currentTrack: null,
        listeners: 0,
        bitrate: 0,
        serverName: 'G-Forge Radio',
        serverDescription: 'Offline'
      }
    }
    
    // Parse current track from metadata
    let currentTrack = null
    const metadata = source.title || source.yp_currently_playing || ''
    
    if (metadata && metadata !== 'Unknown') {
      // Try to parse "Artist - Title" format
      const match = metadata.match(/^(.+?)\s*-\s*(.+)$/)
      if (match) {
        currentTrack = {
          artist: match[1].trim(),
          title: match[2].trim()
        }
      } else {
        currentTrack = {
          artist: 'Unknown',
          title: metadata
        }
      }
    }
    
    return {
      isLive: true,
      currentTrack,
      listeners: source.listeners || 0,
      bitrate: source.bitrate || 0,
      serverName: source.server_name || 'G-Forge Radio',
      serverDescription: source.server_description || ''
    }
  } catch (error) {
    console.error('Failed to fetch stream status:', error)
    return null
  }
}

/**
 * Get playlist from S3 bucket
 * This shows what Liquidsoap is playing
 */
export async function getStreamPlaylist(): Promise<string[]> {
  try {
    // For now, return empty array
    // Later we can add an API endpoint to fetch the M3U from S3
    return []
  } catch (error) {
    console.error('Failed to fetch stream playlist:', error)
    return []
  }
}

/**
 * Poll stream status at interval
 */
export function pollStreamStatus(
  callback: (status: StreamStatus | null) => void,
  intervalMs: number = 5000
): () => void {
  // Initial fetch
  getStreamStatus().then(callback)
  
  // Set up polling
  const interval = setInterval(async () => {
    const status = await getStreamStatus()
    callback(status)
  }, intervalMs)
  
  // Return cleanup function
  return () => clearInterval(interval)
}
