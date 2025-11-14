#!/bin/bash

# 🔄 SplashFM Player Rollback Script
# Restore previous version from S3 backup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
EC2_HOST="radio-ec2"
EC2_PATH="/var/www/splashfm/index.html"
S3_BUCKET="amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt"
S3_BASE="web-player"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔄 SplashFM Player Rollback         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check for version argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}📋 Available versions:${NC}"
    echo ""
    aws s3 ls s3://$S3_BUCKET/$S3_BASE/versions/ | awk '{print "   " $4}'
    echo ""
    echo -e "${YELLOW}📋 Recent backups:${NC}"
    echo ""
    aws s3 ls s3://$S3_BUCKET/$S3_BASE/backups/ | tail -5 | awk '{print "   " $4}'
    echo ""
    echo -e "${RED}Usage: $0 <version>${NC}"
    echo -e "Example: $0 v0.0.2"
    echo -e "Or:      $0 backup-20251114-113500"
    exit 1
fi

VERSION=$1
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# Determine source path
if [[ $VERSION == backup-* ]]; then
    S3_SOURCE="s3://$S3_BUCKET/$S3_BASE/backups/$VERSION.html"
else
    S3_SOURCE="s3://$S3_BUCKET/$S3_BASE/versions/$VERSION-index.html"
fi

echo -e "${YELLOW}🔍 Checking if version exists...${NC}"

# Check if version exists in S3
if ! aws s3 ls $S3_SOURCE > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Version not found in S3${NC}"
    echo -e "   Looking for: $S3_SOURCE"
    echo ""
    echo -e "${YELLOW}Available versions:${NC}"
    aws s3 ls s3://$S3_BUCKET/$S3_BASE/versions/
    exit 1
fi

echo -e "${GREEN}✅ Version found: $S3_SOURCE${NC}"
echo ""

# Backup current version before rollback
echo -e "${BLUE}📥 Step 1/4: Backing up current version...${NC}"
ssh $EC2_HOST "cat $EC2_PATH" > /tmp/player-pre-rollback-$TIMESTAMP.html
aws s3 cp /tmp/player-pre-rollback-$TIMESTAMP.html \
    s3://$S3_BUCKET/$S3_BASE/backups/pre-rollback-$TIMESTAMP.html \
    --quiet
echo -e "${GREEN}✅ Current version backed up${NC}"
echo ""

# Download version from S3
echo -e "${BLUE}📥 Step 2/4: Downloading version from S3...${NC}"
aws s3 cp $S3_SOURCE /tmp/player-rollback.html --quiet
echo -e "${GREEN}✅ Downloaded from S3${NC}"
echo ""

# Deploy to EC2
echo -e "${BLUE}🚀 Step 3/4: Deploying to EC2...${NC}"
scp /tmp/player-rollback.html $EC2_HOST:/tmp/player-rollback.html > /dev/null 2>&1
ssh $EC2_HOST "sudo cp /tmp/player-rollback.html $EC2_PATH && sudo rm /tmp/player-rollback.html"
echo -e "${GREEN}✅ Deployed to EC2${NC}"
echo ""

# Verify
echo -e "${BLUE}🔍 Step 4/4: Verifying rollback...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Player accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}⚠️  Warning: HTTP status $HTTP_CODE${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ ROLLBACK SUCCESSFUL!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Rollback Summary:${NC}"
echo -e "   Restored:     ${GREEN}$VERSION${NC}"
echo -e "   Source:       ${GREEN}$S3_SOURCE${NC}"
echo -e "   Live URL:     ${BLUE}https://splashfm.nl${NC}"
echo -e "   Pre-rollback: ${GREEN}/tmp/player-pre-rollback-$TIMESTAMP.html${NC}"
echo ""
echo -e "${YELLOW}💡 To rollback this rollback:${NC}"
echo -e "   ./rollback-player.sh pre-rollback-$TIMESTAMP"
echo ""
