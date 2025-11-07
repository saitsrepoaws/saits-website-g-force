/**
 * Stream Status Publisher
 * 
 * Runs every 10 seconds via EventBridge
 * Publishes stream status to IoT topic: radio/stream/status
 */

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const iot = new IoTDataPlaneClient({})
const s3 = new S3Client({})
const dynamoClient = new DynamoDBClient({})
const dynamodb = DynamoDBDocumentClient.from(dynamoClient)

const ICECAST_URL = 'http://46.137.184.91:8000'
const PLAYLIST_BUCKET = process.env.PLAYLIST_BUCKET || ''
const PLAYER_STATE_TABLE = process.env.PLAYER_STATE_TABLE || ''
const IOT_TOPIC = 'radio/stream/status'
const NONSTOP_PLAYER_ID = 'nonstop'

export const handler = async (event: any) => {
  console.log('🎙️ Publishing stream status to IoT...')
  
  try {
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
    try {
      const playerStateResult = await dynamodb.send(new GetCommand({
        TableName: PLAYER_STATE_TABLE,
        Key: { id: NONSTOP_PLAYER_ID }
      }))
      
      const currentState = playerStateResult.Item
      const newTrackTitle = currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : null
      
      if (!currentState || currentState.currentTrackTitle !== newTrackTitle) {
        trackChanged = true
        
        // Update PlayerState in DynamoDB
        await dynamodb.send(new PutCommand({
          TableName: PLAYER_STATE_TABLE,
          Item: {
            id: NONSTOP_PLAYER_ID,
            playerId: NONSTOP_PLAYER_ID,
            currentTrackTitle: currentTrack?.title || null,
            currentTrackArtist: currentTrack?.artist || null,
            status: source ? 'playing' : 'idle',
            lastActive: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }))
        
        console.log('🔄 Track changed:', newTrackTitle)
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
    
    console.log('✅ Published stream status to IoT')
    console.log(`   Current: ${currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : 'None'}`)
    console.log(`   Queue: ${playlist.total} tracks`)
    console.log(`   Track changed: ${trackChanged}`)
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) }
    
  } catch (error) {
    console.error('❌ Error publishing stream status:', error)
    return { statusCode: 500, body: JSON.stringify({ error: String(error) }) }
  }
}
