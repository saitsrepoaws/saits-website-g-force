import { defineFunction } from '@aws-amplify/backend'

export const trackQueueManager = defineFunction({
  name: 'track-queue-manager',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  resourceGroupName: 'storage' // In storage stack to avoid circular dependency with data
})
