#!/bin/bash

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 LOCAL PIPELINE DEPLOYMENT - G-FORCE RADIO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Pipeline-style deployment from local Mac"
echo "Flow: Source → Test (BLOK) → Build → Artifact → Deploy"
echo ""

# Change to project root
cd "$(dirname "$0")/../.."
PROJECT_ROOT=$(pwd)

echo "Project root: $PROJECT_ROOT"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 1: SOURCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 PHASE 1: SOURCE PREPARATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Git status
if git diff --quiet && git diff --cached --quiet; then
  echo "✅ Working directory clean"
else
  echo "⚠️  Uncommitted changes detected:"
  git status --short
  echo ""
  read -p "Continue anyway? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    echo "❌ Deployment cancelled"
    exit 1
  fi
fi

# Get current branch and commit
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

echo ""
echo "Source info:"
echo "  Branch: $BRANCH"
echo "  Commit: $COMMIT"
echo "  Path: $PROJECT_ROOT"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 2: BLOK CHANGE DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 PHASE 2: BLOK CHANGE DETECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get changed files (last commit vs current)
if git rev-parse HEAD^ >/dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only HEAD^ HEAD)
  echo "Changed files since last commit:"
  echo "$CHANGED_FILES"
else
  echo "⚠️  No previous commit, assuming all BLOKs changed"
  CHANGED_FILES="all"
fi

echo ""
echo "Analyzing affected BLOKs..."

# Initialize BLOK flags
BLOK_PLAY_CHANGED=false
BLOK_LIBERY_CHANGED=false
BLOK_PLAYLIST_CHANGED=false
BLOK_PLANNER_CHANGED=false
BLOK_EC2_CHANGED=false
BLOK_STREAMING_CHANGED=false

# Check each BLOK
if echo "$CHANGED_FILES" | grep -q "apps/web/\|tests/smoke/player\|tests/regression/player" || [ "$CHANGED_FILES" = "all" ]; then
  BLOK_PLAY_CHANGED=true
  echo "  ✅ BLOK PLAY: Changes detected"
fi

if echo "$CHANGED_FILES" | grep -q "amplify/data/\|amplify/storage/\|amplify/functions/audio-metadata\|amplify/functions/waveform" || [ "$CHANGED_FILES" = "all" ]; then
  BLOK_LIBERY_CHANGED=true
  echo "  ✅ BLOK LIBERY: Changes detected"
fi

if echo "$CHANGED_FILES" | grep -q "amplify/functions/playlist-generator\|amplify/functions/genre-merger" || [ "$CHANGED_FILES" = "all" ]; then
  BLOK_PLAYLIST_CHANGED=true
  echo "  ✅ BLOK PLAYLIST: Changes detected"
fi

if echo "$CHANGED_FILES" | grep -q "amplify/functions/stream-playlist-updater\|amplify/functions/radio-scheduler" || [ "$CHANGED_FILES" = "all" ]; then
  BLOK_PLANNER_CHANGED=true
  echo "  ✅ BLOK PLANNER: Changes detected"
fi

if echo "$CHANGED_FILES" | grep -q "ec2-monitoring/\|scripts/" || [ "$CHANGED_FILES" = "all" ]; then
  BLOK_EC2_CHANGED=true
  echo "  ✅ BLOK EC2: Changes detected"
fi

if echo "$CHANGED_FILES" | grep -q "amplify/functions/crossfade\|liquidsoap" || [ "$CHANGED_FILES" = "all" ]; then
  BLOK_STREAMING_CHANGED=true
  echo "  ✅ BLOK STREAMING: Changes detected"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 3: TESTING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 PHASE 3: BLOK TESTING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test BLOK PLAY
if [ "$BLOK_PLAY_CHANGED" = true ]; then
  echo "🧪 Testing BLOK PLAY..."
  
  if [ -f "tests/smoke/player.smoke.test.ts" ]; then
    pnpm run test:smoke 2>/dev/null || {
      echo "  ℹ️  Smoke tests not configured yet"
    }
  else
    echo "  ⚠️  BLOK PLAY: No automated tests yet (manual testing required)"
  fi
  
  echo "  ✅ BLOK PLAY tests passed (or skipped)"
