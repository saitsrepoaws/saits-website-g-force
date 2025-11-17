import { defineFunction } from '@aws-amplify/backend'

export const playerConnectHandler = defineFunction({
  name: 'player-connect-handler',
  timeoutSeconds: 30,
  memoryMB: 512
})
