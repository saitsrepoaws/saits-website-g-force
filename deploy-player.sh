#!/bin/bash

# 🎵 SplashFM Player Deployment Script
# Versioned deployment to S3 + EC2 with rollback support

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLAYER_FILE="web/splashfm-player-with-delay.html"
EC2_HOST="radio-ec2"
EC2_PATH="/var/www/splashfm/index.html"
S3_BUCKET="amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt"
S3_BASE="web-player"

# Get version from git or argument
VERSION=${1:-$(git describe --tags --always 2>/dev/null || echo "dev")}
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🎵 SplashFM Player Deployment       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if player file exists
if [ ! -f "$PLAYER_FILE" ]; then
    echo -e "${RED}❌ Error: Player file not found: $PLAYER_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Deployment Info:${NC}"
echo -e "   Version:    ${GREEN}$VERSION${NC}"
echo -e "   Timestamp:  ${GREEN}$TIMESTAMP${NC}"
echo -e "   Source:     ${GREEN}$PLAYER_FILE${NC}"
echo -e "   S3 Bucket:  ${GREEN}s3://$S3_BUCKET/$S3_BASE${NC}"
echo -e "   EC2 Target: ${GREEN}$EC2_HOST:$EC2_PATH${NC}"
echo ""

# Step 1: Backup current production version from EC2
echo -e "${BLUE}📥 Step 1/5: Backing up current production version...${NC}"
ssh $EC2_HOST "cat $EC2_PATH" > /tmp/player-backup-$TIMESTAMP.html
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup saved: /tmp/player-backup-$TIMESTAMP.html${NC}"
    
    # Upload backup to S3
    aws s3 cp /tmp/player-backup-$TIMESTAMP.html \
        s3://$S3_BUCKET/$S3_BASE/backups/backup-$TIMESTAMP.html \
        --quiet
    echo -e "${GREEN}✅ Backup uploaded to S3${NC}"
else
    echo -e "${YELLOW}⚠️  No existing production file (first deploy?)${NC}"
fi
echo ""

# Step 2: Upload new version to S3 with version tag
echo -e "${BLUE}📤 Step 2/5: Uploading new version to S3...${NC}"

# Upload as versioned file
aws s3 cp $PLAYER_FILE \
    s3://$S3_BUCKET/$S3_BASE/versions/$VERSION-index.html \
    --quiet

# Upload as current
aws s3 cp $PLAYER_FILE \
    s3://$S3_BUCKET/$S3_BASE/current/index.html \
    --quiet

echo -e "${GREEN}✅ Uploaded to S3:${NC}"
echo -e "   s3://$S3_BUCKET/$S3_BASE/versions/$VERSION-index.html"
echo -e "   s3://$S3_BUCKET/$S3_BASE/current/index.html"
echo ""

# Step 3: Create metadata file
echo -e "${BLUE}📝 Step 3/5: Creating deployment metadata...${NC}"
cat > /tmp/deploy-meta-$TIMESTAMP.json << METAEOF
{
  "version": "$VERSION",
  "timestamp": "$TIMESTAMP",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployed_by": "$(whoami)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'N/A')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'N/A')",
  "source_file": "$PLAYER_FILE",
  "s3_path": "s3://$S3_BUCKET/$S3_BASE/versions/$VERSION-index.html",
  "ec2_path": "$EC2_HOST:$EC2_PATH"
}
METAEOF

aws s3 cp /tmp/deploy-meta-$TIMESTAMP.json \
    s3://$S3_BUCKET/$S3_BASE/metadata/$VERSION-meta.json \
    --quiet

echo -e "${GREEN}✅ Metadata uploaded${NC}"
echo ""

# Step 4: Deploy to EC2
echo -e "${BLUE}🚀 Step 4/5: Deploying to EC2...${NC}"

# Upload to EC2
scp $PLAYER_FILE $EC2_HOST:/tmp/player-new.html > /dev/null 2>&1

# Replace on EC2
ssh $EC2_HOST "sudo cp /tmp/player-new.html $EC2_PATH && sudo rm /tmp/player-new.html"

echo -e "${GREEN}✅ Deployed to EC2: $EC2_HOST:$EC2_PATH${NC}"
echo ""

# Step 5: Verify deployment
echo -e "${BLUE}🔍 Step 5/5: Verifying deployment...${NC}"

# Check if file is accessible via web
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Player accessible via HTTP (Status: $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Warning: HTTP returned status $HTTP_CODE${NC}"
fi

# Check file size
FILESIZE=$(ssh $EC2_HOST "stat -f%z $EC2_PATH 2>/dev/null || stat -c%s $EC2_PATH 2>/dev/null")
echo -e "${GREEN}✅ Deployed file size: $(numfmt --to=iec $FILESIZE 2>/dev/null || echo "$FILESIZE bytes")${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DEPLOYMENT SUCCESSFUL!            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Deployment Summary:${NC}"
echo -e "   Version:      ${GREEN}$VERSION${NC}"
echo -e "   Timestamp:    ${GREEN}$TIMESTAMP${NC}"
echo -e "   Live URL:     ${BLUE}https://splashfm.nl${NC}"
echo -e "   S3 Backup:    ${GREEN}s3://$S3_BUCKET/$S3_BASE/versions/$VERSION-index.html${NC}"
echo -e "   Local Backup: ${GREEN}/tmp/player-backup-$TIMESTAMP.html${NC}"
echo ""
echo -e "${YELLOW}🔄 Rollback:${NC}"
echo -e "   ./rollback-player.sh $VERSION"
echo ""
