/**
 * Stream Playlist Updater Lambda - PUSH Architecture
 * 
 * Runs HOURLY (:00) via EventBridge
 * Downloads news + Generates M3U playlist + Pushes to EC2
 * 
 * FLOW:
 * 1. Download news MP3 → Upload to S3
 * 2. Lookup schedule for current hour
 * 3. Get full playlist
 * 4. Generate M3U file: News → Track 1 → Track 2 → ... → Track N
 * 5. Upload M3U to EC2 /var/radio/playlists/current.m3u
 * 6. Liquidsoap auto-reloads and plays!
 * 
 * ARCHITECTUUR:
 * Schedule → Playlist → Lambda → M3U → EC2 → Liquidsoap playlist()
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm'
import * as https from 'https'
import * as http from 'http'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const s3 = new S3Client({})
const ssm = new SSMClient({})

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || ''
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE || ''
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE || ''
const TRACK_TABLE = process.env.TRACK_TABLE || ''
const SETTINGS_TABLE = process.env.SETTINGS_TABLE || ''
const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || ''

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

/**
 * Download all files from S3 to EC2 in a single SSM command and WAIT for completion
 */
async function downloadAllFilesToEC2(downloads: Array<{s3Url: string, localPath: string}>): Promise<void> {
  // Generate bash script to download all files
  const commands = [
    '#!/bin/bash',
    'set -e',  // Exit on error
    'echo "Starting batch download..."',
    ...downloads.map(({s3Url, localPath}) => 
      `echo "Downloading ${localPath}..." && aws s3 cp "${s3Url}" "${localPath}" --region eu-west-1 --quiet && chmod 644 "${localPath}"`
    ),
    'echo "All downloads complete!"'
  ]
  
  // Send command
  const result = await ssm.send(new SendCommandCommand({
    InstanceIds: [EC2_INSTANCE_ID],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands
    }
  }))
  
  const commandId = result.Command?.CommandId
  if (!commandId) {
    throw new Error('No CommandId returned from SSM')
  }
  
  console.log(`📤 SSM Command sent: ${commandId}`)
  console.log(`⏳ Waiting for downloads to complete (max 2 minutes)...`)
  
  // Wait for command to complete
  for (let i = 0; i < 24; i++) { // 24 * 5s = 120s = 2 minutes
    await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
    
    try {
      const invocation = await ssm.send(new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: EC2_INSTANCE_ID
      }))
      
      const status = invocation.Status
      console.log(`  Status: ${status} (${i * 5}s)`)  
      
      if (status === 'Success') {
        console.log(`✅ Downloads completed successfully!`)
        return
      } else if (status === 'Failed' || status === 'Cancelled' || status === 'TimedOut') {
        throw new Error(`SSM command failed with status: ${status}`)
      }
    } catch (err) {
      if (i < 3) continue // First few checks might fail, keep retrying
      throw err
    }
  }
  
  console.log(`⚠️ Download timeout reached, proceeding anyway...`)
}

/**
 * Generate M3U playlist file content with LOCAL file paths + COVER ART URLs
 */
function generateM3U(newsLocalPath: string | null, tracks: Array<{track: Track, localPath: string}>): string {
  let m3u = '#EXTM3U\n'
  
  // Add news first if available
  if (newsLocalPath) {
    m3u += `#EXTINF:300,Splash FM Nieuws\n`
    m3u += `${newsLocalPath}\n`
  }
  
  // Add all tracks with LOCAL paths + COVER ART
  for (const {track, localPath} of tracks) {
    const duration = track.trackDuration || 180
    const artist = track.trackArtist || 'Unknown Artist'
    const title = track.trackTitle || 'Unknown'
    const coverUrl = track.coverArtUrl || ''
    
    // Standard EXTINF line
    m3u += `#EXTINF:${duration},${artist} - ${title}\n`
    
    // Add cover art URL as extended tag (for Liquidsoap to parse)
    if (coverUrl) {
      m3u += `#EXTIMG:${coverUrl}\n`
    }
    
    // Local file path
    m3u += `${localPath}\n`
  }
  
  return m3u
}

/**
 * Get news enabled setting from StreamSettings
 */
async function isNewsEnabled(): Promise<boolean> {
  try {
    const { Item } = await dynamodb.send(new GetCommand({
      TableName: SETTINGS_TABLE,
      Key: { settingKey: 'playlist_update_timing' }
    }))
    
    // Default to false (OFF) if setting doesn't exist
    const enabled = Item?.newsEnabled === true
    console.log(`📰 News enabled: ${enabled}`)
    return enabled
  } catch (err) {
    console.error('⚠️ Failed to get news setting, defaulting to OFF:', err)
    return false
  }
}

