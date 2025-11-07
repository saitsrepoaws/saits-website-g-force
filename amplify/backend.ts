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
import { radioScheduler } from './functions/radio-scheduler/resource'
import { crossfadeController } from './functions/crossfade-controller/resource'
import { streamPlaylistUpdater } from './functions/stream-playlist-updater/resource'
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
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join} from 'path'

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
  radioScheduler,
  crossfadeController,
  streamPlaylistUpdater
})

// Configure Lambdas to trigger on S3 uploads
const storageBucket = backend.storage.resources.bucket
const metadataLambda = backend.audioMetadata.resources.lambda
const waveformLambda = backend.waveformGenerator.resources.lambda
const playlistGeneratorLambda = backend.playlistGenerator.resources.lambda
const trackTable = backend.data.resources.tables['Track']
const playlistTable = backend.data.resources.tables['Playlist']
const scheduleTable = backend.data.resources.tables['Schedule']
const radioSchedulerLambda = backend.radioScheduler.resources.lambda

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

// Grant radio scheduler Lambda permissions
scheduleTable.grantReadData(radioSchedulerLambda)
playlistTable.grantReadData(radioSchedulerLambda)
trackTable.grantReadData(radioSchedulerLambda)

// Add environment variables for radio scheduler
backend.radioScheduler.addEnvironment('SCHEDULE_TABLE_NAME', scheduleTable.tableName)
backend.radioScheduler.addEnvironment('PLAYLIST_TABLE_NAME', playlistTable.tableName)
backend.radioScheduler.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)
backend.radioScheduler.addEnvironment('IOT_ENDPOINT', 'acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com')

// Grant IoT publish permission to radio scheduler
radioSchedulerLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['iot:Publish'],
    resources: ['arn:aws:iot:*:*:topic/radio/station/*'],
  })
)

// =============================================================================
// Cross-Fade Controller Configuration
// =============================================================================

const crossfadeControllerLambda = backend.crossfadeController.resources.lambda

// Grant cross-fade controller Lambda permissions
playlistTable.grantReadData(crossfadeControllerLambda)
trackTable.grantReadData(crossfadeControllerLambda)

// Add environment variables for cross-fade controller
backend.crossfadeController.addEnvironment('PLAYLIST_TABLE_NAME', playlistTable.tableName)
backend.crossfadeController.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)
backend.crossfadeController.addEnvironment('IOT_ENDPOINT', 'acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com')

// Grant IoT publish permission to cross-fade controller
crossfadeControllerLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['iot:Publish'],
    resources: ['arn:aws:iot:*:*:topic/radio/player/*'],
  })
)

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

// Add IoT policy to BOTH authenticated AND unauthenticated roles for PubSub access
// Open policy for development - see /docs/IOT_TOPICS_SPECIFICATION.md for production policy
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole
const unauthenticatedRole = backend.auth.resources.unauthenticatedUserIamRole

// Attach AWS managed policies for IoT access to BOTH roles
authenticatedRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('AWSIoTDataAccess')
)
authenticatedRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('AWSIoTConfigAccess')
)
unauthenticatedRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('AWSIoTDataAccess')
)
unauthenticatedRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('AWSIoTConfigAccess')
)

// Note: RadioPlayerCognitoPolicy already exists in AWS IoT
// We use the existing policy created earlier, no need to create via CDK
// The iotPolicyAttacher service will attach this existing policy to identities

// Output IoT Policy name for frontend to use (existing policy)
new CfnOutput(backend.auth.stack, 'IoTCognitoPolicyName', {
  value: 'RadioPlayerCognitoPolicy',
  description: 'IoT Policy name (existing) that gets attached to Cognito Identity',
  exportName: 'IoTCognitoPolicyName',
})

// Create policy statements that will be attached to BOTH roles
const iotPolicyStatements = [
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
      
      // IoT Policy Management - allow attaching existing RadioPlayerCognitoPolicy
      // Required for frontend to attach IoT policy to Cognito Identity
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'iot:AttachPolicy',
          'iot:DetachPolicy',
          'iot:ListAttachedPolicies',
        ],
        resources: [
          'arn:aws:iot:eu-west-1:*:policy/RadioPlayerCognitoPolicy',
          'arn:aws:iot:eu-west-1:*:cert/*',  // For attaching to identities
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
]

