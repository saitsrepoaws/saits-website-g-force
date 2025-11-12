import { defineFunction } from '@aws-amplify/backend'

export const listenerTracker = defineFunction({
  name: 'listener-tracker',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    SESSION_TABLE: '',
    PROFILE_TABLE: ''
  }
})
