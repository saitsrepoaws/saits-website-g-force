import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

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
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
