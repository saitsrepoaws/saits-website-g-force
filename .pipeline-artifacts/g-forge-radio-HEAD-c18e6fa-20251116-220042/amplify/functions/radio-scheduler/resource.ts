import { defineFunction } from '@aws-amplify/backend'

export const radioScheduler = defineFunction({
  name: 'radio-scheduler',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 20,
  // EventBridge schedule will be added in backend.ts
  // Schedule: rate(1 minute)
})
