import { defineFunction } from '@aws-amplify/backend'

export const streamStatusPublisher = defineFunction({
  name: 'stream-status-publisher',
  entry: './handler.ts',
  timeoutSeconds: 30,
})