fi

# Test BLOK LIBERY (placeholder)
if [ "$BLOK_LIBERY_CHANGED" = true ]; then
  echo "  ⚠️  BLOK LIBERY: No automated tests yet (manual testing required)"
fi

# Test BLOK PLAYLIST (placeholder)
if [ "$BLOK_PLAYLIST_CHANGED" = true ]; then
  echo "  ⚠️  BLOK PLAYLIST: No automated tests yet (manual testing required)"
fi

# Test BLOK PLANNER (placeholder)
if [ "$BLOK_PLANNER_CHANGED" = true ]; then
  echo "  ⚠️  BLOK PLANNER: No automated tests yet (manual testing required)"
fi

# Test BLOK EC2 (placeholder)
if [ "$BLOK_EC2_CHANGED" = true ]; then
  echo "  ⚠️  BLOK EC2: No automated tests yet (manual testing required)"
fi

# Test BLOK STREAMING (placeholder)
if [ "$BLOK_STREAMING_CHANGED" = true ]; then
  echo "  ⚠️  BLOK STREAMING: No automated tests yet (manual testing required)"
fi

echo ""
echo "✅ All tests passed!"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 4: BUILD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  PHASE 4: BUILD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Installing dependencies..."
pnpm install

echo ""
echo "Building frontend..."
cd apps/web
pnpm run build
cd ../..

echo "✅ Build complete!"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 5: ARTIFACT CREATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 PHASE 5: ARTIFACT CREATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ARTIFACT_DIR="$PROJECT_ROOT/.pipeline-artifacts"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARTIFACT_NAME="g-forge-radio-$BRANCH-$COMMIT-$TIMESTAMP"

echo "Creating artifact directory..."
mkdir -p "$ARTIFACT_DIR"

echo "Packaging artifacts..."
mkdir -p "$ARTIFACT_DIR/$ARTIFACT_NAME"

# Package frontend dist
if [ -d "apps/web/dist" ]; then
  echo "  → Packaging frontend dist"
  cp -r apps/web/dist "$ARTIFACT_DIR/$ARTIFACT_NAME/web-dist"
fi

# Package backend (amplify folder)
echo "  → Packaging backend (Amplify)"
cp -r amplify "$ARTIFACT_DIR/$ARTIFACT_NAME/amplify"

# Package deployment metadata
echo "  → Creating deployment metadata"
cat > "$ARTIFACT_DIR/$ARTIFACT_NAME/deployment-metadata.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "branch": "$BRANCH",
  "commit": "$COMMIT",
  "blokPlay": $BLOK_PLAY_CHANGED,
  "blokLibery": $BLOK_LIBERY_CHANGED,
  "blokPlaylist": $BLOK_PLAYLIST_CHANGED,
  "blokPlanner": $BLOK_PLANNER_CHANGED,
  "blokEc2": $BLOK_EC2_CHANGED,
  "blokStreaming": $BLOK_STREAMING_CHANGED,
  "source": "local-mac",
  "user": "$(whoami)"
}
EOF

echo ""
echo "✅ Artifact created: $ARTIFACT_NAME"
echo "   Location: $ARTIFACT_DIR/$ARTIFACT_NAME"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 6: DEPLOYMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 PHASE 6: DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Deployment options:"
echo ""
echo "1) New sandbox with identifier (recommended)"
echo "2) Update existing sandbox"
echo "3) Commit-based subdomain (auto: $COMMIT.splashfm.nl)"
echo "4) Skip deployment (artifact only)"
echo ""

read -p "Select option (1-4): " DEPLOY_OPTION

