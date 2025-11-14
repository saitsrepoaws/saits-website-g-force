#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PLAYER DEPLOY SCRIPT (Met Versie Controle)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Safe deployment of SplashFM player to nginx
# Usage: ./player-deploy.sh <local-html-file> [version-tag]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PLAYER_PATH="/var/www/splashfm/index.html"
LOCAL_FILE="$1"
VERSION_TAG="${2:-manual-deploy}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 PLAYER DEPLOYMENT UTILITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Validate input
if [ -z "$LOCAL_FILE" ]; then
    echo "${RED}❌ Error: No file specified${NC}"
    echo ""
    echo "Usage: $0 <local-html-file> [version-tag]"
    echo ""
    echo "Example:"
    echo "  $0 player-v2.html fast-start-fix"
    exit 1
fi

if [ ! -f "$LOCAL_FILE" ]; then
    echo "${RED}❌ Error: File not found: $LOCAL_FILE${NC}"
    exit 1
fi

echo "📋 Deployment Details:"
echo "   Local file:  $LOCAL_FILE"
echo "   Target:      $PLAYER_PATH (radio-ec2)"
echo "   Version:     $VERSION_TAG"
echo "   Timestamp:   $TIMESTAMP"
echo ""

# Check syntax (basic HTML validation)
echo "🔍 Validating HTML syntax..."
if ! grep -q '<html' "$LOCAL_FILE"; then
    echo "${YELLOW}⚠️  Warning: No <html> tag found${NC}"
fi
if ! grep -q '</html>' "$LOCAL_FILE"; then
    echo "${YELLOW}⚠️  Warning: No </html> closing tag found${NC}"
fi
if grep -q '<audio' "$LOCAL_FILE"; then
    echo "   ✅ Audio element found"
fi
echo ""

# Confirm deployment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "${YELLOW}⚠️  Ready to deploy to PRODUCTION${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  1. Backup current production player"
echo "  2. Upload new version to EC2"
echo "  3. Set proper permissions"
echo ""
echo "Continue? (yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "${RED}❌ Deployment cancelled${NC}"
    exit 0
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Step 1: Backup current version
echo "📦 Step 1/4: Creating backup..."
BACKUP_NAME="index.html.backup-${VERSION_TAG}-${TIMESTAMP}"
ssh radio-ec2 "sudo cp $PLAYER_PATH /var/www/splashfm/$BACKUP_NAME"
echo "   ${GREEN}✅ Backup: $BACKUP_NAME${NC}"
echo ""

# Step 2: Upload new version
echo "⬆️  Step 2/4: Uploading new player..."
scp "$LOCAL_FILE" radio-ec2:/tmp/index.html.new
echo "   ${GREEN}✅ Uploaded to temporary location${NC}"
echo ""

# Step 3: Move to production
echo "🔄 Step 3/4: Moving to production..."
ssh radio-ec2 "sudo mv /tmp/index.html.new $PLAYER_PATH"
ssh radio-ec2 "sudo chown www-data:www-data $PLAYER_PATH"
ssh radio-ec2 "sudo chmod 644 $PLAYER_PATH"
echo "   ${GREEN}✅ Player deployed${NC}"
echo ""

# Step 4: Verify
echo "✅ Step 4/4: Verifying deployment..."
SIZE=$(ssh radio-ec2 "stat -f%z $PLAYER_PATH 2>/dev/null || stat -c%s $PLAYER_PATH")
echo "   File size: $SIZE bytes"

# Test HTTP access
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/ || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ${GREEN}✅ HTTP test: OK (200)${NC}"
else
    echo "   ${RED}❌ HTTP test: FAILED ($HTTP_CODE)${NC}"
    echo ""
    echo "${RED}Rolling back...${NC}"
    ssh radio-ec2 "sudo cp /var/www/splashfm/$BACKUP_NAME $PLAYER_PATH"
    echo "${RED}❌ Deployment failed - rolled back to previous version${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "${GREEN}✅ DEPLOYMENT SUCCESSFUL!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Player URL: http://46.137.184.91/"
echo "📦 Backup:     $BACKUP_NAME"
echo "🏷️  Version:    $VERSION_TAG-$TIMESTAMP"
echo ""
echo "📝 To rollback if needed:"
echo "   ./player-restore.sh /var/www/splashfm/$BACKUP_NAME"
echo ""
echo "🎉 Deployment complete! Test the player now."
echo ""
