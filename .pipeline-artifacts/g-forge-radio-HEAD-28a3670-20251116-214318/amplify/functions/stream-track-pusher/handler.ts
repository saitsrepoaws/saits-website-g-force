/**
 * Stream Track Pusher Lambda - SMART BUFFERING
 * 
 * Runs every 2-3 minutes via EventBridge
 * Maintains 2-track buffer on EC2
 * 
 * FLOW:
 * 1. Check EC2: How many tracks are currently downloaded?
 * 2. If < 3 tracks → Push next track from playlist
 * 3. Download 1 track from S3 to EC2
 * 4. Append to M3U playlist
 * 5. Liquidsoap automatically picks it up!
 * 
 * BENEFITS:
 * - Minimal disk usage (~120MB = 2-3 tracks)
 * - Real-time playlist updates (2-track delay)
 * - Always smooth playback
 * - Flexible: can reorder/skip tracks on the fly
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const ssm = new SSMClient({})

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || ''
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE || ''
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE || ''
const TRACK_TABLE = process.env.TRACK_TABLE || ''
const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || ''

// DynamoDB table to track playlist state
const STATE_TABLE = 'RadioStreamState'

interface Track {
  trackId: string
  trackTitle: string
  trackArtist?: string
  trackDuration: number
  fileUrl: string
}

interface PlaylistState {
  currentPlaylistId: string
  currentTrackIndex: number
  lastUpdated: string
}

/**
 * Get current track count on EC2
 */
async function getCurrentTrackCount(): Promise<number> {
  const result = await ssm.send(new SendCommandCommand({
    InstanceIds: [EC2_INSTANCE_ID],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [
        'ls /var/radio/tracks/*.mp3 /var/radio/tracks/*.wav 2>/dev/null | grep -v news-latest.mp3 | wc -l'
      ]
    }
  }))
  
  const commandId = result.Command?.CommandId
  if (!commandId) return 0
  
  // Wait for result
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const invocation = await ssm.send(new GetCommandInvocationCommand({
    CommandId: commandId,
    InstanceId: EC2_INSTANCE_ID
  }))
  
  const output = invocation.StandardOutputContent || '0'
  return parseInt(output.trim())
}

/**
 * Get playlist state from DynamoDB
 */
async function getPlaylistState(): Promise<PlaylistState | null> {
  try {
    // For now, we'll get current schedule
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()
    
    // Find active slot
    const scheduleResult = await dynamodb.send(new ScanCommand({
      TableName: SCHEDULE_TABLE,
      FilterExpression: 'startTime = :hour OR (dayOfWeek = :day AND startTime = :hour)',
      ExpressionAttributeValues: {
        ':hour': `${currentHour.toString().padStart(2, '0')}:00`,
        ':day': currentDay
      }
    }))
    
    const slot = scheduleResult.Items?.[0]
    if (!slot) return null
    
    return {
      currentPlaylistId: slot.playlistId,
      currentTrackIndex: 0, // We'll track this separately
      lastUpdated: new Date().toISOString()
    }
  } catch (err) {
    console.error('Failed to get playlist state:', err)
    return null
  }
}

/**
 * Get next track from playlist
 */
async function getNextTrack(playlistId: string, currentIndex: number): Promise<Track | null> {
  try {
    // Get playlist items
    const result = await dynamodb.send(new QueryCommand({
      TableName: PLAYLIST_TABLE,
      KeyConditionExpression: 'playlistId = :pid',
      ExpressionAttributeValues: {
        ':pid': playlistId
      }
    }))
    
    const items = result.Items || []
    if (items.length === 0) return null
    
    // Sort by trackOrder
    items.sort((a: any, b: any) => (a.trackOrder || 0) - (b.trackOrder || 0))
    
    // Get track at index (cycling)
    const trackIndex = currentIndex % items.length
    const playlistItem = items[trackIndex]
    
    // Fetch full track details
    const trackResult = await dynamodb.send(new GetCommand({
      TableName: TRACK_TABLE,
      Key: { trackId: playlistItem.trackId }
    }))
    
    return trackResult.Item as Track
  } catch (err) {
    console.error('Failed to get next track:', err)
    return null
  }
}

