#!/bin/bash

###############################################################################
# 🔄 AMPLIFY CONFIG SYNC SCRIPT
###############################################################################
#
# Purpose: Sync amplify_outputs.json to frontend after deployment
# Usage:   ./scripts/sync-amplify-config.sh
#
# This ensures the frontend always uses the latest Auth/API configuration
# Prevents issues with old Cognito User Pool Client IDs
#
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🔄 Syncing Amplify Configuration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if amplify_outputs.json exists
if [ ! -f "amplify_outputs.json" ]; then
  echo -e "${YELLOW}⚠️  amplify_outputs.json not found!${NC}"
  echo "   Run 'npx ampx sandbox' first to generate config"
  exit 1
fi

# Copy to frontend
echo "📋 Copying amplify_outputs.json to frontend..."
cp amplify_outputs.json apps/web/src/

echo -e "${GREEN}✅ Config synced successfully!${NC}"
echo ""

# Show what was synced
echo "📊 Configuration details:"
USER_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.user_pool_id')
CLIENT_ID=$(cat amplify_outputs.json | jq -r '.auth.user_pool_client_id')
IDENTITY_POOL=$(cat amplify_outputs.json | jq -r '.auth.identity_pool_id')
API_URL=$(cat amplify_outputs.json | jq -r '.data.url')

echo "   User Pool ID:        $USER_POOL_ID"
echo "   User Pool Client ID: $CLIENT_ID"
echo "   Identity Pool ID:    $IDENTITY_POOL"
echo "   AppSync API URL:     $API_URL"
echo ""
echo -e "${GREEN}🚀 Frontend is now using latest configuration!${NC}"
echo ""
