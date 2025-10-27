import { defineFunction } from '@aws-amplify/backend'

export const stateMachineTrigger = defineFunction({
  name: 'state-machine-trigger',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 20,
  resourceGroupName: 'custom-player-state-machine', // Custom stack for State Machine resources
})
