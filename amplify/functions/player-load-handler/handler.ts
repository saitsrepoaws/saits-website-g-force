/**
 * Player LOAD Command Handler
 * 
 * Uses AppSync GraphQL API directly (no AWS SDK needed!)
 */

import https from 'https'

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT || ''
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY || ''

async function graphqlRequest(query: string, variables: any = {}) {
  const url = new URL(APPSYNC_ENDPOINT)
  
  const postData = JSON.stringify({
    query,
    variables
  })

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': APPSYNC_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, playlistId, timestamp } = event

  if (!playlistId) {
    return {
      success: false,
      error: 'Missing playlistId'
    }
  }

  try {
    // 1. Fetch playlist
    const playlistQuery = `
      query GetPlaylist($id: ID!) {
        getPlaylist(id: $id) {
          id
          name
          tracks
        }
      }
    `

    const playlistResult: any = await graphqlRequest(playlistQuery, { id: playlistId })
    const playlist = playlistResult.data?.getPlaylist

    if (!playlist) {
      return {
        success: false,
        error: 'Playlist not found'
      }
    }

    const playlistTracks = JSON.parse(playlist.tracks || '[]')
    
    if (playlistTracks.length === 0) {
      return {
        success: false,
        error: 'Playlist is empty'
      }
    }

    // 2. Calculate current track based on time
    const now = new Date(timestamp || Date.now())
    const currentTimeInSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()

    let cumulativeTime = 0
    let currentTrackIndex = 0

    for (let i = 0; i < playlistTracks.length; i++) {
      const trackDuration = playlistTracks[i].duration || 180
      
      if (currentTimeInSeconds >= cumulativeTime && currentTimeInSeconds < cumulativeTime + trackDuration) {
        currentTrackIndex = i
        break
      }
      
      cumulativeTime += trackDuration
      
      if (i === playlistTracks.length - 1 && currentTimeInSeconds >= cumulativeTime) {
        currentTrackIndex = 0
        break
      }
    }

    const selectedTrack = playlistTracks[currentTrackIndex]
    console.log('🎯 Selected track index:', currentTrackIndex)
    console.log('🎵 Track ID:', selectedTrack.trackId)

    // 3. Fetch full track data
    const trackQuery = `
      query GetTrack($id: ID!) {
        getTrack(id: $id) {
          id
          title
          artist
          album
          fileUrl
          coverArtUrl
          waveformUrl
          duration
          bpm
          key
          energy
          genre
          year
          label
        }
      }
    `

    const trackResult: any = await graphqlRequest(trackQuery, { id: selectedTrack.trackId })
    const track = trackResult.data?.getTrack

    if (!track) {
      return {
        success: false,
        error: 'Track not found'
      }
    }

    console.log('✅ Track found:', track.title, 'by', track.artist)

    return {
      success: true,
      playlistId: playlistId,
      trackIndex: currentTrackIndex,
      track: track
    }

  } catch (error: any) {
    console.error('❌ Error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
