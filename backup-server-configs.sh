#!/bin/bash

# 💾 Server Config Backup Script
# Backup all important config files from EC2 to S3

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
EC2_HOST="radio-ec2"
S3_BUCKET="amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr"
S3_BASE="server-configs"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
VERSION=${1:-"snapshot-$TIMESTAMP"}

# Local temp directory
TMP_DIR="/tmp/server-configs-backup-$TIMESTAMP"
mkdir -p $TMP_DIR

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  💾 Server Config Backup to S3        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📋 Backup Info:${NC}"
echo -e "   Version:    ${GREEN}$VERSION${NC}"
echo -e "   Timestamp:  ${GREEN}$TIMESTAMP${NC}"
echo -e "   S3 Bucket:  ${GREEN}s3://$S3_BUCKET/$S3_BASE${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📥 Step 1: Download configs from EC2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📥 Step 1/4: Downloading configs from EC2...${NC}"

# Liquidsoap configs
echo -e "   Downloading Liquidsoap configs..."
ssh $EC2_HOST "cat /opt/radio/radio.liq" > $TMP_DIR/radio.liq
ssh $EC2_HOST "cat /opt/radio/advanced-crossfade.liq" > $TMP_DIR/advanced-crossfade.liq
ssh $EC2_HOST "cat /opt/radio/cover-support.liq" > $TMP_DIR/cover-support.liq 2>/dev/null || echo "# No cover support" > $TMP_DIR/cover-support.liq

# Nginx configs
echo -e "   Downloading Nginx configs..."
ssh $EC2_HOST "sudo cat /etc/nginx/sites-available/splashfm" > $TMP_DIR/nginx-splashfm.conf

# Icecast config
echo -e "   Downloading Icecast config..."
ssh $EC2_HOST "sudo cat /etc/icecast2/icecast.xml" > $TMP_DIR/icecast.xml

# Stereo Tool relay
echo -e "   Downloading Stereo Tool relay..."
ssh $EC2_HOST "cat /usr/local/bin/stereotool-relay.sh" > $TMP_DIR/stereotool-relay.sh 2>/dev/null || echo "# No stereo tool" > $TMP_DIR/stereotool-relay.sh

# System info
echo -e "   Collecting system info..."
ssh $EC2_HOST "liquidsoap --version" > $TMP_DIR/liquidsoap-version.txt 2>&1
ssh $EC2_HOST "nginx -v" > $TMP_DIR/nginx-version.txt 2>&1
ssh $EC2_HOST "icecast2 -v" > $TMP_DIR/icecast-version.txt 2>&1 || echo "Unknown" > $TMP_DIR/icecast-version.txt

echo -e "${GREEN}✅ Configs downloaded${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 Step 2: Create metadata
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📝 Step 2/4: Creating backup metadata...${NC}"

cat > $TMP_DIR/backup-meta.json << METAEOF
{
  "version": "$VERSION",
  "timestamp": "$TIMESTAMP",
  "backup_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "backed_up_by": "$(whoami)",
  "ec2_host": "$EC2_HOST",
  "configs": [
    "radio.liq",
    "advanced-crossfade.liq",
    "cover-support.liq",
    "nginx-splashfm.conf",
    "icecast.xml",
    "stereotool-relay.sh"
  ],
  "s3_bucket": "$S3_BUCKET",
  "s3_path": "s3://$S3_BUCKET/$S3_BASE/$VERSION/"
}
METAEOF

echo -e "${GREEN}✅ Metadata created${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📤 Step 3: Upload to S3
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📤 Step 3/4: Uploading to S3...${NC}"

# Upload versioned backup
aws s3 cp $TMP_DIR s3://$S3_BUCKET/$S3_BASE/$VERSION/ --recursive --quiet
echo -e "${GREEN}✅ Uploaded to: s3://$S3_BUCKET/$S3_BASE/$VERSION/${NC}"

# Upload as "latest" snapshot
aws s3 cp $TMP_DIR s3://$S3_BUCKET/$S3_BASE/latest/ --recursive --quiet
echo -e "${GREEN}✅ Uploaded to: s3://$S3_BUCKET/$S3_BASE/latest/${NC}"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 Step 4: Verify
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🔍 Step 4/4: Verifying upload...${NC}"

FILE_COUNT=$(aws s3 ls s3://$S3_BUCKET/$S3_BASE/$VERSION/ | wc -l)
echo -e "${GREEN}✅ $FILE_COUNT files uploaded${NC}"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 Cleanup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rm -rf $TMP_DIR
echo -e "${GREEN}✅ Temp files cleaned up${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ Success
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ BACKUP SUCCESSFUL!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Backup Summary:${NC}"
echo -e "   Version:     ${GREEN}$VERSION${NC}"
echo -e "   Timestamp:   ${GREEN}$TIMESTAMP${NC}"
echo -e "   S3 Location: ${GREEN}s3://$S3_BUCKET/$S3_BASE/$VERSION/${NC}"
echo -e "   Files:       ${GREEN}$FILE_COUNT${NC}"
echo ""
echo -e "${YELLOW}📋 Backed up configs:${NC}"
echo -e "   • Liquidsoap:    radio.liq, advanced-crossfade.liq"
echo -e "   • Nginx:         splashfm site config"
echo -e "   • Icecast:       icecast.xml"
echo -e "   • Stereo Tool:   relay script"
echo -e "   • Metadata:      versions, system info"
echo ""
echo -e "${YELLOW}🔄 Restore:${NC}"
echo -e "   ./restore-server-configs.sh $VERSION"
echo ""
