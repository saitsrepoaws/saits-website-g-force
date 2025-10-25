/**
 * Radio Player IoT Service
 * Handles IoT/PubSub communication for a single radio player instance
 * Each player gets its own RadioPlayerIoT instance with unique playerId
 * 
 * See: /docs/IOT_TOPICS_SPECIFICATION.md
 */

import * as pubsub from './pubsub'
import type {
  PlayerState,
  PlayerStateMessage,
  PlayerCommand,
  TrackInfoMessage,
  HeartbeatMessage,
  PlayersStatusMessage,
  ScheduleMessage,
  CommandType
} from '../types/player'

/**
 * Radio Player IoT Service Class
 * One instance per player
 */
export class RadioPlayerIoT {
  private playerId: string
  private currentState: PlayerState = 'IDLE' as PlayerState
  private subscriptions: Map<string, any> = new Map()
  private heartbeatInterval: number | null = null
  private statusInterval: number | null = null
  private startTime: number = Date.now()
  private errorCount: number = 0
  private tracksPlayed: number = 0
  private lastTrackId: string | null = null

  constructor(playerId: string) {
    this.playerId = playerId
    console.log(`🎵 RadioPlayerIoT initialized for: ${playerId}`)
  }

  // ==========================================================================
  // State Publishing
  // ==========================================================================

  /**
   * Publish player state change
   * Topic: radio/player/{playerId}/state
   * QoS: 1
   */
  async publishState(
    newState: PlayerState,
    metadata?: PlayerStateMessage['metadata']
  ): Promise<void> {
    try {
      const message: PlayerStateMessage = {
        playerId: this.playerId,
        state: newState,
        previousState: this.currentState,
        timestamp: new Date().toISOString(),
        metadata
      }

      await pubsub.publish({
        topic: `radio/player/${this.playerId}/state`,
        message
      })

      console.log(`✅ State published: ${this.currentState} → ${newState}`)
      
      // Update internal state
      this.currentState = newState

      // Track error count
      if (newState === 'ERROR') {
        this.errorCount++
      }
    } catch (error) {
      console.error(`❌ Failed to publish state:`, error)
      throw error
    }
  }

  // ==========================================================================
  // Command Subscription
  // ==========================================================================

  /**
   * Subscribe to player commands
   * Topic: radio/player/{playerId}/command
   * QoS: 1
   */
  async subscribeToCommands(
    callback: (command: PlayerCommand) => void
  ): Promise<() => void> {
    const topic = `radio/player/${this.playerId}/command`

    console.log(`📡 Subscribing to commands: ${topic}`)

    const subscription = await pubsub.subscribe(
      { topic },
      (message: any) => {
        console.log(`📩 Command received:`, message)
        
        try {
          // Validate command structure
          if (message && typeof message === 'object' && 'command' in message) {
            callback(message as PlayerCommand)
          } else {
            console.error('Invalid command format:', message)
          }
        } catch (error) {
          console.error('Error processing command:', error)
        }
      },
      (error: any) => {
        console.error(`❌ Command subscription error:`, error)
      }
    )

    // Store subscription
    if (subscription) {
      this.subscriptions.set('commands', subscription)
    }

    // Return unsubscribe function
    return () => {
      console.log(`📡 Unsubscribing from commands: ${topic}`)
      subscription?.unsubscribe()
      this.subscriptions.delete('commands')
    }
  }

  // ==========================================================================
  // Schedule Subscription
  // ==========================================================================

  /**
   * Subscribe to schedule updates
   * Topic: radio/schedule/current
   * QoS: 1
   */
  async subscribeToSchedule(
    callback: (schedule: ScheduleMessage) => void
  ): Promise<() => void> {
    const topic = 'radio/schedule/current'

    console.log(`📅 Subscribing to schedule: ${topic}`)

    const subscription = await pubsub.subscribe(
      { topic },
      (message: any) => {
        console.log(`📅 Schedule update received:`, message)
        
        try {
          if (message && typeof message === 'object') {
            callback(message as ScheduleMessage)
          }
        } catch (error) {
          console.error('Error processing schedule:', error)
        }
      },
      (error: any) => {
        console.error(`❌ Schedule subscription error:`, error)
      }
    )

    if (subscription) {
      this.subscriptions.set('schedule', subscription)
    }

    return () => {
      console.log(`📅 Unsubscribing from schedule`)
      subscription?.unsubscribe()
      this.subscriptions.delete('schedule')
    }
  }

  // ==========================================================================
  // Track Info Publishing
  // ==========================================================================

  /**
   * Publish track info
   * Topic: radio/player/{playerId}/track
   * QoS: 0
   */
  async publishTrackInfo(track: {
    trackId: string
    title: string
    artist: string
    album?: string
    duration: number
    bpm?: number
    key?: string
    genre?: string
    label?: string
    playlistId?: string
    position: number
  }): Promise<void> {
    try {
      const message: TrackInfoMessage = {
        playerId: this.playerId,
        ...track,
        timestamp: new Date().toISOString()
      }

      await pubsub.publish({
        topic: `radio/player/${this.playerId}/track`,
        message
      })

      console.log(`✅ Track info published: ${track.title}`)
      
      // Update internal tracking
      this.lastTrackId = track.trackId
      this.tracksPlayed++
    } catch (error) {
      console.error(`❌ Failed to publish track info:`, error)
    }
  }

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  /**
   * Publish heartbeat
   * Topic: radio/player/{playerId}/heartbeat
   * QoS: 0
   * Frequency: Every 30 seconds
   */
  async publishHeartbeat(): Promise<void> {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000)

