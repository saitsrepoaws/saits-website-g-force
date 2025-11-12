/**
 * Stream Status Publisher
 * 
 * Runs every 1 minute via EventBridge
 * Publishes stream status to IoT topic: radio/stream/status
 * 
 * Dynamic Playlist Update Logic:
 * - Tracks track duration and elapsed time
 * - Triggers playlist update N seconds before track end (configurable, default: 60s)
 * - Only triggers for tracks longer than min duration (configurable, default: 60s)
 * - Prevents duplicate triggers with cooldown
 * 
 * Note: EventBridge minimum interval is 1 minute
 */

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const iot = new IoTDataPlaneClient({})
const s3 = new S3Client({})
const dynamoClient = new DynamoDBClient({})
const dynamodb = DynamoDBDocumentClient.from(dynamoClient)
const lambda = new LambdaClient({})

const ICECAST_URL = 'http://46.137.184.91:8000'
const PLAYLIST_BUCKET = process.env.PLAYLIST_BUCKET || ''
const PLAYER_STATE_TABLE = process.env.PLAYER_STATE_TABLE || ''
const SETTINGS_TABLE = process.env.SETTINGS_TABLE || ''
const STREAM_PLAYLIST_UPDATER_FUNCTION = process.env.STREAM_PLAYLIST_UPDATER_FUNCTION || ''
const TRACK_TABLE = process.env.TRACK_TABLE || ''
const IOT_TOPIC = 'radio/stream/status'
const NONSTOP_PLAYER_ID = 'nonstop'

// Default settings
const DEFAULT_TRIGGER_SECONDS = 60 // Trigger 60 sec before track end
const DEFAULT_MIN_TRACK_DURATION = 60 // Only trigger for tracks > 60 sec

/**
 * Get settings from DynamoDB
 */
async function getSettings() {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: 'playlist_update_timing' }
    }))
    
    if (result.Item) {
      return {
        triggerSeconds: result.Item.playlistUpdateTriggerSeconds || DEFAULT_TRIGGER_SECONDS,
        minTrackDuration: result.Item.playlistUpdateMinTrackDuration || DEFAULT_MIN_TRACK_DURATION
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not load settings, using defaults:', error)
  }
  
  return {
    triggerSeconds: DEFAULT_TRIGGER_SECONDS,
    minTrackDuration: DEFAULT_MIN_TRACK_DURATION
  }
}

/**
 * Get track duration from Track table
 */
async function getTrackDuration(trackTitle: string, trackArtist: string): Promise<number | null> {
  try {
    // Search for track by title and artist
    // Note: This is a simplified lookup. In production, you might want a GSI on title+artist
    // For now, we'll use the duration from PlayerState which is updated from Icecast metadata
    return null // Will fall back to Icecast metadata or PlayerState
  } catch (error) {
    console.warn('⚠️ Could not fetch track duration:', error)
    return null
  }
}

/**
 * Trigger playlist updater Lambda
 */
async function triggerPlaylistUpdate() {
  try {
    console.log('🔄 Triggering playlist updater Lambda...')
    
    await lambda.send(new InvokeCommand({
      FunctionName: STREAM_PLAYLIST_UPDATER_FUNCTION,
      InvocationType: 'Event' // Async invocation
    }))
    
    console.log('✅ Playlist updater triggered')
    return true
  } catch (error) {
    console.error('❌ Failed to trigger playlist updater:', error)
    return false
  }
}

