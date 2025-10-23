// IoT/PubSub service for real-time playlist updates
import { PubSub } from 'aws-amplify/pubsub'
import { CONNECTION_STATE_CHANGE, ConnectionState } from 'aws-amplify/pubsub'
import { Hub } from 'aws-amplify/utils'
import type { PlaylistEvent, PlaylistTrackItem } from '../types/playlist'

class PlaylistIoTService {
  private subscriptions: Map<string, any> = new Map()
  private isConnected = false
  
  /**
   * Initialize IoT connection
   * Auto-configured via amplify_outputs.json
   */
  async connect() {
    console.log('🔌 Connecting to IoT Core...')
    
    // Listen for connection state changes
    Hub.listen('pubsub', (data: any) => {
      const { payload } = data
      if (payload.event === CONNECTION_STATE_CHANGE) {
        const connectionState = payload.data.connectionState as ConnectionState
        console.log('📡 IoT Connection State:', connectionState)
        this.isConnected = connectionState === ConnectionState.Connected
      }
    })
  }
  
  /**
   * Subscribe to playlist events
   * Returns unsubscribe function
   */
  subscribeToPlaylist(playlistId: string, callback: (event: PlaylistEvent) => void) {
    const topic = `playlist/${playlistId}/events`
    
    console.log(`📡 Subscribing to: ${topic}`)
    
    const subscription = PubSub.subscribe({ topics: [topic] }).subscribe({
      next: (data) => {
        console.log('📩 Playlist event received:', data)
        try {
          const event = data.value as PlaylistEvent
          callback(event)
        } catch (error) {
          console.error('Failed to parse playlist event:', error)
        }
      },
      error: (error) => {
        console.error('❌ IoT subscription error:', error)
      },
      complete: () => {
        console.log('IoT subscription completed')
      },
    })
    
    this.subscriptions.set(playlistId, subscription)
    
    // Return unsubscribe function
    return () => {
      console.log(`📡 Unsubscribing from: ${topic}`)
      subscription.unsubscribe()
      this.subscriptions.delete(playlistId)
    }
  }
  
  /**
   * Publish playlist event
   */
  private async publishEvent(playlistId: string, event: PlaylistEvent) {
    const topic = `playlist/${playlistId}/events`
    
    console.log(`📤 Publishing to ${topic}:`, event)
    
    try {
      await PubSub.publish({
        topics: [topic],
        message: event,
      })
      console.log('✅ Event published successfully')
    } catch (error) {
      console.error('❌ Failed to publish event:', error)
      throw error
    }
  }
  
  /**
   * Notify track added
   */
  async trackAdded(playlistId: string, track: PlaylistTrackItem) {
    const event: PlaylistEvent = {
      type: 'TRACK_ADDED',
      playlistId,
      track,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(playlistId, event)
  }
  
  /**
   * Notify track removed
   */
  async trackRemoved(playlistId: string, trackId: string) {
    const event: PlaylistEvent = {
      type: 'TRACK_REMOVED',
      playlistId,
      trackId,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(playlistId, event)
  }
  
  /**
   * Notify tracks reordered
   */
  async tracksReordered(playlistId: string, newOrder: string[]) {
    const event: PlaylistEvent = {
      type: 'TRACKS_REORDERED',
      playlistId,
      newOrder,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(playlistId, event)
  }
  
  /**
   * Notify playlist updated
   */
  async playlistUpdated(playlistId: string, updates: any) {
    const event: PlaylistEvent = {
      type: 'PLAYLIST_UPDATED',
      playlistId,
      updates,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(playlistId, event)
  }
  
  /**
   * Notify playlist deleted
   */
  async playlistDeleted(playlistId: string) {
    const event: PlaylistEvent = {
      type: 'PLAYLIST_DELETED',
      playlistId,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(playlistId, event)
  }
  
  /**
   * Cleanup all subscriptions
   */
  unsubscribeAll() {
    console.log('🔌 Unsubscribing from all playlists...')
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions.clear()
  }
  
  /**
   * Get connection status
   */
  isIoTConnected(): boolean {
    return this.isConnected
  }
}

// Export singleton instance
export const playlistIoT = new PlaylistIoTService()
