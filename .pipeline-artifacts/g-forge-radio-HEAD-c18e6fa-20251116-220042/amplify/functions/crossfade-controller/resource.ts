import { defineFunction } from '@aws-amplify/backend'

export const crossfadeController = defineFunction({
  name: 'crossfade-controller',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20
})
