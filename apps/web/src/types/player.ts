/**
 * Radio Player Types
 * Complete type definitions for multi-player state machine system
 * See: /docs/IOT_TOPICS_SPECIFICATION.md
 */

import type { Track } from '../services/tracks'

// ============================================================================
// Player State Machine
// ============================================================================

/**
 * Player State Enum
 * All possible states in the player state machine
 */
export enum PlayerState {
  IDLE = 'IDLE',           // No track loaded
  LOADING = 'LOADING',     // Track is loading
  LOADED = 'LOADED',       // Track loaded, ready to play
  PLAYING = 'PLAYING',     // Currently playing
  PAUSED = 'PAUSED',       // Playback paused
  STOPPED = 'STOPPED',     // Playback stopped
  BUFFERING = 'BUFFERING', // Buffering audio data
  ERROR = 'ERROR'          // Error state
}

/**
 * Valid state transitions
 * Used to validate state machine transitions
 */
export const VALID_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  [PlayerState.IDLE]: [
    PlayerState.LOADING,
    PlayerState.ERROR
  ],
  [PlayerState.LOADING]: [
    PlayerState.LOADED,
    PlayerState.ERROR,
    PlayerState.IDLE  // Cancel
  ],
  [PlayerState.LOADED]: [
    PlayerState.PLAYING,
    PlayerState.IDLE,  // Unload
    PlayerState.ERROR
  ],
  [PlayerState.PLAYING]: [
    PlayerState.PAUSED,
    PlayerState.STOPPED,
    PlayerState.BUFFERING,
    PlayerState.IDLE,  // Track ended
    PlayerState.ERROR
  ],
  [PlayerState.PAUSED]: [
    PlayerState.PLAYING,
    PlayerState.STOPPED,
    PlayerState.ERROR
  ],
  [PlayerState.STOPPED]: [
    PlayerState.PLAYING,
    PlayerState.IDLE,
    PlayerState.ERROR
  ],
  [PlayerState.BUFFERING]: [
    PlayerState.PLAYING,
    PlayerState.ERROR
  ],
  [PlayerState.ERROR]: [
    PlayerState.LOADING,  // Retry
    PlayerState.IDLE      // Reset
  ]
}

// ============================================================================
// Player Configuration
// ============================================================================

/**
 * Player Configuration
 * Configuration for a single player instance
 */
export interface PlayerConfig {
  /** Unique player identifier (e.g., "player-main-001") */
  playerId: string
  
  /** Human-readable player name */
  playerName: string
  
  /** Auto-play when track is loaded */
  autoPlay?: boolean
  
  /** Default playlist ID to load */
  defaultPlaylistId?: string | null
  
  /** Enable automatic schedule switching */
  scheduleEnabled?: boolean
  
  /** Player volume (0.0 - 1.0) */
  defaultVolume?: number
}

// ============================================================================
// Player Instance State
// ============================================================================

/**
 * Player Instance
 * Complete state of a single player instance
 */
export interface PlayerInstance {
  /** Player configuration */
  config: PlayerConfig
  
  /** Current state */
  state: PlayerState
  
  /** Currently loaded track */
  currentTrack: Track | null
  
  /** Current playlist ID */
  currentPlaylistId: string | null
  
  /** Is playing */
  isPlaying: boolean
  
  /** Is paused */
  isPaused: boolean
  
  /** Is loaded */
  isLoaded: boolean
  
  /** Current playback position (seconds) */
  currentTime: number
  
  /** Track duration (seconds) */
  duration: number
  
  /** Volume (0.0 - 1.0) */
  volume: number
  
  /** Error message (if state = ERROR) */
  error?: string
}

// ============================================================================
// IoT Messages - Player State
// ============================================================================

/**
 * Player State Message
 * Published to: radio/player/{playerId}/state
 * Direction: Player → Backend
 * QoS: 1
 */
export interface PlayerStateMessage {
  /** Player ID */
  playerId: string
  
  /** Current state */
  state: PlayerState
  
  /** Previous state */
  previousState: PlayerState
  
  /** Timestamp (ISO 8601) */
  timestamp: string
  
  /** Optional metadata */
  metadata?: {
    trackId?: string
    playlistId?: string
    position?: number      // Current position (seconds)
    duration?: number      // Track duration (seconds)
    volume?: number        // Volume (0.0 - 1.0)
    error?: string         // Error message (if state = ERROR)
  }
}

// ============================================================================
// IoT Messages - Player Commands
// ============================================================================

/**
 * Command Type
 * All possible commands that can be sent to a player
 */
export type CommandType = 
  | 'PLAY'      // Start playback
  | 'PAUSE'     // Pause playback
  | 'STOP'      // Stop playback
  | 'LOAD'      // Load track
  | 'SEEK'      // Seek to position
  | 'VOLUME'    // Set volume
  | 'SKIP'      // Skip to next track
  | 'RESTART'   // Restart player

/**
 * Command Parameters
 * Parameters for player commands
 */
export interface CommandParams {
  trackId?: string      // For LOAD command
  playlistId?: string   // For LOAD command
  position?: number     // For SEEK command (seconds)
  volume?: number       // For VOLUME command (0.0 - 1.0)
}

/**
 * Player Command Message
 * Published to: radio/player/{playerId}/command
 * Direction: Backend → Player
 * QoS: 1
 */
export interface PlayerCommand {
  /** Command type */
  command: CommandType
  
  /** Timestamp (ISO 8601) */
  timestamp: string
  
  /** Command parameters */
  params?: CommandParams
  
  /** Request ID for tracking */
  requestId?: string
}

