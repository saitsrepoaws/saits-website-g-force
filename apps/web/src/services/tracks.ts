// Service layer for Track data operations
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'

export type Track = Schema['Track']['type']
export type CreateTrackInput = Schema['Track']['createType']
export type UpdateTrackInput = Schema['Track']['updateType']

// Lazy client initialization - only create when first used
let client: ReturnType<typeof generateClient<Schema>> | null = null

function getClient() {
  if (!client) {
    client = generateClient<Schema>()
  }
  return client
}

/**
 * List all tracks
 */
export async function listTracks() {
  try {
    const { data, errors } = await getClient().models.Track.list()
    if (errors) {
      console.error('Error listing tracks:', errors)
      return { data: [], errors }
    }
    return { data: data || [], errors: null }
  } catch (error) {
    console.error('Failed to list tracks:', error)
    return { data: [], errors: [error] }
  }
}

/**
 * Get a single track by ID
 */
export async function getTrack(id: string) {
  try {
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
    const { data, errors } = await getClient().models.Track.delete({ id })
    if (errors) {
      console.error('Error deleting track:', errors)
      return { data: null, errors }
    }
    return { data, errors: null }
  } catch (error) {
    console.error('Failed to delete track:', error)
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
    const sub = getClient().models.Track.onCreate().subscribe({
      next: (data) => onCreate(data),
      error: (error) => console.error('onCreate subscription error:', error),
    })
    subscriptions.push(sub)
  }

  if (onUpdate) {
    const sub = getClient().models.Track.onUpdate().subscribe({
      next: (data) => onUpdate(data),
      error: (error) => console.error('onUpdate subscription error:', error),
    })
    subscriptions.push(sub)
  }

  if (onDelete) {
    const sub = getClient().models.Track.onDelete().subscribe({
      next: (data) => onDelete(data),
      error: (error) => console.error('onDelete subscription error:', error),
    })
    subscriptions.push(sub)
  }

  return {
    unsubscribe: () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    },
  }
}
