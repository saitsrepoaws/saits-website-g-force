import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

// Define the data schema
const schema = a.schema({
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
