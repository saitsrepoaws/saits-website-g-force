/**
 * Stream Playlist Updater Lambda
 * 
 * Runs every 5 minutes via EventBridge
 * Updates the M3U playlist in S3 based on current schedule
 * Liquidsoap automatically reloads the playlist
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

const s3 = new S3Client({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const PLAYLIST_BUCKET = process.env.PLAYLIST_BUCKET || ''
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || ''
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
  const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  console.log(`📅 Current: ${dayNames[dayOfWeek]} ${currentTime} (dayOfWeek=${dayOfWeek})`)

  try {
    // APPROACH: Scan table and filter by time + day
    // This handles both:
    // - Entries with dayOfWeek set (specific days)
    // - Entries with dayOfWeek=null (every day)
    const result = await dynamodb.send(new ScanCommand({
      TableName: SCHEDULE_TABLE,
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':active': true
      }
    }))

    if (!result.Items || result.Items.length === 0) {
      console.log('⚠️ No schedule entries found in table')
      return null
    }
    
    console.log(`📋 Found ${result.Items.length} total schedule entries`)
    
    // Filter entries that match current day OR are null (= every day)
    const todaySlots = result.Items.filter((item: any) => {
      // null/undefined dayOfWeek means "every day"
      if (item.dayOfWeek === null || item.dayOfWeek === undefined) {
        return true
      }
      // Match specific day
      return item.dayOfWeek === dayOfWeek
    })
    
    console.log(`📋 Found ${todaySlots.length} slots for ${dayNames[dayOfWeek]}`)
    
    if (todaySlots.length === 0) {
      console.log('⚠️ No schedule slots found for today')
      return null
    }

    // Find slot where currentTime is between startTime and endTime
    // Sort slots by startTime to find the current slot
    todaySlots.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
    
    // Find the active slot: latest start time that's <= current time
    let activeSlot = null
    for (const slot of todaySlots) {
      if (slot.startTime <= currentTime) {
        // Check if there's an endTime and we're past it
        if (slot.endTime && currentTime >= slot.endTime) {
          continue // This slot has ended
        }
        activeSlot = slot
      } else {
        break // Slots are sorted, no need to check further
      }
    }

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
    
    // File URL - S3 path that Liquidsoap can access via AWS CLI
    // EC2 has IAM role with S3 read access
    const fileUrl = track.fileUrl.startsWith('s3://') 
      ? track.fileUrl 
      : (track.fileUrl.startsWith('http') 
        ? track.fileUrl 
        : `s3://${STORAGE_BUCKET}/${track.fileUrl}`)
    
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
