#!/usr/bin/env node

/**
 * G-Forge Radio - Standalone CI/CD Pipeline CDK App
 * 
 * 100% isolated from main project
 * Professional deployment pipeline
 */

import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { GForgePipelineStack } from '../lib/pipeline-stack'

const app = new cdk.App()

// Get configuration from environment or context
const githubOwner = app.node.tryGetContext('githubOwner') || process.env.GITHUB_OWNER || ''
const githubRepo = app.node.tryGetContext('githubRepo') || process.env.GITHUB_REPO || ''
const githubBranch = app.node.tryGetContext('githubBranch') || process.env.GITHUB_BRANCH || 'main'
const githubToken = app.node.tryGetContext('githubToken') || process.env.GITHUB_TOKEN || ''
const notificationEmail = app.node.tryGetContext('notificationEmail') || process.env.NOTIFICATION_EMAIL

// Validate required parameters
if (!githubOwner || !githubRepo) {
  console.error('❌ ERROR: GitHub owner and repo are required')
  console.error('\nSet via environment variables:')
  console.error('  export GITHUB_OWNER=your-username')
  console.error('  export GITHUB_REPO=your-repo')
  console.error('\nOr via CDK context:')
  console.error('  cdk deploy --context githubOwner=your-username --context githubRepo=your-repo')
  process.exit(1)
}

if (!githubToken) {
  console.error('❌ ERROR: GitHub token is required')
  console.error('\nSet via environment variable:')
  console.error('  export GITHUB_TOKEN=ghp_your_token_here')
  console.error('\nOr via CDK context:')
  console.error('  cdk deploy --context githubToken=ghp_your_token_here')
  process.exit(1)
}

console.log('🚀 G-Forge Radio Pipeline Deployment')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📦 Repository: ${githubOwner}/${githubRepo}`)
console.log(`🌿 Branch: ${githubBranch}`)
console.log(`📧 Notifications: ${notificationEmail || 'none'}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Create pipeline stack
new GForgePipelineStack(app, 'GForgePipelineStack', {
  githubOwner,
  githubRepo,
  githubBranch,
  githubToken,
  notificationEmail,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
  description: 'G-Forge Radio CI/CD Pipeline - Professional deployment with CodePipeline & CodeDeploy',
  stackName: 'GForge-Pipeline',
})

app.synth()
