/**
 * Player LOAD Command Handler
 * 
 * Processes LOAD commands from the State Machine:
 * 1. Fetches playlist data from DynamoDB
 * 2. Gets first track from playlist
 * 3. Fetches complete track data
 * 4. Returns track data for IoT response
 */

import { env } from '$amplify/env/player-load-handler'
import type { Schema } from '../../data/resource'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'iam'
      }
    }
  },
  {
    Auth: {
      credentialsProvider: {
        getCredentialsAndIdentityId: async () => ({
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        }),
        clearCredentialsAndIdentityId: () => {
          /* noop */
        },
      },
    },
  }
)

const client = generateClient<Schema>({ authMode: 'iam' })

interface LoadCommandEvent {
  command: string
  playerId: string
  playlistId: string
}

interface LoadCommandResponse {
  success: boolean
  playlistId?: string
  track?: any
  error?: string
}

export const handler = async (event: LoadCommandEvent): Promise<LoadCommandResponse> => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, playlistId } = event

  if (!playlistId) {
    console.error('❌ Missing playlistId')
    return {
      success: false,
      error: 'Missing playlistId parameter'
    }
  }

  try {
    // 1. Fetch playlist via GraphQL
    console.log('🔍 Fetching playlist:', playlistId)
    
    const { data: playlist, errors } = await client.models.Playlist.get({ id: playlistId })

    if (errors || !playlist) {
      console.error('❌ Playlist not found:', playlistId, errors)
      return {
        success: false,
        error: `Playlist not found: ${playlistId}`
      }
    }

    console.log('✅ Playlist fetched:', playlist.name)

    // 2. Parse tracks from JSON string
    let tracks: any[] = []
    
    if (typeof playlist.tracks === 'string') {
      tracks = JSON.parse(playlist.tracks)
    } else if (Array.isArray(playlist.tracks)) {
      tracks = playlist.tracks
    }

    if (tracks.length === 0) {
      console.error('❌ Playlist is empty')
      return {
        success: false,
        error: 'Playlist has no tracks'
      }
    }

    // 3. Sort by order and get first track
    const sortedTracks = [...tracks].sort((a, b) => {
      return (a.order ?? 0) - (b.order ?? 0)
    })

    const firstPlaylistTrack = sortedTracks[0]
    console.log('🎵 First track in playlist:', firstPlaylistTrack)

    if (!firstPlaylistTrack.trackId) {
      console.error('❌ No trackId in playlist track')
      return {
        success: false,
        error: 'Playlist track has no trackId'
      }
    }

    // 4. Fetch complete track data via GraphQL
    console.log('🔍 Fetching track:', firstPlaylistTrack.trackId)
    
    const { data: track, errors: trackErrors } = await client.models.Track.get({ 
      id: firstPlaylistTrack.trackId 
    })

    if (trackErrors || !track) {
      console.error('❌ Track not found:', firstPlaylistTrack.trackId, trackErrors)
      return {
        success: false,
        error: `Track not found: ${firstPlaylistTrack.trackId}`
      }
    }

    console.log('✅ Track fetched:', track.title)

    // 5. Return complete track data
    const response: LoadCommandResponse = {
      success: true,
      playlistId: playlistId,
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        fileUrl: track.fileUrl || track.audioUrl,
        coverArtUrl: track.coverArtUrl,
        waveformUrl: track.waveformUrl,
        duration: track.duration,
        bpm: track.bpm,
        key: track.key,
        energy: track.energy,
        genre: track.genre,
        year: track.year,
        label: track.label
      }
    }

    console.log('✅ LOAD command processed successfully')
    console.log('📤 Returning track data for:', track.title)

    return response

  } catch (error) {
    console.error('❌ Error processing LOAD command:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