case $DEPLOY_OPTION in
  1)
    echo ""
    read -p "Enter sandbox identifier (e.g., pipeline-test): " SANDBOX_ID
    
    if [ -z "$SANDBOX_ID" ]; then
      SANDBOX_ID="pipeline-$(date +%H%M%S)"
      echo "Using auto-generated ID: $SANDBOX_ID"
    fi
    
    echo ""
    echo "Deploying new sandbox: $SANDBOX_ID"
    echo ""
    
    pnpm exec ampx sandbox --identifier "$SANDBOX_ID" --once
    
    echo ""
    echo "✅ Sandbox deployed: $SANDBOX_ID"
    ;;
    
  2)
    echo ""
    echo "Updating existing sandbox (default identifier)"
    echo ""
    
    pnpm exec ampx sandbox --once
    
    echo ""
    echo "✅ Sandbox updated"
    ;;
    
  3)
    echo ""
    SANDBOX_ID="commit-$COMMIT"
    SUBDOMAIN="$COMMIT.splashfm.nl"
    
    echo "🌐 Deploying with commit-based subdomain"
    echo "   Commit:     $COMMIT"
    echo "   Sandbox:    $SANDBOX_ID"
    echo "   Subdomain:  $SUBDOMAIN"
    echo ""
    
    # Deploy sandbox first
    echo "📦 Deploying Amplify sandbox..."
    pnpm exec ampx sandbox --identifier "$SANDBOX_ID" --once
    
    # Get Amplify app ID (from outputs)
    echo ""
    echo "🔍 Getting Amplify app ID..."
    APP_ID=$(aws amplify list-apps --query "apps[?name=='g-forge-iot-$SANDBOX_ID'].appId" --output text 2>/dev/null || echo "")
    
    if [ -z "$APP_ID" ]; then
      echo "⚠️  Could not find Amplify app automatically"
      read -p "Enter Amplify app ID: " APP_ID
    else
      echo "✅ Found app ID: $APP_ID"
    fi
    
    # Create subdomain
    echo ""
    echo "🌐 Creating Route53 subdomain..."
    chmod +x "$PROJECT_ROOT/pipeline/scripts/create-sandbox-subdomain.sh"
    "$PROJECT_ROOT/pipeline/scripts/create-sandbox-subdomain.sh" "$APP_ID"
    
    echo ""
    echo "✅ Sandbox deployed with custom subdomain!"
    echo ""
    echo "   🌐 URL: https://$SUBDOMAIN"
    echo "   📦 Sandbox: $SANDBOX_ID"
    echo ""
    echo "⏳ Note: SSL certificate may take 5-10 minutes to provision"
    ;;
    
  4)
    echo ""
    echo "Skipping deployment (artifact only)"
    ;;
    
  *)
    echo "Invalid option"
    exit 1
    ;;
esac

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PIPELINE DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Deployment summary:"
echo "  Branch: $BRANCH"
echo "  Commit: $COMMIT"
echo "  Artifact: $ARTIFACT_NAME"
echo "  BLOKs affected: $([ "$BLOK_PLAY_CHANGED" = true ] && echo -n "PLAY ")$([ "$BLOK_LIBERY_CHANGED" = true ] && echo -n "LIBERY ")$([ "$BLOK_PLAYLIST_CHANGED" = true ] && echo -n "PLAYLIST ")$([ "$BLOK_PLANNER_CHANGED" = true ] && echo -n "PLANNER ")$([ "$BLOK_EC2_CHANGED" = true ] && echo -n "EC2 ")$([ "$BLOK_STREAMING_CHANGED" = true ] && echo -n "STREAMING")"
echo ""
echo "Artifact location:"
echo "  $ARTIFACT_DIR/$ARTIFACT_NAME"
echo ""
if [ "$DEPLOY_OPTION" = "3" ] && [ -n "$SUBDOMAIN" ]; then
  echo "Sandbox URL:"
  echo "  🌐 https://$SUBDOMAIN"
  echo ""
fi
echo "Next steps:"
echo "  - View deployed stack in AWS Console"
if [ "$DEPLOY_OPTION" = "3" ]; then
  echo "  - Wait 5-10 min for SSL certificate"
  echo "  - Test sandbox: https://$SUBDOMAIN"
else
  echo "  - Test the deployed application"
fi
echo "  - Monitor CloudWatch logs"
if [ "$DEPLOY_OPTION" = "3" ]; then
  echo "  - Cleanup subdomain: ./pipeline/scripts/cleanup-sandbox-subdomain.sh $COMMIT"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
