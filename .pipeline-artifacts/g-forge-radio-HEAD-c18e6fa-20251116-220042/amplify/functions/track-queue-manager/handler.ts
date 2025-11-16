/**
 * Track Queue Manager Lambda - HYBRID SQS STREAMING
 * 
 * Maintains queue of exactly 2 tracks:
 * - Track 1: Currently playing
 * - Track 2: Next up (buffered)
 * 
 * Triggers:
 * 1. EventBridge (hourly) - Initial load
 * 2. Liquidsoap invoke (async) - Add next track when queue < 2
 * 3. Manual/API - Playlist changes
 * 
 * Architecture: Just-in-time streaming with minimal buffer
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { SQSClient, SendMessageCommand, GetQueueAttributesCommand, PurgeQueueCommand } from '@aws-sdk/client-sqs'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const sqs = new SQSClient({})
const s3 = new S3Client({})

// Environment variables
const QUEUE_URL = process.env.QUEUE_URL!
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE!
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE!
const TRACK_TABLE = process.env.TRACK_TABLE!
const SETTINGS_TABLE = process.env.SETTINGS_TABLE!
const STORAGE_BUCKET = process.env.STORAGE_BUCKET!

interface Track {
  trackId: string
  trackTitle: string
  trackArtist?: string
  trackDuration: number
  fileUrl: string
  coverArtUrl?: string
  genre?: string
  bpm?: number
}

interface PlaylistState {
  playlistId: string
  currentPosition: number
  lastUpdated: string
}

/**
 * Get current queue size
 */
async function getQueueSize(): Promise<number> {
  try {
    const result = await sqs.send(new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    }))
    
    const visible = parseInt(result.Attributes?.ApproximateNumberOfMessages || '0')
    const processing = parseInt(result.Attributes?.ApproximateNumberOfMessagesNotVisible || '0')
    const total = visible + processing
    
    console.log(`📊 Queue state: ${visible} visible, ${processing} processing, ${total} total`)
    return total
  } catch (error) {
    console.error('❌ Failed to get queue size:', error)
    return 0
  }
}

/**
 * Get current schedule slot (CET timezone)
 */
async function getCurrentScheduleSlot() {
  const nowUTC = new Date()
  const nowCET = new Date(nowUTC.getTime() + (60 * 60 * 1000))
  
  const dayOfWeek = nowCET.getUTCDay()
  const hours = nowCET.getUTCHours().toString().padStart(2, '0')
  const minutes = nowCET.getUTCMinutes().toString().padStart(2, '0')
  const currentTime = `${hours}:${minutes}`
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const currentDayName = dayNames[dayOfWeek]
  
  console.log(`🗓️ Current time: ${currentDayName} ${currentTime} CET`)
  
  const { Items = [] } = await dynamodb.send(new ScanCommand({
    TableName: SCHEDULE_TABLE
  }))
  
  for (const slot of Items) {
    const slotDay = slot.dayOfWeek
    const slotStart = slot.startTime
    const slotEnd = slot.endTime
    
    const dayMatches = (slotDay === null || slotDay === undefined) || slotDay === dayOfWeek
    
    let timeMatches = false
    if (slotEnd) {
      timeMatches = currentTime >= slotStart && currentTime < slotEnd
    } else {
      const slotHour = parseInt(slotStart.split(':')[0])
      const currentHour = parseInt(currentTime.split(':')[0])
      timeMatches = currentHour === slotHour
    }
    
    if (dayMatches && timeMatches && slot.isActive) {
      console.log(`✅ Found active slot: ${slot.name || 'Hourly Slot'}`)
      return slot
    }
  }
  
  console.log('⚠️ No active schedule slot found')
  return null
}

/**
 * Get playlist state from DynamoDB
 */
async function getPlaylistState(playlistId: string): Promise<PlaylistState> {
  try {
    const { Item } = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: `playlist_state_${playlistId}` }
    }))
    
    if (Item) {
      return {
        playlistId: Item.playlistId,
        currentPosition: Item.currentPosition || 0,
        lastUpdated: Item.lastUpdated
      }
    }
  } catch (error) {
    console.log('⚠️ No playlist state found, starting from position 0')
  }
  
  return {
    playlistId,
    currentPosition: 0,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Update playlist state in DynamoDB
 */
async function updatePlaylistState(state: PlaylistState): Promise<void> {
  try {
    await dynamodb.send(new UpdateCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: `playlist_state_${state.playlistId}` },
      UpdateExpression: 'SET playlistId = :pid, currentPosition = :pos, lastUpdated = :updated',
      ExpressionAttributeValues: {
        ':pid': state.playlistId,
        ':pos': state.currentPosition,
        ':updated': new Date().toISOString()
      }
    }))
    console.log(`✅ Updated playlist state: position ${state.currentPosition}`)
  } catch (error) {
    console.error('❌ Failed to update playlist state:', error)
  }
}

/**
 * Get playlist with all tracks
 */
async function getPlaylist(playlistId: string) {
  const { Item: playlist } = await dynamodb.send(new GetCommand({
    TableName: PLAYLIST_TABLE,
    Key: { id: playlistId }
  }))
  
  if (!playlist) {
    throw new Error(`Playlist ${playlistId} not found`)
  }
  
  const tracks: Track[] = JSON.parse(playlist.tracks || '[]')
  console.log(`🎵 Playlist: ${playlist.name} (${tracks.length} tracks)`)
  
  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    tracks
  }
}

/**
 * Get full track details from Track table
 */