      const message: HeartbeatMessage = {
        playerId: this.playerId,
        state: this.currentState,
        online: true,
        timestamp: new Date().toISOString(),
        uptime,
        errors: this.errorCount,
        tracksPlayed: this.tracksPlayed,
        lastTrackId: this.lastTrackId || undefined
      }

      await pubsub.publish({
        topic: `radio/player/${this.playerId}/heartbeat`,
        message
      })

      console.log(`💓 Heartbeat sent (uptime: ${uptime}s)`)
    } catch (error) {
      console.error(`❌ Failed to publish heartbeat:`, error)
    }
  }

  /**
   * Start heartbeat interval (every 30 seconds)
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      console.warn('Heartbeat already running')
      return
    }

    console.log('💓 Starting heartbeat (30s interval)')
    
    // Send immediately
    this.publishHeartbeat()

    // Then every 30 seconds
    this.heartbeatInterval = window.setInterval(() => {
      this.publishHeartbeat()
    }, 30000)
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      console.log('💓 Stopping heartbeat')
      window.clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // ==========================================================================
  // Status Broadcasting
  // ==========================================================================

  /**
   * Publish player status
   * Topic: radio/players/status
   * QoS: 0
   * Frequency: Every 60 seconds
   */
  async publishStatus(currentTrack?: {
    trackId: string
    title: string
    position: number
    duration: number
  }): Promise<void> {
    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000)

      const message: PlayersStatusMessage = {
        playerId: this.playerId,
        state: this.currentState,
        online: true,
        lastHeartbeat: new Date().toISOString(),
        uptime,
        currentTrack
      }

      await pubsub.publish({
        topic: 'radio/players/status',
        message
      })

      console.log(`📊 Status broadcast sent`)
    } catch (error) {
      console.error(`❌ Failed to publish status:`, error)
    }
  }

  /**
   * Start status broadcast interval (every 60 seconds)
   */
  startStatusBroadcast(): void {
    if (this.statusInterval) {
      console.warn('Status broadcast already running')
      return
    }

    console.log('📊 Starting status broadcast (60s interval)')
    
    // Send immediately
    this.publishStatus()

    // Then every 60 seconds
    this.statusInterval = window.setInterval(() => {
      this.publishStatus()
    }, 60000)
  }

  /**
   * Stop status broadcast interval
   */
  stopStatusBroadcast(): void {
    if (this.statusInterval) {
      console.log('📊 Stopping status broadcast')
      window.clearInterval(this.statusInterval)
      this.statusInterval = null
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get current player state
   */
  getCurrentState(): PlayerState {
    return this.currentState
  }

  /**
   * Get player ID
   */
  getPlayerId(): string {
    return this.playerId
  }

  /**
   * Get player statistics
   */
  getStats() {
    return {
      playerId: this.playerId,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      errorCount: this.errorCount,
      tracksPlayed: this.tracksPlayed,
      lastTrackId: this.lastTrackId,
      currentState: this.currentState
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.errorCount = 0
    this.tracksPlayed = 0
    this.lastTrackId = null
    this.startTime = Date.now()
    console.log('📊 Statistics reset')
  }

  /**
   * Cleanup all subscriptions and intervals
   */
  cleanup(): void {
    console.log(`🧹 Cleaning up RadioPlayerIoT for: ${this.playerId}`)
    
    // Stop intervals
    this.stopHeartbeat()
    this.stopStatusBroadcast()
    
    // Unsubscribe from all topics
    this.subscriptions.forEach((subscription, key) => {
      console.log(`📡 Unsubscribing from: ${key}`)
      subscription?.unsubscribe()
    })
    this.subscriptions.clear()
    
    console.log('✅ Cleanup complete')
  }
}

// ==========================================================================
// Factory Function
// ==========================================================================

/**
 * Create a new RadioPlayerIoT instance
 */
export function createRadioPlayerIoT(playerId: string): RadioPlayerIoT {
  return new RadioPlayerIoT(playerId)
}

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Publish a command to a specific player
 * Utility function for backend use
 */
export async function sendCommandToPlayer(
  playerId: string,
  command: CommandType,
  params?: PlayerCommand['params']
): Promise<void> {
  const message: PlayerCommand = {
    command,
    timestamp: new Date().toISOString(),
    params,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  await pubsub.publish({
    topic: `radio/player/${playerId}/command`,
    message
  })

  console.log(`🎛️ Command sent to ${playerId}:`, command)
}

/**
 * Publish schedule update to all players
 * Utility function for backend use
 */
export async function broadcastSchedule(schedule: ScheduleMessage): Promise<void> {
  await pubsub.publish({
    topic: 'radio/schedule/current',
    message: schedule
  })

  console.log(`📅 Schedule broadcast:`, schedule.playlistName)
}
