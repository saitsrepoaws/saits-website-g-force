import { defineFunction } from '@aws-amplify/backend'

export const genreMerger = defineFunction({
  name: 'genre-merger',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for large libraries
  memoryMB: 1024,
  resourceGroupName: 'data'
})
