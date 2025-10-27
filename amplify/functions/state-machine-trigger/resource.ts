import { defineFunction } from '@aws-amplify/backend'

export const stateMachineTrigger = defineFunction({
  name: 'state-machine-trigger',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  runtime: 20,
  // No resourceGroupName - will be added to custom stack in backend.ts
})
