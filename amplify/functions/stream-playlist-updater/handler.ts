/**
 * Stream Playlist Updater Lambda - Radio Station Model
 * 
 * Runs HOURLY (:00) via EventBridge
 * Downloads news + Queues entire playlist to SQS
 * 
 * FLOW:
 * 1. Download news MP3
 * 2. Lookup schedule for current hour
 * 3. Get full playlist
 * 4. Queue: News → Track 1 → Track 2 → ... → Track N
 * 5. Liquidsoap plays in order with minimal buffer
 * 
 * ARCHITECTUUR:
 * Schedule → Playlist → Lambda → (News + Tracks) → SQS → Liquidsoap (EC2)
 */
import { SQSClient, SendMessageCommand, GetQueueAttributesCommand, PurgeQueueCommand } from '@aws-sdk/client-sqs'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as https from 'https'

const sqs = new SQSClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})

const TRACK_QUEUE_URL = process.env.TRACK_QUEUE_URL || ''
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || ''
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE || ''
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE || ''
const TRACK_TABLE = process.env.TRACK_TABLE || ''
const SETTINGS_TABLE = process.env.SETTINGS_TABLE || ''
const STREAM_QUEUE_TRACK_TABLE = process.env.STREAM_QUEUE_TRACK_TABLE || ''

// News URL
const NEWS_URL = 'http://www.downloadlokaalmedia.nl/special/nieuwswildfm.mp3'

interface Track {
  trackId: string
  trackTitle: string
  trackArtist?: string
  trackDuration: number
  fileUrl: string
  coverArtUrl?: string
  waveformUrl?: string
  genre?: string
  bpm?: number
  key?: string
  energy?: number
}

interface SQSTrackMessage {
  trackId: string
  title: string
  artist: string
  fileUrl: string
  duration: number
  coverArtUrl?: string
  waveformUrl?: string
  genre?: string
  bpm?: number
  key?: string
  energy?: number
  scheduledAt: string
  playlistId: string
  playlistName: string
}

/**
 * Download news MP3 and upload to S3
 * Returns S3 URL for Liquidsoap
 */
async function downloadNews(): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`📰 Downloading news from ${NEWS_URL}`)
    
    https.get(NEWS_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download news: ${response.statusCode}`))
        return
      }
      
      const chunks: Buffer[] = []
      
      response.on('data', (chunk) => {
        chunks.push(chunk)
      })
      
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks)
          const timestamp = Date.now()
          const key = `public/news/nieuws-${timestamp}.mp3`
          
          // Upload to S3
          await s3.send(new PutObjectCommand({
            Bucket: STORAGE_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'audio/mpeg'
          }))
          
          const s3Url = `s3://${STORAGE_BUCKET}/${key}`
          console.log(`✅ News downloaded and uploaded to ${s3Url}`)
          console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
          
          resolve(s3Url)
        } catch (error) {
          reject(error)
        }
      })
      
      response.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * Get current active schedule slot
 */
async function getCurrentScheduleSlot() {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const currentDayName = dayNames[dayOfWeek]
  
  console.log(`🗓️ Current time: ${currentDayName} (${dayOfWeek}) ${currentTime}`)
  
  // Scan Schedule table (we need scan because dayOfWeek can be null = every day)
  const { Items = [] } = await dynamodb.send(new ScanCommand({
    TableName: SCHEDULE_TABLE
  }))
  
  console.log(`📋 Found ${Items.length} schedule entries`)
  
  // Find matching slot
  for (const slot of Items) {
    const slotDay = slot.dayOfWeek
    const slotStart = slot.startTime
    const slotEnd = slot.endTime
    
    // Check if day matches (null/undefined = every day, otherwise compare as integers)
    const dayMatches = (slotDay === null || slotDay === undefined) || slotDay === dayOfWeek
    
    // Check if time is within slot
    // If endTime is null, slot runs until next hour
    let timeMatches = false
    if (slotEnd) {
      timeMatches = currentTime >= slotStart && currentTime < slotEnd
    } else {
      // No end time = slot is active for 1 hour
      const slotHour = parseInt(slotStart.split(':')[0])
      const currentHour = parseInt(currentTime.split(':')[0])
      timeMatches = currentHour === slotHour
    }
    
    console.log(`  Checking slot: ${slot.name || slot.slotName || 'Unnamed'}`)
    console.log(`    Day: ${slotDay === null || slotDay === undefined ? 'Every day' : dayNames[slotDay]} (${slotDay}) - Match: ${dayMatches}`)
    console.log(`    Time: ${slotStart}-${slotEnd || 'end of day'} - Match: ${timeMatches}`)
    console.log(`    Active: ${slot.isActive}`)
    
    if (dayMatches && timeMatches && slot.isActive) {
      console.log(`✅ Found active slot: ${slot.name || slot.slotName || 'Hourly Slot'}`)
      console.log(`   Playlist ID: ${slot.playlistId}`)
      return slot
    }
  }
  
  console.log('⚠️ No active schedule slot found')
  return null
}

