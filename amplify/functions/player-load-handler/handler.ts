/**
 * Player LOAD Command Handler
 * 
 * Uses AWS AppSync GraphQL API with IAM auth via AWS SDK
 */

import { SignatureV4 } from '@aws-sdk/signature-v4'
import { Sha256 } from '@aws-crypto/sha256-js'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { defaultProvider } from '@aws-sdk/credential-provider-node'

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT || ''
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1'

async function graphqlRequest(query: string, variables: any = {}) {
  const url = new URL(APPSYNC_ENDPOINT)
  
  const request = new HttpRequest({
    method: 'POST',
    protocol: url.protocol.slice(0, -1),
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      'Content-Type': 'application/json',
      host: url.hostname,
    },
    body: JSON.stringify({ query, variables }),
  })

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: AWS_REGION,
    service: 'appsync',
    sha256: Sha256,
  })

  const signedRequest = await signer.sign(request)
  
  const response = await fetch(APPSYNC_ENDPOINT, {
    method: signedRequest.method,
    headers: signedRequest.headers,
    body: signedRequest.body,
  })

  return response.json()
}

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, timestamp } = event
  const now = new Date(timestamp || Date.now())

  try {
    // 1. Determine which playlist should be active NOW based on schedule
    // For now, we'll use a hardcoded playlist ID
    // TODO: Implement schedule-based playlist selection
    const playlistId = 'playlist-1761422965322-2ko9rx2fh' // Hardcoded for now
    
    console.log('🎯 Using playlist:', playlistId)
    console.log('⏰ Current time:', now.toISOString())

    // 2. Fetch playlist
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
      console.error('❌ Playlist not found')
      return {
        success: false,
        error: 'Playlist not found'
      }
    }

    console.log('✅ Playlist found:', playlist.name)

    const playlistTracks = JSON.parse(playlist.tracks || '[]')
    
    if (playlistTracks.length === 0) {
      return {
        success: false,
        error: 'Playlist is empty'
      }
    }

    // 3. Calculate current track based on time of day
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
      console.error('❌ Track not found')
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
