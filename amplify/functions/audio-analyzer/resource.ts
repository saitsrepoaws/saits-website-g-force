import { defineFunction } from '@aws-amplify/backend'

export const audioAnalyzer = defineFunction({
  name: 'audio-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 min for audio analysis
  memoryMB: 3008, // Max memory for audio processing
  resourceGroupName: 'storage',
})