export const handler = async (event: any) => {
  console.log('🎙️ Publishing stream status to IoT...')
  
  try {
    // Get settings
    const settings = await getSettings()
    console.log(`⚙️ Settings: trigger=${settings.triggerSeconds}s, minDuration=${settings.minTrackDuration}s`)
    // 1. Fetch Icecast status
    const icecastResponse = await fetch(`${ICECAST_URL}/status-json.xsl`)
    const icecastData = await icecastResponse.json()
    const source = icecastData.icestats?.source
    
    // 2. Fetch current playlist from S3
    let playlist = {
      current: null as string | null,
      queue: [] as string[],
      total: 0
    }
    
    try {
      const s3Response = await s3.send(new GetObjectCommand({
        Bucket: PLAYLIST_BUCKET,
        Key: 'current-playlist.m3u'
      }))
      
      const content = await s3Response.Body?.transformToString()
      
      if (content) {
        const lines = content.split('\n')
        const tracks: string[] = []
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('#EXTINF:')) {
            const match = lines[i].match(/#EXTINF:\d+,(.+)$/)
            if (match) tracks.push(match[1])
          }
        }
        
        playlist = {
          current: tracks[0] || null,
          queue: tracks.slice(1, 6), // Next 5 tracks
          total: tracks.length
        }
      }
    } catch (s3Error) {
      console.warn('Could not fetch playlist:', s3Error)
    }
    
    // 3. Parse current track
    let currentTrack = null
    const metadata = source?.title || source?.yp_currently_playing || ''
    
    if (metadata && metadata !== 'Unknown') {
      const match = metadata.match(/^(.+?)\s*-\s*(.+)$/)
      if (match) {
        currentTrack = {
          artist: match[1].trim(),
          title: match[2].trim()
        }
      }
    }
    
    // 4. Check PlayerState - heeft track gewijzigd?
    let trackChanged = false
    let shouldTriggerUpdate = false
    let trackStartTime: Date | null = null
    let trackDuration = 0
    
    try {
      const playerStateResult = await dynamodb.send(new GetCommand({
        TableName: PLAYER_STATE_TABLE,
        Key: { id: NONSTOP_PLAYER_ID }
      }))
      
      const currentState = playerStateResult.Item
      const newTrackTitle = currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : null
      
      if (!currentState || currentState.currentTrackTitle !== newTrackTitle) {
        trackChanged = true
        trackStartTime = new Date()
        
        // Reset playlist update trigger flag on track change
        await dynamodb.send(new PutCommand({
          TableName: PLAYER_STATE_TABLE,
          Item: {
            id: NONSTOP_PLAYER_ID,
            playerId: NONSTOP_PLAYER_ID,
            currentTrackTitle: currentTrack?.title || null,
            currentTrackArtist: currentTrack?.artist || null,
            status: source ? 'playing' : 'idle',
            duration: 0, // Will be updated once we know it
            trackStartTime: trackStartTime.toISOString(),
            playlistUpdateTriggered: false, // Reset trigger flag
            lastActive: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }))
        
        console.log('🔄 Track changed:', newTrackTitle)
      } else if (currentState) {
        // Same track - check timing for playlist update
        trackStartTime = currentState.trackStartTime ? new Date(currentState.trackStartTime) : null
        trackDuration = currentState.duration || 0
        const playlistUpdateTriggered = currentState.playlistUpdateTriggered || false
        
        if (trackStartTime && trackDuration > settings.minTrackDuration && !playlistUpdateTriggered) {
          // Calculate elapsed time
          const now = new Date()
          const elapsedSeconds = Math.floor((now.getTime() - trackStartTime.getTime()) / 1000)
          const remainingSeconds = trackDuration - elapsedSeconds
          
          console.log(`⏱️ Track timing: elapsed=${elapsedSeconds}s, remaining=${remainingSeconds}s, duration=${trackDuration}s`)
          
          // Trigger if we're within the trigger window
          if (remainingSeconds > 0 && remainingSeconds <= settings.triggerSeconds) {
            shouldTriggerUpdate = true
            console.log(`🎯 Trigger condition met: ${remainingSeconds}s remaining (trigger at ${settings.triggerSeconds}s)`)
            
            // Mark as triggered to prevent duplicate triggers
            await dynamodb.send(new PutCommand({
              TableName: PLAYER_STATE_TABLE,
              Item: {
                ...currentState,
                playlistUpdateTriggered: true,
                lastPlaylistUpdateTrigger: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }))
          }
        }
      }
    } catch (dbError) {
      console.warn('⚠️ Could not update PlayerState:', dbError)
    }
    
    // 5. Build status message
    const status = {
      timestamp: new Date().toISOString(),
      playerId: NONSTOP_PLAYER_ID,
      isLive: !!source,
      currentTrack,
      listeners: source?.listeners || 0,
      bitrate: source?.bitrate || 192,
      playlist,
      trackChanged
    }
    
    // 6. Publish to IoT - broadcast topic
    await iot.send(new PublishCommand({
      topic: IOT_TOPIC,
      payload: Buffer.from(JSON.stringify(status)),
      qos: 0
    }))
    
    // 7. Publish to nonstop player specific topic
    await iot.send(new PublishCommand({
      topic: `radio/player/${NONSTOP_PLAYER_ID}/status`,
      payload: Buffer.from(JSON.stringify(status)),
      qos: 0
    }))
    
    // 8. Send notifications to subscribed users if track changed
    if (trackChanged && currentTrack) {
      try {
        // Get all subscribed users from DynamoDB
        // For now, broadcast to all authenticated users
        // TODO: Add UserNotificationPreferences table to manage subscriptions
        
        const notification = {
          type: 'track_change',
          title: 'Track Changed',
          body: `Now playing: ${currentTrack.artist} - ${currentTrack.title}`,
          playerId: NONSTOP_PLAYER_ID,
          track: currentTrack,
          timestamp: new Date().toISOString()
        }
        
        // Publish to broadcast notification topic (all users)
        // Users subscribe to: user/{userId}/notifications/track_change
        // For demo: use a broadcast topic that all can subscribe to
        await iot.send(new PublishCommand({
          topic: 'notifications/track_change',
          payload: Buffer.from(JSON.stringify(notification)),
          qos: 0
        }))
        
        console.log('📬 Notification sent to users')
      } catch (notifError) {
        console.warn('⚠️ Could not send notification:', notifError)
      }
    }
    
    // 9. Trigger playlist update if needed
    if (shouldTriggerUpdate) {
      await triggerPlaylistUpdate()
    }
    
    console.log('✅ Published stream status to IoT')
    console.log(`   Current: ${currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : 'None'}`)
    console.log(`   Queue: ${playlist.total} tracks`)
    console.log(`   Track changed: ${trackChanged}`)
    console.log(`   Playlist update triggered: ${shouldTriggerUpdate}`)
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        success: true, 
        trackChanged,
        playlistUpdateTriggered: shouldTriggerUpdate 
      }) 
    }
    
  } catch (error) {
    console.error('❌ Error publishing stream status:', error)
    return { statusCode: 500, body: JSON.stringify({ error: String(error) }) }
  }
}
