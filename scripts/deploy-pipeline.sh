#!/bin/bash

# =============================================================================
# G-FORGE RADIO - DEPLOY CI/CD PIPELINE
# =============================================================================
#
# Deploys the CodePipeline infrastructure
#
# Usage:
#   ./scripts/deploy-pipeline.sh
#
# Environment Variables Required:
#   GITHUB_TOKEN - GitHub personal access token
#   GITHUB_REPO - GitHub repository (owner/repo)
#   NOTIFICATION_EMAIL - Email for pipeline notifications (optional)
#
# =============================================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 G-FORGE RADIO - PIPELINE DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check required environment variables
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ ERROR: GITHUB_TOKEN environment variable not set"
  echo ""
  echo "Create a GitHub Personal Access Token with:"
  echo "  - repo (full control)"
  echo "  - admin:repo_hook (read & write)"
  echo ""
  echo "Then set it: export GITHUB_TOKEN=your_token_here"
  exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
  echo "❌ ERROR: GITHUB_REPO environment variable not set"
  echo "Example: export GITHUB_REPO=owner/repository"
  exit 1
fi

# Default values
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"

echo "📋 Configuration:"
echo "  Repository: $GITHUB_REPO"
echo "  Branch: $GITHUB_BRANCH"
echo "  Notifications: ${NOTIFICATION_EMAIL:-none}"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📦 Installing AWS CDK..."
npm install -g aws-cdk

echo ""
echo "📦 Installing pipeline dependencies..."
pnpm add -D constructs aws-cdk-lib

echo ""
echo "🏗️  Synthesizing CloudFormation template..."
cdk synth GForgePipelineStack \
  --context githubRepo="$GITHUB_REPO" \
  --context githubBranch="$GITHUB_BRANCH" \
  --context githubToken="$GITHUB_TOKEN" \
  --context notificationEmail="$NOTIFICATION_EMAIL"

echo ""
echo "🚀 Deploying pipeline..."
cdk deploy GForgePipelineStack \
  --context githubRepo="$GITHUB_REPO" \
  --context githubBranch="$GITHUB_BRANCH" \
  --context githubToken="$GITHUB_TOKEN" \
  --context notificationEmail="$NOTIFICATION_EMAIL" \
  --require-approval never

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PIPELINE DEPLOYED SUCCESSFULLY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 View pipeline:"
echo "   https://console.aws.amazon.com/codesuite/codepipeline/pipelines/gforge-radio-pipeline/view"
echo ""
echo "📧 Notifications will be sent to: ${NOTIFICATION_EMAIL:-none}"
echo ""
echo "🎯 Next steps:"
echo "   1. Push code to trigger pipeline"
echo "   2. Monitor build progress in AWS Console"
echo "   3. Approve production deployment when ready"
echo ""
