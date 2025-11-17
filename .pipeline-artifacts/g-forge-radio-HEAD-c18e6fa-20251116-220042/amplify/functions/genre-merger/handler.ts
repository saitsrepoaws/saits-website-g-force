/**
 * Genre Merger Lambda
 * 
 * Merges multiple genres into one, updating all affected tracks
 * 
 * Use case: Consolidate duplicate/similar genres
 * Example: "Techno", "Techno (Peak Time)", "Peak Time Techno" → "Techno"
 * 
 * Input:
 * {
 *   sourceGenres: ["Techno (Peak Time)", "Peak Time Techno"],
 *   targetGenre: "Techno",
 *   dryRun: false  // Set true to preview changes without applying
 * }
 * 
 * Output:
 * {
 *   success: true,
 *   tracksUpdated: 45,
 *   sourceGenres: [...],
 *   targetGenre: "Techno",
 *   affectedTracks: [...]  // Preview of tracks that will be updated
 * }
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  UpdateCommand,
  BatchWriteCommand 
} from '@aws-sdk/lib-dynamodb'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TRACK_TABLE = process.env.TRACK_TABLE!
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE!

interface MergeRequest {
  sourceGenres: string[]  // Genres to be replaced
  targetGenre: string     // New genre name
  dryRun?: boolean       // Preview mode (default: false)
}

interface TrackUpdate {
  id: string
  oldGenre: string
  newGenre: string
  title: string
  artist: string
}

/**
 * Scan Track table for tracks with source genres
 */
async function findTracksWithGenres(genres: string[]): Promise<any[]> {
  console.log(`🔍 Scanning for tracks with genres: ${genres.join(', ')}`)
  
  const tracks: any[] = []
  let lastEvaluatedKey: any = undefined
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: TRACK_TABLE,
      ExclusiveStartKey: lastEvaluatedKey
    }))
    
    if (result.Items) {
      // Filter tracks that have one of the source genres
      const matchingTracks = result.Items.filter(track => 
        track.genre && genres.includes(track.genre)
      )
      tracks.push(...matchingTracks)
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey
  } while (lastEvaluatedKey)
  
  console.log(`✅ Found ${tracks.length} tracks with source genres`)
  return tracks
}

/**
 * Update track genre
 */
async function updateTrackGenre(trackId: string, newGenre: string): Promise<boolean> {
  try {
    await dynamodb.send(new UpdateCommand({
      TableName: TRACK_TABLE,
      Key: { id: trackId },
      UpdateExpression: 'SET genre = :genre, updatedAt = :now',
      ExpressionAttributeValues: {
        ':genre': newGenre,
        ':now': new Date().toISOString()
      }
    }))
    return true
  } catch (error) {
    console.error(`❌ Failed to update track ${trackId}:`, error)
    return false
  }
}

/**
 * Batch update tracks (max 25 per batch)
 */
async function batchUpdateTracks(tracks: any[], targetGenre: string): Promise<number> {
  let updated = 0
  
  // DynamoDB batch write max 25 items
  const batchSize = 25
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize)
    
    console.log(`📦 Updating batch ${Math.floor(i / batchSize) + 1} (${batch.length} tracks)`)
    
    // Update each track in batch
    const updatePromises = batch.map(track => 
      updateTrackGenre(track.id, targetGenre)
    )
    
    const results = await Promise.all(updatePromises)
    updated += results.filter(r => r).length
  }
  
  return updated
}

/**
 * Find and update playlists that have genre filter matching source genres
 */
async function updatePlaylistGenres(sourceGenres: string[], targetGenre: string, dryRun: boolean): Promise<number> {
  console.log('🎵 Checking playlists with genre filters...')
  
  const { Items = [] } = await dynamodb.send(new ScanCommand({
    TableName: PLAYLIST_TABLE
  }))
  
  const affectedPlaylists = Items.filter(playlist => 
    playlist.genre && sourceGenres.includes(playlist.genre)
  )
  
  console.log(`   Found ${affectedPlaylists.length} playlists to update`)
  
  if (dryRun || affectedPlaylists.length === 0) {
    return affectedPlaylists.length
  }
  
  // Update playlist genres
  let updated = 0
  for (const playlist of affectedPlaylists) {
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: PLAYLIST_TABLE,
        Key: { id: playlist.id },
        UpdateExpression: 'SET genre = :genre, updatedAt = :now',
        ExpressionAttributeValues: {
          ':genre': targetGenre,
          ':now': new Date().toISOString()
        }
      }))
      updated++
    } catch (error) {
      console.error(`❌ Failed to update playlist ${playlist.id}:`, error)
    }
  }
  
  return updated
}

