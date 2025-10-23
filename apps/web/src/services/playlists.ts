// Service layer for Playlist data operations
import { generateClient } from 'aws-amplify/data'
import type { 
  Playlist, 
  CreatePlaylistInput, 
  UpdatePlaylistInput,
  PlaylistTrackItem,
  parsePlaylistTracks,
  serializePlaylistTracks 
} from '../types/playlist'

// Lazy client - only create after Amplify.configure()
let client: any = null

function getClient() {
  if (!client) {
    // @ts-ignore - Amplify Gen 2 client will have models at runtime
    client = generateClient()
    console.log('[Playlists] Client generated')
  }
  return client
}

/**
 * List all playlists
 */
export async function listPlaylists() {
  try {
    // @ts-ignore - Playlist model exists at runtime
    const { data, errors } = await getClient().models.Playlist.list()
    if (errors) {
      console.error('❌ GraphQL Errors listing playlists:', errors)
      errors.forEach((err: any, i: number) => {
        console.error(`  Error ${i + 1}:`, {
          message: err.message,
          path: err.path,
        })
      })
      return { data: [], errors }
    }
    return { data: data || [], errors: null }
  } catch (error) {
    console.error('Failed to list playlists:', error)
    return { data: [], errors: [error] }
  }
}

/**
 * Get a single playlist by ID
 */
