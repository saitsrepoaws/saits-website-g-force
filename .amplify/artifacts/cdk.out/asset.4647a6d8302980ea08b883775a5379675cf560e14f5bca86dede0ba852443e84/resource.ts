import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import { Stack } from 'aws-cdk-lib'
import { fileURLToPath } from 'url'

// ES module workaround for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * FFmpeg Lambda Layer
 * Provides static FFmpeg binary at /opt/bin/ffmpeg
 */
export function createFFmpegLayer(stack: Stack): lambda.LayerVersion {
  return new lambda.LayerVersion(stack, 'FFmpegLayer', {
    code: lambda.Code.fromAsset(__dirname),
    compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
    description: 'FFmpeg static binary for audio processing',
    layerVersionName: 'ffmpeg-static',
  })
}
