// IoT/PubSub service for real-time playlist updates
// PubSub imported via pubsub service
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
    console.log('🔌 Connecting to IoT Core via PubSub...')
    
    // Listen for connection state changes
    Hub.listen('pubsub', (data: any) => {
      const { payload } = data
      if (payload.event === 'CONNECTION_STATE_CHANGE') {
        const connectionState = payload.data.connectionState
        console.log('📡 IoT Connection State:', connectionState)
        this.isConnected = connectionState === 'Connected'
      }
    })
  }
  
  /**
   * Subscribe to playlist events
   * Returns unsubscribe function
   */
  subscribeToPlaylist(playlistId: string, _callback: (event: PlaylistEvent) => void) {
    const topic = `playlist/${playlistId}/events`
    
    console.log(`📡 Subscribing to: ${topic} (IoT Core not configured - using local state only)`)
    
    // TODO: Enable when IoT Core is configured in Amplify
    // For now, return a no-op unsubscribe function
    return () => {
      console.log(`📡 Unsubscribe (no-op): ${topic}`)
    }
    
    /* Uncomment when IoT Core is configured:
    const subscription = (PubSub as any).subscribe({ topics: [topic] }).subscribe({
      next: (data: any) => {
        console.log('📩 Playlist event received:', data)
        try {
          const event = data.value as PlaylistEvent
          callback(event)
        } catch (error) {
          console.error('Failed to parse playlist event:', error)
        }
      },
      error: (error: any) => {
        console.error('❌ IoT subscription error:', error)
      },
      complete: () => {
        console.log('IoT subscription completed')
      },
    })
    
    this.subscriptions.set(playlistId, subscription)
    
    return () => {
      console.log(`📡 Unsubscribing from: ${topic}`)
      subscription.unsubscribe()
      this.subscriptions.delete(playlistId)
    }
    */
  }
  
  /**
   * Publish playlist event
   */
  private async publishEvent(playlistId: string, event: PlaylistEvent) {
    const topic = `playlist/${playlistId}/events`
    
    console.log(`📤 Publishing to ${topic} (IoT Core not configured - skipping):`, event.type)
    
    // TODO: Enable when IoT Core is configured
    return
    
    /* Uncomment when IoT Core is configured:
    try {
      await (PubSub as any).publish({
        topics: [topic],
        message: event,
      })
      console.log('✅ Event published successfully')
    } catch (error) {
      console.error('❌ Failed to publish event:', error)
      throw error
    }
    */
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
