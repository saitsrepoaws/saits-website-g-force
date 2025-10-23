import { defineFunction } from '@aws-amplify/backend'

export const audioAnalyzer = defineFunction({
  name: 'audio-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 min for audio analysis
  memoryMB: 3008, // Max memory for audio processing
  resourceGroupName: 'storage',
  environment: {
    // FFmpeg will be in /opt/bin from Lambda Layer
    PATH: '/opt/bin:/usr/local/bin:/usr/bin/:/bin:/opt/ffmpeg/bin',
    LD_LIBRARY_PATH: '/opt/lib:/opt/ffmpeg/lib',
    FFMPEG_PATH: '/opt/bin/ffmpeg',
  },
})
