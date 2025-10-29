/**
 * Radio Scheduler Lambda
 * 
 * Runs every minute via EventBridge
 * Determines current track based on schedule
 * Publishes to IoT 5 seconds before track change
 * All players receive same track at same time
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const iotClient = new IoTDataPlaneClient({})

interface ScheduleSlot {
  id: string
  name: string
  time: string
  duration: number
  playlistId: string
  isActive: boolean
}

interface PlaylistTrack {
  trackId: string
  trackTitle?: string
  trackArtist?: string
  trackDuration?: number
  order: number
}

interface Track {
  id: string
  title: string
  artist?: string
  duration?: number
  fileUrl?: string
  coverArtUrl?: string
  waveformUrl?: string
}

export async function handler(event: any) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📻 RADIO SCHEDULER TRIGGERED')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Time:', new Date().toISOString())
  
  try {
    // 1. Get current time
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const currentSeconds = now.getSeconds()
    
    console.log('🕐 Current time:', now.toISOString())
    console.log('   Minutes:', currentMinutes, 'Seconds:', currentSeconds)
    
    // 2. Load schedule from DynamoDB
    const schedule = await loadSchedule()
    console.log('📅 Loaded schedule:', schedule.length, 'slots')
    
    // 3. Find active slot
    const activeSlot = findActiveSlot(schedule, currentMinutes)
    
    if (!activeSlot) {
      console.log('⚠️ No active slot found')
      return { statusCode: 200, body: 'No active slot' }
    }
    
    console.log('✅ Active slot:', activeSlot.name, activeSlot.time)
    
    // 4. Load playlist
    const playlist = await loadPlaylist(activeSlot.playlistId)
    
    if (!playlist || !playlist.tracks) {
      console.log('⚠️ Playlist not found or empty')
      return { statusCode: 200, body: 'Playlist not found' }
    }
    
    // 5. Parse tracks
    const tracks: PlaylistTrack[] = typeof playlist.tracks === 'string' 
      ? JSON.parse(playlist.tracks)
      : playlist.tracks
    
    console.log('🎵 Playlist:', playlist.name, '-', tracks.length, 'tracks')
    
    // 6. Calculate current and next track
    const timing = calculateTrackTiming(activeSlot, tracks, now)
    
    if (!timing) {
      console.log('⚠️ Could not calculate track timing')
      return { statusCode: 200, body: 'No timing' }
    }
    
    console.log('⏱️ Track timing calculated')
    console.log('   Current track:', timing.currentTrackIndex)
    console.log('   Next track:', timing.nextTrackIndex)
    console.log('   Time until next:', Math.round(timing.timeUntilNext), 'seconds')
    
    // 7. Check if we should broadcast (5 seconds before next track)
    if (timing.timeUntilNext <= 5 && timing.timeUntilNext > 0) {
      console.log('🎯 BROADCASTING: 5-second window!')
      
      // Get full track data
      const nextTrack = await loadTrack(timing.nextTrackId)
      
      if (!nextTrack) {
        console.error('❌ Track not found:', timing.nextTrackId)
        return { statusCode: 200, body: 'Track not found' }
      }
      
      // Publish to IoT
      const message = {
        command: 'LOAD_AND_SCHEDULE',
        mode: 'station',
        track: {
          id: nextTrack.id,
          title: nextTrack.title,
          artist: nextTrack.artist,
          duration: nextTrack.duration,
          fileUrl: nextTrack.fileUrl,
          coverArtUrl: nextTrack.coverArtUrl,
          waveformUrl: nextTrack.waveformUrl
        },
        timing: {
          startAt: timing.nextTrackStartTime.toISOString(),
          loadBy: now.toISOString(),
          bufferSeconds: 5,
          currentPosition: 0
        },
        playlist: {
          id: activeSlot.playlistId,
          name: playlist.name
        },
        slot: {
          id: activeSlot.id,
          name: activeSlot.name,
          time: activeSlot.time
        },
        timestamp: now.toISOString()
      }
      
      await publishToIoT('radio/station/current-track', message)
      
      console.log('✅ Broadcast sent!')
      console.log('   Track:', nextTrack.title)
      console.log('   Start at:', timing.nextTrackStartTime.toISOString())
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          action: 'broadcast',
          track: nextTrack.title,
          startAt: timing.nextTrackStartTime.toISOString()
        })
      }
    } else {
      console.log('⏳ Not time to broadcast yet')
      console.log('   Time until next:', Math.round(timing.timeUntilNext), 'seconds')
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          action: 'wait',
          timeUntilNext: timing.timeUntilNext
        })
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) })
    }
  }
}

async function loadSchedule(): Promise<ScheduleSlot[]> {
  const tableName = process.env.SCHEDULE_TABLE_NAME
  
  if (!tableName) {
    throw new Error('SCHEDULE_TABLE_NAME not set')
  }
  
  const result = await dynamoClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: 'isActive = :active',
    ExpressionAttributeValues: {
      ':active': true
    }
  }))
  
  return (result.Items || []) as ScheduleSlot[]
}

async function loadPlaylist(playlistId: string) {
  const tableName = process.env.PLAYLIST_TABLE_NAME
  
  if (!tableName) {
    throw new Error('PLAYLIST_TABLE_NAME not set')
  }
  
  const result = await dynamoClient.send(new GetCommand({
    TableName: tableName,
    Key: { id: playlistId }
  }))
  
  return result.Item
}

async function loadTrack(trackId: string): Promise<Track | null> {
  const tableName = process.env.TRACK_TABLE_NAME
  
  if (!tableName) {
    throw new Error('TRACK_TABLE_NAME not set')
  }
  
  const result = await dynamoClient.send(new GetCommand({
    TableName: tableName,
    Key: { id: trackId }
  }))
  
  return result.Item as Track || null
}

function findActiveSlot(slots: ScheduleSlot[], currentMinutes: number): ScheduleSlot | null {
  const sortedSlots = [...slots].sort((a, b) => {
    const [aHour, aMin] = a.time.split(':').map(Number)
    const [bHour, bMin] = b.time.split(':').map(Number)
    return (aHour * 60 + aMin) - (bHour * 60 + bMin)
  })
  
  for (let i = sortedSlots.length - 1; i >= 0; i--) {
    const slot = sortedSlots[i]
    const [slotHour, slotMin] = slot.time.split(':').map(Number)
    const slotStartMinutes = slotHour * 60 + slotMin
    
    if (currentMinutes >= slotStartMinutes) {
      if (slot.duration === 0) {
        const nextSlot = sortedSlots[i + 1]
        if (nextSlot) {
          const [nextHour, nextMin] = nextSlot.time.split(':').map(Number)
          const nextSlotMinutes = nextHour * 60 + nextMin
          if (currentMinutes < nextSlotMinutes) {
            return slot
          }
        } else {
          return slot
        }
      } else {
        const slotEndMinutes = slotStartMinutes + slot.duration
        if (currentMinutes < slotEndMinutes) {
          return slot
        }
      }
    }
  }
  
  return null
}

function calculateTrackTiming(slot: ScheduleSlot, tracks: PlaylistTrack[], now: Date) {
  if (!tracks || tracks.length === 0) return null
  
  const sortedTracks = [...tracks].sort((a, b) => a.order - b.order)
  
  const [slotHour, slotMin] = slot.time.split(':').map(Number)
  const slotStartTime = new Date(now)
  slotStartTime.setHours(slotHour, slotMin, 0, 0)
  
  const secondsIntoSlot = Math.floor((now.getTime() - slotStartTime.getTime()) / 1000)
  
  let accumulatedSeconds = 0
  
  for (let i = 0; i < sortedTracks.length; i++) {
    const track = sortedTracks[i]
    const trackDuration = track.trackDuration || 180
    
    if (secondsIntoSlot >= accumulatedSeconds && secondsIntoSlot < accumulatedSeconds + trackDuration) {
      // This is current track
      const nextTrack = sortedTracks[i + 1]
      
      if (!nextTrack) {
        // Last track - loop back to first
        return {
          currentTrackIndex: i,
          currentTrackId: track.trackId,
          nextTrackIndex: 0,
          nextTrackId: sortedTracks[0].trackId,
          nextTrackStartTime: new Date(slotStartTime.getTime() + (accumulatedSeconds + trackDuration) * 1000),
          timeUntilNext: (accumulatedSeconds + trackDuration) - secondsIntoSlot
        }
      }
      
      return {
        currentTrackIndex: i,
        currentTrackId: track.trackId,
        nextTrackIndex: i + 1,
        nextTrackId: nextTrack.trackId,
        nextTrackStartTime: new Date(slotStartTime.getTime() + (accumulatedSeconds + trackDuration) * 1000),
        timeUntilNext: (accumulatedSeconds + trackDuration) - secondsIntoSlot
      }
    }
    
    accumulatedSeconds += trackDuration
  }
  
  return null
}

async function publishToIoT(topic: string, message: any) {
  const endpoint = process.env.IOT_ENDPOINT
  
  if (!endpoint) {
    throw new Error('IOT_ENDPOINT not set')
  }
  
  const command = new PublishCommand({
    topic,
    payload: Buffer.from(JSON.stringify(message)),
    qos: 1
  })
  
  await iotClient.send(command)
  
  console.log('📡 Published to IoT:', topic)
}
