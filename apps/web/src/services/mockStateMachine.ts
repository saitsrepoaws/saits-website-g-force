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
import { loadScheduleAndDeterminePlaylist } from './scheduleService'
import { calculateCurrentTrack } from '../utils/scheduleCalculator'
import type { PlaylistTrack } from '../utils/scheduleCalculator'

const getClient = () => generateClient()

let isRunning = false
let subscription: any = null
let instanceCount = 0 // Track how many times Mock State Machine was started

/**
 * Start the mock state machine
 * Listens to all player commands and responds
 */
export async function startMockStateMachine() {
  instanceCount++
  
  if (isRunning) {
    console.log(`⚠️ Mock State Machine already running (attempt #${instanceCount})`)
    console.log(`⚠️ MULTIPLE START ATTEMPTS DETECTED!`)
    return
  }

  console.log(`🤖 Starting Mock State Machine (instance #${instanceCount})...`)
  isRunning = true

  try {
    // Subscribe to ALL player command REQUESTS (wildcard)
    // Listen to: radio/player/+/command-request
    // Respond to: radio/player/{playerId}/command
    const topic = 'radio/player/+/command-request'
    console.log(`🎧 Mock State Machine subscribing to: ${topic}`)
    console.log('📝 This simulates the backend State Machine')
    console.log('📥 Listens: command-request')
    console.log('📤 Responds: command')

    subscription = await pubsubService.subscribe(
      { topic },
      async (message: any) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('🤖 MOCK STATE MACHINE RECEIVED')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('Message:', message)
        await handleCommand(message)
      },
      (error: any) => {
        console.error('❌ Mock State Machine error:', error)
      }
    )

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Mock State Machine started!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
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
  // PubSub wraps message in { value: ... }
  const message = data?.value || data
  const command = message?.command
  const playerId = message?.playerId
  const params = message?.params

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🤖 PROCESSING COMMAND:', command)
  console.log('   Player:', playerId)
  console.log('   Params:', params)
  console.log('   Raw data:', data)
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
 * Backend determines which track should play NOW based on schedule
 * Player sends LOAD → Backend calculates → Backend sends track data back
 * 
 * @param playerId - The player requesting the track
 * @param _params - Not used, backend determines everything from schedule
 */
async function handleLoadCommand(playerId: string, _params?: any) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🤖 BACKEND: Determining scheduled track...')
  console.log(`📍 Player ID: ${playerId}`)
  console.log(`📍 Timestamp: ${new Date().toISOString()}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Step 1: Load schedule and find active slot
  const { activeSlot, playlistId } = loadScheduleAndDeterminePlaylist()
  
  if (!activeSlot || !playlistId) {
    console.error('❌ No active schedule slot found')
    console.error('   Player cannot determine track - needs schedule!')
    return
  }
  
  console.log('✅ Active slot:', activeSlot.name, `(${activeSlot.time})`)
  console.log('📋 Scheduled playlist:', playlistId)

  try {
    // Step 2: Fetch playlist data
    // @ts-ignore - Playlist model exists at runtime
    const { data: playlistData } = await getClient().models.Playlist.get({ id: playlistId })
    
    if (!playlistData?.tracks) {
      console.error('❌ Playlist has no tracks')
      return
    }

    console.log('✅ Playlist fetched:', playlistData.name)

    // Step 3: Parse tracks from JSON string
    let parsedTracks: PlaylistTrack[] = []
    
    if (typeof playlistData.tracks === 'string') {
      parsedTracks = JSON.parse(playlistData.tracks)
    } else if (Array.isArray(playlistData.tracks)) {
      parsedTracks = playlistData.tracks
    }

    if (parsedTracks.length === 0) {
      console.error('❌ Playlist is empty')
      return
    }

    // Step 4: Calculate which track should be playing NOW
    const currentTrackInfo = calculateCurrentTrack(
      activeSlot,
      parsedTracks,
      playlistData.name || 'Unnamed Playlist'
    )

    if (!currentTrackInfo) {
      console.error('❌ Could not calculate current track')
      return
    }

    console.log('🎯 Scheduled track (GREEN ROW):')
    console.log('   Index:', currentTrackInfo.trackIndex)
    console.log('   Title:', currentTrackInfo.track.trackTitle || 'Unknown')
    console.log('   Progress:', `${currentTrackInfo.percentComplete}%`)
    console.log('   Start:', currentTrackInfo.trackStartTime)
    console.log('   End:', currentTrackInfo.trackEndTime)

    const scheduledTrack = currentTrackInfo.track

    if (!scheduledTrack.trackId) {
      console.error('❌ No trackId in scheduled track')
      return
    }

    // Step 5: Fetch complete track data from library
    console.log('🔍 Fetching complete track data from library...')
    console.log('   Track ID:', scheduledTrack.trackId)
    // @ts-ignore - Track model exists at runtime
    const { data: trackData } = await getClient().models.Track.get({ 
      id: scheduledTrack.trackId 
    })

    if (!trackData) {
      console.error('❌ Track not found in library')
      return
    }

    console.log('✅ Complete track data fetched!')
    console.log('   Artist:', trackData.artist)
    console.log('   Title:', trackData.title)
    console.log('   Duration:', trackData.duration, 'sec')

    // Step 6: Send LOAD command back with complete track data + schedule info
    const responseTopic = `radio/player/${playerId}/command`
    const responseMessage = {
      command: 'LOAD',
      playerId: playerId,
      timestamp: new Date().toISOString(),
      params: {
        playlistId: playlistId,
        playlistName: playlistData.name,
        slotName: activeSlot.name,
        slotStartTime: activeSlot.time,
        trackIndex: currentTrackInfo.trackIndex,
        trackStartTime: currentTrackInfo.trackStartTime,
        trackEndTime: currentTrackInfo.trackEndTime,
        percentComplete: currentTrackInfo.percentComplete,
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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📤 Sending LOAD response to player...')
    await pubsubService.publish({
      topic: responseTopic,
      message: responseMessage
    })

    console.log('✅ LOAD response sent!')
    console.log('🎯 Backend determined scheduled track!')
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
