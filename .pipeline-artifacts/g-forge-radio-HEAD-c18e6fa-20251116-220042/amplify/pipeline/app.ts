#!/usr/bin/env node

/**
 * CDK App for G-Forge Radio CI/CD Pipeline
 */

import * as cdk from 'aws-cdk-lib'
import { GForgePipelineStack } from './pipeline-stack'

const app = new cdk.App()

// Get configuration from context
const githubRepo = app.node.tryGetContext('githubRepo') || process.env.GITHUB_REPO || 'owner/repo'
const githubBranch = app.node.tryGetContext('githubBranch') || process.env.GITHUB_BRANCH || 'main'
const githubToken = app.node.tryGetContext('githubToken') || process.env.GITHUB_TOKEN || ''
const notificationEmail = app.node.tryGetContext('notificationEmail') || process.env.NOTIFICATION_EMAIL

if (!githubToken) {
  console.error('❌ ERROR: GitHub token not provided')
  console.error('Set via: --context githubToken=TOKEN or GITHUB_TOKEN env var')
  process.exit(1)
}

new GForgePipelineStack(app, 'GForgePipelineStack', {
  githubRepo,
  githubBranch,
  githubToken,
  notificationEmail,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
  description: 'G-Forge Radio CI/CD Pipeline with CodePipeline, CodeBuild, and automated testing',
  tags: {
    Project: 'G-Forge-Radio',
    Environment: 'CI/CD',
    ManagedBy: 'CDK',
  },
})

app.synth()
