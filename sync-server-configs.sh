#!/bin/bash

# 🔄 Sync Server Configs Between EC2, S3, and Local Git
# Usage: ./sync-server-configs.sh [pull|push|sync]

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
LOCAL_DIR="server-configs"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function pull_from_ec2() {
    echo -e "${BLUE}📥 Pulling configs from EC2...${NC}"
    echo ""
    
    # Liquidsoap configs
    echo "   Downloading Liquidsoap configs..."
    scp -q $EC2_HOST:/opt/radio/radio.liq $LOCAL_DIR/
    scp -q $EC2_HOST:/opt/radio/advanced-crossfade.liq $LOCAL_DIR/
    scp -q $EC2_HOST:/opt/radio/cover-support.liq $LOCAL_DIR/
    
    # Nginx config
    echo "   Downloading Nginx config..."
    scp -q $EC2_HOST:/etc/nginx/sites-available/radio $LOCAL_DIR/nginx-splashfm.conf
    
    # Icecast config
    echo "   Downloading Icecast config..."
    ssh $EC2_HOST "sudo cat /etc/icecast2/icecast.xml" > $LOCAL_DIR/icecast.xml 2>/dev/null
    
    # Stereo Tool
    echo "   Downloading Stereo Tool config..."
    ssh $EC2_HOST "sudo cat /usr/local/bin/stereotool-relay.sh" > $LOCAL_DIR/stereotool-relay.sh 2>/dev/null
    
    echo -e "${GREEN}✅ Configs pulled from EC2${NC}"
}

function push_to_ec2() {
    echo -e "${BLUE}📤 Pushing configs to EC2...${NC}"
    echo ""
    
    # Backup current configs on EC2 first
    echo "   Creating backup on EC2..."
    ssh $EC2_HOST "mkdir -p /tmp/config-backup-$TIMESTAMP"
    ssh $EC2_HOST "cp /opt/radio/*.liq /tmp/config-backup-$TIMESTAMP/ 2>/dev/null || true"
    
    # Liquidsoap configs
    echo "   Uploading Liquidsoap configs..."
    scp -q $LOCAL_DIR/radio.liq $EC2_HOST:/tmp/
    scp -q $LOCAL_DIR/advanced-crossfade.liq $EC2_HOST:/tmp/
    scp -q $LOCAL_DIR/cover-support.liq $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/radio.liq /opt/radio/"
    ssh $EC2_HOST "sudo mv /tmp/advanced-crossfade.liq /opt/radio/"
    ssh $EC2_HOST "sudo mv /tmp/cover-support.liq /opt/radio/"
    
    # Nginx config
    echo "   Uploading Nginx config..."
    scp -q $LOCAL_DIR/nginx-splashfm.conf $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/nginx-splashfm.conf /etc/nginx/sites-available/radio"
    
    # Icecast config
    echo "   Uploading Icecast config..."
    scp -q $LOCAL_DIR/icecast.xml $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/icecast.xml /etc/icecast2/"
    
    # Stereo Tool
    echo "   Uploading Stereo Tool config..."
    scp -q $LOCAL_DIR/stereotool-relay.sh $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/stereotool-relay.sh /usr/local/bin/"
    ssh $EC2_HOST "sudo chmod +x /usr/local/bin/stereotool-relay.sh"
    
    echo -e "${GREEN}✅ Configs pushed to EC2${NC}"
    echo -e "${YELLOW}⚠️  Remember to restart services if needed!${NC}"
}

function sync_to_s3() {
    echo -e "${BLUE}☁️  Syncing to S3...${NC}"
    echo ""
    
    # Upload to S3 latest
    for file in $LOCAL_DIR/*.liq $LOCAL_DIR/*.conf $LOCAL_DIR/*.xml $LOCAL_DIR/*.sh; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            echo "   Uploading $filename..."
            aws s3 cp "$file" s3://$S3_BUCKET/server-configs/latest/ --quiet
        fi
    done
    
    # Create timestamped backup
    echo "   Creating timestamped backup..."
    aws s3 sync $LOCAL_DIR/ s3://$S3_BUCKET/server-configs/backup-$TIMESTAMP/ \
        --exclude "README.md" --quiet
    
    echo -e "${GREEN}✅ Synced to S3${NC}"
}

function git_commit() {
    echo -e "${BLUE}📝 Committing to Git...${NC}"
    echo ""
    
    if git diff --quiet server-configs/; then
        echo -e "${YELLOW}   No changes to commit${NC}"
    else
        git add server-configs/
        git commit -m "🔄 Sync server configs from EC2 ($TIMESTAMP)" || true
        echo -e "${GREEN}✅ Changes committed to Git${NC}"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 Main
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔄 Server Config Sync Tool          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check command
COMMAND=${1:-sync}

case $COMMAND in
    pull)
        echo -e "${YELLOW}Mode: PULL (EC2 → Local)${NC}"
        echo ""
        pull_from_ec2
        git_commit
        ;;
    
    push)
        echo -e "${YELLOW}Mode: PUSH (Local → EC2)${NC}"
        echo ""
        echo -e "${RED}⚠️  WARNING: This will overwrite configs on EC2!${NC}"
        read -p "Continue? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            push_to_ec2
            sync_to_s3
            git_commit
        else
            echo "Aborted."
            exit 1
        fi
        ;;
    
    sync)
        echo -e "${YELLOW}Mode: FULL SYNC (EC2 → Local → S3 → Git)${NC}"
        echo ""
        pull_from_ec2
        echo ""
        sync_to_s3
        echo ""
        git_commit
        ;;
    
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo ""
        echo "Usage: $0 [pull|push|sync]"
        echo ""
        echo "Commands:"
        echo "  pull  - Download configs from EC2 to local"
        echo "  push  - Upload local configs to EC2"
        echo "  sync  - Full sync: EC2 → Local → S3 → Git"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ SYNC COMPLETE!                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Status:${NC}"
echo -e "   💻 Local:  ${GREEN}✅ Updated${NC}"
if [ "$COMMAND" != "pull" ]; then
    echo -e "   ☁️  S3:     ${GREEN}✅ Synced${NC}"
fi
echo -e "   📝 Git:    ${GREEN}✅ Committed${NC}"
echo ""
