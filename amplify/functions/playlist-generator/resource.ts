import { defineFunction } from '@aws-amplify/backend'

export const playlistGenerator = defineFunction({
  name: 'playlist-generator',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
})
