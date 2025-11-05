/**
 * Cross-Fade Controller
 * 
 * Manages automatic cross-fade playback between Player 1 and Player 2
 * 
 * Flow:
 * 1. Receives START_CROSSFADE command with playlistId
 * 2. Loads playlist tracks
 * 3. Alternates loading tracks between player-001 and player-002
 * 4. Sends LOAD commands via IoT
 * 5. Waits for track_ended events
 * 6. Unloads finished track and loads next
 */

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

const iot = new IoTDataPlaneClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE_NAME
const TRACK_TABLE = process.env.TRACK_TABLE_NAME

interface Track {
  id: string
  title: string
  artist: string
  fileUrl: string
  coverArtUrl?: string
  waveformUrl?: string
  duration?: number
}

interface CrossFadeState {
  playlistId: string
  tracks: Track[]
  currentIndex: number
  player1TrackId: string | null
  player2TrackId: string | null
  activePlayer: 1 | 2
  isRunning: boolean
}

export const handler = async (event: any) => {
  console.log('🎛️ Cross-Fade Controller invoked:', JSON.stringify(event, null, 2))

  const { command, playlistId, action } = event

  if (command === 'START_CROSSFADE') {
    return await startCrossFade(playlistId)
  } else if (command === 'STOP_CROSSFADE') {
    return await stopCrossFade()
  } else if (action === 'TRACK_ENDED') {
    return await handleTrackEnded(event)
  }

  return {
    success: false,
    error: 'Unknown command'
  }
}

async function startCrossFade(playlistId: string) {
  console.log('▶️ Starting cross-fade for playlist:', playlistId)

  try {
    // Load playlist
    const playlist = await getPlaylist(playlistId)
    
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
      console.error('❌ Playlist not found or empty')
      return {
        success: false,
        error: 'Playlist not found or empty'
      }
    }

    console.log('✅ Playlist loaded:', playlist.name)
    console.log('📋 Tracks count:', playlist.tracks.length)

    // Load tracks data
    const tracks = await loadTracksData(playlist.tracks)
    
    if (tracks.length === 0) {
      console.error('❌ No valid tracks found')
      return {
        success: false,
        error: 'No valid tracks'
      }
    }

    console.log('✅ Tracks data loaded:', tracks.length)

    // Start with first track in Player 1
    const firstTrack = tracks[0]
    console.log('🎵 Loading first track in Player 1:', firstTrack.title)

    await sendLoadCommand('player-001', firstTrack)

    // If there's a second track, preload it in Player 2
    if (tracks.length > 1) {
      const secondTrack = tracks[1]
      console.log('🎵 Preloading second track in Player 2:', secondTrack.title)
      
      // Small delay to ensure Player 1 loads first
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      await sendLoadCommand('player-002', secondTrack)
    }

    return {
      success: true,
      playlistId,
      tracksLoaded: Math.min(2, tracks.length),
      totalTracks: tracks.length,
      currentIndex: 1, // Next track to load
      activePlayer: 1 // Player 1 should play first
    }
  } catch (error) {
    console.error('❌ Error starting cross-fade:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function stopCrossFade() {
  console.log('⏹️ Stopping cross-fade')

  // Send STOP commands to both players
  await sendStopCommand('player-001')
  await sendStopCommand('player-002')

  return {
    success: true,
    message: 'Cross-fade stopped'
  }
}

async function handleTrackEnded(event: any) {
  console.log('🏁 Track ended event:', event)

  // This would be called when a track finishes
  // In the real implementation, this would:
  // 1. Unload the finished track
  // 2. Start playing the other player
  // 3. Load the next track in the freed player

  return {
    success: true,
    message: 'Track ended handled'
  }
}

async function getPlaylist(playlistId: string) {
  console.log('📋 Loading playlist:', playlistId)

  const result = await dynamodb.send(
    new GetCommand({
      TableName: PLAYLIST_TABLE,
      Key: { id: playlistId }
    })
  )

  return result.Item
}

async function loadTracksData(playlistTracks: any[]): Promise<Track[]> {
  console.log('📀 Loading track data for', playlistTracks.length, 'tracks')

  const tracks: Track[] = []

  for (const playlistTrack of playlistTracks) {
    try {
      const result = await dynamodb.send(
        new GetCommand({
          TableName: TRACK_TABLE,
          Key: { id: playlistTrack.trackId }
        })
      )

      if (result.Item) {
        tracks.push({
          id: result.Item.id,
          title: result.Item.title || 'Unknown',
          artist: result.Item.artist || 'Unknown',
          fileUrl: result.Item.fileUrl || '',
          coverArtUrl: result.Item.coverArtUrl,
          waveformUrl: result.Item.waveformUrl,
          duration: result.Item.trackDuration
        })
      }
    } catch (error) {
      console.error(`❌ Error loading track ${playlistTrack.trackId}:`, error)
    }
  }

  return tracks
}

async function sendLoadCommand(playerId: string, track: Track) {
  console.log(`📤 Sending LOAD command to ${playerId}:`, track.title)

  const topic = `radio/player/${playerId}/command`
  const message = {
    command: 'LOAD',
    playerId,
    timestamp: new Date().toISOString(),
    params: {
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        fileUrl: track.fileUrl,
        coverArtUrl: track.coverArtUrl,
        waveformUrl: track.waveformUrl,
        duration: track.duration
      }
    }
  }

  await iot.send(
    new PublishCommand({
      topic,
      payload: Buffer.from(JSON.stringify(message)),
      qos: 1
    })
  )

  console.log(`✅ LOAD command sent to ${playerId}`)
}

async function sendStopCommand(playerId: string) {
  console.log(`📤 Sending STOP command to ${playerId}`)

  const topic = `radio/player/${playerId}/command`
  const message = {
    command: 'STOP',
    playerId,
    timestamp: new Date().toISOString()
  }

  await iot.send(
    new PublishCommand({
      topic,
      payload: Buffer.from(JSON.stringify(message)),
      qos: 1
    })
  )

  console.log(`✅ STOP command sent to ${playerId}`)
}
