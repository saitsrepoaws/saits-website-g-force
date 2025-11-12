import { defineFunction } from '@aws-amplify/backend'

export const trackCompletionHandler = defineFunction({
  name: 'track-completion-handler',
  entry: './handler.ts',
  timeoutSeconds: 30,
})
