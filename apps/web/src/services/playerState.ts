/**
 * PlayerState Service
 * 
 * Hybrid approach for player state management:
 * - Real-time updates via IoT (free!)
 * - Persistent snapshots in DynamoDB (cheap!)
 * 
 * Save strategy:
 * - On PAUSE (preserve position)
 * - On STOP (reset position)
 * - On LOAD (new track)
 * - Every 5 minutes (checkpoint during playback)
 * - On page unload (browser close)
 * 
 * Recovery:
 * - On page load: restore last known state
 * - Resume playback from lastPosition
 */

import { generateClient } from 'aws-amplify/data'

let client: any

function getClient() {
  if (!client) {
    // @ts-ignore - Amplify Gen 2 client will have models at runtime
    client = generateClient()
    console.log('[PlayerState] Client generated')
  }
  return client
}

export interface PlayerStateData {
  playerId: string
  currentTrackId?: string
  currentTrackTitle?: string
  currentTrackArtist?: string
  currentPlaylistId?: string
  status: 'playing' | 'paused' | 'stopped' | 'idle'
  lastPosition: number
  duration: number
  volume: number
  autoPlayEnabled: boolean
  currentScheduleSlotId?: string
  currentScheduleSlotName?: string
  deviceInfo?: string
}

/**
 * Get or create player state
 */
export async function getPlayerState(playerId: string) {
  try {
    console.log('🔍 Getting player state for:', playerId)
    
    // Try to get existing state
    // @ts-ignore - PlayerState model exists at runtime
    const { data: items } = await getClient().models.PlayerState.list({
      filter: { playerId: { eq: playerId } }
    })
    
    if (items && items.length > 0) {
      console.log('✅ Found existing player state:', items[0])
      return { data: items[0], errors: null }
    }
    
    // Create default state if not exists
    console.log('🆕 Creating new player state for:', playerId)
    // @ts-ignore
    const { data, errors } = await getClient().models.PlayerState.create({
      playerId,
      status: 'idle',
      lastPosition: 0,
      duration: 0,
      volume: 0.7,
      autoPlayEnabled: false,
      lastActive: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    })
    
    return { data, errors }
  } catch (error) {
    console.error('❌ Failed to get player state:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Save player state snapshot
 */
export async function savePlayerState(stateId: string, state: Partial<PlayerStateData>) {
  try {
    console.log('💾 Saving player state snapshot:', state.status)
    
    // @ts-ignore
    const { data, errors } = await getClient().models.PlayerState.update({
      id: stateId,
      ...state,
      lastActive: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    })
    
    if (errors) {
      console.error('❌ Failed to save player state:', errors)
      return { data: null, errors }
    }
    
    console.log('✅ Player state saved')
    return { data, errors: null }
  } catch (error) {
    console.error('❌ Failed to save player state:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Update player position (lightweight update)
 */
export async function updatePlayerPosition(stateId: string, position: number) {
  try {
    // @ts-ignore
    const { data, errors } = await getClient().models.PlayerState.update({
      id: stateId,
      lastPosition: position,
      lastUpdated: new Date().toISOString()
    })
    
    if (errors) {
      console.error('❌ Failed to update position:', errors)
      return { data: null, errors }
    }
    
    return { data, errors: null }
  } catch (error) {
    console.error('❌ Failed to update position:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Clear player state (on unload/stop)
 */
export async function clearPlayerState(stateId: string) {
  try {
    console.log('🧹 Clearing player state')
    
    // @ts-ignore
    const { data, errors } = await getClient().models.PlayerState.update({
      id: stateId,
      currentTrackId: null,
      currentTrackTitle: null,
      currentTrackArtist: null,
      status: 'idle',
      lastPosition: 0,
      duration: 0,
      lastUpdated: new Date().toISOString()
    })
    
    return { data, errors }
  } catch (error) {
    console.error('❌ Failed to clear player state:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Delete player state
 */
export async function deletePlayerState(stateId: string) {
  try {
    // @ts-ignore
    const { data, errors } = await getClient().models.PlayerState.delete({ id: stateId })
    return { data, errors }
  } catch (error) {
    console.error('❌ Failed to delete player state:', error)
    return { data: null, errors: [error] }
  }
}
