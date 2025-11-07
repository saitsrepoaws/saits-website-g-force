/**
 * Stream Playlist Updater Lambda
 * 
 * Runs every 5 minutes via EventBridge
 * Updates the M3U playlist in S3 based on current schedule
 * Liquidsoap automatically reloads the playlist
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

const s3 = new S3Client({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const PLAYLIST_BUCKET = process.env.PLAYLIST_BUCKET || ''
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE || ''
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE || ''
const TRACK_TABLE = process.env.TRACK_TABLE || ''

interface Track {
  trackId: string
  trackTitle: string
  trackDuration: number
  fileUrl: string
}

/**
 * Get current active schedule slot
 */
async function getCurrentScheduleSlot() {
  const now = new Date()
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM

  console.log(`📅 Current: ${dayOfWeek} ${currentTime}`)

  try {
    const result = await dynamodb.send(new QueryCommand({
      TableName: SCHEDULE_TABLE,
      IndexName: 'schedulesByDayOfWeekAndStartTime',
      KeyConditionExpression: 'dayOfWeek = :day',
      ExpressionAttributeValues: {
        ':day': dayOfWeek
      }
    }))

    if (!result.Items || result.Items.length === 0) {
      console.log('⚠️ No schedule slots found for today')
      return null
    }

    // Find slot where currentTime is between startTime and endTime
    const activeSlot = result.Items.find(slot => {
      const start = slot.startTime
      const end = slot.endTime
      return currentTime >= start && currentTime < end
    })

    if (activeSlot) {
      console.log(`✅ Active slot: ${activeSlot.startTime}-${activeSlot.endTime}, Playlist: ${activeSlot.playlistId}`)
    } else {
      console.log('⚠️ No active slot for current time')
    }

    return activeSlot || null
  } catch (error) {
    console.error('❌ Error getting schedule:', error)
    return null
  }
}

/**
 * Get playlist with tracks
 */
async function getPlaylist(playlistId: string) {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: PLAYLIST_TABLE,
      Key: { id: playlistId }
    }))

    if (!result.Item) {
      console.error(`❌ Playlist ${playlistId} not found`)
      return null
    }

    console.log(`✅ Found playlist: ${result.Item.name}`)
    return result.Item
  } catch (error) {
    console.error('❌ Error getting playlist:', error)
    return null
  }
}

/**
 * Load full track data for playlist tracks
 */
async function loadTracksData(playlistTracks: Track[]) {
  const tracks: any[] = []
  
  // Limit to first 50 tracks for stream
  const tracksToLoad = playlistTracks.slice(0, 50)
  console.log(`📝 Loading ${tracksToLoad.length} tracks`)

  for (const playlistTrack of tracksToLoad) {
    try {
      const trackId = playlistTrack.trackId

      if (!trackId) {
        console.warn('⚠️ Skipping track without ID')
        continue
      }

      const result = await dynamodb.send(new GetCommand({
        TableName: TRACK_TABLE,
        Key: { id: trackId }
      }))

      if (result.Item) {
        tracks.push(result.Item)
      } else {
        console.warn(`⚠️ Track ${trackId} not found in database`)
      }
    } catch (error) {
      console.error(`❌ Error loading track:`, error)
    }
  }

  console.log(`✅ Loaded ${tracks.length} tracks`)
  return tracks
}

/**
 * Generate M3U playlist content
 */
function generateM3UPlaylist(tracks: any[]): string {
  const lines = ['#EXTM3U']
  
  for (const track of tracks) {
    // EXTINF line with duration and title
    const duration = Math.floor(track.trackDuration || 0)
    const title = `${track.artist || 'Unknown'} - ${track.title || 'Unknown'}`
    lines.push(`#EXTINF:${duration},${title}`)
    
    // File URL - convert S3 path to presigned URL
    // For now, use the S3 path directly (Liquidsoap will need S3 access)
    const fileUrl = track.fileUrl.startsWith('http') 
      ? track.fileUrl 
      : `https://your-bucket.s3.eu-west-1.amazonaws.com/${track.fileUrl}`
    
    lines.push(fileUrl)
  }
  
  return lines.join('\n')
}

/**
 * Upload playlist to S3
 */
async function uploadPlaylistToS3(playlistContent: string) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: PLAYLIST_BUCKET,
      Key: 'current-playlist.m3u',
      Body: playlistContent,
      ContentType: 'audio/x-mpegurl',
      CacheControl: 'no-cache'
    }))

    console.log('✅ Playlist uploaded to S3')
    return true
  } catch (error) {
    console.error('❌ Error uploading playlist:', error)
    return false
  }
}

/**
 * Main handler
 */
export const handler = async (event: any) => {
  console.log('🎵 Stream Playlist Updater started')
  console.log('Event:', JSON.stringify(event, null, 2))

  try {
    // 1. Get current schedule slot
    const slot = await getCurrentScheduleSlot()
    
    if (!slot) {
      console.log('⏸️ No active schedule, keeping previous playlist')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No active schedule' })
      }
    }

    // 2. Get playlist
    const playlist = await getPlaylist(slot.playlistId)
    
    if (!playlist) {
      console.error('❌ Failed to get playlist')
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Playlist not found' })
      }
    }

    // 3. Parse tracks
    const parsedTracks = typeof playlist.tracks === 'string'
      ? JSON.parse(playlist.tracks)
      : playlist.tracks

    console.log(`📋 Playlist has ${parsedTracks.length} tracks`)

    // 4. Load full track data
    const tracks = await loadTracksData(parsedTracks)

    if (tracks.length === 0) {
      console.error('❌ No tracks loaded')
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No tracks found' })
      }
    }

    // 5. Generate M3U playlist
    const m3uContent = generateM3UPlaylist(tracks)
    console.log('📝 M3U playlist generated')
    console.log('Preview:', m3uContent.split('\n').slice(0, 6).join('\n'))

    // 6. Upload to S3
    const uploaded = await uploadPlaylistToS3(m3uContent)

    if (!uploaded) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to upload playlist' })
      }
    }

    console.log('✅ Stream playlist updated successfully!')

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        playlistId: slot.playlistId,
        tracksCount: tracks.length,
        slot: {
          day: slot.dayOfWeek,
          time: `${slot.startTime}-${slot.endTime}`
        }
      })
    }
  } catch (error) {
    console.error('❌ Error updating stream playlist:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