// Attach policy to authenticated role
authenticatedRole.attachInlinePolicy(
  new Policy(authenticatedRole.stack, 'IotPubSubPolicy', {
    statements: iotPolicyStatements,
  })
)

// Attach same policy to unauthenticated role (CRITICAL FIX!)
unauthenticatedRole.attachInlinePolicy(
  new Policy(unauthenticatedRole.stack, 'IotPubSubPolicyUnauth', {
    statements: iotPolicyStatements,
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

// Add environment variables using CDK escape hatch
const loadHandlerCfn = loadHandlerLambda.node.defaultChild as any
loadHandlerCfn.addPropertyOverride('Environment.Variables.APPSYNC_ENDPOINT', 'https://3xebr33oejghvevq22tg52nbba.appsync-api.eu-west-1.amazonaws.com/graphql')
loadHandlerCfn.addPropertyOverride('Environment.Variables.APPSYNC_API_KEY', '')
// Add DynamoDB table names for schedule-based track loading
loadHandlerCfn.addPropertyOverride('Environment.Variables.SCHEDULE_TABLE_NAME', backend.data.resources.tables['Schedule'].tableName)
loadHandlerCfn.addPropertyOverride('Environment.Variables.PLAYLIST_TABLE_NAME', playlistTable.tableName)
loadHandlerCfn.addPropertyOverride('Environment.Variables.TRACK_TABLE_NAME', trackTable.tableName)

const iotPublisherCfn = iotPublisherLambda.node.defaultChild as any
iotPublisherCfn.addPropertyOverride('Environment.Variables.IOT_ENDPOINT', 'acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com')

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

// Grant DynamoDB read access to load handler for Schedule, Playlist, and Track tables
scheduleTable.grantReadData(loadHandlerLambda)
playlistTable.grantReadData(loadHandlerLambda)
trackTable.grantReadData(loadHandlerLambda)

// Grant IoT publish permission to IoT publisher (all player topics)
iotPublisherLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['iot:Publish'],
    resources: ['arn:aws:iot:*:*:topic/radio/player/*'],
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
  bundling: {
    externalModules: [], // Bundle ALL modules including AWS SDK
    minify: false,
    sourceMap: false,
  },
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

// Grant State Machine permission to publish to IoT
playerStateMachine.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['iot:Publish'],
    resources: ['arn:aws:iot:*:*:topic/radio/player/*'],
  })
)

// Add environment variable to trigger Lambda
triggerLambda.addEnvironment('STATE_MACHINE_ARN', playerStateMachine.stateMachineArn)

// Grant trigger Lambda permission to start State Machine
playerStateMachine.grantStartExecution(triggerLambda)

// =============================================================================
// IoT Rule ENABLED - Triggers AWS Step Functions State Machine
// =============================================================================
// Schedule data is now in DynamoDB ✅
// Lambda reads from Schedule table ✅
// Real backend logic active! ✅

// Create IoT Rule to trigger Lambda (which then starts State Machine)
triggerLambda.grantInvoke(new ServicePrincipal('iot.amazonaws.com'))

