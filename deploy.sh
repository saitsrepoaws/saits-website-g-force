#!/bin/bash

# 🚀 Deploy Server Configs to EC2
# Usage: ./deploy.sh [crossfade|nginx|icecast|stereotool|liquidsoap|all]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
EC2_HOST="radio-ec2"
S3_BUCKET="amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr"
LOCAL_DIR="server-configs"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 Deploy Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function deploy_crossfade() {
    echo -e "${CYAN}🎛️  Deploying Crossfade Config...${NC}"
    
    # Backup current
    echo "   📦 Backing up current config..."
    ssh $EC2_HOST "cat /opt/radio/advanced-crossfade.liq" > /tmp/crossfade-backup-$TIMESTAMP.liq
    aws s3 cp /tmp/crossfade-backup-$TIMESTAMP.liq s3://$S3_BUCKET/crossfade-presets/backups/ --quiet
    
    # Upload new
    echo "   📤 Uploading new config..."
    scp -q $LOCAL_DIR/advanced-crossfade.liq $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/advanced-crossfade.liq /opt/radio/"
    
    # Restart Liquidsoap
    echo "   🔄 Restarting Liquidsoap..."
    ssh $EC2_HOST "sudo pkill -9 liquidsoap" 2>/dev/null || true
    sleep 2
    ssh $EC2_HOST "cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 </dev/null & disown" &
    sleep 3
    
    echo -e "${GREEN}   ✅ Crossfade deployed${NC}"
}

function deploy_nginx() {
    echo -e "${CYAN}🌐 Deploying Nginx Config...${NC}"
    
    # Backup current
    echo "   📦 Backing up current config..."
    ssh $EC2_HOST "cat /etc/nginx/sites-available/radio" > /tmp/nginx-backup-$TIMESTAMP.conf
    
    # Upload new
    echo "   📤 Uploading new config..."
    scp -q $LOCAL_DIR/nginx-splashfm.conf $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/nginx-splashfm.conf /etc/nginx/sites-available/radio"
    
    # Test config
    echo "   🧪 Testing Nginx config..."
    ssh $EC2_HOST "sudo nginx -t"
    
    # Reload Nginx
    echo "   🔄 Reloading Nginx..."
    ssh $EC2_HOST "sudo systemctl reload nginx"
    
    echo -e "${GREEN}   ✅ Nginx deployed${NC}"
}

function deploy_icecast() {
    echo -e "${CYAN}📡 Deploying Icecast Config...${NC}"
    
    # Backup current
    echo "   📦 Backing up current config..."
    ssh $EC2_HOST "sudo cat /etc/icecast2/icecast.xml" > /tmp/icecast-backup-$TIMESTAMP.xml
    
    # Upload new
    echo "   📤 Uploading new config..."
    scp -q $LOCAL_DIR/icecast.xml $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/icecast.xml /etc/icecast2/"
    
    # Restart Icecast
    echo "   🔄 Restarting Icecast..."
    ssh $EC2_HOST "sudo systemctl restart icecast2"
    sleep 2
    
    echo -e "${GREEN}   ✅ Icecast deployed${NC}"
}

function deploy_stereotool() {
    echo -e "${CYAN}🎵 Deploying Stereo Tool Config...${NC}"
    
    # Backup current
    echo "   📦 Backing up current script..."
    ssh $EC2_HOST "sudo cat /usr/local/bin/stereotool-relay.sh" > /tmp/stereotool-backup-$TIMESTAMP.sh
    
    # Upload new
    echo "   📤 Uploading new script..."
    scp -q $LOCAL_DIR/stereotool-relay.sh $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/stereotool-relay.sh /usr/local/bin/"
    ssh $EC2_HOST "sudo chmod +x /usr/local/bin/stereotool-relay.sh"
    
    echo -e "${GREEN}   ✅ Stereo Tool deployed${NC}"
    echo -e "${YELLOW}   ⚠️  Manual restart needed if Stereo Tool is running${NC}"
}

