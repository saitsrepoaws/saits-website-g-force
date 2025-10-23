import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { Schema } from '../../data/resource'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

interface GeneratePlaylistInput {
  name: string
  description?: string
  genre?: string
  mood?: string
  bpmMin?: number
  bpmMax?: number
  key?: string
  tags?: string
  maxTracks?: number
  minDuration?: number
  maxDuration?: number
}

interface Track {
  id: string
  title: string
  artist?: string
  genre?: string
  bpm?: number
  key?: string
  duration?: number
  coverArtUrl?: string
  energy?: number
  danceability?: number
  valence?: number
}

interface PlaylistTrackItem {
  trackId: string
  order: number
  addedAt: string
  trackTitle?: string
  trackArtist?: string
  trackDuration?: number
  trackBpm?: number
  trackGenre?: string
  trackCoverArtUrl?: string
}

// GraphQL resolver handler
export const handler: Schema['generatePlaylist']['functionHandler'] = async (event) => {
  console.log('🎵 Playlist Generator Lambda triggered', event)
  
  const input = event.arguments as GeneratePlaylistInput
  const result = await generatePlaylist(input)
  
  return JSON.stringify(result)
}

/**
 * Generate a playlist based on criteria
 */
export async function generatePlaylist(input: GeneratePlaylistInput) {
  try {
    console.log('🎵 Generating playlist with criteria:', input)
    
    const trackTableName = process.env.TRACK_TABLE_NAME
    if (!trackTableName) {
      throw new Error('TRACK_TABLE_NAME not configured')
    }
    
    // 1. Query tracks from DynamoDB
    const scanCommand = new ScanCommand({
      TableName: trackTableName,
    })
    
    const { Items: allTracks } = await docClient.send(scanCommand)
    if (!allTracks || allTracks.length === 0) {
      console.log('❌ No tracks found in library')
      return {
        success: false,
        error: 'No tracks found in library'
      }
    }
    
    console.log(`📊 Found ${allTracks.length} tracks, filtering...`)
    
    // 2. Filter tracks based on criteria
    let filteredTracks = allTracks as Track[]
    
    // Genre filter
    if (input.genre) {
      filteredTracks = filteredTracks.filter(t => t.genre === input.genre)
      console.log(`🎵 Genre filter (${input.genre}): ${filteredTracks.length} tracks`)
    }
    
    // BPM range filter
    if (input.bpmMin || input.bpmMax) {
      filteredTracks = filteredTracks.filter(t => {
        if (!t.bpm) return false
        const bpmInRange = 
          (!input.bpmMin || t.bpm >= input.bpmMin) &&
          (!input.bpmMax || t.bpm <= input.bpmMax)
        return bpmInRange
      })
      console.log(`⚡ BPM filter (${input.bpmMin}-${input.bpmMax}): ${filteredTracks.length} tracks`)
    }
    
    // Key filter
    if (input.key) {
      filteredTracks = filteredTracks.filter(t => t.key === input.key)
      console.log(`🎹 Key filter (${input.key}): ${filteredTracks.length} tracks`)
    }
    
    // Mood filter (map to energy/valence)
    if (input.mood) {
      const moodMap: Record<string, { minEnergy?: number, maxEnergy?: number, minValence?: number }> = {
        'Energetic': { minEnergy: 0.7 },
        'Chill': { maxEnergy: 0.5 },
        'Dark': { maxEnergy: 0.6, minValence: 0 },
        'Uplifting': { minEnergy: 0.6, minValence: 0.6 },
        'Groovy': { minEnergy: 0.5 },
        'Melodic': { minValence: 0.5 },
        'Driving': { minEnergy: 0.7 },
        'Atmospheric': { maxEnergy: 0.5 },
      }
      
      const moodCriteria = moodMap[input.mood]
      if (moodCriteria) {
        filteredTracks = filteredTracks.filter(t => {
          if (moodCriteria.minEnergy && (!t.energy || t.energy < moodCriteria.minEnergy)) return false
          if (moodCriteria.maxEnergy && (!t.energy || t.energy > moodCriteria.maxEnergy)) return false
          if (moodCriteria.minValence && (!t.valence || t.valence < moodCriteria.minValence)) return false
          return true
        })
        console.log(`✨ Mood filter (${input.mood}): ${filteredTracks.length} tracks`)
      }
    }
    
    if (filteredTracks.length === 0) {
      console.log('❌ No tracks match criteria')
      return {
        success: false,
        error: 'No tracks match the specified criteria'
      }
    }
    
    // 3. Sort tracks (by BPM or energy for smooth flow)
    filteredTracks.sort((a, b) => {
      // Primary: BPM (if available)
      if (a.bpm && b.bpm) {
        return a.bpm - b.bpm
      }
      // Secondary: Energy
      if (a.energy && b.energy) {
        return a.energy - b.energy
      }
      return 0
    })
    
    // 4. Select tracks (respect maxTracks and maxDuration)
    const maxTracks = input.maxTracks || 20
    const maxDuration = input.maxDuration || (59 * 60) // 59 minutes default
    
    const selectedTracks: Track[] = []
    let totalDuration = 0
    
    for (const track of filteredTracks) {
      if (selectedTracks.length >= maxTracks) break
      
      const trackDuration = track.duration || 0
      if (totalDuration + trackDuration > maxDuration) {
        // Check if we should stop or skip this track
        if (selectedTracks.length < 5) {
          // Too few tracks, skip this one
          continue
        } else {
          // Enough tracks, stop here
          break
        }
      }
      
      selectedTracks.push(track)
      totalDuration += trackDuration
    }
    
    console.log(`✅ Selected ${selectedTracks.length} tracks, total duration: ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')}`)
    
    // 5. Create PlaylistTrackItems
    const playlistTracks: PlaylistTrackItem[] = selectedTracks.map((track, index) => ({
      trackId: track.id,
      order: index,
      addedAt: new Date().toISOString(),
      trackTitle: track.title,
      trackArtist: track.artist,
      trackDuration: track.duration,
      trackBpm: track.bpm,
      trackGenre: track.genre,
      trackCoverArtUrl: track.coverArtUrl,
    }))
    
    // 6. Create playlist in DynamoDB
    const playlistTableName = process.env.PLAYLIST_TABLE_NAME
    if (!playlistTableName) {
      throw new Error('PLAYLIST_TABLE_NAME not configured')
    }
    
    const playlistId = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    const playlist = {
      id: playlistId,
      name: input.name,
      description: input.description || `Auto-generated playlist with ${selectedTracks.length} tracks`,
      genre: input.genre,
      mood: input.mood,
      bpmMin: input.bpmMin,
      bpmMax: input.bpmMax,
      key: input.key,
      tags: input.tags,
      tracks: JSON.stringify(playlistTracks),
      trackCount: selectedTracks.length,
      totalDuration,
      createdAt: now,
      updatedAt: now,
    }
    
    const putCommand = new PutCommand({
      TableName: playlistTableName,
      Item: playlist,
    })
    
    await docClient.send(putCommand)
    
    console.log('✅ Playlist created:', playlistId)
    
    return {
      success: true,
      playlist,
      tracksMatched: filteredTracks.length,
      tracksSelected: selectedTracks.length,
    }
    
  } catch (error) {
    console.error('❌ Error generating playlist:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