/**
 * Get genre statistics (track counts per genre)
 */
async function getGenreStats(): Promise<Record<string, number>> {
  console.log('📊 Gathering genre statistics...')
  
  const stats: Record<string, number> = {}
  let lastEvaluatedKey: any = undefined
  
  do {
    const result = await dynamodb.send(new ScanCommand({
      TableName: TRACK_TABLE,
      ProjectionExpression: 'genre',
      ExclusiveStartKey: lastEvaluatedKey
    }))
    
    if (result.Items) {
      result.Items.forEach(track => {
        if (track.genre) {
          stats[track.genre] = (stats[track.genre] || 0) + 1
        }
      })
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey
  } while (lastEvaluatedKey)
  
  // Sort by count descending
  const sorted = Object.entries(stats)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [genre, count]) => ({ ...acc, [genre]: count }), {})
  
  console.log(`✅ Found ${Object.keys(stats).length} unique genres`)
  return sorted
}

/**
 * Main handler
 */
export const handler = async (event: any) => {
  console.log('🎨 Genre Merger - Starting...')
  console.log(`📋 Event:`, JSON.stringify(event, null, 2))
  
  try {
    // Parse input
    const input: MergeRequest = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event
    
    // Special case: Get genre statistics
    if (input.sourceGenres && input.sourceGenres[0] === '__STATS__') {
      const stats = await getGenreStats()
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          action: 'statistics',
          genreStats: stats,
          totalGenres: Object.keys(stats).length,
          totalTracks: Object.values(stats).reduce((a, b) => a + b, 0)
        })
      }
    }
    
    // Validation
    if (!input.sourceGenres || input.sourceGenres.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'sourceGenres is required and must not be empty'
        })
      }
    }
    
    if (!input.targetGenre || input.targetGenre.trim() === '') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'targetGenre is required'
        })
      }
    }
    
    const dryRun = input.dryRun === true
    console.log(`🎯 Mode: ${dryRun ? 'DRY RUN (preview)' : 'LIVE UPDATE'}`)
    console.log(`📝 Merging: ${input.sourceGenres.join(', ')} → ${input.targetGenre}`)
    
    // 1. Find affected tracks
    const affectedTracks = await findTracksWithGenres(input.sourceGenres)
    
    if (affectedTracks.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No tracks found with source genres',
          tracksUpdated: 0,
          playlistsUpdated: 0,
          sourceGenres: input.sourceGenres,
          targetGenre: input.targetGenre
        })
      }
    }
    
    // 2. Preview or update tracks
    const trackUpdates: TrackUpdate[] = affectedTracks.map(track => ({
      id: track.id,
      oldGenre: track.genre,
      newGenre: input.targetGenre,
      title: track.title || 'Unknown',
      artist: track.artist || 'Unknown'
    }))
    
    let tracksUpdated = 0
    if (!dryRun) {
      console.log(`🔄 Updating ${affectedTracks.length} tracks...`)
      tracksUpdated = await batchUpdateTracks(affectedTracks, input.targetGenre)
      console.log(`✅ Updated ${tracksUpdated}/${affectedTracks.length} tracks`)
    }
    
    // 3. Update playlists
    const playlistsUpdated = await updatePlaylistGenres(
      input.sourceGenres, 
      input.targetGenre, 
      dryRun
    )
    
    // 4. Return results
    const result = {
      success: true,
      dryRun,
      tracksUpdated: dryRun ? 0 : tracksUpdated,
      tracksAffected: affectedTracks.length,
      playlistsUpdated: dryRun ? 0 : playlistsUpdated,
      playlistsAffected: playlistsUpdated,
      sourceGenres: input.sourceGenres,
      targetGenre: input.targetGenre,
      preview: dryRun ? trackUpdates.slice(0, 10) : undefined, // First 10 for preview
      message: dryRun 
        ? `Preview: ${affectedTracks.length} tracks and ${playlistsUpdated} playlists would be updated`
        : `Successfully updated ${tracksUpdated} tracks and ${playlistsUpdated} playlists`
    }
    
    console.log('✅ Genre merge complete!')
    console.log(`   Tracks: ${tracksUpdated}/${affectedTracks.length}`)
    console.log(`   Playlists: ${playlistsUpdated}`)
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error('❌ Error in genre merger:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
