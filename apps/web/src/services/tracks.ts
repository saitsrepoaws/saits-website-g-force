// Service layer for Track data operations
import { generateClient } from 'aws-amplify/data'

export type Track = any
export type CreateTrackInput = any
export type UpdateTrackInput = any

// Lazy client - only create after Amplify.configure()
let client: any = null

function getClient() {
  if (!client) {
    // @ts-ignore - Amplify Gen 2 client will have models at runtime
    client = generateClient()
    console.log('[Tracks] Client generated:', client)
    console.log('[Tracks] Client.models:', client.models)
    console.log('[Tracks] Available models:', Object.keys(client.models || {}))
  }
  return client
}

/**
 * List all tracks
 */
export async function listTracks() {
  try {
    console.log('🔍 Attempting to list tracks...')
    
    // @ts-ignore - Track model exists at runtime
    const result = await getClient().models.Track.list({
      selectionSet: [
        'id',
        'artist',
        'title',
        'version',
        'label',
        'genre',
        'year',
        'duration',
        'fileUrl',
        'fileSize',
        'format',
        'addedAt',
        'bpm',
        'key',
        'energy',
        'danceability',
        'valence',
        'coverArtUrl',
        'waveformUrl',
        'trimStart',
        'trimEnd',
        // Skip createdAt/updatedAt - they have datetime format issues from Lambda
      ],
    })
    
    console.log('📦 Raw result from GraphQL:', result)
    
    const { data, errors } = result
    
    if (errors) {
      console.error('❌ GraphQL Errors listing tracks:', errors)
      errors.forEach((err: any, i: number) => {
        console.error(`  Error ${i + 1}:`, {
          message: err.message,
          path: err.path,
          errorType: err.errorType,
          errorInfo: err.errorInfo,
          locations: err.locations,
          fullError: err,
        })
      })
      // Still return data if available (partial success), but filter nulls
      const validTracks = (data || []).filter((track: any) => track !== null && track.id)
      console.log(`⚠️ Filtered ${data?.length || 0} items → ${validTracks.length} valid tracks`)
      return { data: validTracks, errors }
    }
    
    // Filter out null tracks (corrupted data)
    const validTracks = (data || []).filter((track: any) => track !== null && track.id)
    console.log(`✅ Successfully loaded ${validTracks.length} tracks`)
    return { data: validTracks, errors: null }
  } catch (error) {
    console.error('❌ Failed to list tracks:', error)
    console.error('Error details:', {
      name: (error as any).name,
      message: (error as any).message,
      stack: (error as any).stack
    })
    return { data: [], errors: [error] }
  }
}

/**
 * Get a single track by ID
 */
export async function getTrack(id: string) {
  try {
    // @ts-ignore - Track model exists at runtime
    const { data, errors } = await getClient().models.Track.get({ id })
    if (errors) {
      console.error('Error getting track:', errors)
      return { data: null, errors }
    }
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to get track:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Create a new track
 */
export async function createTrack(input: CreateTrackInput) {
  try {
    // @ts-ignore - Track model exists at runtime
    const { data, errors } = await getClient().models.Track.create(input)
    if (errors) {
      console.error('Error creating track:', errors)
      return { data: null, errors }
    }
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to create track:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Update an existing track
 */
export async function updateTrack(input: UpdateTrackInput) {
  try {
    // @ts-ignore - Track model exists at runtime
    const { data, errors } = await getClient().models.Track.update(input)
    if (errors) {
      console.error('Error updating track:', errors)
      return { data: null, errors }
    }
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to update track:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Delete a track
 */
export async function deleteTrack(id: string) {
  try {
    console.log(`🗑️ Attempting to delete track: ${id}`)
    
    // Simple delete with just ID - let Amplify handle the rest
    // @ts-ignore - Track model exists at runtime
    const result = await getClient().models.Track.delete({ id })
    
    // Check for errors
    if (result.errors && result.errors.length > 0) {
      console.error('❌ Delete failed with errors:', result.errors)
      
      // Log detailed error info
      result.errors.forEach((err: any, index: number) => {
        console.error(`  Error ${index + 1}:`, {
          message: err.message,
          path: err.path,
          errorType: err.errorType,
          locations: err.locations,
        })
      })
      
      // Even with errors, check if data came through (partial success)
      if (result.data) {
        console.log('⚠️ Delete completed with errors, but data returned:', result.data)
        return { data: result.data, errors: result.errors }
      }
      
      return { data: null, errors: result.errors }
    }
    
    console.log('✅ Track deleted successfully from DynamoDB')
    return { data: result.data || { id }, errors: null }
    
  } catch (error) {
    console.error('❌ Delete operation failed:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Subscribe to track changes (real-time)
 */
export function subscribeToTracks(
  onCreate?: (track: Track) => void,
  onUpdate?: (track: Track) => void,
  onDelete?: (track: Track) => void
) {
  const subscriptions: Array<{ unsubscribe: () => void }> = []

  if (onCreate) {
    // @ts-ignore - Track model exists at runtime
    const sub = getClient().models.Track.onCreate().subscribe({
      next: (data: any) => onCreate(data),
      error: (error: any) => console.error('onCreate subscription error:', error),
    })
    subscriptions.push(sub)
  }

  if (onUpdate) {
    // @ts-ignore - Track model exists at runtime
    const sub = getClient().models.Track.onUpdate().subscribe({
      next: (data: any) => onUpdate(data),
      error: (error: any) => console.error('onUpdate subscription error:', error),
    })
    subscriptions.push(sub)
  }

  if (onDelete) {
    // @ts-ignore - Track model exists at runtime
    const sub = getClient().models.Track.onDelete().subscribe({
      next: (data: any) => onDelete(data),
      error: (error: any) => console.error('onDelete subscription error:', error),
    })
    subscriptions.push(sub)
  }

  return {
    unsubscribe: () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    },
  }
}
