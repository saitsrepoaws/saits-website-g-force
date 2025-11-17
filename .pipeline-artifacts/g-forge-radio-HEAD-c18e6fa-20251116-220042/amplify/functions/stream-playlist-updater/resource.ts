import { defineFunction } from '@aws-amplify/backend'

export const streamPlaylistUpdater = defineFunction({
  name: 'stream-playlist-updater',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    // These will be added in backend.ts
  }
})