const iotRule = new iot.CfnTopicRule(stateMachineStack, 'PlayerCommandRule', {
  ruleName: 'RadioPlayerCommandRuleV2',
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

// IoT Rule output
new CfnOutput(stateMachineStack, 'IoTRuleArn', {
  value: `arn:aws:iot:${stateMachineStack.region}:${stateMachineStack.account}:rule/${iotRule.ruleName}`,
  description: 'ARN of the IoT Rule for player commands',
})

// =============================================================================
// Cross-Fade Controller IoT Rule
// =============================================================================

// Grant IoT permission to invoke cross-fade controller
crossfadeControllerLambda.grantInvoke(new ServicePrincipal('iot.amazonaws.com'))

const crossfadeIotRule = new iot.CfnTopicRule(stateMachineStack, 'CrossFadeControlRule', {
  ruleName: 'RadioCrossFadeControlRule',
  topicRulePayload: {
    sql: "SELECT * FROM 'radio/crossfade/control'",
    description: 'Trigger cross-fade controller for START/STOP commands',
    actions: [
      {
        lambda: {
          functionArn: crossfadeControllerLambda.functionArn,
        },
      },
    ],
    awsIotSqlVersion: '2016-03-23',
  },
})

// Cross-Fade Rule output
new CfnOutput(stateMachineStack, 'CrossFadeIoTRuleArn', {
  value: `arn:aws:iot:${stateMachineStack.region}:${stateMachineStack.account}:rule/${crossfadeIotRule.ruleName}`,
  description: 'ARN of the IoT Rule for cross-fade control',
  exportName: 'PlayerCommandIoTRuleArn',
})

// =============================================================================
// Radio Scheduler - EventBridge Schedule (runs every minute)
// =============================================================================

// Create EventBridge rule to trigger radio scheduler every minute
const schedulerRule = new events.Rule(backend.radioScheduler.resources.lambda.stack, 'RadioSchedulerRule', {
  ruleName: 'RadioSchedulerEveryMinute',
  description: 'Triggers radio scheduler Lambda every minute to broadcast next track',
  schedule: events.Schedule.rate(Duration.minutes(1)),
})

// Add Lambda as target
schedulerRule.addTarget(new targets.LambdaFunction(radioSchedulerLambda))

// Output scheduler info
new CfnOutput(backend.radioScheduler.resources.lambda.stack, 'RadioSchedulerRuleArn', {
  value: schedulerRule.ruleArn,
  description: 'EventBridge rule that triggers radio scheduler every minute',
  exportName: 'RadioSchedulerRuleArn',
})

console.log('📻 Radio Scheduler Lambda deployed with EventBridge (rate: 1 minute)')

// =============================================================================
// 🎙️ STREAM SERVER - EC2 Icecast + Liquidsoap + S3 Playlist
// =============================================================================

// Get Lambda for stream playlist updater
const streamPlaylistLambda = backend.streamPlaylistUpdater.resources.lambda

// Create S3 bucket for playlists (Liquidsoap will download from here)
const playlistBucket = new s3.Bucket(
  streamPlaylistLambda.stack,
  'StreamPlaylistBucket',
  {
    bucketName: `radio-playlists-${streamPlaylistLambda.stack.account}`,
    publicReadAccess: false,
    versioned: false,
    lifecycleRules: [
      {
        expiration: Duration.days(7),
        id: 'CleanupOldPlaylists'
      }
    ]
  }
)

// Grant Lambda permissions
scheduleTable.grantReadData(streamPlaylistLambda)
playlistTable.grantReadData(streamPlaylistLambda)
trackTable.grantReadData(streamPlaylistLambda)
playlistBucket.grantWrite(streamPlaylistLambda)

// Add environment variables
backend.streamPlaylistUpdater.addEnvironment('SCHEDULE_TABLE', scheduleTable.tableName)
backend.streamPlaylistUpdater.addEnvironment('PLAYLIST_TABLE', playlistTable.tableName)
backend.streamPlaylistUpdater.addEnvironment('TRACK_TABLE', trackTable.tableName)
backend.streamPlaylistUpdater.addEnvironment('PLAYLIST_BUCKET', playlistBucket.bucketName)

// EventBridge rule - Run every 5 minutes
const streamSchedulerRule = new events.Rule(
  streamPlaylistLambda.stack,
  'StreamPlaylistSchedulerRule',
  {
    ruleName: 'StreamPlaylistEvery5Minutes',
    description: 'Updates stream playlist every 5 minutes based on schedule',
    schedule: events.Schedule.rate(Duration.minutes(5)),
  }
)

streamSchedulerRule.addTarget(new targets.LambdaFunction(streamPlaylistLambda))

// VPC for EC2 Stream Server
const vpc = new ec2.Vpc(streamPlaylistLambda.stack, 'StreamVPC', {
  maxAzs: 2,
  natGateways: 0, // Use public subnet only for cost
  subnetConfiguration: [
    {
      name: 'Public',
      subnetType: ec2.SubnetType.PUBLIC,
      cidrMask: 24
    }
  ]
})

// Security Group for Stream Server
const streamSG = new ec2.SecurityGroup(streamPlaylistLambda.stack, 'StreamSG', {
  vpc,
  description: 'Security group for Icecast stream server',
  allowAllOutbound: true
})

// Allow Icecast port 8000
streamSG.addIngressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(8000),
  'Allow Icecast streaming'
)

// Allow SSH
streamSG.addIngressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(22),
  'Allow SSH access'
)

// Allow HTTP
streamSG.addIngressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(80),
  'Allow HTTP access'
)

