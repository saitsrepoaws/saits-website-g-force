import { defineFunction } from '@aws-amplify/backend'

export const playerLoadHandler = defineFunction({
  name: 'player-load-handler',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    // Will be set by backend.ts
  }
})
