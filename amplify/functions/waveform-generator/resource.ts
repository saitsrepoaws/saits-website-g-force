import { defineFunction } from '@aws-amplify/backend'

export const waveformGenerator = defineFunction({
  name: 'waveform-generator',
  entry: './handler.ts',
  timeoutSeconds: 120, // 2 minutes for audio processing
  memoryMB: 2048, // More memory for audio processing
  resourceGroupName: 'storage',
})
