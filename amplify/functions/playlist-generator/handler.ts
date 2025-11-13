import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { Schema } from '../../data/resource'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

// Camelot Wheel mapping for harmonic mixing
// Each key maps to its Camelot code and compatible keys
const CAMELOT_WHEEL: Record<string, { code: string, compatible: string[] }> = {
  'C': { code: '8B', compatible: ['C', 'G', 'F', 'Am'] },
  'C#/Db': { code: '3B', compatible: ['C#/Db', 'G#/Ab', 'F#/Gb', 'A#/Bb'] },
  'D': { code: '10B', compatible: ['D', 'A', 'G', 'Bm'] },
  'D#/Eb': { code: '5B', compatible: ['D#/Eb', 'A#/Bb', 'G#/Ab', 'Cm'] },
  'E': { code: '12B', compatible: ['E', 'B', 'A', 'C#/Dbm'] },
  'F': { code: '7B', compatible: ['F', 'C', 'A#/Bb', 'Dm'] },
  'F#/Gb': { code: '2B', compatible: ['F#/Gb', 'C#/Db', 'B', 'D#/Ebm'] },
  'G': { code: '9B', compatible: ['G', 'D', 'C', 'Em'] },
  'G#/Ab': { code: '4B', compatible: ['G#/Ab', 'D#/Eb', 'C#/Db', 'Fm'] },
  'A': { code: '11B', compatible: ['A', 'E', 'D', 'F#/Gbm'] },
  'A#/Bb': { code: '6B', compatible: ['A#/Bb', 'F', 'D#/Eb', 'Gm'] },
  'B': { code: '1B', compatible: ['B', 'F#/Gb', 'E', 'G#/Abm'] },
}

/**
 * Calculate harmonic compatibility score between two keys
 * Returns 0-3 (3 = perfect match, 0 = incompatible)
 */
function getHarmonicScore(key1: string | undefined, key2: string | undefined): number {
  if (!key1 || !key2) return 0
  if (key1 === key2) return 3 // Same key = perfect
  
  const key1Data = CAMELOT_WHEEL[key1]
  const key2Data = CAMELOT_WHEEL[key2]
  
  if (!key1Data || !key2Data) return 0
  
  // Check if keys are compatible
  if (key1Data.compatible.includes(key2)) return 2 // Compatible
  
  // Check adjacent on Camelot Wheel (±1 step)
  const key1Code = parseInt(key1Data.code)
  const key2Code = parseInt(key2Data.code)
  const diff = Math.abs(key1Code - key2Code)
  
  if (diff === 1 || diff === 11) return 1 // Adjacent
  
  return 0 // Not compatible
}

interface GeneratePlaylistInput {
  name: string
  description?: string
  genre?: string
  mood?: string
  bpmMin?: number
  bpmMax?: number
  keys?: string[] // Multi-select keys for harmonic mixing
  tags?: string
  maxTracks?: number
  minDuration?: number
  maxDuration?: number
  // Jingle options
  includeJingles?: boolean // Add jingles to playlist
  jinglesEveryN?: number // Insert jingle every N tracks (e.g. 2 = every 2 tracks)
  jingleGenre?: string // Genre filter for jingles (default: 'Station ID')
  jingleTags?: string // Tags filter for jingles (e.g. 'WildFM', 'Sweepers', etc.)
}

interface Track {
  id: string
  title: string
  artist?: string
  genre?: string
  tags?: string
  bpm?: number
  key?: string
  duration?: number
  trimStart?: number
  trimEnd?: number
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
  trackActualDuration?: number // Duration using trim points (for accurate mixing)
  trackTrimStart?: number
  trackTrimEnd?: number
  trackMixOutPoint?: number // Recommended time to start mixing to next track (seconds)
  trackMixInPoint?: number // Recommended time to start this track when mixing in (seconds)
  trackBpm?: number
  trackKey?: string // Musical key
  trackGenre?: string
  trackCoverArtUrl?: string
}

