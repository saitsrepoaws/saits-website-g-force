import { defineFunction } from '@aws-amplify/backend'

export const streamTrackPusher = defineFunction({
  name: 'stream-track-pusher',
  entry: './handler.ts',
  timeoutSeconds: 60,
  environment: {
    STORAGE_BUCKET: '', // Set in backend.ts
    SCHEDULE_TABLE: '',
    PLAYLIST_TABLE: '',
    TRACK_TABLE: '',
    EC2_INSTANCE_ID: ''
  }
})
