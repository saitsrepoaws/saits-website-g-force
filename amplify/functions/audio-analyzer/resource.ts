import { defineFunction } from '@aws-amplify/backend'

export const audioAnalyzer = defineFunction({
  name: 'audio-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 min for audio analysis
  memoryMB: 3008, // Max memory for audio processing
  resourceGroupName: 'storage',
  environment: {
    // FFmpeg from Lambda Layer at /opt/bin/ffmpeg
    FFMPEG_PATH: '/opt/bin/ffmpeg',
    PATH: '/opt/bin:/usr/local/bin:/usr/bin:/bin',
  },
})
