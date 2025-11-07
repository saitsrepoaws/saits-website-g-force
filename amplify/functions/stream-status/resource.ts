import { defineFunction } from '@aws-amplify/backend'

export const streamStatus = defineFunction({
  name: 'stream-status',
  entry: './handler.ts',
  timeoutSeconds: 30,
})
