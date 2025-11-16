#!/bin/bash

# =============================================================================
# G-FORGE RADIO - DEPLOY PIPELINE
# =============================================================================
#
# Standalone deployment script for CI/CD pipeline
#
# Usage:
#   ./scripts/deploy.sh
#
# Environment Variables Required:
#   GITHUB_OWNER - GitHub username/organization
#   GITHUB_REPO - Repository name
#   GITHUB_TOKEN - GitHub personal access token
#   NOTIFICATION_EMAIL - Email for notifications (optional)
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 G-FORGE RADIO - PIPELINE DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to codedeploy-pipeline folder
cd "$(dirname "$0")/.."

# Check required environment variables
MISSING_VARS=()

if [ -z "$GITHUB_OWNER" ]; then
  MISSING_VARS+=("GITHUB_OWNER")
fi

if [ -z "$GITHUB_REPO" ]; then
  MISSING_VARS+=("GITHUB_REPO")
fi

if [ -z "$GITHUB_TOKEN" ]; then
  MISSING_VARS+=("GITHUB_TOKEN")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${RED}❌ ERROR: Missing required environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Set them with:"
  echo "  export GITHUB_OWNER=your-username"
  echo "  export GITHUB_REPO=your-repository"
  echo "  export GITHUB_TOKEN=ghp_your_token_here"
  echo ""
  echo "To create a GitHub token:"
  echo "  1. Go to https://github.com/settings/tokens"
  echo "  2. Click 'Generate new token (classic)'"
  echo "  3. Select scopes: repo, admin:repo_hook"
  echo "  4. Copy the token"
  exit 1
fi

# Default values
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
AWS_REGION="${AWS_REGION:-eu-west-1}"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Repository: $GITHUB_OWNER/$GITHUB_REPO"
echo "  Branch: $GITHUB_BRANCH"
echo "  Region: $AWS_REGION"
echo "  Notifications: ${NOTIFICATION_EMAIL:-none}"
echo ""

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
aws sts get-caller-identity > /dev/null 2>&1 || {
  echo -e "${RED}❌ AWS credentials not configured${NC}"
  echo "Run: aws configure"
  exit 1
}
echo -e "${GREEN}✅ AWS credentials OK${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  pnpm install
else
  echo "Dependencies already installed"
fi
echo ""

# Bootstrap CDK (if needed)
echo -e "${BLUE}🥾 Checking CDK bootstrap...${NC}"
CDK_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
CDK_REGION=$AWS_REGION

aws cloudformation describe-stacks --stack-name CDKToolkit --region $CDK_REGION > /dev/null 2>&1 || {
  echo -e "${YELLOW}⚠️  CDK not bootstrapped, bootstrapping now...${NC}"
  pnpm run bootstrap
}
echo -e "${GREEN}✅ CDK bootstrap OK${NC}"
echo ""

# Synthesize CloudFormation template
echo -e "${BLUE}🏗️  Synthesizing CloudFormation template...${NC}"
pnpm run synth \
  --context githubOwner="$GITHUB_OWNER" \
  --context githubRepo="$GITHUB_REPO" \
  --context githubBranch="$GITHUB_BRANCH" \
  --context githubToken="$GITHUB_TOKEN" \
  --context notificationEmail="$NOTIFICATION_EMAIL"

echo -e "${GREEN}✅ Synthesis complete${NC}"
echo ""

# Show diff (if stack exists)
echo -e "${BLUE}📊 Checking for changes...${NC}"
pnpm run diff \
  --context githubOwner="$GITHUB_OWNER" \
  --context githubRepo="$GITHUB_REPO" \
  --context githubBranch="$GITHUB_BRANCH" \
  --context githubToken="$GITHUB_TOKEN" \
  --context notificationEmail="$NOTIFICATION_EMAIL" || true
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  Ready to deploy pipeline${NC}"
echo ""
read -p "Continue with deployment? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}🚀 Deploying pipeline...${NC}"
echo ""

pnpm run deploy:pipeline \
  --context githubOwner="$GITHUB_OWNER" \
  --context githubRepo="$GITHUB_REPO" \
  --context githubBranch="$GITHUB_BRANCH" \
  --context githubToken="$GITHUB_TOKEN" \
  --context notificationEmail="$NOTIFICATION_EMAIL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ PIPELINE DEPLOYED SUCCESSFULLY!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 View pipeline:"
echo "   https://$AWS_REGION.console.aws.amazon.com/codesuite/codepipeline/pipelines/gforge-radio-pipeline/view"
echo ""
echo "📧 Notifications: ${NOTIFICATION_EMAIL:-none}"
echo ""
echo "🎯 Next steps:"
echo "   1. Push code to $GITHUB_OWNER/$GITHUB_REPO ($GITHUB_BRANCH branch)"
echo "   2. Pipeline will automatically trigger"
echo "   3. Monitor progress in AWS Console"
echo "   4. Approve production deployment when ready"
echo ""
