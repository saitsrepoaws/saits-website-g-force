import { type ClientSchema, a, defineData } from '@aws-amplify/backend'
import { playlistGenerator } from '../functions/playlist-generator/resource'

// Define the data schema
const schema = a.schema({
  // Playlist model - playlist management with IoT sync
  Playlist: a
    .model({
      name: a.string().required(),
      description: a.string(),
      coverImageUrl: a.string(),
      
      // Metadata for organization and filtering
      genre: a.string(), // Main genre (Techno, House, etc.)
      mood: a.string(), // Mood/vibe (Energetic, Chill, Dark, etc.)
      bpmMin: a.integer(), // Minimum BPM range
      bpmMax: a.integer(), // Maximum BPM range
      key: a.string(), // Musical key (C, C#, Dm, Am, etc.)
      tags: a.string(), // Comma-separated tags (summer, peak-time, etc.)
      
      // Embedded tracks as JSON string (no join table!)
      tracks: a.string().default('[]'), // JSON.stringify(PlaylistTrackItem[])
      
      // Computed fields
      trackCount: a.integer().default(0),
      totalDuration: a.integer().default(0),
      
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // Schedule model - time-based playlist scheduling
  // Maps time slots to playlists for automatic playback
  Schedule: a
    .model({
      name: a.string().required(), // "Morning Show", "Peak Time", etc.
      dayOfWeek: a.string(), // "Monday", "Tuesday", etc. (changed from integer to string for GSI)
      startTime: a.string().required(), // "09:00"
      endTime: a.string(), // "12:00" (null = until next slot)
      startDate: a.string(), // "2025-01-01" (null = starts immediately)
      endDate: a.string(), // "2025-01-31" (null = runs indefinitely)
      playlistId: a.string().required(), // References Playlist.id
      isActive: a.boolean().default(true),
      priority: a.integer().default(0), // Higher priority wins if slots overlap
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('dayOfWeek').sortKeys(['startTime']).queryField('byDay')
    ])
    .authorization((allow) => [allow.authenticated()]),

  // PlayerState model - persistent player state for recovery
  // Hybrid approach: IoT for real-time, DynamoDB for snapshots
  PlayerState: a
    .model({
      playerId: a.string().required(), // "player-main-001" (unique identifier)
      
      // Current Track Info
      currentTrackId: a.string(), // Currently loaded track
      currentTrackTitle: a.string(), // For display
      currentTrackArtist: a.string(), // For display
      currentPlaylistId: a.string(), // Current playlist
      
      // Playback State
      status: a.string().default('idle'), // "playing", "paused", "stopped", "idle"
      lastPosition: a.float().default(0), // Last known position in seconds
      duration: a.float().default(0), // Track duration
      volume: a.float().default(0.7), // Volume level (0-1)
      
      // Settings
      autoPlayEnabled: a.boolean().default(false),
      
      // Schedule Context
      currentScheduleSlotId: a.string(), // Current schedule slot
      currentScheduleSlotName: a.string(), // "Slot 21:00"
      
      // Timestamps (for recovery and monitoring)
      lastActive: a.datetime(), // Last activity (any interaction)
      lastUpdated: a.datetime(), // Last state update
      
      // Metadata
      deviceInfo: a.string(), // JSON: browser, OS, etc. (optional)
    })
    .authorization((allow) => [allow.authenticated()]),

  // Track model - audio tracks in the Libery system
  // Format: Artist - Title (Version) [Label]
  Track: a
    .model({
      artist: a.string(), // Artist name (parsed from filename)
      title: a.string().required(), // Track title (parsed from filename or fallback to filename)
      version: a.string(), // Version/Mix info (parsed from filename, optional)
      label: a.string(), // Record label (parsed from filename, optional)
      genre: a.string(), // Genre from ID3 tags
      year: a.integer(), // Release year from ID3 tags
      duration: a.integer(), // duration in seconds
      fileUrl: a.string(), // S3 URL or path to audio file
      fileSize: a.integer(), // file size in bytes
      format: a.string(), // mp3, flac, wav, etc.
      addedAt: a.datetime(),
      
      // Audio Features (from Lambda analysis)
      bpm: a.integer(), // Beats per minute
      key: a.string(), // Musical key (e.g. "Am", "C#")
      energy: a.float(), // Energy level 0-1
      danceability: a.float(), // Danceability 0-1
      valence: a.float(), // Musical positiveness 0-1
      coverArtUrl: a.string(), // S3 path to cover art
      
      // Waveform (from Lambda 3)
      waveformUrl: a.string(), // S3 path to waveform PNG
      peaks: a.string(), // JSON array of peak values for visualization
      trimStart: a.float(), // Time in seconds where audio actually starts
      trimEnd: a.float(), // Time in seconds where audio actually ends
    })
    .authorization((allow) => [allow.authenticated()]),
  
  // Custom query to generate playlist based on criteria
  generatePlaylist: a
    .query()
    .arguments({
      name: a.string().required(),
      description: a.string(),
      genre: a.string(),
      mood: a.string(),
      bpmMin: a.integer(),
      bpmMax: a.integer(),
      keys: a.string().array(), // Multi-select keys for harmonic mixing
      tags: a.string(),
      maxTracks: a.integer(),
      maxDuration: a.integer(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(playlistGenerator)),
  
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
