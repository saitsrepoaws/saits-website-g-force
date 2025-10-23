import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { audioMetadata } from './functions/audio-metadata/resource'
import { waveformGenerator } from './functions/waveform-generator/resource'
import { playlistGenerator } from './functions/playlist-generator/resource'
import { audioAnalyzer } from './functions/audio-analyzer/resource'
// import { audioFeatures } from './functions/audio-features/resource'
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'
import { EventType } from 'aws-cdk-lib/aws-s3'
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications'
import { LayerVersion, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'

// Compose resources explicitly to keep files small and modular
export const backend = defineBackend({
  auth,
  data,
  storage,
  audioMetadata,
  waveformGenerator,
  playlistGenerator,
  audioAnalyzer,
  // audioFeatures, // TODO: Combine with metadata or use SNS fanout
})

// Configure Lambdas to trigger on S3 uploads
const storageBucket = backend.storage.resources.bucket
const metadataLambda = backend.audioMetadata.resources.lambda
const waveformLambda = backend.waveformGenerator.resources.lambda
const playlistGeneratorLambda = backend.playlistGenerator.resources.lambda
const audioAnalyzerLambda = backend.audioAnalyzer.resources.lambda
const trackTable = backend.data.resources.tables['Track']
const playlistTable = backend.data.resources.tables['Playlist']

// Grant Lambda permission to read from S3 and write cover art
storageBucket.grantRead(metadataLambda)
storageBucket.grantPut(metadataLambda)

// Grant Lambda permission to read/write DynamoDB Track table
trackTable.grantReadWriteData(metadataLambda)
trackTable.grantReadWriteData(waveformLambda)

// Grant playlist generator Lambda permissions
trackTable.grantReadData(playlistGeneratorLambda)
playlistTable.grantReadWriteData(playlistGeneratorLambda)

// Grant waveform Lambda S3 permissions
storageBucket.grantRead(waveformLambda)
storageBucket.grantPut(waveformLambda)

// Grant Lambda 1 permission to invoke Lambda 3 and Lambda 5
waveformLambda.grantInvoke(metadataLambda)
audioAnalyzerLambda.grantInvoke(metadataLambda)

// Grant Lambda 5 (audio analyzer) permissions
storageBucket.grantRead(audioAnalyzerLambda)
trackTable.grantReadWriteData(audioAnalyzerLambda)

// Note: FFmpeg binary will be bundled with Lambda deployment
// No Lambda Layer needed - ffmpeg-static provides the binary

// Add environment variables
backend.audioMetadata.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.audioMetadata.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)
backend.audioMetadata.addEnvironment('WAVEFORM_LAMBDA_NAME', waveformLambda.functionName)
backend.audioMetadata.addEnvironment('AUDIO_ANALYZER_LAMBDA_NAME', audioAnalyzerLambda.functionName)

backend.waveformGenerator.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.waveformGenerator.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)

backend.playlistGenerator.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)
backend.playlistGenerator.addEnvironment('PLAYLIST_TABLE_NAME', playlistTable.tableName)

backend.audioAnalyzer.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.audioAnalyzer.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)

// Add S3 notification to trigger Lambda on audio file uploads
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(metadataLambda),
  { prefix: 'public/audio/' }
)

// Add IoT policy to authenticated role for PubSub access
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole

authenticatedRole.attachInlinePolicy(
  new Policy(authenticatedRole.stack, 'IotPubSubPolicy', {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'iot:Connect',
        ],
        resources: [
          // Allow connection with client ID matching the identity ID pattern
          'arn:aws:iot:eu-west-1:*:client/*',
        ],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'iot:Subscribe',
        ],
        resources: [
          'arn:aws:iot:eu-west-1:*:topicfilter/*',
        ],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'iot:Publish',
          'iot:Receive',
        ],
        resources: [
          'arn:aws:iot:eu-west-1:*:topic/*',
        ],
      }),
    ],
  })
)
