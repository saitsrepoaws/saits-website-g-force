import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { audioMetadata } from './functions/audio-metadata/resource'
import { waveformGenerator } from './functions/waveform-generator/resource'
import { playlistGenerator } from './functions/playlist-generator/resource'
import { playerLoadHandler } from './functions/player-load-handler/resource'
import { playerIotPublisher } from './functions/player-iot-publisher/resource'
import { playerSimpleHandler } from './functions/player-simple-handler/resource'
// stateMachineTrigger will be created directly in custom stack to avoid circular dependency
// Container-based Lambda - imported separately
// import { audioAnalyzer } from './functions/audio-analyzer/resource'
import { Policy, PolicyStatement, Effect, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { EventType } from 'aws-cdk-lib/aws-s3'
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications'
import { DockerImageFunction, DockerImageCode, Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Duration, CfnOutput } from 'aws-cdk-lib'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import * as iot from 'aws-cdk-lib/aws-iot'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Compose resources explicitly to keep files small and modular
export const backend = defineBackend({
  auth,
  data,
  storage,
  audioMetadata,
  waveformGenerator,
  playlistGenerator,
  playerLoadHandler,
  playerIotPublisher,
  playerSimpleHandler,
  // audioAnalyzer - replaced with container Lambda below
})

// Configure Lambdas to trigger on S3 uploads
const storageBucket = backend.storage.resources.bucket
const metadataLambda = backend.audioMetadata.resources.lambda
const waveformLambda = backend.waveformGenerator.resources.lambda
const playlistGeneratorLambda = backend.playlistGenerator.resources.lambda
const trackTable = backend.data.resources.tables['Track']
const playlistTable = backend.data.resources.tables['Playlist']

// Create Docker-based Lambda for audio analysis with FFmpeg
// Lookup ECR repository that we created with build-container.sh
const ecrRepository = ecr.Repository.fromRepositoryName(
  backend.storage.stack,
  'AudioAnalyzerECR',
  'audio-analyzer-lambda'
)

const audioAnalyzerLambda = new DockerImageFunction(
  backend.storage.stack,
  'AudioAnalyzerDockerLambda',
  {
    code: DockerImageCode.fromEcr(ecrRepository, {
      // Use digest instead of tag to force Lambda to pull new image
      tagOrDigest: 'sha256:700414a4e55cd34e8c91c362de8ad5d3f4a214d17b8def56e0d1a2cc0794fc3f',
    }),
    timeout: Duration.seconds(300),
    memorySize: 3008,
    architecture: Architecture.X86_64,
    environment: {
      STORAGE_BUCKET_NAME: storageBucket.bucketName,
      TRACK_TABLE_NAME: trackTable.tableName,
      FFMPEG_PATH: '/usr/local/bin/ffmpeg',
    },
  }
)

console.log('🐳 Docker Lambda created for audio-analyzer with FFmpeg')

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

// Grant Lambda 5 (Docker audio analyzer) permissions
storageBucket.grantRead(audioAnalyzerLambda)
trackTable.grantReadWriteData(audioAnalyzerLambda)

// Add environment variables
backend.audioMetadata.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.audioMetadata.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)
backend.audioMetadata.addEnvironment('WAVEFORM_LAMBDA_NAME', waveformLambda.functionName)
backend.audioMetadata.addEnvironment('AUDIO_ANALYZER_LAMBDA_NAME', audioAnalyzerLambda.functionName)

backend.waveformGenerator.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.waveformGenerator.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)

backend.playlistGenerator.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)
backend.playlistGenerator.addEnvironment('PLAYLIST_TABLE_NAME', playlistTable.tableName)

// Add S3 notification to trigger Lambda on audio file uploads
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(metadataLambda),
  { prefix: 'public/audio/' }
)

// Add IoT policy to authenticated role for PubSub access
// Open policy for development - see /docs/IOT_TOPICS_SPECIFICATION.md for production policy
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole

authenticatedRole.attachInlinePolicy(
  new Policy(authenticatedRole.stack, 'IotPubSubPolicy', {
    statements: [
      // Connect - allow any client ID for development
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Connect'],
        resources: [
          'arn:aws:iot:eu-west-1:*:client/*',
        ],
      }),
      
      // Subscribe - allow all topics for development
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Subscribe'],
        resources: [
          'arn:aws:iot:eu-west-1:*:topicfilter/*',
        ],
      }),
      
      // Publish & Receive - allow all topics for development
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish', 'iot:Receive'],
        resources: [
          'arn:aws:iot:eu-west-1:*:topic/*',
        ],
      }),
      
      // Step Functions - allow starting and describing State Machine executions
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'states:StartExecution',
          'states:DescribeExecution'
        ],
        resources: [
          'arn:aws:states:eu-west-1:*:stateMachine:RadioPlayerStateMachine',
          'arn:aws:states:eu-west-1:*:execution:RadioPlayerStateMachine:*'
        ],
      }),
    ],
  })
)

