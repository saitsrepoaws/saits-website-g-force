import { defineFunction } from '@aws-amplify/backend'

export const playerSimpleHandler = defineFunction({
  name: 'player-simple-handler',
  entry: './handler.ts',
  timeoutSeconds: 5,
  memoryMB: 128
})
