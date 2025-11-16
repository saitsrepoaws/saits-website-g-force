/**
 * Track Completion Handler
 * 
 * Triggered when Liquidsoap finishes playing a track
 * - Records play in TrackPlayHistory
 * - Updates Track play statistics
 * 
 * Trigger: IoT Core message on 'radio/stream/status' topic
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TRACK_TABLE = process.env.TRACK_TABLE || ''
const PLAY_HISTORY_TABLE = process.env.PLAY_HISTORY_TABLE || ''
const STREAM_QUEUE_TRACK_TABLE = process.env.STREAM_QUEUE_TRACK_TABLE || ''

interface StreamStatus {
  nowPlaying?: {
    trackId?: string
    artist?: string
    title?: string
    listeners?: number
    startedAt?: string
  }
  previousTrack?: {
    trackId?: string
    artist?: string
    title?: string
    duration?: number
    playlistId?: string
    playlistName?: string
  }
}

export const handler = async (event: any) => {
  console.log('🎵 Track Completion Handler - Processing...')
  
  try {
    // Parse IoT message
    const message: StreamStatus = typeof event === 'string' ? JSON.parse(event) : event
    
    // Check if we have a completed track (previousTrack)
    if (!message.previousTrack?.trackId) {
      console.log('No completed track in message, skipping...')
      return { statusCode: 200, body: 'No action needed' }
    }
    
    const track = message.previousTrack
    const now = new Date().toISOString()
    
    console.log(`📊 Recording play: ${track.artist} - ${track.title}`)
    
    // 1. Record play in TrackPlayHistory
    const playHistoryId = `${Date.now()}-${track.trackId}`
    await dynamodb.send(new PutCommand({
      TableName: PLAY_HISTORY_TABLE,
      Item: {
        id: playHistoryId,
        trackId: track.trackId,
        artist: track.artist || 'Unknown',
        title: track.title || 'Unknown',
        playlistId: track.playlistId,
        playlistName: track.playlistName,
        playedAt: now,
        duration: track.duration || 0,
        source: 'stream',
        listeners: message.nowPlaying?.listeners || 0,
        skipped: false,
        createdAt: now,
        updatedAt: now,
      }
    }))
    
    console.log(`✅ Play history recorded: ${playHistoryId}`)
    
    // 2. Get current track stats for averaging
    const { Items: playHistory = [] } = await dynamodb.send(new QueryCommand({
      TableName: PLAY_HISTORY_TABLE,
      IndexName: 'trackId-playedAt-index',
      KeyConditionExpression: 'trackId = :trackId',
      ExpressionAttributeValues: {
        ':trackId': track.trackId
      },
      ScanIndexForward: false,
      Limit: 100
    }))
    
    const playCount = playHistory.length
    const totalListeners = playHistory.reduce((sum: number, play: any) => sum + (play.listeners || 0), 0)
    const averageListeners = playCount > 0 ? totalListeners / playCount : 0
    const popularityScore = playCount * (1 + averageListeners / 10) // Simple formula
    
    // 3. Update Track statistics
    await dynamodb.send(new UpdateCommand({
      TableName: TRACK_TABLE,
      Key: { id: track.trackId },
      UpdateExpression: `
        SET playCount = :playCount,
            lastPlayedAt = :now,
            totalListeners = :totalListeners,
            averageListeners = :avgListeners,
            popularityScore = :popularity,
            updatedAt = :now
      `,
      ExpressionAttributeValues: {
        ':playCount': playCount,
        ':now': now,
        ':totalListeners': totalListeners,
        ':avgListeners': averageListeners,
        ':popularity': popularityScore
      }
    }))
    
    console.log(`✅ Track stats updated: playCount=${playCount}, avgListeners=${averageListeners.toFixed(1)}`)
    
    // 4. Mark queue item as completed (if exists in StreamQueueTrack)
    if (STREAM_QUEUE_TRACK_TABLE) {
      try {
        // Find recent queue entry for this track
        const { Items: queueItems = [] } = await dynamodb.send(new QueryCommand({
          TableName: STREAM_QUEUE_TRACK_TABLE,
          FilterExpression: 'trackId = :trackId AND #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':trackId': track.trackId,
            ':status': 'queued'
          },
          Limit: 1
        }))
        
        if (queueItems.length > 0) {
          await dynamodb.send(new UpdateCommand({
            TableName: STREAM_QUEUE_TRACK_TABLE,
            Key: { id: queueItems[0].id },
            UpdateExpression: 'SET #status = :completed, completedAt = :now, updatedAt = :now',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':completed': 'completed',
              ':now': now
            }
          }))
          
          console.log(`✅ Queue item marked as completed`)
        }
      } catch (err) {
        console.warn('Could not update queue item:', err)
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        trackId: track.trackId,
        playCount,
        averageListeners
      })
    }
  } catch (error) {
    console.error('❌ Error processing track completion:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
