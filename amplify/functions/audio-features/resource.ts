import { defineFunction } from '@aws-amplify/backend'

export const audioFeatures = defineFunction({
  name: 'audio-features',
  entry: './handler.ts',
  timeoutSeconds: 120, // BPM detection can take longer
  memoryMB: 2048, // More memory for audio processing
  resourceGroupName: 'storage', // Assign to storage stack to avoid circular dependency
})
