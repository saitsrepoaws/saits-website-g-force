#!/bin/bash

# 🔄 Server Config Restore Script
# Restore config files from S3 to EC2

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

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🔄 Server Config Restore from S3     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check for version argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}📋 Available backup versions:${NC}"
    echo ""
    aws s3 ls s3://$S3_BUCKET/$S3_BASE/ | grep PRE | awk '{print "   " $2}' | sed 's/\///'
    echo ""
    echo -e "${RED}Usage: $0 <version>${NC}"
    echo -e "Example: $0 snapshot-20251114-115500"
    echo -e "Or:      $0 latest"
    exit 1
fi

VERSION=$1
TMP_DIR="/tmp/server-configs-restore-$TIMESTAMP"
mkdir -p $TMP_DIR

echo -e "${YELLOW}🔍 Checking if version exists...${NC}"

# Check if version exists in S3
if ! aws s3 ls s3://$S3_BUCKET/$S3_BASE/$VERSION/ > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Version not found in S3${NC}"
    echo -e "   Looking for: s3://$S3_BUCKET/$S3_BASE/$VERSION/"
    exit 1
fi

echo -e "${GREEN}✅ Version found${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📥 Step 1: Download from S3
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📥 Step 1/5: Downloading configs from S3...${NC}"
aws s3 cp s3://$S3_BUCKET/$S3_BASE/$VERSION/ $TMP_DIR/ --recursive --quiet
echo -e "${GREEN}✅ Downloaded to $TMP_DIR${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💾 Step 2: Backup current configs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}💾 Step 2/5: Backing up current configs...${NC}"
BACKUP_DIR="/tmp/server-configs-pre-restore-$TIMESTAMP"
mkdir -p $BACKUP_DIR

ssh $EC2_HOST "cat /opt/radio/radio.liq" > $BACKUP_DIR/radio.liq
ssh $EC2_HOST "sudo cat /etc/nginx/sites-available/splashfm" > $BACKUP_DIR/nginx-splashfm.conf
ssh $EC2_HOST "sudo cat /etc/icecast2/icecast.xml" > $BACKUP_DIR/icecast.xml

# Upload backup to S3
aws s3 cp $BACKUP_DIR s3://$S3_BUCKET/$S3_BASE/pre-restore-$TIMESTAMP/ --recursive --quiet
echo -e "${GREEN}✅ Current configs backed up to S3${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📤 Step 3: Upload to EC2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📤 Step 3/5: Uploading configs to EC2...${NC}"

# Liquidsoap configs
if [ -f "$TMP_DIR/radio.liq" ]; then
    scp $TMP_DIR/radio.liq $EC2_HOST:/tmp/ > /dev/null 2>&1
    ssh $EC2_HOST "sudo mv /tmp/radio.liq /opt/radio/radio.liq"
    echo -e "   ${GREEN}✓${NC} radio.liq"
fi

if [ -f "$TMP_DIR/advanced-crossfade.liq" ]; then
    scp $TMP_DIR/advanced-crossfade.liq $EC2_HOST:/tmp/ > /dev/null 2>&1
    ssh $EC2_HOST "sudo mv /tmp/advanced-crossfade.liq /opt/radio/advanced-crossfade.liq"
    echo -e "   ${GREEN}✓${NC} advanced-crossfade.liq"
fi

# Nginx config
if [ -f "$TMP_DIR/nginx-splashfm.conf" ]; then
    scp $TMP_DIR/nginx-splashfm.conf $EC2_HOST:/tmp/ > /dev/null 2>&1
    ssh $EC2_HOST "sudo mv /tmp/nginx-splashfm.conf /etc/nginx/sites-available/splashfm"
    echo -e "   ${GREEN}✓${NC} nginx-splashfm.conf"
fi

# Icecast config
if [ -f "$TMP_DIR/icecast.xml" ]; then
    scp $TMP_DIR/icecast.xml $EC2_HOST:/tmp/ > /dev/null 2>&1
    ssh $EC2_HOST "sudo mv /tmp/icecast.xml /etc/icecast2/icecast.xml"
    echo -e "   ${GREEN}✓${NC} icecast.xml"
fi

# Stereo Tool relay
if [ -f "$TMP_DIR/stereotool-relay.sh" ] && [ -s "$TMP_DIR/stereotool-relay.sh" ]; then
    scp $TMP_DIR/stereotool-relay.sh $EC2_HOST:/tmp/ > /dev/null 2>&1
    ssh $EC2_HOST "sudo mv /tmp/stereotool-relay.sh /usr/local/bin/stereotool-relay.sh && sudo chmod +x /usr/local/bin/stereotool-relay.sh"
    echo -e "   ${GREEN}✓${NC} stereotool-relay.sh"
fi

echo -e "${GREEN}✅ Configs uploaded${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 Step 4: Restart services
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🔄 Step 4/5: Restarting services...${NC}"

# Test nginx config
ssh $EC2_HOST "sudo nginx -t" > /dev/null 2>&1 && echo -e "   ${GREEN}✓${NC} Nginx config valid"

# Reload nginx
ssh $EC2_HOST "sudo systemctl reload nginx" && echo -e "   ${GREEN}✓${NC} Nginx reloaded"

# Restart liquidsoap
ssh $EC2_HOST "sudo pkill -9 liquidsoap && sleep 3 && cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 &" && echo -e "   ${GREEN}✓${NC} Liquidsoap restarted"

# Restart icecast (optional - usually not needed)
# ssh $EC2_HOST "sudo systemctl restart icecast2" && echo -e "   ${GREEN}✓${NC} Icecast restarted"

echo -e "${GREEN}✅ Services restarted${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 Step 5: Verify
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🔍 Step 5/5: Verifying restore...${NC}"

sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Stream accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}⚠️  Warning: HTTP status $HTTP_CODE${NC}"
fi

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
echo -e "${GREEN}║   ✅ RESTORE SUCCESSFUL!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Restore Summary:${NC}"
echo -e "   Restored:      ${GREEN}$VERSION${NC}"
echo -e "   Live URL:      ${BLUE}https://splashfm.nl${NC}"
echo -e "   Pre-restore:   ${GREEN}s3://$S3_BUCKET/$S3_BASE/pre-restore-$TIMESTAMP/${NC}"
echo ""
echo -e "${YELLOW}💡 Rollback this restore:${NC}"
echo -e "   ./restore-server-configs.sh pre-restore-$TIMESTAMP"
echo ""
