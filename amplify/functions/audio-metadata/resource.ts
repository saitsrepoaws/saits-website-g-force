import { defineFunction } from '@aws-amplify/backend'

export const audioMetadata = defineFunction({
  name: 'audio-metadata',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
  environment: {
    STORAGE_BUCKET_NAME: process.env.STORAGE_BUCKET_NAME || '',
  },
})