// ============================================================================
// IoT Messages - Track Info
// ============================================================================

/**
 * Track Info Message
 * Published to: radio/player/{playerId}/track
 * Direction: Player → Backend
 * QoS: 0
 */
export interface TrackInfoMessage {
  /** Player ID */
  playerId: string
  
  /** Track ID */
  trackId: string
  
  /** Track title */
  title: string
  
  /** Track artist */
  artist: string
  
  /** Album name */
  album?: string
  
  /** Track duration (seconds) */
  duration: number
  
  /** BPM */
  bpm?: number
  
  /** Key */
  key?: string
  
  /** Genre */
  genre?: string
  
  /** Label */
  label?: string
  
  /** Playlist ID */
  playlistId?: string
  
  /** Track position in playlist */
  position: number
  
  /** Timestamp (ISO 8601) */
  timestamp: string
}

// ============================================================================
// IoT Messages - Heartbeat
// ============================================================================

/**
 * Heartbeat Message
 * Published to: radio/player/{playerId}/heartbeat
 * Direction: Player → Backend
 * QoS: 0
 * Frequency: Every 30 seconds
 */
export interface HeartbeatMessage {
  /** Player ID */
  playerId: string
  
  /** Current state */
  state: PlayerState
  
  /** Is online */
  online: boolean
  
  /** Timestamp (ISO 8601) */
  timestamp: string
  
  /** Uptime (seconds since player start) */
  uptime: number
  
  /** Total error count */
  errors: number
  
  /** Total tracks played */
  tracksPlayed: number
  
  /** Last track ID */
  lastTrackId?: string
}

// ============================================================================
// IoT Messages - Schedule
// ============================================================================

/**
 * Schedule Message
 * Published to: radio/schedule/current
 * Direction: Backend → All Players
 * QoS: 1
 * Frequency: On schedule change (hourly)
 */
export interface ScheduleMessage {
  /** Hour (0-23) */
  hour: number
  
  /** Playlist ID */
  playlistId: string
  
  /** Playlist name */
  playlistName: string
  
  /** Should players auto-switch? */
  autoSwitch: boolean
  
  /** Timestamp (ISO 8601) */
  timestamp: string
  
  /** Optional metadata */
  metadata?: {
    genre?: string
    mood?: string
    description?: string
  }
}

// ============================================================================
// IoT Messages - Players Status
// ============================================================================

/**
 * Players Status Message
 * Published to: radio/players/status
 * Direction: All Players → Backend
 * QoS: 0
 * Frequency: Every 60 seconds
 */
export interface PlayersStatusMessage {
  /** Player ID */
  playerId: string
  
  /** Current state */
  state: PlayerState
  
  /** Is online */
  online: boolean
  
  /** Last heartbeat timestamp */
  lastHeartbeat: string
  
  /** Uptime (seconds) */
  uptime: number
  
  /** Current track info */
  currentTrack?: {
    trackId: string
    title: string
    position: number
    duration: number
  }
}

// ============================================================================
// IoT Messages - System Alerts
// ============================================================================

/**
 * Alert Severity
 */
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

/**
 * Alert Message
 * Published to: radio/system/alerts
 * Direction: Backend → Players (and admins)
 * QoS: 1
 */
export interface AlertMessage {
  /** Severity level */
  severity: AlertSeverity
  
  /** Alert message */
  message: string
  
  /** Timestamp (ISO 8601) */
  timestamp: string
  
  /** Source (playerId or 'system') */
  source?: string
  
  /** Additional context */
  context?: any
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a state transition is valid
 */
export function canTransition(from: PlayerState, to: PlayerState): boolean {
  const allowedTransitions = VALID_TRANSITIONS[from]
  return allowedTransitions.includes(to)
}

/**
 * Get human-readable state name
 */
export function getStateName(state: PlayerState): string {
  const names: Record<PlayerState, string> = {
    [PlayerState.IDLE]: 'Idle',
    [PlayerState.LOADING]: 'Loading',
    [PlayerState.LOADED]: 'Ready',
    [PlayerState.PLAYING]: 'Playing',
    [PlayerState.PAUSED]: 'Paused',
    [PlayerState.STOPPED]: 'Stopped',
    [PlayerState.BUFFERING]: 'Buffering',
    [PlayerState.ERROR]: 'Error'
  }
  return names[state]
}

/**
 * Get state icon emoji
 */
export function getStateIcon(state: PlayerState): string {
  const icons: Record<PlayerState, string> = {
    [PlayerState.IDLE]: '⏹️',
    [PlayerState.LOADING]: '⏳',
    [PlayerState.LOADED]: '✅',
    [PlayerState.PLAYING]: '▶️',
    [PlayerState.PAUSED]: '⏸️',
    [PlayerState.STOPPED]: '⏹️',
    [PlayerState.BUFFERING]: '⏳',
    [PlayerState.ERROR]: '❌'
  }
  return icons[state]
}

/**
 * Get state color class (Tailwind)
 */
export function getStateColor(state: PlayerState): string {
  const colors: Record<PlayerState, string> = {
    [PlayerState.IDLE]: 'bg-gray-400',
    [PlayerState.LOADING]: 'bg-yellow-500 animate-pulse',
    [PlayerState.LOADED]: 'bg-blue-500',
    [PlayerState.PLAYING]: 'bg-green-500',
    [PlayerState.PAUSED]: 'bg-orange-500',
    [PlayerState.STOPPED]: 'bg-gray-600',
    [PlayerState.BUFFERING]: 'bg-yellow-500 animate-pulse',
    [PlayerState.ERROR]: 'bg-red-500'
  }
  return colors[state]
}
