/**
 * Stream Monitor Lambda
 * Provides monitoring data for the frontend
 */
import { SQSClient, GetQueueAttributesCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const sqs = new SQSClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TRACK_QUEUE_URL = process.env.TRACK_QUEUE_URL || ''
const STREAM_QUEUE_TRACK_TABLE = process.env.STREAM_QUEUE_TRACK_TABLE || ''

interface Track {
  artist?: string
  title?: string
  version?: string
  trackDuration?: number
}

interface QueuedTrack {
  trackId: string
  artist?: string
  title?: string
  version?: string
  trackDuration?: number
  position: number
  queuedAt: string
  status: string
}

export const handler = async (event: any) => {
  console.log('📊 Stream Monitor - Getting status...')
  
  try {
    // Get SQS queue attributes
    const queueAttrs = await sqs.send(new GetQueueAttributesCommand({
      QueueUrl: TRACK_QUEUE_URL,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed'
      ]
    }))
    
    const available = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessages || '0')
    const inFlight = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessagesNotVisible || '0')
    const delayed = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessagesDelayed || '0')
    
    console.log(`Queue: ${available} available, ${inFlight} in-flight, ${delayed} delayed`)
    
    // Get track details from available messages (without removing them)
    const tracks: Track[] = []
    if (available > 0) {
      try {
        const messagesResponse = await sqs.send(new ReceiveMessageCommand({
          QueueUrl: TRACK_QUEUE_URL,
          MaxNumberOfMessages: Math.min(10, available), // Get up to 10 tracks
          VisibilityTimeout: 1, // Return to queue after 1 second
          WaitTimeSeconds: 0
        }))
        
        if (messagesResponse.Messages) {
          for (const message of messagesResponse.Messages) {
            if (message.Body) {
              const track = JSON.parse(message.Body)
              tracks.push({
                artist: track.artist || 'Unknown Artist',
                title: track.title || 'Unknown Title',
                version: track.version,
                trackDuration: track.trackDuration
              })
            }
          }
        }
        console.log(`📋 Found ${tracks.length} available tracks in queue`)
      } catch (error) {
        console.warn('⚠️ Could not fetch track details:', error)
      }
    }
    
    // Get queue history from DynamoDB (shows all queued tracks including in-flight)
    const queueHistory: QueuedTrack[] = []
    if (STREAM_QUEUE_TRACK_TABLE) {
      try {
        const cutoffTime = new Date(Date.now() - 60 * 60 * 1000).toISOString() // Last hour
        
        const { Items = [] } = await dynamodb.send(new ScanCommand({
          TableName: STREAM_QUEUE_TRACK_TABLE,
          FilterExpression: 'queuedAt > :cutoff AND #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':cutoff': cutoffTime,
            ':status': 'queued'
          },
          Limit: 20
        }))
        
        for (const item of Items) {
          queueHistory.push({
            trackId: item.trackId || '',
            artist: item.artist,
            title: item.title,
            version: item.version,
            trackDuration: item.trackDuration,
            position: item.position || 0,
            queuedAt: item.queuedAt || '',
            status: item.status || 'queued'
          })
        }
        
        // Sort by queued time
        queueHistory.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())
        
        console.log(`📋 Found ${queueHistory.length} queued tracks in history`)
      } catch (error) {
        console.warn('⚠️ Could not fetch queue history:', error)
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        queue: {
          available,
          inFlight,
          delayed,
          total: available + inFlight + delayed,
          tracks, // Available tracks from SQS
          queueHistory // All queued tracks from DynamoDB (last hour)
        },
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('❌ Error getting monitor data:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