/**
 * Download news MP3 and upload to S3
 * Returns S3 URL for Liquidsoap
 */
async function downloadNews(): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`📰 Downloading news from ${NEWS_URL}`)
    
    // Use http module for http:// URLs, https for https://
    const httpModule = NEWS_URL.startsWith('https://') ? https : http
    
    httpModule.get(NEWS_URL, (response) => {
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
 * NOTE: Converts UTC to CET (UTC+1) for schedule matching
 */
async function getCurrentScheduleSlot() {
  const nowUTC = new Date()
  
  // Convert UTC to CET (UTC+1)
  // Add 1 hour (3600000 milliseconds) for CET timezone
  const nowCET = new Date(nowUTC.getTime() + (60 * 60 * 1000))
  
  const dayOfWeek = nowCET.getUTCDay() // 0=Sunday, 1=Monday, ..., 6=Saturday
  const hours = nowCET.getUTCHours().toString().padStart(2, '0')
  const minutes = nowCET.getUTCMinutes().toString().padStart(2, '0')
  const currentTime = `${hours}:${minutes}` // HH:MM in CET
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const currentDayName = dayNames[dayOfWeek]
  
  console.log(`🗓️ Current time: ${currentDayName} (${dayOfWeek}) ${currentTime} CET (UTC: ${nowUTC.toISOString()})`)
  
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
 * Get correct fileUrl from Track table (playlist data may be outdated)
 */
async function getTrackFileUrl(track: any): Promise<string> {
  // Always lookup from Track table for correct S3 path
  try {
    const { Item: fullTrack } = await dynamodb.send(new GetCommand({
      TableName: TRACK_TABLE,
      Key: { id: track.trackId }
    }))
    
    if (fullTrack?.fileUrl) {
      let fileUrl = fullTrack.fileUrl
      // Convert to S3 URL if needed
      if (fileUrl && !fileUrl.startsWith('s3://') && !fileUrl.startsWith('http')) {
        fileUrl = `s3://${STORAGE_BUCKET}/${fileUrl}`
      }
      return fileUrl
    }
  } catch (err) {
    console.error(`⚠️ Failed to lookup track ${track.trackId}:`, err)
  }
  
  // Fallback
  console.error(`❌ No fileUrl for track ${track.trackId}`)
  return `s3://${STORAGE_BUCKET}/public/audio/${track.trackId}.mp3`
}

/**
 * Upload covers mapping JSON to EC2 via SSM
 */
async function uploadCoversMapToEC2(tracks: Array<{track: Track, localPath: string}>): Promise<void> {
  console.log('🖼️  Generating covers map...')
  
  // Build cover mapping: local path → cover URL
  const coversMap: Record<string, string> = {}
  for (const {track, localPath} of tracks) {
    if (track.coverArtUrl) {
      coversMap[localPath] = track.coverArtUrl
    }
  }
  
  const jsonContent = JSON.stringify(coversMap, null, 2)
  
  console.log(`📋 Covers map has ${Object.keys(coversMap).length} entries`)
  
  // Upload to EC2
  const command = `
cat > /var/radio/covers-map.json << 'EOFJSON'
${jsonContent}
EOFJSON
chmod 644 /var/radio/covers-map.json
echo "✅ Covers map uploaded"
`
  
  try {
    const result = await ssm.send(new SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: [command]
      }
    }))
    
    console.log(`✅ Covers map uploaded to EC2, CommandId: ${result.Command?.CommandId}`)
  } catch (error) {
    console.error('❌ Failed to upload covers map to EC2:', error)
    throw error
  }
}

/**
 * Upload M3U playlist to EC2 via SSM
 */
async function uploadPlaylistToEC2(m3uContent: string): Promise<void> {
  console.log('📤 Uploading M3U to EC2...')
  
  // Create M3U file on EC2 using SSM Run Command
  const command = `
cat > /var/radio/playlists/current.m3u << 'EOFM3U'
${m3uContent}
EOFM3U
chmod 644 /var/radio/playlists/current.m3u
echo "✅ M3U uploaded successfully"
`
  
  try {
    const result = await ssm.send(new SendCommandCommand({
      InstanceIds: [EC2_INSTANCE_ID],
      DocumentName: 'AWS-RunShellScript',
      Parameters: {
        commands: [command]
      }
    }))
    
    console.log(`✅ M3U uploaded to EC2, CommandId: ${result.Command?.CommandId}`)
  } catch (error) {
    console.error('❌ Failed to upload M3U to EC2:', error)
    throw error
  }
}

/**
 * Main handler - HOURLY TRIGGER
 */