// CloudFront Distribution for S3 Storage
// Cache presigned URLs from Amplify Storage (respects auth + Block Public Access)
const cloudFrontDistribution = new cloudfront.Distribution(
  backend.storage.stack,
  'StorageDistribution',
  {
    defaultBehavior: {
      origin: new origins.HttpOrigin(`${storageBucket.bucketName}.s3.${backend.storage.stack.region}.amazonaws.com`),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      cachePolicy: new cloudfront.CachePolicy(
        backend.storage.stack,
        'AudioCachePolicy',
        {
          cachePolicyName: 'AudioFilesCache',
          comment: 'Cache policy for audio files with auth params',
          defaultTtl: Duration.minutes(15), // Match presigned URL expiry
          maxTtl: Duration.hours(1), // Max 1 hour
          minTtl: Duration.seconds(0),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
          // Include query strings for presigned URLs
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        }
      ),
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
    },
    comment: 'CDN for audio files, cover art, and waveforms (with presigned URLs)',
    enableLogging: false,
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
  }
)

// Export CloudFront domain for use in frontend
new CfnOutput(backend.storage.stack, 'CloudFrontDomain', {
  value: cloudFrontDistribution.distributionDomainName,
  description: 'CloudFront distribution domain for storage assets',
  exportName: 'StorageCloudFrontDomain',
})

new CfnOutput(backend.storage.stack, 'CloudFrontDistributionId', {
  value: cloudFrontDistribution.distributionId,
  description: 'CloudFront distribution ID',
  exportName: 'StorageCloudFrontDistributionId',
})

// =============================================================================
// Player State Machine Setup
// =============================================================================

// Get Lambda functions for State Machine
const loadHandlerLambda = backend.playerLoadHandler.resources.lambda
const iotPublisherLambda = backend.playerIotPublisher.resources.lambda
const simpleHandlerLambda = backend.playerSimpleHandler.resources.lambda

// Grant GraphQL API access to load handler (via IAM policy)
loadHandlerLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    resources: [
      `${backend.data.resources.graphqlApi.arn}/types/Query/*`,
      `${backend.data.resources.graphqlApi.arn}/types/Mutation/*`
    ],
  })
)

// Grant IoT publish permission to IoT publisher
iotPublisherLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['iot:Publish'],
    resources: ['arn:aws:iot:*:*:topic/radio/player/*/command'],
  })
)

// Read State Machine definition
const stateMachineDefinitionPath = join(__dirname, 'functions/state-machine/definition.asl.json')
const stateMachineDefinitionRaw = readFileSync(stateMachineDefinitionPath, 'utf-8')

// Replace placeholders with actual Lambda ARNs
const stateMachineDefinition = stateMachineDefinitionRaw
  .replace(/\$\{LoadCommandHandlerArn\}/g, loadHandlerLambda.functionArn)
  .replace(/\$\{PublishIoTCommandArn\}/g, iotPublisherLambda.functionArn)
  .replace(/\$\{SimpleCommandHandlerArn\}/g, simpleHandlerLambda.functionArn)
  .replace(/\$\{PlayCommandHandlerArn\}/g, simpleHandlerLambda.functionArn)

// Create custom stack for State Machine to avoid circular dependencies
const stateMachineStack = backend.createStack('custom-player-state-machine')

// Create trigger Lambda directly in custom stack
const triggerLambda = new NodejsFunction(stateMachineStack, 'StateMachineTrigger', {
  functionName: 'state-machine-trigger',
  entry: join(__dirname, 'functions/state-machine-trigger/handler.ts'),
  runtime: Runtime.NODEJS_20_X,
  timeout: Duration.seconds(10),
  memorySize: 256,
})

// Create State Machine in custom stack
const playerStateMachine = new sfn.StateMachine(stateMachineStack, 'PlayerStateMachine', {
  stateMachineName: 'RadioPlayerStateMachineV2', // Changed name to avoid conflict with old stack
  definitionBody: sfn.DefinitionBody.fromString(stateMachineDefinition),
  timeout: Duration.minutes(5),
})

// Grant State Machine permission to invoke Lambdas
loadHandlerLambda.grantInvoke(playerStateMachine)
iotPublisherLambda.grantInvoke(playerStateMachine)
simpleHandlerLambda.grantInvoke(playerStateMachine)

// Add environment variable to trigger Lambda
triggerLambda.addEnvironment('STATE_MACHINE_ARN', playerStateMachine.stateMachineArn)

// Grant trigger Lambda permission to start State Machine
playerStateMachine.grantStartExecution(triggerLambda)

// Create IoT Rule to trigger Lambda (which then starts State Machine)
triggerLambda.grantInvoke(new ServicePrincipal('iot.amazonaws.com'))

const iotRule = new iot.CfnTopicRule(stateMachineStack, 'PlayerCommandRule', {
  ruleName: 'RadioPlayerCommandRule',
  topicRulePayload: {
    sql: "SELECT * FROM 'radio/player/+/command-request'",
    description: 'Trigger Lambda for player command requests',
    actions: [
      {
        lambda: {
          functionArn: triggerLambda.functionArn,
        },
      },
    ],
    awsIotSqlVersion: '2016-03-23',
  },
})

// Output State Machine ARN
new CfnOutput(stateMachineStack, 'PlayerStateMachineArn', {
  value: playerStateMachine.stateMachineArn,
  description: 'ARN of the Player State Machine',
  exportName: 'PlayerStateMachineArn',
})

new CfnOutput(stateMachineStack, 'IoTRuleArn', {
  value: `arn:aws:iot:${stateMachineStack.region}:${stateMachineStack.account}:rule/${iotRule.ruleName}`,
  description: 'ARN of the IoT Rule for player commands',
  exportName: 'PlayerCommandIoTRuleArn',
})
