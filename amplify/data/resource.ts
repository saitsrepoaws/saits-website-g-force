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
      duration: a.integer(), // duration in seconds
      fileUrl: a.string(), // S3 URL or path to audio file
      fileSize: a.integer(), // file size in bytes
      format: a.string(), // mp3, flac, wav, etc.
      addedAt: a.datetime(),
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
