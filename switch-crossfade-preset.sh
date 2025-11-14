#!/bin/bash

# 🎛️ Switch G-Forge Crossfade Preset
# Switch between crossfade presets on EC2 server

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
S3_BASE="crossfade-presets"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🎛️  G-Forge Crossfade Preset Switch  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check for preset argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}📋 Available presets:${NC}"
    echo ""
    echo -e "   ${GREEN}1. g-forge-Ultra-Tight${NC}"
    echo -e "      Settings: 0.5s fadeout / 0s fadein / linear"
    echo -e "      Style:    Radio 538, maximum energy"
    echo ""
    echo -e "   ${GREEN}2. g-forge-Quick-Mix${NC}"
    echo -e "      Settings: 1.0s fadeout / 0s fadein / exponential"
    echo -e "      Style:    Commercial hit radio, professional"
    echo ""
    echo -e "   ${GREEN}3. g-forge-Quick-Mix-Extreme${NC}"
    echo -e "      Settings: 0.2s fadeout / 0s fadein / linear"
    echo -e "      Style:    SLAM transitions, extreme energy"
    echo ""
    echo -e "${RED}Usage: $0 <preset-name>${NC}"
    echo -e "Example: $0 g-forge-Quick-Mix-Extreme"
    exit 1
fi

PRESET=$1
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# Validate preset name
case $PRESET in
    "g-forge-Ultra-Tight"|"g-forge-Quick-Mix"|"g-forge-Quick-Mix-Extreme")
        echo -e "${GREEN}✅ Valid preset: $PRESET${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid preset name${NC}"
        echo -e "   Must be one of: g-forge-Ultra-Tight, g-forge-Quick-Mix, g-forge-Quick-Mix-Extreme"
        exit 1
        ;;
esac

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📥 Step 1: Download preset from S3
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📥 Step 1/5: Downloading preset from S3...${NC}"

TMP_DIR="/tmp/crossfade-switch-$TIMESTAMP"
mkdir -p $TMP_DIR

aws s3 cp s3://$S3_BUCKET/$S3_BASE/$PRESET.liq $TMP_DIR/ --quiet

if [ ! -f "$TMP_DIR/$PRESET.liq" ]; then
    echo -e "${RED}❌ Failed to download preset from S3${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Preset downloaded${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 💾 Step 2: Backup current crossfade config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}💾 Step 2/5: Backing up current crossfade...${NC}"

ssh $EC2_HOST "cat /opt/radio/advanced-crossfade.liq" > $TMP_DIR/backup-crossfade.liq
aws s3 cp $TMP_DIR/backup-crossfade.liq s3://$S3_BUCKET/crossfade-presets/backups/crossfade-backup-$TIMESTAMP.liq --quiet

echo -e "${GREEN}✅ Backup saved to S3${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📤 Step 3: Upload new preset to EC2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📤 Step 3/5: Uploading preset to EC2...${NC}"

scp $TMP_DIR/$PRESET.liq $EC2_HOST:/tmp/new-crossfade.liq > /dev/null 2>&1
ssh $EC2_HOST "sudo mv /tmp/new-crossfade.liq /opt/radio/advanced-crossfade.liq"

echo -e "${GREEN}✅ Preset uploaded${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 Step 4: Restart Liquidsoap
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🔄 Step 4/5: Restarting Liquidsoap...${NC}"

# Stop Liquidsoap
ssh $EC2_HOST "sudo pkill -9 liquidsoap" 2>/dev/null || true
echo "   Liquidsoap stopped..."
sleep 2

# Start Liquidsoap in background (non-blocking)
ssh $EC2_HOST "cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 </dev/null & disown" &
sleep 3

echo -e "${GREEN}✅ Liquidsoap restarted${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔍 Step 5: Verify
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🔍 Step 5/5: Verifying...${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Stream accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}⚠️  Warning: HTTP status $HTTP_CODE${NC}"
fi

# Check logs (wait a bit for startup)
sleep 2
echo -e "   Checking Liquidsoap logs..."
ssh $EC2_HOST "tail -10 /tmp/liquidsoap.log 2>/dev/null | grep -i 'G-Forge\|crossfade\|loaded' || echo '   (Liquidsoap starting up...)'"

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
echo -e "${GREEN}║   ✅ PRESET SWITCH SUCCESSFUL!        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 Switch Summary:${NC}"
echo -e "   Active Preset:  ${GREEN}$PRESET${NC}"
echo -e "   Live URL:       ${BLUE}https://splashfm.nl${NC}"
echo -e "   Backup:         ${GREEN}s3://$S3_BUCKET/crossfade-presets/backups/crossfade-backup-$TIMESTAMP.liq${NC}"
echo ""
echo -e "${YELLOW}🔄 Rollback:${NC}"
echo -e "   scp radio-ec2:/opt/radio/advanced-crossfade.liq ."
echo -e "   Or restore from S3 backup"
echo ""