export const handler = async (event: any) => {
  console.log('🎙️ Stream Playlist Updater (PUSH) - Starting...')
  console.log(`⏰ Triggered at: ${new Date().toISOString()}`)
  
  try {
    // 1. Get current schedule slot
    const slot = await getCurrentScheduleSlot()
    
    if (!slot || !slot.playlistId) {
      console.log('ℹ️ No active schedule slot - Empty M3U (silence)')
      // Upload empty M3U
      await uploadPlaylistToEC2('#EXTM3U\n')
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
      await uploadPlaylistToEC2('#EXTM3U\n')
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Playlist has no tracks' })
      }
    }
    
    // 3. Cleanup old tracks on EC2 (keep disk clean)
    console.log('🧹 Cleaning up old tracks...')
    const cleanupCommand = `
find /var/radio/tracks -type f -mmin +120 -delete
echo "Cleanup complete"
`
    try {
      await ssm.send(new SendCommandCommand({
        InstanceIds: [EC2_INSTANCE_ID],
        DocumentName: 'AWS-RunShellScript',
        Parameters: { commands: [cleanupCommand] }
      }))
    } catch (err) {
      console.log('⚠️ Cleanup warning:', err)
    }
    
    // 4. Prepare downloads list
    console.log('📋 Preparing download list...')
    const downloads: Array<{s3Url: string, localPath: string}> = []
    let newsLocalPath: string | null = null
    
    // Check if news is enabled and add to downloads
    const newsEnabledSetting = await isNewsEnabled()
    if (newsEnabledSetting) {
      try {
        const newsS3Url = await downloadNews()
        newsLocalPath = '/var/radio/tracks/news-latest.mp3'
        downloads.push({ s3Url: newsS3Url, localPath: newsLocalPath })
        console.log(`📰 News queued for download`)
      } catch (newsError) {
        console.error('❌ Failed to fetch news:', newsError)
      }
    } else {
      console.log('📰 News disabled - skipping download')
    }
    
    // 5. Add all tracks to downloads and prepare track list
    console.log(`🎵 Preparing ${tracks.length} tracks...`)
    const tracksWithPaths: Array<{track: Track, localPath: string}> = []
    
    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index]
      try {
        const s3Url = await getTrackFileUrl(track)
        // Extract filename from S3 URL
        const filename = s3Url.split('/').pop() || `track-${index}.mp3`
        const localPath = `/var/radio/tracks/${filename}`
        
        downloads.push({ s3Url, localPath })
        tracksWithPaths.push({ track, localPath })
        console.log(`  ✓ ${index + 1}/${tracks.length}: ${track.trackArtist} - ${track.trackTitle}`)
      } catch (err) {
        console.error(`  ✗ Failed to get URL for track ${track.trackId}:`, err)
      }
    }
    
    // 6. Execute batch download and WAIT for completion
    console.log(`📥 Downloading ${downloads.length} files to EC2...`)
    await downloadAllFilesToEC2(downloads)
    console.log(`✅ All ${downloads.length} files downloaded!`)
    
    const successfulTracks = tracksWithPaths
    
    // 6. Generate M3U with LOCAL paths
    console.log('🎵 Generating M3U with local paths...')
    const m3uContent = generateM3U(newsLocalPath, successfulTracks)
    
    console.log('📋 M3U Preview:')
    console.log(m3uContent.split('\n').slice(0, 10).join('\n') + '\n...')
    
    // 7. Upload M3U to EC2
    await uploadPlaylistToEC2(m3uContent)
    
    // 8. Upload covers map to EC2
    await uploadCoversMapToEC2(successfulTracks)
    
    // Calculate total duration
    const newsTime = newsLocalPath ? 300 : 0
    const tracksTime = successfulTracks.reduce((sum, {track}) => sum + (track.trackDuration || 180), 0)
    const totalMinutes = Math.floor((newsTime + tracksTime) / 60)
    
    console.log(`✅ LOCAL FILE PLAYLIST COMPLETE!`)
    console.log(`   📰 News: ${newsLocalPath ? 'YES' : 'NO'}`)
    console.log(`   🎵 Tracks: ${successfulTracks.length}/${tracks.length}`)
    console.log(`   💾 Storage: ~${Math.floor(tracksTime / 60)} min of audio`)
    console.log(`   ⏱️  Total duration: ~${totalMinutes} minutes`)
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        playlistId,
        playlistName,
        hasNews: !!newsLocalPath,
        trackCount: successfulTracks.length,
        totalDuration: totalMinutes,
        slot: {
          name: slot.name || slot.slotName,
          day: slot.dayOfWeek === null ? 'Every day' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek],
          time: `${slot.startTime}-${slot.endTime || 'next hour'}`
        }
      })
    }
  } catch (error) {
    console.error('❌ Error generating playlist:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
