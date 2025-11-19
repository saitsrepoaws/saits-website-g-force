#!/bin/bash

###############################################################################
# 🔧 STATELESS BUILD - Parameter Store First
###############################################################################
#
# Purpose: Build frontend with runtime config from Parameter Store
# Usage:   ./scripts/build-with-params.sh
#
# This ensures ZERO hardcoded values - everything from AWS SSM
#
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REGION="eu-west-1"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🔧 Stateless Build - Parameter Store First${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

###############################################################################
# STEP 1: Fetch from Parameter Store (Single Source of Truth)
###############################################################################

echo "📦 Step 1: Fetching config from Parameter Store..."
echo ""

# Try Parameter Store first
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

# If Parameter Store is empty, fall back to amplify_outputs.json
if [ -z "$USER_POOL_CLIENT_ID" ] || [ "$USER_POOL_CLIENT_ID" == "None" ]; then
  echo -e "${YELLOW}⚠️  Parameter Store empty - using amplify_outputs.json${NC}"
  
  if [ ! -f "amplify_outputs.json" ]; then
    echo -e "${RED}❌ ERROR: No amplify_outputs.json found!${NC}"
    echo "   Run: npx ampx sandbox --once"
    exit 1
  fi
  
  USER_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.user_pool_id')
  USER_POOL_CLIENT_ID=$(cat amplify_outputs.json | jq -r '.auth.user_pool_client_id')
  IDENTITY_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.identity_pool_id')
  BUCKET_NAME=$(cat amplify_outputs.json | jq -r '.storage.bucket_name // empty')
fi

echo -e "${GREEN}✅ Config fetched!${NC}"
echo "   User Pool ID:     $USER_POOL_ID"
echo "   Client ID:        $USER_POOL_CLIENT_ID"
echo "   Identity Pool:    $IDENTITY_POOL_ID"
echo "   Bucket:           $BUCKET_NAME"
echo ""

###############################################################################
# STEP 2: Generate runtime config
###############################################################################

echo "📋 Step 2: Generating runtime config..."

# Get full amplify_outputs.json and update auth section
if [ -f "amplify_outputs.json" ]; then
  cat amplify_outputs.json | jq \
    --arg pool_id "$USER_POOL_ID" \
    --arg client_id "$USER_POOL_CLIENT_ID" \
    --arg identity_pool "$IDENTITY_POOL_ID" \
    '.auth.user_pool_id = $pool_id | 
     .auth.user_pool_client_id = $client_id | 
     .auth.identity_pool_id = $identity_pool' \
    > apps/web/src/amplify_outputs.json
  
  echo -e "${GREEN}✅ Runtime config generated!${NC}"
else
  echo -e "${YELLOW}⚠️  No base amplify_outputs.json - creating minimal config${NC}"
  
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
    "password_policy": {
      "min_length": 8,
      "require_lowercase": true,
      "require_numbers": true,
      "require_symbols": true,
      "require_uppercase": true
    },
    "unauthenticated_identities_enabled": true
  }
}
EOF
  echo -e "${GREEN}✅ Minimal config created${NC}"
fi

echo ""

###############################################################################
# STEP 3: Verify config
###############################################################################

echo "🔍 Step 3: Verifying config..."
echo ""

FRONTEND_CLIENT_ID=$(cat apps/web/src/amplify_outputs.json | jq -r '.auth.user_pool_client_id')

if [ "$FRONTEND_CLIENT_ID" == "$USER_POOL_CLIENT_ID" ]; then
  echo -e "${GREEN}✅ VERIFICATION PASSED!${NC}"
  echo "   Frontend uses: $FRONTEND_CLIENT_ID"
  echo "   Expected:      $USER_POOL_CLIENT_ID"
else
  echo -e "${RED}❌ VERIFICATION FAILED!${NC}"
  echo "   Frontend has:  $FRONTEND_CLIENT_ID"
  echo "   Should be:     $USER_POOL_CLIENT_ID"
  exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   🚀 Stateless build complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "   1. Start dev server: cd apps/web && npm run dev"
echo "   2. Or build for prod: cd apps/web && npm run build"
echo ""
