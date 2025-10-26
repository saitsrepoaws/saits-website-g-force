/**
 * Mock State Machine
 * 
 * Simulates backend State Machine behavior for development/testing
 * Listens to player commands and responds with appropriate data
 * 
 * In production, this will be replaced by AWS Lambda
 */

import { generateClient } from 'aws-amplify/data'
import * as pubsubService from './pubsub'

const getClient = () => generateClient()

let isRunning = false
let subscription: any = null

/**
 * Start the mock state machine
 * Listens to all player commands and responds
 */
export async function startMockStateMachine() {
  if (isRunning) {
    console.log('⚠️ Mock State Machine already running')
    return
  }

  console.log('🤖 Starting Mock State Machine...')
  isRunning = true

  try {
    // Subscribe to ALL player commands (wildcard)
    const topic = 'radio/player/+/command'
    console.log(`🎧 Mock State Machine subscribing to: ${topic}`)

    subscription = await pubsubService.subscribe(
      { topic },
      async (message: any) => {
        console.log('🤖 Mock State Machine received command:', message)
        await handleCommand(message)
      },
      (error: any) => {
        console.error('❌ Mock State Machine error:', error)
      }
    )

    console.log('✅ Mock State Machine started!')
  } catch (error) {
    console.error('❌ Failed to start Mock State Machine:', error)
    isRunning = false
  }
}

/**
 * Stop the mock state machine
 */
export function stopMockStateMachine() {
  if (!isRunning) {
    console.log('⚠️ Mock State Machine not running')
    return
  }

  console.log('🛑 Stopping Mock State Machine...')
  
  if (subscription) {
    subscription.unsubscribe()
    subscription = null
  }

  isRunning = false
  console.log('✅ Mock State Machine stopped')
}

/**
 * Handle incoming command
 */
async function handleCommand(data: any) {
  const { value } = data
  const command = value?.command
  const playerId = value?.playerId
  const params = value?.params

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🤖 PROCESSING COMMAND:', command)
  console.log('   Player:', playerId)
  console.log('   Params:', params)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  switch (command) {
    case 'LOAD':
      await handleLoadCommand(playerId, params)
      break

    case 'PLAY':
      await handlePlayCommand(playerId)
      break

    case 'PAUSE':
      await handlePauseCommand(playerId)
      break

    case 'STOP':
      await handleStopCommand(playerId)
      break

    case 'UNLOAD':
      await handleUnloadCommand(playerId)
      break

    default:
      console.warn('⚠️ Unknown command:', command)
  }
}

/**
 * Handle LOAD command
 * Fetch playlist, get first track, send back complete track data
 */
async function handleLoadCommand(playerId: string, params: any) {
  const playlistId = params?.playlistId

  if (!playlistId) {
    console.error('❌ LOAD command missing playlistId')
    return
  }

  console.log('📋 Fetching playlist:', playlistId)

  try {
    // @ts-ignore - Playlist model exists at runtime
    const { data: playlistData } = await getClient().models.Playlist.get({ id: playlistId })
    
    if (!playlistData?.tracks) {
      console.error('❌ Playlist has no tracks')
      return
    }

    console.log('✅ Playlist fetched:', playlistData.name)

    // Parse tracks from JSON string
    let parsedTracks: any[] = []
    
    if (typeof playlistData.tracks === 'string') {
      parsedTracks = JSON.parse(playlistData.tracks)
    } else if (Array.isArray(playlistData.tracks)) {
      parsedTracks = playlistData.tracks
    }

    if (parsedTracks.length === 0) {
      console.error('❌ Playlist is empty')
      return
    }

    // Sort by order and get first track
    const sortedTracks = [...parsedTracks].sort((a, b) => {
      return (a.order ?? 0) - (b.order ?? 0)
    })

    const firstPlaylistTrack = sortedTracks[0]
    console.log('🎵 First track in playlist:', firstPlaylistTrack)

    if (!firstPlaylistTrack.trackId) {
      console.error('❌ No trackId in playlist track')
      return
    }

    // Fetch complete track data from library
    console.log('🔍 Fetching track from library...')
    // @ts-ignore - Track model exists at runtime
    const { data: trackData } = await getClient().models.Track.get({ 
      id: firstPlaylistTrack.trackId 
    })

    if (!trackData) {
      console.error('❌ Track not found in library')
      return
    }

    console.log('✅ Track fetched:', trackData.title)

    // Send LOAD command back with complete track data
    const responseTopic = `radio/player/${playerId}/command`
    const responseMessage = {
      command: 'LOAD',
      playerId: playerId,
      timestamp: new Date().toISOString(),
      params: {
        playlistId: playlistId,
        track: {
          id: trackData.id,
          title: trackData.title,
          artist: trackData.artist,
          album: trackData.album,
          fileUrl: trackData.fileUrl || trackData.audioUrl,
          coverArtUrl: trackData.coverArtUrl,
          waveformUrl: trackData.waveformUrl,
          duration: trackData.duration,
          bpm: trackData.bpm,
          key: trackData.key,
          energy: trackData.energy,
          genre: trackData.genre,
          year: trackData.year,
          label: trackData.label
        }
      }
    }

    console.log('📤 Sending LOAD response to player...')
    await pubsubService.publish({
      topic: responseTopic,
      message: responseMessage
    })

    console.log('✅ LOAD response sent!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('❌ Failed to handle LOAD command:', error)
  }
}

/**
 * Handle PLAY command
 */
async function handlePlayCommand(playerId: string) {
  console.log('▶️ Processing PLAY command')

  const responseTopic = `radio/player/${playerId}/command`
  const responseMessage = {
    command: 'PLAY',
    playerId: playerId,
    timestamp: new Date().toISOString()
  }

  await pubsubService.publish({
    topic: responseTopic,
    message: responseMessage
  })

  console.log('✅ PLAY response sent!')
}

/**
 * Handle PAUSE command
 */
async function handlePauseCommand(playerId: string) {
  console.log('⏸️ Processing PAUSE command')

  const responseTopic = `radio/player/${playerId}/command`
  const responseMessage = {
    command: 'PAUSE',
    playerId: playerId,
    timestamp: new Date().toISOString()
  }

  await pubsubService.publish({
    topic: responseTopic,
    message: responseMessage
  })

  console.log('✅ PAUSE response sent!')
}

/**
 * Handle STOP command
 */
async function handleStopCommand(playerId: string) {
  console.log('⏹️ Processing STOP command')

  const responseTopic = `radio/player/${playerId}/command`
  const responseMessage = {
    command: 'STOP',
    playerId: playerId,
    timestamp: new Date().toISOString()
  }

  await pubsubService.publish({
    topic: responseTopic,
    message: responseMessage
  })

  console.log('✅ STOP response sent!')
}

/**
 * Handle UNLOAD command
 */
async function handleUnloadCommand(playerId: string) {
  console.log('⏏️ Processing UNLOAD command')

  const responseTopic = `radio/player/${playerId}/command`
  const responseMessage = {
    command: 'UNLOAD',
    playerId: playerId,
    timestamp: new Date().toISOString()
  }

  await pubsubService.publish({
    topic: responseTopic,
    message: responseMessage
  })

  console.log('✅ UNLOAD response sent!')
}
