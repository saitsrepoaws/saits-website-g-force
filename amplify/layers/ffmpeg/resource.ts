import { defineFunction } from '@aws-amplify/backend'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import { Stack } from 'aws-cdk-lib'

/**
 * FFmpeg Lambda Layer
 * Provides static FFmpeg binary at /opt/bin/ffmpeg
 */
export function createFFmpegLayer(stack: Stack): lambda.LayerVersion {
  return new lambda.LayerVersion(stack, 'FFmpegLayer', {
    code: lambda.Code.fromAsset(path.join(__dirname)),
    compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
    description: 'FFmpeg static binary for audio processing',
    layerVersionName: 'ffmpeg-static',
  })
}
