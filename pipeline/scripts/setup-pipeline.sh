#!/bin/bash

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 G-FORCE RADIO - PIPELINE SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script will setup a CI/CD pipeline for G-FORCE Radio"
echo ""

# Change to project root
cd "$(dirname "$0")/../.."

# Check prerequisites
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 CHECKING PREREQUISITES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not found. Please install: https://aws.amazon.com/cli/"
  exit 1
fi
echo "✅ AWS CLI installed"

# Check Git
if ! command -v git &> /dev/null; then
  echo "❌ Git not found. Please install Git"
  exit 1
fi
echo "✅ Git installed"

# Check if in Git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Not a Git repository. Run 'git init' first"
  exit 1
fi
echo "✅ Git repository detected"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+"
  exit 1
fi
echo "✅ Node.js installed ($(node --version))"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm not found. Installing..."
  npm install -g pnpm
fi
echo "✅ pnpm installed ($(pnpm --version))"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 PIPELINE TYPE SELECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Select pipeline type:"
echo ""
echo "1) AWS CodePipeline + CodeBuild (Full AWS native)"
echo "   - Best for: Production deployments"
echo "   - Cost: ~$8/month"
echo "   - Features: Advanced (approvals, parallel stages)"
echo ""
echo "2) AWS Amplify Hosting (Easiest)"
echo "   - Best for: Quick setup, automatic deployments"
echo "   - Cost: ~$3/month"
echo "   - Features: Auto CI/CD, built-in previews"
echo ""
echo "3) Manual (Just setup Git, no automation yet)"
echo "   - Best for: Local development, later automation"
echo "   - Cost: $0"
echo "   - Features: None (manual deployment)"
echo ""

read -p "Enter choice (1-3): " PIPELINE_TYPE

case $PIPELINE_TYPE in
  1)
    PIPELINE_NAME="codepipeline"
    echo ""
    echo "Selected: AWS CodePipeline + CodeBuild"
    ;;
  2)
    PIPELINE_NAME="amplify"
    echo ""
    echo "Selected: AWS Amplify Hosting"
    ;;
  3)
    PIPELINE_NAME="manual"
    echo ""
    echo "Selected: Manual (No automation)"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 GIT CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Git remote is configured
if ! git remote get-url origin &> /dev/null; then
  echo "⚠️  No Git remote configured"
  echo ""
  echo "Do you want to configure a Git remote now?"
  echo "1) GitHub"
  echo "2) AWS CodeCommit"
  echo "3) Skip (configure later)"
  echo ""
  read -p "Enter choice (1-3): " GIT_CHOICE
  
  case $GIT_CHOICE in
    1)
      read -p "Enter GitHub repository URL (e.g., https://github.com/user/repo.git): " GIT_URL
      git remote add origin "$GIT_URL"
      echo "✅ GitHub remote added"
      ;;
    2)
      read -p "Enter CodeCommit repository name: " REPO_NAME
      AWS_REGION=$(aws configure get region)
      GIT_URL="https://git-codecommit.$AWS_REGION.amazonaws.com/v1/repos/$REPO_NAME"
      git remote add origin "$GIT_URL"
      echo "✅ CodeCommit remote added"
      ;;
    3)
      echo "⚠️  Skipped Git remote configuration"
      ;;
  esac
else
  GIT_URL=$(git remote get-url origin)
  echo "✅ Git remote already configured: $GIT_URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 INSTALLING DEPENDENCIES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm install

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DEPLOYING PIPELINE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