// GraphQL resolver handler
export const handler: Schema['generatePlaylist']['functionHandler'] = async (event) => {
  console.log('🎵 Playlist Generator Lambda triggered', event)
  
  const input = event.arguments as GeneratePlaylistInput
  const result = await generatePlaylist(input)
  
  // Return the object directly - AppSync will handle JSON serialization
  return result as any
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
    
    // Keys filter (multi-select)
    if (input.keys && input.keys.length > 0) {
      filteredTracks = filteredTracks.filter(t => {
        if (!t.key) return false
        // Check if track key matches any selected key OR is compatible
        return input.keys!.some(selectedKey => {
          if (t.key === selectedKey) return true // Exact match
          const score = getHarmonicScore(t.key, selectedKey)
          return score >= 2 // Include compatible keys (score 2 or 3)
        })
      })
      console.log(`🎹 Keys filter (${input.keys.join(', ')}): ${filteredTracks.length} tracks`)
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
    
    // 3. Sort tracks intelligently
    if (input.keys && input.keys.length > 0 && filteredTracks.length > 0) {
      // HARMONIC MIXING: Use Camelot Wheel
      console.log('🎹 Applying harmonic mixing sort...')
      const sorted: Track[] = []
      const remaining = [...filteredTracks]
      
      // Start with first track (preferably matching first selected key)
      const startTrack = remaining.find(t => t.key === input.keys![0]) || remaining[0]
      sorted.push(startTrack)
      remaining.splice(remaining.indexOf(startTrack), 1)
      
      // Greedily pick next track with best harmonic match
      while (remaining.length > 0 && sorted.length < (input.maxTracks || 20)) {
        const currentKey = sorted[sorted.length - 1].key
        
        // Find track with best harmonic score
        let bestTrack = remaining[0]
        let bestScore = getHarmonicScore(currentKey, bestTrack.key)
        
        for (const track of remaining) {
          const score = getHarmonicScore(currentKey, track.key)
          // Also consider BPM proximity as tiebreaker
          const bpmDiff = Math.abs((track.bpm || 0) - (sorted[sorted.length - 1].bpm || 0))
          const adjustedScore = score - (bpmDiff > 10 ? 0.5 : 0)
          
          if (adjustedScore > bestScore) {
            bestScore = adjustedScore
            bestTrack = track
          }
        }
        
        sorted.push(bestTrack)
        remaining.splice(remaining.indexOf(bestTrack), 1)
      }
      
      filteredTracks = sorted
      console.log('✅ Harmonic mix created with optimal key transitions')
    } else {
      // ENERGY FLOW: Create smooth progression based on mood
      console.log('✨ Creating energy flow playlist...')
      
      // Determine energy progression style based on mood
      const moodProgressions: Record<string, 'build' | 'constant' | 'wave'> = {
        'Energetic': 'constant', // Keep energy high
        'Chill': 'constant', // Keep energy low
        'Dark': 'build', // Build tension
        'Uplifting': 'build', // Build to peak
        'Groovy': 'wave', // Up and down groove
        'Melodic': 'wave', // Musical journey
        'Driving': 'constant', // Steady drive
        'Atmospheric': 'wave', // Evolving soundscape
      }
      
      const progression = input.mood ? moodProgressions[input.mood] || 'build' : 'build'
      
      // Sort tracks by energy to prepare
      const energySorted = [...filteredTracks].sort((a, b) => {
        const energyA = a.energy || 0.5
        const energyB = b.energy || 0.5
        return energyA - energyB
      })
      
      // Build optimal order based on progression type
      let ordered: Track[] = []
      
      if (progression === 'build') {
        // Warm-up → Peak: Low to high energy
        ordered = energySorted
        console.log('📈 Energy progression: Warm-up → Peak')
      } else if (progression === 'constant') {
        // Constant energy: Group similar energy levels, slight variations
        const avgEnergy = energySorted.reduce((sum, t) => sum + (t.energy || 0.5), 0) / energySorted.length
        ordered = energySorted.sort((a, b) => {
          const diffA = Math.abs((a.energy || 0.5) - avgEnergy)
          const diffB = Math.abs((b.energy || 0.5) - avgEnergy)
          return diffA - diffB // Prefer tracks near average
        })
        console.log(`➡️ Energy progression: Constant (${avgEnergy.toFixed(2)})`)
      } else {
        // Wave: Low → Mid → High → Mid → Low
        const third = Math.floor(energySorted.length / 3)
        const low = energySorted.slice(0, third)
        const mid = energySorted.slice(third, third * 2)
        const high = energySorted.slice(third * 2)
        
        ordered = [
          ...low.slice(0, Math.ceil(low.length / 2)),
          ...mid,
          ...high,
          ...mid.reverse(),
          ...low.slice(Math.ceil(low.length / 2)).reverse()
        ]
        console.log('🌊 Energy progression: Wave (Low → Peak → Low)')
      }
      
      // Apply BPM smoothing: Avoid large BPM jumps
      const smoothed: Track[] = [ordered[0]]
      const remaining = ordered.slice(1)
      
      while (remaining.length > 0) {
        const currentBpm = smoothed[smoothed.length - 1].bpm || 120
        
        // Find next track with closest BPM (within ±5 preferred)
        let bestIdx = 0
        let bestScore = Infinity
        
        for (let i = 0; i < remaining.length; i++) {
          const trackBpm = remaining[i].bpm || 120
          const bpmDiff = Math.abs(trackBpm - currentBpm)
          
          // Prefer tracks within ±5 BPM, otherwise pick closest
          const score = bpmDiff <= 5 ? bpmDiff : bpmDiff * 2
          
          if (score < bestScore) {
            bestScore = score
            bestIdx = i
          }
        }
        
        smoothed.push(remaining[bestIdx])
        remaining.splice(bestIdx, 1)
      }
      
      filteredTracks = smoothed
      console.log('✅ Energy flow playlist created with BPM smoothing')
    }
    
    // 4. Get jingles if requested
    let jingles: Track[] = []
    if (input.includeJingles) {
      const jingleGenre = input.jingleGenre || 'Station ID'
      let filteredJingles = allTracks.filter(t => t.genre === jingleGenre) as Track[]
      
      // Further filter by tags if jingleTags is provided
      if (input.jingleTags) {
        const requestedTags = input.jingleTags.toLowerCase().split(',').map(t => t.trim())
        filteredJingles = filteredJingles.filter(jingle => {
          if (!jingle.tags) return false
          const jingleTags = jingle.tags.toLowerCase().split(',').map(t => t.trim())
          // Check if any requested tag matches any jingle tag
          return requestedTags.some(reqTag => jingleTags.some(jTag => jTag.includes(reqTag)))
        })
        console.log(`🎤 Found ${filteredJingles.length} jingles (genre: ${jingleGenre}, tags: ${input.jingleTags})`)
      } else {
        console.log(`🎤 Found ${filteredJingles.length} jingles (genre: ${jingleGenre})`)
      }
      
      jingles = filteredJingles
    }
    
    // 5. Select tracks (respect maxTracks and maxDuration)
    const maxTracks = input.maxTracks || 20
    const TARGET_DURATION = 60 * 60 // Target: exactly 60 minutes (3600 seconds)
    const maxDuration = input.maxDuration || TARGET_DURATION
    const MIN_ACCEPTABLE = TARGET_DURATION - 120 // Allow 58+ minutes (within 2 min of target)
    const MAX_ACCEPTABLE = TARGET_DURATION + 60 // Allow up to 61 minutes
    
    const selectedTracks: Track[] = []
    const selectedTrackIds = new Set<string>() // Track duplicates
    let totalDuration = 0
    let totalActualDuration = 0 // Duration without silence (using trim points)
    
    for (const track of filteredTracks) {
      // DUPLICATE CHECK: Skip if already selected
      if (selectedTrackIds.has(track.id)) {
        console.log(`⏭️  Skipping duplicate: ${track.title}`)
        continue
      }
      
      if (selectedTracks.length >= maxTracks) break
      
      // Use actual duration (trim points) if available, otherwise use full duration
      const trackDuration = track.trimStart !== undefined && track.trimEnd !== undefined
        ? (track.trimEnd - track.trimStart)
        : (track.duration || 180) // Default 3 min if no duration
      
      // STRICT DURATION CHECK: Use full duration for safety
      const durationToCheck = track.duration || trackDuration
      
      // INTELLIGENT DURATION CHECK: Aim for exactly 60 minutes
      const wouldExceed = totalDuration + durationToCheck > MAX_ACCEPTABLE
      const tooShort = totalDuration < MIN_ACCEPTABLE
      const nearTarget = totalDuration >= MIN_ACCEPTABLE && totalDuration <= MAX_ACCEPTABLE
      
      if (wouldExceed) {
        console.log(`⏱️  Track would exceed 61min: ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')} + ${Math.floor(durationToCheck / 60)}:${(durationToCheck % 60).toString().padStart(2, '0')}`)
        
        // If we're near target (58-60 min), stop here - perfect!
        if (nearTarget) {
          console.log(`✅ Near-perfect duration reached: ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')}`)
          break
        }
        
        // Too short still, try next track (might be shorter)
        if (tooShort && selectedTracks.length < maxTracks) {
          console.log(`   ⏭️  Skipping, looking for shorter track...`)
          continue
        }
        
        // Give up, we're as close as we can get
        console.log(`   Stopping at ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')}`)
        break
      }
      
      // Add track
      selectedTracks.push(track)
      selectedTrackIds.add(track.id)
      totalDuration += durationToCheck // Use safe duration
      totalActualDuration += trackDuration // Actual playable duration
      
      // Log and check if we've hit the sweet spot
      console.log(`   ➕ Added: ${track.artist} - ${track.title} (${Math.floor(durationToCheck / 60)}:${(durationToCheck % 60).toString().padStart(2, '0')}) | Total: ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')}`)
      
      // Check if we've reached the perfect duration (58-61 minutes)
      if (totalDuration >= MIN_ACCEPTABLE && totalDuration <= MAX_ACCEPTABLE) {
        console.log(`✅ Perfect fit! Total: ${Math.floor(totalDuration / 60)}:${(totalDuration % 60).toString().padStart(2, '0')} (target: 60:00)`)
        break // Stop here, we're at the perfect duration!
      }
    }
    
    const durationMinutes = Math.floor(totalDuration / 60)
    const durationSeconds = Math.floor(totalDuration % 60)
    const actualMinutes = Math.floor(totalActualDuration / 60)
    const actualSeconds = Math.floor(totalActualDuration % 60)
    const targetDiff = totalDuration - TARGET_DURATION
    const targetDiffStr = targetDiff > 0 ? `+${Math.floor(targetDiff / 60)}:${(Math.abs(targetDiff) % 60).toString().padStart(2, '0')}` : `${Math.floor(targetDiff / 60)}:${(Math.abs(targetDiff) % 60).toString().padStart(2, '0')}`
    
    console.log(`✅ Selected ${selectedTracks.length} tracks (NO DUPLICATES! ✨)`)
    console.log(`   Total duration: ${durationMinutes}:${durationSeconds.toString().padStart(2, '0')} (target: 60:00, diff: ${targetDiffStr})`)
    console.log(`   Actual mix duration (trimmed): ${actualMinutes}:${actualSeconds.toString().padStart(2, '0')}`)
    
    if (Math.abs(targetDiff) <= 60) {
      console.log(`   🎯 PERFECT! Within 1 minute of target!`)
    } else if (Math.abs(targetDiff) <= 120) {
      console.log(`   ✅ EXCELLENT! Within 2 minutes of target!`)
    } else {
      console.log(`   ⚠️  Could be closer to 60 minutes...`)
    }
    
    // 5.5. Insert jingles if requested
    let finalTracks: Track[] = selectedTracks
    let jinglesInserted = 0
    
    if (input.includeJingles) {
      if (jingles.length === 0) {
        console.log(`⚠️  No jingles found matching criteria (genre: ${input.jingleGenre || 'Station ID'}, tags: ${input.jingleTags || 'any'})`)  
      } else {
        const jinglesEveryN = input.jinglesEveryN || 2 // Default: every 2 tracks
        console.log(`🎤 Inserting jingles every ${jinglesEveryN} tracks (${jingles.length} jingles available)...`)
        
        finalTracks = []
        let jingleIndex = 0
        
        for (let i = 0; i < selectedTracks.length; i++) {
          finalTracks.push(selectedTracks[i])
          
          // Insert jingle after every N tracks (but not after the last track)
          if ((i + 1) % jinglesEveryN === 0 && i < selectedTracks.length - 1) {
            const jingle = jingles[jingleIndex % jingles.length] // Loop through jingles
            finalTracks.push(jingle)
            console.log(`   🎤 Inserted jingle: ${jingle.title} (after track ${i + 1})`)
            jingleIndex++
            jinglesInserted++
          }
        }
        
        // Calculate new total duration with jingles
        totalDuration = finalTracks.reduce((sum, t) => sum + (t.duration || 0), 0)
        totalActualDuration = finalTracks.reduce((sum, t) => {
          const duration = t.trimStart !== undefined && t.trimEnd !== undefined
            ? (t.trimEnd - t.trimStart)
            : (t.duration || 0)
          return sum + duration
        }, 0)
        
        const newDurationMin = Math.floor(totalDuration / 60)
        const newDurationSec = Math.floor(totalDuration % 60)
        const jingleDiff = totalDuration - TARGET_DURATION
        const jingleDiffStr = jingleDiff > 0 ? `+${Math.floor(jingleDiff / 60)}:${(Math.abs(jingleDiff) % 60).toString().padStart(2, '0')}` : `${Math.floor(jingleDiff / 60)}:${(Math.abs(jingleDiff) % 60).toString().padStart(2, '0')}`
        
        console.log(`✅ Inserted ${jinglesInserted} jingles`)
        console.log(`   New total duration: ${newDurationMin}:${newDurationSec.toString().padStart(2, '0')} (target: 60:00, diff: ${jingleDiffStr})`)
        console.log(`   New actual duration: ${Math.floor(totalActualDuration / 60)}:${(Math.floor(totalActualDuration) % 60).toString().padStart(2, '0')}`)
        
        // Check if still close to target
        if (Math.abs(jingleDiff) <= 60) {
          console.log(`   🎯 PERFECT WITH JINGLES! Within 1 minute of 60:00!`)
        } else if (Math.abs(jingleDiff) <= 180) {
          console.log(`   ✅ GOOD! Within 3 minutes of 60:00 with jingles`)
        } else {
          console.log(`   ⚠️  With jingles: ${newDurationMin}:${newDurationSec.toString().padStart(2, '0')} (may need adjustment)`)
        }
      }
    }
    
    // 6. Create PlaylistTrackItems with auto-mix points
    const playlistTracks: PlaylistTrackItem[] = finalTracks.map((track, index) => {
      // Calculate actual duration using trim points
      const actualDuration = track.trimStart !== undefined && track.trimEnd !== undefined
        ? (track.trimEnd - track.trimStart)
        : track.duration
      
      // Calculate auto-mix points for DJ mixing
      let mixOutPoint: number | undefined
      let mixInPoint: number | undefined
      
      if (track.bpm && track.trimEnd !== undefined) {
        // Mix out: Start mixing 8 bars before trim end
        // 8 bars = 32 beats = 32 * (60 / BPM) seconds
        const eightBarsInSeconds = (32 * 60) / track.bpm
        mixOutPoint = Math.max(track.trimStart || 0, track.trimEnd - eightBarsInSeconds)
      }
      
      if (track.trimStart !== undefined) {
        // Mix in: Start this track at trim start (skip intro silence)
        mixInPoint = track.trimStart
      }
      
      return {
        trackId: track.id,
        order: index,
        addedAt: new Date().toISOString(),
        trackTitle: track.title,
        trackArtist: track.artist,
        trackDuration: track.duration,
        trackActualDuration: actualDuration, // Duration without silence for accurate mixing
        trackTrimStart: track.trimStart,
        trackTrimEnd: track.trimEnd,
        trackMixOutPoint: mixOutPoint, // Time to start mixing to next track
        trackMixInPoint: mixInPoint, // Time to start playing when mixing in
        trackBpm: track.bpm,
        trackKey: track.key, // Include key for display
        trackGenre: track.genre,
        trackCoverArtUrl: track.coverArtUrl,
      }
    })
    
    console.log('🎛️ Auto-mix points calculated for seamless transitions')
    
    // 7. Create playlist in DynamoDB
    const playlistTableName = process.env.PLAYLIST_TABLE_NAME
    if (!playlistTableName) {
      throw new Error('PLAYLIST_TABLE_NAME not configured')
    }
    
    const playlistId = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    const jingleCount = finalTracks.length - selectedTracks.length
    const descriptionSuffix = jingleCount > 0 ? ` + ${jingleCount} jingles` : ''
    
    const playlist = {
      id: playlistId,
      name: input.name,
      description: input.description || `Auto-generated harmonic mix with ${selectedTracks.length} tracks${descriptionSuffix}`,
      genre: input.genre,
      mood: input.mood,
      bpmMin: input.bpmMin,
      bpmMax: input.bpmMax,
      key: input.keys && input.keys.length > 0 ? input.keys.join(', ') : undefined, // Store keys as comma-separated
      tags: input.tags,
      tracks: JSON.stringify(playlistTracks),
      trackCount: finalTracks.length,
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
