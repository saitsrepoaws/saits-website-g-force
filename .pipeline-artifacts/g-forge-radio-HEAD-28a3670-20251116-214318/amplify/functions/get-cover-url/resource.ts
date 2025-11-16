import { defineFunction } from '@aws-amplify/backend'

export const getCoverUrl = defineFunction({
  name: 'get-cover-url',
  entry: './handler.ts',
  timeoutSeconds: 10
})