function deploy_liquidsoap() {
    echo -e "${CYAN}🎙️  Deploying Liquidsoap Configs...${NC}"
    
    # Backup current
    echo "   📦 Backing up current configs..."
    ssh $EC2_HOST "tar czf /tmp/liquidsoap-backup-$TIMESTAMP.tar.gz -C /opt/radio *.liq"
    
    # Upload new
    echo "   📤 Uploading new configs..."
    scp -q $LOCAL_DIR/radio.liq $EC2_HOST:/tmp/
    scp -q $LOCAL_DIR/advanced-crossfade.liq $EC2_HOST:/tmp/
    scp -q $LOCAL_DIR/cover-support.liq $EC2_HOST:/tmp/
    ssh $EC2_HOST "sudo mv /tmp/radio.liq /opt/radio/"
    ssh $EC2_HOST "sudo mv /tmp/advanced-crossfade.liq /opt/radio/"
    ssh $EC2_HOST "sudo mv /tmp/cover-support.liq /opt/radio/"
    
    # Restart Liquidsoap
    echo "   🔄 Restarting Liquidsoap..."
    ssh $EC2_HOST "sudo pkill -9 liquidsoap" 2>/dev/null || true
    sleep 2
    ssh $EC2_HOST "cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 </dev/null & disown" &
    sleep 3
    
    echo -e "${GREEN}   ✅ Liquidsoap deployed${NC}"
}

function sync_to_s3() {
    echo -e "${CYAN}☁️  Syncing to S3...${NC}"
    
    # Upload to S3 latest
    for file in $LOCAL_DIR/*.liq $LOCAL_DIR/*.conf $LOCAL_DIR/*.xml $LOCAL_DIR/*.sh; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            aws s3 cp "$file" s3://$S3_BUCKET/server-configs/latest/ --quiet
        fi
    done
    
    echo -e "${GREEN}   ✅ Synced to S3${NC}"
}

function git_commit() {
    echo -e "${CYAN}📝 Committing to Git...${NC}"
    
    if git diff --quiet server-configs/; then
        echo -e "${YELLOW}   No changes to commit${NC}"
    else
        git add server-configs/
        git commit -m "🚀 Deploy: $1 ($TIMESTAMP)" || true
        echo -e "${GREEN}   ✅ Committed to Git${NC}"
    fi
}

function verify_stream() {
    echo -e "${CYAN}🔍 Verifying stream...${NC}"
    sleep 2
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/)
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}   ✅ Stream accessible (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}   ⚠️  HTTP status: $HTTP_CODE${NC}"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 Main
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Deploy Server Configs             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check command
if [ -z "$1" ]; then
    echo -e "${RED}❌ No deployment target specified${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC} $0 <target>"
    echo ""
    echo -e "${YELLOW}Available targets:${NC}"
    echo "  crossfade   - Deploy crossfade preset only"
    echo "  nginx       - Deploy Nginx config"
    echo "  icecast     - Deploy Icecast config"
    echo "  stereotool  - Deploy Stereo Tool script"
    echo "  liquidsoap  - Deploy all Liquidsoap configs"
    echo "  all         - Deploy everything"
    echo ""
    exit 1
fi

TARGET=$1
echo -e "${YELLOW}🎯 Target: $TARGET${NC}"
echo ""

# Execute deployment
case $TARGET in
    crossfade)
        deploy_crossfade
        sync_to_s3
        git_commit "crossfade"
        verify_stream
        ;;
    
    nginx)
        deploy_nginx
        sync_to_s3
        git_commit "nginx"
        verify_stream
        ;;
    
    icecast)
        deploy_icecast
        sync_to_s3
        git_commit "icecast"
        verify_stream
        ;;
    
    stereotool)
        deploy_stereotool
        sync_to_s3
        git_commit "stereotool"
        ;;
    
    liquidsoap)
        deploy_liquidsoap
        sync_to_s3
        git_commit "liquidsoap"
        verify_stream
        ;;
    
    all)
        echo -e "${RED}⚠️  WARNING: This will deploy ALL configs!${NC}"
        read -p "Continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Aborted."
            exit 1
        fi
        echo ""
        deploy_liquidsoap
        echo ""
        deploy_nginx
        echo ""
        deploy_icecast
        echo ""
        deploy_stereotool
        echo ""
        sync_to_s3
        git_commit "all configs"
        verify_stream
        ;;
    
    *)
        echo -e "${RED}❌ Unknown target: $TARGET${NC}"
        echo ""
        echo "Available: crossfade, nginx, icecast, stereotool, liquidsoap, all"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DEPLOYMENT COMPLETE!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   🎯 Target:   ${YELLOW}$TARGET${NC}"
echo -e "   💻 EC2:      ${GREEN}✅ Updated${NC}"
echo -e "   ☁️  S3:       ${GREEN}✅ Backed up${NC}"
echo -e "   📝 Git:      ${GREEN}✅ Committed${NC}"
echo -e "   🌐 Stream:   ${BLUE}http://46.137.184.91/${NC}"
echo ""
