import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

// Define the data schema
const schema = a.schema({
  // Track model - audio tracks in the Libery system
  Track: a
    .model({
      title: a.string().required(),
      artist: a.string(),
      album: a.string(),
      duration: a.integer(), // duration in seconds
      fileUrl: a.string(), // S3 URL or path to audio file
      fileSize: a.integer(), // file size in bytes
      format: a.string(), // mp3, flac, wav, etc.
      bitrate: a.integer(), // bitrate in kbps
      sampleRate: a.integer(), // sample rate in Hz
      genre: a.string(),
      year: a.integer(),
      coverArtUrl: a.string(), // URL to cover art image
      addedAt: a.datetime(),
      lastPlayedAt: a.datetime(),
      playCount: a.integer().default(0),
      tags: a.string().array(), // custom tags for organization
      metadata: a.json(), // flexible field for additional metadata
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