// IAM Role for EC2
const ec2Role = new iam.Role(streamPlaylistLambda.stack, 'StreamServerRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
  ]
})

// Grant S3 read access to EC2
playlistBucket.grantRead(ec2Role)
storageBucket.grantRead(ec2Role) // For reading audio files

// User data script for EC2
const userData = ec2.UserData.forLinux()
userData.addCommands(
  '#!/bin/bash',
  'set -e',
  'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
  '',
  'echo "🎙️ G-Forge Radio Stream Server Setup Starting..."',
  '',
  '# Update system',
  'export DEBIAN_FRONTEND=noninteractive',
  'apt-get update',
  'apt-get upgrade -y',
  '',
  '# Pre-configure icecast2 to avoid interactive prompts',
  'echo "icecast2 icecast2/icecast-setup boolean false" | debconf-set-selections',
  '',
  '# Install dependencies',
  'apt-get install -y \\',
  '  icecast2 \\',
  '  liquidsoap \\',
  '  awscli \\',
  '  nginx \\',
  '  curl \\',
  '  ffmpeg',
  '',
  '# Configure Icecast',
  'cat > /etc/icecast2/icecast.xml << "ICECAST_EOF"',
  '<icecast>',
  '  <location>Europe/Amsterdam</location>',
  '  <admin>admin@g-forge.com</admin>',
  '  <limits>',
  '    <clients>100</clients>',
  '    <sources>5</sources>',
  '    <queue-size>524288</queue-size>',
  '  </limits>',
  '  <authentication>',
  '    <source-password>gforge2024radio</source-password>',
  '    <admin-password>gforge2024admin</admin-password>',
  '  </authentication>',
  '  <hostname>radio.g-forge.com</hostname>',
  '  <listen-socket>',
  '    <port>8000</port>',
  '  </listen-socket>',
  '  <paths>',
  '    <basedir>/usr/share/icecast2</basedir>',
  '    <logdir>/var/log/icecast2</logdir>',
  '    <webroot>/usr/share/icecast2/web</webroot>',
  '    <adminroot>/usr/share/icecast2/admin</adminroot>',
  '    <alias source="/" dest="/status.xsl"/>',
  '  </paths>',
  '</icecast>',
  'ICECAST_EOF',
  '',
  '# Enable Icecast',
  'sed -i "s/ENABLE=false/ENABLE=true/" /etc/default/icecast2',
  '',
  '# Create radio directory',
  'mkdir -p /opt/radio',
  'mkdir -p /var/log/liquidsoap',
  '',
  '# Create Liquidsoap configuration',
  `cat > /opt/radio/radio.liq << "LIQUIDSOAP_EOF"`,
  '# G-Forge Radio - Liquidsoap Configuration',
  'set("log.file.path", "/var/log/liquidsoap/radio.log")',
  'set("log.level", 3)',
  '',
  's3_bucket = "' + playlistBucket.bucketName + '"',
  'playlist_file = "/tmp/current-playlist.m3u"',
  '',
  'def fetch_playlist() =',
  '  log("📥 Fetching playlist from S3...")',
  '  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")',
  '  log("S3 result: #{ret}")',
  '  playlist_file',
  'end',
  '',
  'ignore(fetch_playlist())',
  'add_timeout(300., fun () -> begin ignore(fetch_playlist()); -1. end)',
  '',
  'radio = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)',
  'radio = fallback(track_sensitive=false, [radio])',
  '# Crossfade for smooth transitions (Liquidsoap 2.x syntax)',
  'radio = crossfade(duration=3., radio)',
  'radio = normalize(radio)',
  '',
  'output.icecast(',
  '  %mp3(bitrate=192, samplerate=44100),',
  '  host="localhost",',
  '  port=8000,',
  '  password="gforge2024radio",',
  '  mount="/stream.mp3",',
  '  name="G-Forge Radio",',
  '  description="Techno & Electronic Music 24/7",',
  '  genre="Techno",',
  '  public=true,',
  '  radio',
  ')',
  'LIQUIDSOAP_EOF',
  '',
  '# Create systemd service',
  'cat > /etc/systemd/system/liquidsoap-radio.service << "SERVICE_EOF"',
  '[Unit]',
  'Description=Liquidsoap Radio Stream',
  'After=network.target icecast2.service',
  'Requires=icecast2.service',
  '',
  '[Service]',
  'Type=simple',
  'User=root',
  'ExecStart=/usr/bin/liquidsoap /opt/radio/radio.liq',
  'Restart=always',
  'RestartSec=10',
  '',
  '[Install]',
  'WantedBy=multi-user.target',
  'SERVICE_EOF',
  '',
  '# Create empty playlist',
  'touch /tmp/current-playlist.m3u',
  '',
  '# Start services',
  'systemctl daemon-reload',
  'systemctl enable icecast2',
  'systemctl start icecast2',
  'systemctl enable liquidsoap-radio',
  'systemctl start liquidsoap-radio',
  '',
  '# Configure nginx reverse proxy',
  'cat > /etc/nginx/sites-available/radio << "NGINX_EOF"',
  'server {',
  '  listen 80;',
  '  server_name _;',
  '  location / {',
  '    proxy_pass http://localhost:8000;',
  '    proxy_set_header Host $host;',
  '  }',
  '}',
  'NGINX_EOF',
  '',
  'ln -sf /etc/nginx/sites-available/radio /etc/nginx/sites-enabled/',
  'rm -f /etc/nginx/sites-enabled/default',
  'systemctl restart nginx',
  '',
  '# Health check script',
  'cat > /opt/radio/healthcheck.sh << "HEALTH_EOF"',
  '#!/bin/bash',
  'curl -f http://localhost:8000/status-json.xsl > /dev/null 2>&1',
  'if [ $? -ne 0 ]; then',
  '  systemctl restart icecast2',
  '  systemctl restart liquidsoap-radio',
  'fi',
  'HEALTH_EOF',
  'chmod +x /opt/radio/healthcheck.sh',
  '',
  '# Add healthcheck cron',
  'echo "*/5 * * * * /opt/radio/healthcheck.sh >> /var/log/radio-health.log 2>&1" | crontab -',
  '',
  'echo "✅ Radio stream server setup complete!"'
)

