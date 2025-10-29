/**
 * Player LOAD Command Handler
 * 
 * Reads schedule from DynamoDB, calculates current track, returns track data
 * Same logic as Mock State Machine but running as AWS Lambda
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

// Get table names from environment (set by CDK)
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE_NAME
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE_NAME  
const TRACK_TABLE = process.env.TRACK_TABLE_NAME

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, timestamp } = event
  const now = new Date(timestamp || Date.now())

  console.log('🎯 Player:', playerId)
  console.log('⏰ Time:', now.toISOString())
  console.log('📅 Finding active schedule...')

  try {
    // Step 1: Find active schedule for current time
    const activeSchedule = await findActiveSchedule(now)
    
    if (!activeSchedule || !activeSchedule.playlistId) {
      console.error('❌ No active schedule found')
      return {
        success: false,
        error: 'No active schedule for current time'
      }
    }

    console.log('✅ Active schedule:', activeSchedule.name, `(${activeSchedule.startTime})`)
    console.log('📋 Playlist ID:', activeSchedule.playlistId)

    // Step 2: Get playlist data
    const playlist = await getPlaylist(activeSchedule.playlistId)
    
    if (!playlist || !playlist.tracks) {
      console.error('❌ Playlist not found or empty')
      return {
        success: false,
        error: 'Playlist not found'
      }
    }

    console.log('✅ Playlist:', playlist.name)

    // Step 3: Parse tracks
    const tracks = typeof playlist.tracks === 'string' 
      ? JSON.parse(playlist.tracks) 
      : playlist.tracks

    if (!tracks || tracks.length === 0) {
      console.error('❌ Playlist has no tracks')
      return {
        success: false,
        error: 'Playlist is empty'
      }
    }

    // Step 4: Calculate which track should be playing NOW
    const trackInfo = calculateCurrentTrack(activeSchedule, tracks, now)

    if (!trackInfo) {
      console.error('❌ Could not calculate current track')
      return {
        success: false,
        error: 'Could not determine track'
      }
    }

    console.log('🎯 Current track (GREEN ROW):')
    console.log('   Index:', trackInfo.trackIndex)
    console.log('   Title:', trackInfo.track.trackTitle)
    console.log('   Progress:', `${trackInfo.percentComplete}%`)

    // Step 5: Get full track data from library
    const fullTrack = await getTrack(trackInfo.track.trackId)

    if (!fullTrack) {
      console.error('❌ Track not found in library')
      return {
        success: false,
        error: 'Track not found'
      }
    }

    console.log('✅ Complete track data retrieved')

    // Step 6: Return response
    return {
      success: true,
      playlistId: activeSchedule.playlistId,
      playlistName: playlist.name,
      slotName: activeSchedule.name,
      slotStartTime: activeSchedule.startTime,
      trackIndex: trackInfo.trackIndex,
      trackStartTime: trackInfo.trackStartTime,
      trackEndTime: trackInfo.trackEndTime,
      percentComplete: trackInfo.percentComplete,
      track: {
        id: fullTrack.id,
        title: fullTrack.title,
        artist: fullTrack.artist,
        album: fullTrack.album,
        fileUrl: fullTrack.fileUrl || fullTrack.audioUrl,
        coverArtUrl: fullTrack.coverArtUrl,
        waveformUrl: fullTrack.waveformUrl,
        duration: fullTrack.duration,
        bpm: fullTrack.bpm,
        key: fullTrack.key,
        energy: fullTrack.energy,
        genre: fullTrack.genre,
        year: fullTrack.year,
        label: fullTrack.label
      }
    }
  } catch (error: any) {
    console.error('❌ Error in LOAD handler:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Helper: Find active schedule for current time
async function findActiveSchedule(now: Date) {
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const currentDay = now.getDay() // 0=Sunday, 1=Monday, etc.

  const { Items } = await dynamodb.send(new ScanCommand({
    TableName: SCHEDULE_TABLE,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: {
      ':active': true
    }
  }))

  if (!Items || Items.length === 0) return null

  // Find schedule matching current time and day
  return Items.find((schedule: any) => {
    // Check day (null = every day)
    if (schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined && schedule.dayOfWeek !== currentDay) {
      return false
    }

    // Check time range
    const startTime = schedule.startTime
    const endTime = schedule.endTime || '23:59'

    return currentTime >= startTime && currentTime < endTime
  })
}

// Helper: Get playlist
async function getPlaylist(id: string) {
  const { Item } = await dynamodb.send(new GetCommand({
    TableName: PLAYLIST_TABLE,
    Key: { id }
  }))
  return Item
}

// Helper: Get track
async function getTrack(id: string) {
  const { Item } = await dynamodb.send(new GetCommand({
    TableName: TRACK_TABLE,
    Key: { id }
  }))
  return Item
}

// Helper: Calculate current track (same logic as frontend scheduleCalculator)
function calculateCurrentTrack(schedule: any, tracks: any[], now: Date) {
  // Parse schedule start time
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number)
  const slotStart = new Date(now)
  slotStart.setHours(startHour, startMinute, 0, 0)

  // Calculate elapsed time in slot
  const elapsedMs = now.getTime() - slotStart.getTime()
  if (elapsedMs < 0) return null // Before slot start

  const elapsedSec = Math.floor(elapsedMs / 1000)

  // Find which track is playing
  let cumulativeSec = 0
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    const trackDuration = track.trackDuration || 180 // Fallback 3 min

    if (elapsedSec < cumulativeSec + trackDuration) {
      // This is the current track!
      const trackElapsed = elapsedSec - cumulativeSec
      const percentComplete = Math.floor((trackElapsed / trackDuration) * 100)

      const trackStart = new Date(slotStart.getTime() + cumulativeSec * 1000)
      const trackEnd = new Date(trackStart.getTime() + trackDuration * 1000)

      return {
        track,
        trackIndex: i,
        trackStartTime: `${trackStart.getHours().toString().padStart(2, '0')}:${trackStart.getMinutes().toString().padStart(2, '0')}:${trackStart.getSeconds().toString().padStart(2, '0')}`,
        trackEndTime: `${trackEnd.getHours().toString().padStart(2, '0')}:${trackEnd.getMinutes().toString().padStart(2, '0')}:${trackEnd.getSeconds().toString().padStart(2, '0')}`,
        percentComplete
      }
    }

    cumulativeSec += trackDuration
  }

  // Past all tracks - return last track
  const lastTrack = tracks[tracks.length - 1]
  return {
    track: lastTrack,
    trackIndex: tracks.length - 1,
    trackStartTime: '??:??:??',
    trackEndTime: '??:??:??',
    percentComplete: 100
  }
}
