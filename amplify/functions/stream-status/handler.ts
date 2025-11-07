/**
 * Stream Status Lambda
 * 
 * Proxies Icecast status JSON to avoid CORS issues
 * Also enriches with playlist data from S3
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({})
const ICECAST_URL = 'http://46.137.184.91:8000'
const PLAYLIST_BUCKET = process.env.PLAYLIST_BUCKET || ''

interface StreamResponse {
  isLive: boolean
  currentTrack: {
    artist: string
    title: string
  } | null
  listeners: number
  bitrate: number
  serverName: string
  serverDescription: string
  playlist: {
    current: string | null
    queue: string[]
    total: number
  }
}

export const handler = async (event: any) => {
  console.log('🎙️ Stream Status API called')
  
  try {
    // 1. Fetch Icecast status
    const icecastResponse = await fetch(`${ICECAST_URL}/status-json.xsl`)
    
    if (!icecastResponse.ok) {
      throw new Error(`Icecast returned ${icecastResponse.status}`)
    }
    
    const icecastData = await icecastResponse.json()
    const source = icecastData.icestats?.source
    
    // 2. Fetch playlist from S3
    let playlistData: {
      current: string | null
      queue: string[]
      total: number
    } = {
      current: null,
      queue: [],
      total: 0
    }
    
    try {
      const s3Response = await s3.send(new GetObjectCommand({
        Bucket: PLAYLIST_BUCKET,
        Key: 'current-playlist.m3u'
      }))
      
      const playlistContent = await s3Response.Body?.transformToString()
      
      if (playlistContent) {
        const lines = playlistContent.split('\n')
        const tracks: string[] = []
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line.startsWith('#EXTINF:')) {
            // Extract track info from #EXTINF line
            const match = line.match(/#EXTINF:\d+,(.+)$/)
            if (match) {
              tracks.push(match[1])
            }
          }
        }
        
        playlistData = {
          current: tracks[0] ? tracks[0] : null,
          queue: tracks.slice(1),
          total: tracks.length
        }
      }
    } catch (s3Error) {
      console.warn('Could not fetch playlist from S3:', s3Error)
    }
    
    // 3. Parse current track from Icecast
    let currentTrack = null
    const metadata = source?.title || source?.yp_currently_playing || ''
    
    if (metadata && metadata !== 'Unknown') {
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
    
    // 4. Build response
    const response: StreamResponse = {
      isLive: !!source,
      currentTrack,
      listeners: source?.listeners || 0,
      bitrate: source?.bitrate || 0,
      serverName: source?.server_name || 'G-Forge Radio',
      serverDescription: source?.server_description || '',
      playlist: playlistData
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(response)
    }
    
  } catch (error) {
    console.error('❌ Error fetching stream status:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch stream status' })
    }
  }
}
