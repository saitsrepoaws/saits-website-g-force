#!/bin/bash

# 📋 SplashFM Player Version List
# Show all available player versions in S3

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
S3_BUCKET="amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt"
S3_BASE="web-player"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📋 Player Versions & Backups         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Current version
echo -e "${YELLOW}📌 CURRENT VERSION:${NC}"
echo ""
CURRENT_SIZE=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/current/index.html 2>/dev/null | awk '{print $3}')
CURRENT_DATE=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/current/index.html 2>/dev/null | awk '{print $1, $2}')
if [ -n "$CURRENT_SIZE" ]; then
    echo -e "   📄 index.html"
    echo -e "   📅 $CURRENT_DATE"
    echo -e "   📦 $(numfmt --to=iec $CURRENT_SIZE 2>/dev/null || echo "$CURRENT_SIZE bytes")"
else
    echo -e "   ${YELLOW}⚠️  No current version found${NC}"
fi
echo ""

# Versioned releases
echo -e "${YELLOW}🏷️  TAGGED VERSIONS:${NC}"
echo ""
VERSIONS=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/versions/ 2>/dev/null)
if [ -n "$VERSIONS" ]; then
    echo "$VERSIONS" | while read -r line; do
        DATE=$(echo $line | awk '{print $1, $2}')
        SIZE=$(echo $line | awk '{print $3}')
        FILE=$(echo $line | awk '{print $4}')
        VERSION=$(echo $FILE | sed 's/-index.html//')
        SIZE_HUMAN=$(numfmt --to=iec $SIZE 2>/dev/null || echo "$SIZE bytes")
        echo -e "   ${GREEN}$VERSION${NC}"
        echo -e "   📅 $DATE | 📦 $SIZE_HUMAN"
        echo ""
    done
else
    echo -e "   ${YELLOW}⚠️  No versioned releases found${NC}"
    echo ""
fi

# Recent backups
echo -e "${YELLOW}💾 RECENT BACKUPS (last 10):${NC}"
echo ""
BACKUPS=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/backups/ 2>/dev/null | tail -10)
if [ -n "$BACKUPS" ]; then
    echo "$BACKUPS" | while read -r line; do
        DATE=$(echo $line | awk '{print $1, $2}')
        SIZE=$(echo $line | awk '{print $3}')
        FILE=$(echo $line | awk '{print $4}')
        BACKUP_ID=$(echo $FILE | sed 's/.html//')
        SIZE_HUMAN=$(numfmt --to=iec $SIZE 2>/dev/null || echo "$SIZE bytes")
        echo -e "   ${BLUE}$BACKUP_ID${NC}"
        echo -e "   📅 $DATE | 📦 $SIZE_HUMAN"
        echo ""
    done
else
    echo -e "   ${YELLOW}⚠️  No backups found${NC}"
    echo ""
fi

# Deployment metadata
echo -e "${YELLOW}📊 DEPLOYMENT METADATA:${NC}"
echo ""
METADATA=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/metadata/ 2>/dev/null | tail -5)
if [ -n "$METADATA" ]; then
    echo "$METADATA" | while read -r line; do
        FILE=$(echo $line | awk '{print $4}')
        VERSION=$(echo $FILE | sed 's/-meta.json//')
        echo -e "   ${GREEN}$VERSION${NC}"
        
        # Download and show metadata
        aws s3 cp s3://$S3_BUCKET/$S3_BASE/metadata/$FILE - 2>/dev/null | jq -r '
          "   📅 Deployed: \(.deployed_at)",
          "   👤 By: \(.deployed_by)",
          "   🔀 Branch: \(.git_branch)",
          "   📝 Commit: \(.git_commit[0:7])"
        ' 2>/dev/null || echo "   (metadata unavailable)"
        echo ""
    done
else
    echo -e "   ${YELLOW}⚠️  No metadata found${NC}"
    echo ""
fi

# Usage instructions
echo -e "${YELLOW}💡 USAGE:${NC}"
echo ""
echo -e "   Deploy new version:"
echo -e "   ${GREEN}./deploy-player.sh v0.0.3${NC}"
echo ""
echo -e "   Rollback to version:"
echo -e "   ${GREEN}./rollback-player.sh v0.0.2${NC}"
echo ""
echo -e "   Rollback to backup:"
echo -e "   ${GREEN}./rollback-player.sh backup-20251114-113500${NC}"
echo ""
