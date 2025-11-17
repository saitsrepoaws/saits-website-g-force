import { defineFunction } from '@aws-amplify/backend'

export const audioMetadata = defineFunction({
  name: 'audio-metadata',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
  resourceGroupName: 'storage', // Assign to storage stack to avoid circular dependency
})