async function getFullTrack(trackId: string): Promise<Track | null> {
  try {
    const { Item } = await dynamodb.send(new GetCommand({
      TableName: TRACK_TABLE,
      Key: { id: trackId }
    }))
    
    if (!Item) {
      console.error(`❌ Track ${trackId} not found`)
      return null
    }
    
    let fileUrl = Item.fileUrl
    let s3Key = fileUrl
    
    // Convert to S3 key if needed
    if (fileUrl && !fileUrl.startsWith('s3://') && !fileUrl.startsWith('http')) {
      s3Key = fileUrl
    } else if (fileUrl && fileUrl.startsWith('s3://')) {
      s3Key = fileUrl.replace(`s3://${STORAGE_BUCKET}/`, '')
    }
    
    // Generate pre-signed URL (valid for 1 hour)
    try {
      const command = new GetObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: s3Key
      })
      fileUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })
      console.log(`✅ Generated signed URL for ${s3Key}`)
    } catch (error) {
      console.error(`❌ Failed to generate signed URL for ${s3Key}:`, error)
      // Fallback to S3 URL
      fileUrl = `s3://${STORAGE_BUCKET}/${s3Key}`
    }
    
    return {
      trackId: Item.id,
      trackTitle: Item.title,
      trackArtist: Item.artist,
      trackDuration: Item.duration || 180,
      fileUrl,
      coverArtUrl: Item.coverArtUrl,
      genre: Item.genre,
      bpm: Item.bpm
    }
  } catch (error) {
    console.error(`❌ Failed to get track ${trackId}:`, error)
    return null
  }
}

/**
 * Send track to SQS queue
 */
async function sendTrackToQueue(track: Track, position: number, playlistName: string): Promise<boolean> {
  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageGroupId: 'radio-stream',
      MessageDeduplicationId: `${track.trackId}-${Date.now()}-${position}`,
      MessageBody: JSON.stringify({
        trackId: track.trackId,
        title: track.trackTitle,
        artist: track.trackArtist || 'Unknown',
        fileUrl: track.fileUrl,
        duration: track.trackDuration,
        coverArtUrl: track.coverArtUrl || '',
        genre: track.genre || '',
        bpm: track.bpm || 0,
        playlistPosition: position,
        playlistName
      }),
      MessageAttributes: {
        title: { DataType: 'String', StringValue: track.trackTitle },
        artist: { DataType: 'String', StringValue: track.trackArtist || 'Unknown' },
        trackId: { DataType: 'String', StringValue: track.trackId }
      }
    }))
    
    console.log(`✅ Queued track ${position + 1}: ${track.trackArtist} - ${track.trackTitle}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to queue track:`, error)
    return false
  }
}

/**
 * Main handler
 */
export const handler = async (event: any) => {
  console.log('🎵 Track Queue Manager - Starting...')
  console.log(`⏰ Triggered at: ${new Date().toISOString()}`)
  console.log(`📋 Event source: ${event.source || 'Manual'}`)
  
  try {
    // 1. Check current queue size
    const queueSize = await getQueueSize()
    
    // Special case: Purge queue if requested (playlist change)
    if (event.action === 'purge') {
      console.log('🧹 Purging queue (playlist change requested)...')
      await sqs.send(new PurgeQueueCommand({ QueueUrl: QUEUE_URL }))
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for purge
      console.log('✅ Queue purged')
      // Continue to add new tracks
    }
    
    // If queue already has 2+ tracks, nothing to do (unless purge was requested)
    if (queueSize >= 2 && event.action !== 'purge') {
      console.log('✅ Queue is full (2 tracks), nothing to do')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Queue full',
          queueSize
        })
      }
    }
    
    // 2. Get current schedule and playlist
    const slot = await getCurrentScheduleSlot()
    
    if (!slot || !slot.playlistId) {
      console.log('⚠️ No active schedule slot, cannot add tracks')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'No active schedule slot'
        })
      }
    }
    
    // 3. Get playlist and current position
    const { playlistId, playlistName, tracks } = await getPlaylist(slot.playlistId)
    
    if (tracks.length === 0) {
      console.log('⚠️ Playlist has no tracks')
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Playlist empty'
        })
      }
    }
    
    // Get playlist state
    const state = await getPlaylistState(playlistId)
    let currentPosition = state.currentPosition
    
    // 4. Calculate how many tracks to add (to reach 2 total)
    const tracksToAdd = Math.min(2 - queueSize, tracks.length)
    console.log(`📥 Need to add ${tracksToAdd} track(s) to queue`)
    
    // 5. Add tracks
    let addedCount = 0
    for (let i = 0; i < tracksToAdd; i++) {
      const position = (currentPosition + i) % tracks.length // Loop playlist
      const trackBasic = tracks[position]
      
      // Get full track details
      const track = await getFullTrack(trackBasic.trackId)
      
      if (!track) {
        console.log(`⚠️ Skipping track at position ${position} (not found)`)
        continue
      }
      
      // Send to queue
      const success = await sendTrackToQueue(track, position, playlistName)
      if (success) {
        addedCount++
      }
    }
    
    // 6. Update playlist position
    const newPosition = (currentPosition + addedCount) % tracks.length
    await updatePlaylistState({
      playlistId,
      currentPosition: newPosition,
      lastUpdated: new Date().toISOString()
    })
    
    // 7. Get final queue size
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for messages to appear
    const finalQueueSize = await getQueueSize()
    
    console.log(`✅ Successfully added ${addedCount} track(s)`)
    console.log(`📊 Final queue size: ${finalQueueSize}`)
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        tracksAdded: addedCount,
        currentPosition: newPosition,
        queueSize: finalQueueSize,
        playlistName,
        slot: {
          name: slot.name || slot.slotName,
          day: slot.dayOfWeek === null ? 'Every day' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek],
          time: `${slot.startTime}-${slot.endTime || 'next hour'}`
        }
      })
    }
  } catch (error) {
    console.error('❌ Error in track queue manager:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
