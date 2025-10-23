import { defineFunction } from '@aws-amplify/backend'

export const playlistGenerator = defineFunction({
  name: 'playlist-generator',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  resourceGroupName: 'data', // Assign to data stack to avoid circular dependency
})