/**
 * Download single track to EC2
 */
async function downloadTrackToEC2(s3Url: string, localPath: string): Promise<void> {
  const command = `aws s3 cp "${s3Url}" "${localPath}" --region eu-west-1 --quiet && chmod 644 "${localPath}"`
  
  const result = await ssm.send(new SendCommandCommand({
    InstanceIds: [EC2_INSTANCE_ID],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [command]
    }
  }))
  
  const commandId = result.Command?.CommandId
  if (!commandId) throw new Error('No CommandId returned')
  
  // Wait for completion
  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const invocation = await ssm.send(new GetCommandInvocationCommand({
      CommandId: commandId,
      InstanceId: EC2_INSTANCE_ID
    }))
    
    if (invocation.Status === 'Success') return
    if (invocation.Status === 'Failed') throw new Error('Download failed')
  }
}

/**
 * Append track to M3U playlist
 */
async function appendToM3U(track: Track, localPath: string): Promise<void> {
  const duration = track.trackDuration || 180
  const artist = track.trackArtist || 'Unknown Artist'
  const title = track.trackTitle || 'Unknown'
  
  const m3uEntry = `#EXTINF:${duration},${artist} - ${title}\n${localPath}\n`
  
  const command = `echo '${m3uEntry}' >> /var/radio/playlists/current.m3u`
  
  await ssm.send(new SendCommandCommand({
    InstanceIds: [EC2_INSTANCE_ID],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [command]
    }
  }))
}

/**
 * Main handler
 */
export const handler = async (event: any) => {
  console.log('🔄 Track Pusher - Checking buffer...')
  
  try {
    // 1. Check current track count
    const trackCount = await getCurrentTrackCount()
    console.log(`📊 Current tracks on EC2: ${trackCount}`)
    
    // 2. If >= 3 tracks, we're good!
    if (trackCount >= 3) {
      console.log('✅ Buffer healthy (3+ tracks), nothing to do')
      return {
        statusCode: 200,
        body: JSON.stringify({
          action: 'none',
          trackCount,
          message: 'Buffer is healthy'
        })
      }
    }
    
    // 3. Get playlist state
    const state = await getPlaylistState()
    if (!state) {
      console.log('⚠️ No active playlist found')
      return {
        statusCode: 200,
        body: JSON.stringify({
          action: 'none',
          message: 'No active playlist'
        })
      }
    }
    
    console.log(`📋 Active playlist: ${state.currentPlaylistId}`)
    
    // 4. Get next track
    const nextTrack = await getNextTrack(state.currentPlaylistId, state.currentTrackIndex)
    if (!nextTrack) {
      console.log('⚠️ No more tracks in playlist')
      return {
        statusCode: 200,
        body: JSON.stringify({
          action: 'none',
          message: 'Playlist exhausted'
        })
      }
    }
    
    console.log(`🎵 Next track: ${nextTrack.trackArtist} - ${nextTrack.trackTitle}`)
    
    // 5. Download track to EC2
    const s3Url = nextTrack.fileUrl.startsWith('s3://') 
      ? nextTrack.fileUrl 
      : `s3://${STORAGE_BUCKET}/${nextTrack.fileUrl.replace(/^public\//, '')}`
    
    const filename = s3Url.split('/').pop() || `track-${Date.now()}.mp3`
    const localPath = `/var/radio/tracks/${filename}`
    
    console.log(`📥 Downloading: ${filename}...`)
    await downloadTrackToEC2(s3Url, localPath)
    console.log(`✅ Downloaded to: ${localPath}`)
    
    // 6. Append to M3U
    console.log('📝 Appending to M3U...')
    await appendToM3U(nextTrack, localPath)
    console.log('✅ M3U updated!')
    
    // 7. Increment state (we'd save this to DynamoDB in production)
    state.currentTrackIndex++
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        action: 'pushed',
        trackCount: trackCount + 1,
        track: {
          artist: nextTrack.trackArtist,
          title: nextTrack.trackTitle,
          path: localPath
        }
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: String(error)
      })
    }
  }
}