export async function getPlaylist(id: string) {
  try {
    // @ts-ignore - Playlist model exists at runtime
    const { data, errors } = await getClient().models.Playlist.get({ id })
    if (errors) {
      console.error('Error getting playlist:', errors)
      return { data: null, errors }
    }
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to get playlist:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Create a new playlist
 */
export async function createPlaylist(input: CreatePlaylistInput) {
  try {
    // @ts-ignore - Playlist model exists at runtime
    const { data, errors } = await getClient().models.Playlist.create({
      ...input,
      tracks: '[]', // Empty tracks array
      trackCount: 0,
      totalDuration: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    if (errors) {
      console.error('Error creating playlist:', errors)
      return { data: null, errors }
    }
    console.log('✅ Playlist created:', data)
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to create playlist:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Update an existing playlist
 */
export async function updatePlaylist(input: UpdatePlaylistInput) {
  try {
    // @ts-ignore - Playlist model exists at runtime
    const { data, errors } = await getClient().models.Playlist.update({
      ...input,
      updatedAt: new Date().toISOString(),
    })
    if (errors) {
      console.error('Error updating playlist:', errors)
      return { data: null, errors }
    }
    console.log('✅ Playlist updated:', data)
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to update playlist:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(id: string) {
  try {
    // @ts-ignore - Playlist model exists at runtime
    const { data, errors } = await getClient().models.Playlist.delete({ id })
    if (errors) {
      console.error('Error deleting playlist:', errors)
      return { data: null, errors }
    }
    console.log('✅ Playlist deleted:', id)
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to delete playlist:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Add tracks to playlist
 */
export async function addTracksToPlaylist(playlistId: string, tracksToAdd: PlaylistTrackItem[]) {
  try {
    // Get current playlist
    const { data: playlist } = await getPlaylist(playlistId)
    if (!playlist) {
      throw new Error('Playlist not found')
    }
    
    // Parse current tracks
    const currentTracks: PlaylistTrackItem[] = JSON.parse(playlist.tracks || '[]')
    
    // Get existing track IDs to prevent duplicates
    const existingTrackIds = new Set(currentTracks.map(t => t.trackId))
    
    // Filter out duplicates
    const uniqueTracksToAdd = tracksToAdd.filter(track => {
      if (existingTrackIds.has(track.trackId)) {
        console.warn(`⚠️ Skipping duplicate track: ${track.trackId}`)
        return false
      }
      return true
    })
    
    // If no unique tracks to add, return early
    if (uniqueTracksToAdd.length === 0) {
      console.log('ℹ️ No new tracks to add (all duplicates)')
      return { data: playlist, errors: null }
    }
    
    // Check duration limit (max 59 minutes = 3540 seconds)
    const MAX_DURATION = 59 * 60 // 3540 seconds
    const currentDuration = currentTracks.reduce((sum, t) => sum + (t.trackDuration || 0), 0)
    const newTracksDuration = uniqueTracksToAdd.reduce((sum, t) => sum + (t.trackDuration || 0), 0)
    const projectedDuration = currentDuration + newTracksDuration
    
    if (projectedDuration > MAX_DURATION) {
      const remaining = MAX_DURATION - currentDuration
      const remainingMin = Math.floor(remaining / 60)
      const remainingSec = remaining % 60
      throw new Error(
        `Playlist duration limit exceeded! Maximum 59 minutes allowed. ` +
        `Current: ${Math.floor(currentDuration / 60)}:${(currentDuration % 60).toString().padStart(2, '0')}, ` +
        `Remaining: ${remainingMin}:${remainingSec.toString().padStart(2, '0')}`
      )
    }
    
    // Add new tracks with incremented order
    const maxOrder = currentTracks.length > 0 
      ? Math.max(...currentTracks.map(t => t.order))
      : -1
    
    const newTracks = uniqueTracksToAdd.map((track, index) => ({
      ...track,
      order: maxOrder + 1 + index,
      addedAt: new Date().toISOString(),
    }))
    
    const updatedTracks = [...currentTracks, ...newTracks]
    
    // Calculate new totals
    const trackCount = updatedTracks.length
    const totalDuration = updatedTracks.reduce((sum, t) => sum + (t.trackDuration || 0), 0)
    
    // Update playlist
    const { data, errors } = await updatePlaylist({
      id: playlistId,
      // @ts-ignore
      tracks: JSON.stringify(updatedTracks),
      trackCount,
      totalDuration,
    })
    
    return { data, errors }
  } catch (error) {
    console.error('Failed to add tracks to playlist:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Remove track from playlist
 */
export async function removeTrackFromPlaylist(playlistId: string, trackId: string) {
  try {
    // Get current playlist
    const { data: playlist } = await getPlaylist(playlistId)
    if (!playlist) {
      throw new Error('Playlist not found')
    }
    
    // Parse and filter tracks
    const currentTracks: PlaylistTrackItem[] = JSON.parse(playlist.tracks || '[]')
    const updatedTracks = currentTracks
      .filter(t => t.trackId !== trackId)
      .map((t, index) => ({ ...t, order: index })) // Re-index
    
    // Calculate new totals
    const trackCount = updatedTracks.length
    const totalDuration = updatedTracks.reduce((sum, t) => sum + (t.trackDuration || 0), 0)
    
    // Update playlist
    const { data, errors } = await updatePlaylist({
      id: playlistId,
      // @ts-ignore
      tracks: JSON.stringify(updatedTracks),
      trackCount,
      totalDuration,
    })
    
    return { data, errors }
  } catch (error) {
    console.error('Failed to remove track from playlist:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Reorder tracks in playlist
 */
export async function reorderPlaylistTracks(playlistId: string, trackIds: string[]) {
  try {
    // Get current playlist
    const { data: playlist } = await getPlaylist(playlistId)
    if (!playlist) {
      throw new Error('Playlist not found')
    }
    
    // Parse current tracks
    const currentTracks: PlaylistTrackItem[] = JSON.parse(playlist.tracks || '[]')
    
    // Create map for quick lookup
    const trackMap = new Map(currentTracks.map(t => [t.trackId, t]))
    
    // Reorder based on trackIds array
    const reorderedTracks = trackIds
      .map(id => trackMap.get(id))
      .filter(Boolean) // Remove undefined
      .map((track, index) => ({
        ...track!,
        order: index,
      }))
    
    // Update playlist
    const { data, errors } = await updatePlaylist({
      id: playlistId,
      // @ts-ignore
      tracks: JSON.stringify(reorderedTracks),
    })
    
    return { data, errors }
  } catch (error) {
    console.error('Failed to reorder playlist tracks:', error)
    return { data: null, errors: [error] }
  }
}
