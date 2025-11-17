import { defineFunction } from '@aws-amplify/backend'

export const ec2ParameterUpdater = defineFunction({
  name: 'ec2-parameter-updater',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 256
})
