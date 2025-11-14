#!/bin/bash

# 📋 List Server Config Backups
# Show all available backups in S3

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
S3_BUCKET="amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr"
S3_BASE="server-configs"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📋 Server Config Backups (S3)       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📌 Latest Backup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}📌 LATEST BACKUP:${NC}"
echo ""

if aws s3 ls s3://$S3_BUCKET/$S3_BASE/latest/ > /dev/null 2>&1; then
    LATEST_DATE=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/latest/backup-meta.json 2>/dev/null | awk '{print $1, $2}')
    LATEST_FILES=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/latest/ | wc -l)
    
    echo -e "   📄 latest/"
    echo -e "   📅 $LATEST_DATE"
    echo -e "   📦 $LATEST_FILES files"
    
    # Show metadata if available
    if aws s3 ls s3://$S3_BUCKET/$S3_BASE/latest/backup-meta.json > /dev/null 2>&1; then
        aws s3 cp s3://$S3_BUCKET/$S3_BASE/latest/backup-meta.json - 2>/dev/null | jq -r '
          "   🔖 Version: \(.version)",
          "   📅 Date: \(.backup_date)",
          "   👤 By: \(.backed_up_by)"
        ' 2>/dev/null || echo "   (metadata unavailable)"
    fi
else
    echo -e "   ${YELLOW}⚠️  No latest backup found${NC}"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📦 All Backups
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}📦 ALL BACKUPS:${NC}"
echo ""

BACKUPS=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/ 2>/dev/null | grep PRE | awk '{print $2}' | sed 's/\///' | grep -v "^latest$" || true)

if [ -n "$BACKUPS" ]; then
    echo "$BACKUPS" | while read -r backup; do
        FILES=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/$backup/ 2>/dev/null | wc -l)
        DATE=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/$backup/backup-meta.json 2>/dev/null | awk '{print $1, $2}')
        
        echo -e "   ${GREEN}$backup${NC}"
        echo -e "   📅 $DATE | 📦 $FILES files"
        
        # Show metadata summary if available
        if aws s3 ls s3://$S3_BUCKET/$S3_BASE/$backup/backup-meta.json > /dev/null 2>&1; then
            aws s3 cp s3://$S3_BUCKET/$S3_BASE/$backup/backup-meta.json - 2>/dev/null | jq -r '
              "   👤 \(.backed_up_by) on \(.backup_date)"
            ' 2>/dev/null || true
        fi
        
        echo ""
    done
else
    echo -e "   ${YELLOW}⚠️  No backups found${NC}"
    echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 Statistics
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}📊 STATISTICS:${NC}"
echo ""

TOTAL_BACKUPS=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/ 2>/dev/null | grep PRE | wc -l || echo "0")
TOTAL_SIZE=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/ --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}' || echo "0")
TOTAL_FILES=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/ --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}' || echo "0")

echo -e "   Total backups:  ${GREEN}$TOTAL_BACKUPS${NC}"
echo -e "   Total files:    ${GREEN}$TOTAL_FILES${NC}"
echo -e "   Total size:     ${GREEN}$(numfmt --to=iec $TOTAL_SIZE 2>/dev/null || echo "$TOTAL_SIZE bytes")${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💡 Usage
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}💡 USAGE:${NC}"
echo ""
echo -e "   Create backup:"
echo -e "   ${GREEN}./backup-server-configs.sh${NC}"
echo ""
echo -e "   Restore backup:"
echo -e "   ${GREEN}./restore-server-configs.sh snapshot-20251114-120000${NC}"
echo ""
echo -e "   Restore latest:"
echo -e "   ${GREEN}./restore-server-configs.sh latest${NC}"
echo ""
