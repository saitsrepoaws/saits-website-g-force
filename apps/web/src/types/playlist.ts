// Playlist types for IoT-based playlist management

export interface PlaylistTrackItem {
  trackId: string
  order: number
  addedAt: string
  
  // Denormalized track data (for fast display)
  trackTitle?: string
  trackArtist?: string
  trackDuration?: number
  trackBpm?: number
  trackGenre?: string
  trackCoverArtUrl?: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  coverImageUrl?: string
  
  // Metadata
  genre?: string
  mood?: string
  bpmMin?: number
  bpmMax?: number
  tags?: string
  occasion?: string
  
  // JSON string of PlaylistTrackItem[]
  tracks: string
  
  // Computed
  trackCount: number
  totalDuration: number
  
  createdAt?: string
  updatedAt?: string
}

// Helper to parse tracks
export function parsePlaylistTracks(playlist: Playlist): PlaylistTrackItem[] {
  try {
    return JSON.parse(playlist.tracks || '[]')
  } catch (error) {
    console.error('Failed to parse playlist tracks:', error)
    return []
  }
}

// Helper to serialize tracks
export function serializePlaylistTracks(tracks: PlaylistTrackItem[]): string {
  return JSON.stringify(tracks)
}

// IoT Event Types
export type PlaylistEvent = 
  | {
      type: 'TRACK_ADDED'
      playlistId: string
      track: PlaylistTrackItem
      timestamp: string
    }
  | {
      type: 'TRACK_REMOVED'
      playlistId: string
      trackId: string
      timestamp: string
    }
  | {
      type: 'TRACKS_REORDERED'
      playlistId: string
      newOrder: string[] // trackIds in new order
      timestamp: string
    }
  | {
      type: 'PLAYLIST_UPDATED'
      playlistId: string
      updates: Partial<Playlist>
      timestamp: string
    }
  | {
      type: 'PLAYLIST_DELETED'
      playlistId: string
      timestamp: string
    }

// Input types
export interface CreatePlaylistInput {
  name: string
  description?: string
  coverImageUrl?: string
  genre?: string
  mood?: string
  bpmMin?: number
  bpmMax?: number
  tags?: string
  occasion?: string
}

export interface UpdatePlaylistInput {
  id: string
  name?: string
  description?: string
  coverImageUrl?: string
  genre?: string
  mood?: string
  bpmMin?: number
  bpmMax?: number
  tags?: string
  occasion?: string
}