// EC2 Instance
const streamInstance = new ec2.Instance(streamPlaylistLambda.stack, 'StreamServer', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.SMALL
  ),
  machineImage: ec2.MachineImage.fromSsmParameter(
    '/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
    { os: ec2.OperatingSystemType.LINUX }
  ),
  securityGroup: streamSG,
  role: ec2Role,
  userData,
  userDataCausesReplacement: true,
  requireImdsv2: true,
  blockDevices: [
    {
      deviceName: '/dev/sda1',
      volume: ec2.BlockDeviceVolume.ebs(20, {
        volumeType: ec2.EbsDeviceVolumeType.GP3
      })
    }
  ]
})

// Elastic IP for fixed stream URL
const eip = new ec2.CfnEIP(streamPlaylistLambda.stack, 'StreamServerEIP', {
  instanceId: streamInstance.instanceId,
  tags: [
    {
      key: 'Name',
      value: 'G-Forge-Radio-Stream-EIP'
    }
  ]
})

// Outputs
new CfnOutput(streamPlaylistLambda.stack, 'StreamServerPublicIP', {
  value: eip.ref,
  description: 'Elastic IP of stream server (fixed)',
  exportName: 'StreamServerPublicIP',
})

new CfnOutput(streamPlaylistLambda.stack, 'StreamURL', {
  value: `http://${eip.ref}:8000/stream.mp3`,
  description: 'Radio stream URL',
  exportName: 'StreamURL',
})

new CfnOutput(streamPlaylistLambda.stack, 'IcecastAdminURL', {
  value: `http://${eip.ref}:8000/admin/`,
  description: 'Icecast admin interface',
  exportName: 'IcecastAdminURL',
})

new CfnOutput(streamPlaylistLambda.stack, 'PlaylistBucketName', {
  value: playlistBucket.bucketName,
  description: 'S3 bucket for playlists',
  exportName: 'PlaylistBucketName',
})

new CfnOutput(streamPlaylistLambda.stack, 'StreamServerInstanceId', {
  value: streamInstance.instanceId,
  description: 'EC2 instance ID for stream server',
  exportName: 'StreamServerInstanceId',
})

console.log('🎙️ Stream Server (EC2 + Icecast + Liquidsoap) configured with Elastic IP')
console.log('📋 Stream Playlist Updater Lambda deployed with EventBridge (rate: 5 minutes)')
