import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { audioMetadata } from './functions/audio-metadata/resource'
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'
import { EventType } from 'aws-cdk-lib/aws-s3'
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications'

// Compose resources explicitly to keep files small and modular
export const backend = defineBackend({
  auth,
  data,
  storage,
  audioMetadata,
})

// Configure Lambda to trigger on S3 uploads
const storageBucket = backend.storage.resources.bucket
const metadataLambda = backend.audioMetadata.resources.lambda

// Grant Lambda permission to read from S3
storageBucket.grantRead(metadataLambda)

// Add environment variable for bucket name using CDK escape hatch
backend.audioMetadata.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)

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