case $PIPELINE_NAME in
  codepipeline)
    echo "Setting up CodePipeline..."
    echo ""
    echo "⚠️  CodePipeline setup requires CloudFormation stack deployment"
    echo "This will create:"
    echo "  - CodePipeline pipeline"
    echo "  - CodeBuild project"
    echo "  - S3 bucket for artifacts"
    echo "  - IAM roles and policies"
    echo ""
    read -p "Continue? (y/n): " CONFIRM
    
    if [ "$CONFIRM" != "y" ]; then
      echo "❌ Setup cancelled"
      exit 0
    fi
    
    # Deploy CloudFormation stack
    STACK_NAME="g-forge-radio-pipeline"
    echo ""
    echo "Deploying CloudFormation stack: $STACK_NAME"
    
    aws cloudformation deploy \
      --stack-name "$STACK_NAME" \
      --template-file pipeline/templates/codepipeline.yml \
      --parameter-overrides \
        GitRepositoryUrl="$GIT_URL" \
        GitBranch="main" \
      --capabilities CAPABILITY_IAM \
      --region eu-west-1
    
    echo ""
    echo "✅ CodePipeline deployed!"
    echo ""
    echo "View pipeline: https://eu-west-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/$STACK_NAME/view"
    ;;
    
  amplify)
    echo "Setting up Amplify Hosting..."
    echo ""
    echo "⚠️  Amplify setup requires:"
    echo "  1. Git repository pushed to remote"
    echo "  2. AWS Amplify app creation"
    echo "  3. Branch connection"
    echo ""
    read -p "Have you pushed code to Git remote? (y/n): " GIT_PUSHED
    
    if [ "$GIT_PUSHED" != "y" ]; then
      echo ""
      echo "Please push code first:"
      echo "  git add ."
      echo "  git commit -m 'Initial commit'"
      echo "  git push -u origin main"
      echo ""
      exit 0
    fi
    
    echo ""
    echo "Creating Amplify app..."
    
    APP_NAME="g-forge-radio"
    
    # Create Amplify app
    APP_ID=$(aws amplify create-app \
      --name "$APP_NAME" \
      --repository "$GIT_URL" \
      --platform WEB \
      --build-spec file://pipeline/configs/amplify.yml \
      --region eu-west-1 \
      --query 'app.appId' \
      --output text)
    
    echo "✅ Amplify app created: $APP_ID"
    
    # Create branch
    echo ""
    echo "Connecting branch: main"
    
    aws amplify create-branch \
      --app-id "$APP_ID" \
      --branch-name main \
      --enable-auto-build \
      --region eu-west-1
    
    echo "✅ Branch connected"
    
    echo ""
    echo "✅ Amplify Hosting deployed!"
    echo ""
    echo "View app: https://eu-west-1.console.aws.amazon.com/amplify/home?region=eu-west-1#/$APP_ID"
    echo ""
    echo "To trigger first build:"
    echo "  git push origin main"
    ;;
    
  manual)
    echo "Manual setup selected. No automation configured."
    echo ""
    echo "Your pipeline configs are ready in pipeline/ folder"
    echo ""
    echo "To deploy later:"
    echo "  - CodePipeline: Run this script again and select option 1"
    echo "  - Amplify: Run this script again and select option 2"
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 PIPELINE SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Pipeline type: $PIPELINE_NAME"
echo "Project root: $(pwd)"
echo "Pipeline folder: $(pwd)/pipeline"
echo ""
echo "📚 Documentation:"
echo "  - README: pipeline/README.md"
echo "  - Setup guide: pipeline/docs/SETUP.md"
echo "  - BLOK strategy: pipeline/docs/BLOK_STRATEGY.md"
echo ""
echo "🚀 Next steps:"

case $PIPELINE_NAME in
  codepipeline)
    echo "  1. Push code to Git: git push origin main"
    echo "  2. Pipeline will automatically start"
    echo "  3. Monitor in AWS Console"
    ;;
  amplify)
    echo "  1. Push code to Git: git push origin main"
    echo "  2. Amplify will automatically build & deploy"
    echo "  3. View in Amplify Console"
    ;;
  manual)
    echo "  1. Setup Git remote (if not done)"
    echo "  2. Run setup script again to configure automation"
    echo "  3. Or deploy manually with: pnpm exec ampx sandbox"
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
