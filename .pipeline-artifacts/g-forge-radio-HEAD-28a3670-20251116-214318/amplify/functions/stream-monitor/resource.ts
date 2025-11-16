import { defineFunction } from '@aws-amplify/backend'

export const streamMonitor = defineFunction({
  name: 'stream-monitor',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256
})
