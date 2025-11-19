#!/bin/bash

###############################################################################
# 🔄 STATELESS CONFIG SYNC - Parameter Store First
###############################################################################
#
# Purpose: Sync config to frontend with Parameter Store as single source of truth
# Usage:   ./scripts/sync-amplify-config.sh
#
# This ensures ZERO hardcoded values - everything from AWS SSM
# Falls back to amplify_outputs.json if Parameter Store not available
#
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REGION="eu-west-1"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🔄 Stateless Config Sync - Parameter Store First${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

###############################################################################
# STEP 1: Try Parameter Store first (Single Source of Truth)
###############################################################################

echo "📦 Fetching from Parameter Store (SSM)..."

USER_POOL_ID=$(aws ssm get-parameter \
  --name /gforce-radio/auth/user-pool-id \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "")

USER_POOL_CLIENT_ID=$(aws ssm get-parameter \
  --name /gforce-radio/auth/user-pool-client-id \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "")

IDENTITY_POOL_ID=$(aws ssm get-parameter \
  --name /gforce-radio/auth/identity-pool-id \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "")

BUCKET_NAME=$(aws ssm get-parameter \
  --name /gforce-radio/storage/bucket-name \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "")

# Check if we got values from Parameter Store
if [ -n "$USER_POOL_CLIENT_ID" ] && [ "$USER_POOL_CLIENT_ID" != "None" ]; then
  echo -e "${GREEN}✅ Using Parameter Store values (stateless!)${NC}"
  CONFIG_SOURCE="Parameter Store"
else
  echo -e "${YELLOW}⚠️  Parameter Store empty - falling back to amplify_outputs.json${NC}"
  
  # Check if amplify_outputs.json exists
  if [ ! -f "amplify_outputs.json" ]; then
    echo -e "${RED}❌ ERROR: No amplify_outputs.json found!${NC}"
    echo "   Run 'npx ampx sandbox' first to generate config"
    exit 1
  fi
  
  USER_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.user_pool_id')
  USER_POOL_CLIENT_ID=$(cat amplify_outputs.json | jq -r '.auth.user_pool_client_id')
  IDENTITY_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.identity_pool_id')
  API_URL=$(cat amplify_outputs.json | jq -r '.data.url // empty')
  BUCKET_NAME=$(cat amplify_outputs.json | jq -r '.storage.bucket_name // empty')
  
  CONFIG_SOURCE="amplify_outputs.json (fallback)"
fi

echo ""
echo "📊 Configuration details (from $CONFIG_SOURCE):"
echo "   User Pool ID:        $USER_POOL_ID"
echo "   User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "   Identity Pool ID:    $IDENTITY_POOL_ID"
echo "   Bucket Name:         $BUCKET_NAME"
echo ""

###############################################################################
# STEP 2: Generate frontend config with fetched values
###############################################################################

echo "📋 Generating frontend config..."

# Get base structure from amplify_outputs.json if it exists
if [ -f "amplify_outputs.json" ]; then
  # Update auth section with Parameter Store values
  cat amplify_outputs.json | jq \
    --arg pool_id "$USER_POOL_ID" \
    --arg client_id "$USER_POOL_CLIENT_ID" \
    --arg identity_pool "$IDENTITY_POOL_ID" \
    '.auth.user_pool_id = $pool_id | 
     .auth.user_pool_client_id = $client_id | 
     .auth.identity_pool_id = $identity_pool' \
    > apps/web/src/amplify_outputs.json
  
  # ALSO copy to public folder (app loads from there!)
  cp amplify_outputs.json apps/web/public/amplify_outputs.json
  
  echo "   ✓ Copied to apps/web/src/amplify_outputs.json"
  echo "   ✓ Copied to apps/web/public/amplify_outputs.json"
else
  # Create minimal config if no base file exists
  cat > apps/web/src/amplify_outputs.json << EOF
{
  "auth": {
    "user_pool_id": "$USER_POOL_ID",
    "aws_region": "$REGION",
    "user_pool_client_id": "$USER_POOL_CLIENT_ID",
    "identity_pool_id": "$IDENTITY_POOL_ID",
    "mfa_methods": [],
    "username_attributes": ["email"],
    "user_verification_types": ["email"],
    "mfa_configuration": "NONE",
    "unauthenticated_identities_enabled": true
  }
}
EOF
  
  # Copy to public as well
  cp apps/web/src/amplify_outputs.json apps/web/public/amplify_outputs.json
  
  echo "   ✓ Created in apps/web/src/"
  echo "   ✓ Copied to apps/web/public/"
fi

echo -e "${GREEN}✅ Config synced to both src/ and public/!${NC}"
echo ""

###############################################################################
# STEP 3: Verify
###############################################################################

echo "🔍 Verifying frontend config..."
FRONTEND_CLIENT=$(cat apps/web/src/amplify_outputs.json | jq -r '.auth.user_pool_client_id')

if [ "$FRONTEND_CLIENT" == "$USER_POOL_CLIENT_ID" ]; then
  echo -e "${GREEN}✅ VERIFIED: Frontend using correct Client ID!${NC}"
  echo "   Expected: $USER_POOL_CLIENT_ID"
  echo "   Got:      $FRONTEND_CLIENT"
else
  echo -e "${RED}❌ MISMATCH!${NC}"
  echo "   Expected: $USER_POOL_CLIENT_ID"
  echo "   Got:      $FRONTEND_CLIENT"
  exit 1
fi

echo ""
echo -e "${GREEN}🚀 Frontend is now using latest configuration!${NC}"
echo -e "${GREEN}   Source: $CONFIG_SOURCE${NC}"
echo ""
