import { defineFunction } from '@aws-amplify/backend'

export const playerIotPublisher = defineFunction({
  name: 'player-iot-publisher',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 20
})
