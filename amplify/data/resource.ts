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
      dayOfWeek: a.integer(), // 0=Sunday, 1=Monday, ..., 6=Saturday (null = every day)
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
      index('dayOfWeek').sortKeys(['startTime'])
    ])
    .authorization((allow) => [allow.authenticated()]),

  // UserPreferences model - user settings and preferences
  UserPreferences: a
    .model({
      userId: a.string().required(), // Cognito userId (from getCurrentUser)
      
      // Notification Settings
      notificationsEnabled: a.boolean().default(true),
      notifyOnTrackChange: a.boolean().default(true),
      notifyOnPlaylistUpdate: a.boolean().default(true),
      notifyOnLogin: a.boolean().default(false),
      
      // UI Preferences
      theme: a.string().default('light'), // "light" | "dark"
      defaultView: a.string(), // "players" | "playlists" | "libery"
      
      // Activity Tracking
      lastLoginAt: a.datetime(), // Last login timestamp
      lastLogoutAt: a.datetime(), // Last logout timestamp
      loginCount: a.integer().default(0), // Total number of logins
      
      // Timestamps
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .identifier(['userId'])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read'])
    ]),

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

  // StreamSettings model - global stream configuration
  StreamSettings: a
    .model({
      settingKey: a.string().required(), // "playlist_update_timing"
      
      // Playlist Update Settings
      playlistUpdateTriggerSeconds: a.integer().default(60), // Trigger N seconds before track end
      playlistUpdateMinTrackDuration: a.integer().default(60), // Only trigger for tracks longer than N seconds
      playlistUpdateFallbackInterval: a.integer().default(300), // Fallback: update every N seconds (5 min)
      
      // Stream Server Config
      streamServerUrl: a.string(), // Icecast server URL
      streamMountPoint: a.string().default('/stream.mp3'),
      
      // News Settings
      newsEnabled: a.boolean().default(false), // Enable/disable news bulletin (default OFF)
      
      // Crossfade Settings
      crossfadeEnabled: a.boolean().default(true), // Enable/disable crossfade
      crossfadeStartNext: a.float().default(3.0), // Start next track N seconds before end (1-10)
      crossfadeFadeIn: a.float().default(2.0), // Fade in duration in seconds (0-10)
      crossfadeFadeOut: a.float().default(2.0), // Fade out duration in seconds (0-10)
      crossfadeNormalize: a.boolean().default(true), // Normalize audio levels
      
      // Smart Crossfade - BPM Matching
      smartCrossfadeEnabled: a.boolean().default(false), // Enable BPM-aware crossfades
      smartCrossfadeBpmTolerance: a.integer().default(5), // BPM difference tolerance (0-20)
      smartCrossfadeAutoAdjust: a.boolean().default(true), // Auto-adjust crossfade duration based on BPM
      
      // Smart Crossfade - Harmonic Mixing
      harmonicMixingEnabled: a.boolean().default(false), // Enable key-aware mixing
      harmonicMixingStrict: a.boolean().default(false), // Only mix compatible keys (Camelot wheel)
      harmonicMixingBoost: a.float().default(1.0), // Boost compatible transitions (0.5-2.0)
      
      // Smart Crossfade - Energy Analysis
      energyMatchingEnabled: a.boolean().default(false), // Match energy levels
      energyMatchingTolerance: a.float().default(0.2), // Energy difference tolerance (0-1)
      energyMatchingSmoothTransitions: a.boolean().default(true), // Smooth energy jumps
      
      // Advanced Crossfade
      crossfadeConservative: a.boolean().default(false), // Use conservative crossfade (longer, safer)
      crossfadePreset: a.string().default('techno'), // Preset: techno, progressive, ambient, hardcore, custom
      
      // Metadata
      lastModifiedBy: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .identifier(['settingKey'])
    .authorization((allow) => [allow.authenticated()]),

  // StreamQueueTrack model - tracks sent to SQS for streaming
  // Used to show queue order and in-flight tracks in UI
  StreamQueueTrack: a
    .model({
      trackId: a.string().required(),
      artist: a.string(),
      title: a.string(),
      version: a.string(),
      trackDuration: a.integer(), // seconds
      playlistId: a.string(),
      playlistName: a.string(),
      position: a.integer(), // queue position when added
      queuedAt: a.datetime().required(),
      status: a.string().default('queued'), // queued, in-flight, completed, failed
      completedAt: a.datetime(), // When track finished playing
      ttl: a.integer(), // Unix timestamp for auto-deletion (24h after queued)
    })
    .authorization((allow) => [allow.authenticated()]),

  // TrackPlayHistory model - analytics and play count tracking
  // Records every time a track is played on the stream
  TrackPlayHistory: a
    .model({
      trackId: a.string().required(),
      artist: a.string(),
      title: a.string(),
      version: a.string(),
      playlistId: a.string(),
      playlistName: a.string(),
      playedAt: a.datetime().required(),
      duration: a.integer(), // seconds
      source: a.string().default('stream'), // stream, manual, test
      listeners: a.integer(), // Concurrent listeners (from Icecast)
      skipped: a.boolean().default(false), // If track was skipped
    })
    .secondaryIndexes((index) => [
      index('trackId').sortKeys(['playedAt']), // Query plays by track
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Stream Health Log - monitoring and alerting
  StreamHealthLog: a
    .model({
      timestamp: a.string().required(), // ISO timestamp as partition key
      icecastUp: a.boolean().required(),
      streamFlowing: a.boolean().required(),
      liquidsoakRunning: a.boolean().required(),
      trackCount: a.integer().required(),
      bitrate: a.integer(),
      listenerCount: a.integer().required(),
      currentTrack: a.string(),
      actionsTaken: a.string(), // JSON array of actions
      ttl: a.integer(), // TTL for auto-cleanup after 7 days
    })
    .authorization((allow) => [allow.authenticated()]),

  // Listener Session - detailed per-connection tracking
  ListenerSession: a
    .model({
      sessionId: a.string().required(), // Unique session ID
      ipHash: a.string().required(), // Hashed IP for privacy
      userAgent: a.string(),
      device: a.string(), // Desktop/Mobile/Car/Smart Speaker
      os: a.string(), // Windows/Mac/iOS/Android/Linux
      player: a.string(), // VLC/iTunes/Winamp/Browser/etc
      country: a.string(),
      city: a.string(),
      connectTime: a.datetime().required(),
      disconnectTime: a.datetime(),
      duration: a.integer(), // seconds
      tracksHeard: a.string(), // JSON array of track IDs
      currentTrack: a.string(),
    })
    .secondaryIndexes((index) => [
      index('ipHash').sortKeys(['connectTime']), // Query sessions by listener
    ])
    .authorization((allow) => [allow.authenticated()]),

  // Listener Profile - aggregated listener stats
  ListenerProfile: a
    .model({
      ipHash: a.string().required(), // Primary key
      firstSeen: a.datetime().required(),
      lastSeen: a.datetime().required(),
      totalSessions: a.integer().default(0),
      totalListenTime: a.integer().default(0), // seconds
      favoriteHours: a.string(), // JSON array of hour preferences
      returningListener: a.boolean().default(false),
      country: a.string(),
      city: a.string(),
      lastDevice: a.string(),
      lastOs: a.string(),
      lastPlayer: a.string(),
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
      genre: a.string(), // Genre from ID3 tags or "Station ID" for jingles
      tags: a.string(), // Tags for categorization (Hot Hits, Oldies, WildFM, Sweepers, etc.)
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
      
      // Play Statistics (updated by TrackPlayHistory triggers)
      playCount: a.integer().default(0), // Total times played on stream
      lastPlayedAt: a.datetime(), // Last time track was played
      totalListeners: a.integer().default(0), // Cumulative listener count
      averageListeners: a.float(), // Average concurrent listeners when played
      skipCount: a.integer().default(0), // Times track was skipped
      popularityScore: a.float(), // Calculated score based on plays/listeners
    })
    .authorization((allow) => [
      allow.authenticated(),
      allow.publicApiKey().to(['read']) // Allow public read for player page
    ]),
  
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
      // Jingle options
      includeJingles: a.boolean(), // Add jingles to playlist
      jinglesEveryN: a.integer(), // Insert jingle every N tracks (e.g. 2 = every 2 tracks)
      jingleGenre: a.string(), // Genre filter for jingles (default: 'Station ID')
      jingleTags: a.string(), // Tags filter for jingles (e.g. 'WildFM', 'Sweepers', etc.)
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
    apiKeyAuthorizationMode: {
      expiresInDays: 365, // API key for public player page
    },
  },
})