/**
 * Get playlist with tracks
 */
async function getPlaylistTracks(playlistId: string) {
  const { Item: playlist } = await dynamodb.send(new GetCommand({
    TableName: PLAYLIST_TABLE,
    Key: { id: playlistId }
  }))
  
  if (!playlist) {
    throw new Error(`Playlist ${playlistId} not found`)
  }
  
  // Parse tracks - they're already full track objects in the playlist
  const tracks: Track[] = JSON.parse(playlist.tracks || '[]')
  
  console.log(`🎵 Playlist: ${playlist.name} (${tracks.length} tracks)`)
  
  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    tracks
  }
}

/**
 * Send track to SQS queue
 */
async function sendTrackToQueue(track: any, playlistId: string, playlistName: string, scheduledAt: Date, position: number) {
  // Get fileUrl - if missing from playlist, lookup from Track table
  let fileUrl = track.fileUrl
  
  if (!fileUrl && track.trackId) {
    console.log(`⚠️ fileUrl missing, looking up Track ${track.trackId}`)
    try {
      const { Item: fullTrack } = await dynamodb.send(new GetCommand({
        TableName: TRACK_TABLE,
        Key: { id: track.trackId }
      }))
      if (fullTrack?.fileUrl) {
        fileUrl = fullTrack.fileUrl
      }
    } catch (err) {
      console.error(`Failed to lookup track ${track.trackId}:`, err)
    }
  }
  
  // Construct proper S3 URL from fileUrl (which is relative path like "public/audio/filename.mp3")
  if (fileUrl && !fileUrl.startsWith('s3://') && !fileUrl.startsWith('http')) {
    fileUrl = `s3://${STORAGE_BUCKET}/${fileUrl}`
  } else if (!fileUrl) {
    // Fallback - should rarely happen
    console.error(`❌ No fileUrl for track ${track.trackId}`)
    fileUrl = `s3://${STORAGE_BUCKET}/public/audio/${track.trackId}.mp3`
  }
  
  const message: SQSTrackMessage = {
    trackId: track.trackId,
    title: track.trackTitle || track.title || 'Unknown',
    artist: track.trackArtist || track.artist || 'Unknown Artist',
    fileUrl,
    duration: track.trackDuration || track.duration || 180,
    coverArtUrl: track.trackCoverArtUrl || track.coverArtUrl,
    waveformUrl: track.waveformUrl,
    genre: track.trackGenre || track.genre,
    bpm: track.trackBpm || track.bpm,
    key: track.trackKey || track.key,
    energy: track.energy,
    scheduledAt: scheduledAt.toISOString(),
    playlistId,
    playlistName
  }
  
  await sqs.send(new SendMessageCommand({
    QueueUrl: TRACK_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageGroupId: 'radio-stream', // Required for FIFO - ensures strict ordering
  }))
  
  // Also log to DynamoDB for UI visibility
  if (STREAM_QUEUE_TRACK_TABLE) {
    const now = new Date()
    const ttl = Math.floor(now.getTime() / 1000) + (24 * 60 * 60) // 24 hours from now
    
    await dynamodb.send(new PutCommand({
      TableName: STREAM_QUEUE_TRACK_TABLE,
      Item: {
        id: `${Date.now()}-${track.trackId}`,
        trackId: track.trackId,
        artist: message.artist,
        title: message.title,
        version: track.version,
        trackDuration: message.duration,
        playlistId,
        playlistName,
        position,
        queuedAt: now.toISOString(),
        status: 'queued',
        ttl,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
    }))
  }
  
  console.log(`📤 Sent to queue: ${track.trackArtist} - ${track.trackTitle}`)
}

/**
 * Main handler - HOURLY TRIGGER
 */
export const handler = async (event: any) => {
  console.log('🎙️ Stream Playlist Updater (HOURLY) - Starting...')
  console.log(`⏰ Triggered at: ${new Date().toISOString()}`)
  
  try {
    // 1. Get current schedule slot
    const slot = await getCurrentScheduleSlot()
    
    if (!slot || !slot.playlistId) {
      console.log('ℹ️ No active schedule slot - SILENCE (per requirement A)')
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'No active schedule slot',
          action: 'silence'
        })
      }
    }
    
    // 2. Get playlist and tracks
    const { playlistId, playlistName, tracks } = await getPlaylistTracks(slot.playlistId)
    
    if (tracks.length === 0) {
      console.log('⚠️ Playlist has no tracks')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Playlist has no tracks' })
      }
    }
    
    // 3. PURGE QUEUE - Start fresh each hour!
    console.log('🗑️ Purging old queue...')
    try {
      await sqs.send(new PurgeQueueCommand({
        QueueUrl: TRACK_QUEUE_URL
      }))
      console.log('✅ Queue purged')
      // Wait 60 seconds for purge to complete (AWS requirement)
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (purgeError) {
      console.log('⚠️ Purge failed (might be in cooldown), continuing anyway...')
    }
    
    // 4. Download NEWS and queue it FIRST
    console.log('📰 Downloading news...')
    let newsQueued = false
    try {
      const newsUrl = await downloadNews()
      
      // Send news as first track
      const newsMessage = {
        trackId: `news-${Date.now()}`,
        title: 'Splash FM Nieuws',
        artist: 'Splash FM',
        fileUrl: newsUrl,
        duration: 300, // ~5 minutes
        scheduledAt: new Date().toISOString(),
        playlistId: 'NEWS',
        playlistName: 'Nieuws'
      }
      
      await sqs.send(new SendMessageCommand({
        QueueUrl: TRACK_QUEUE_URL,
        MessageBody: JSON.stringify(newsMessage),
        MessageGroupId: 'radio-stream', // Required for FIFO - all messages in same group maintain order
      }))
      
      console.log('✅ News queued as first item')
      newsQueued = true
    } catch (newsError) {
      console.error('❌ Failed to download/queue news:', newsError)
      console.log('⚠️ Continuing without news...')
    }
    
    // 5. Queue ALL playlist tracks (not 2 random!)
    console.log(`🎵 Queueing entire playlist: ${tracks.length} tracks`)
    const now = new Date()
    let scheduledTime = new Date(now.getTime() + (newsQueued ? 300000 : 0)) // +5 min if news
    let tracksQueued = 0
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      
      await sendTrackToQueue(track, playlistId, playlistName, scheduledTime, i + 1)
      
      // Next track starts after current duration
      scheduledTime = new Date(scheduledTime.getTime() + ((track.trackDuration || 180) * 1000))
      tracksQueued++
    }
    
    console.log(`✅ HOURLY QUEUE COMPLETE!`)
    console.log(`   📰 News: ${newsQueued ? 'YES' : 'NO'}`)
    console.log(`   🎵 Tracks: ${tracksQueued}`)
    console.log(`   ⏱️  Total duration: ~${Math.floor((scheduledTime.getTime() - now.getTime()) / 60000)} minutes`)
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        playlistId,
        playlistName,
        newsQueued,
        tracksQueued,
        totalDuration: Math.floor((scheduledTime.getTime() - now.getTime()) / 60000),
        slot: {
          name: slot.name || slot.slotName,
          day: slot.dayOfWeek === null ? 'Every day' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek],
          time: `${slot.startTime}-${slot.endTime || 'next hour'}`
        }
      })
    }
  } catch (error) {
    console.error('❌ Error updating stream queue:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
