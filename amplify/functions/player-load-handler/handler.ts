/**
 * Player LOAD Command Handler
 * 
 * Uses Amplify Data client with IAM auth
 */

import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../data/resource'

const APPSYNC_ENDPOINT = process.env.APPSYNC_ENDPOINT || ''

// Configure Amplify for Lambda
Amplify.configure({
  API: {
    GraphQL: {
      endpoint: APPSYNC_ENDPOINT,
      region: process.env.AWS_REGION || 'eu-west-1',
      defaultAuthMode: 'iam'
    }
  }
}, {
  Auth: {
    credentialsProvider: {
      getCredentialsAndIdentityId: async () => ({
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          sessionToken: process.env.AWS_SESSION_TOKEN
        }
      }),
      clearCredentialsAndIdentityId: () => {}
    }
  }
})

const client = generateClient<Schema>()

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
    // 1. Fetch playlist using Amplify client
    const { data: playlist, errors } = await client.models.Playlist.get({ id: playlistId })

    if (errors || !playlist) {
      console.error('❌ Playlist fetch error:', errors)
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

    // 3. Fetch full track data using Amplify client
    const { data: track, errors: trackErrors } = await client.models.Track.get({ id: selectedTrack.trackId })

    if (trackErrors || !track) {
      console.error('❌ Track fetch error:', trackErrors)
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
