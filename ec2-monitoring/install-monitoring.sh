#!/bin/bash

# 🚀 Splash FM Monitoring Installation Script
# Deploys complete monitoring system to EC2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EC2_HOST="radio-ec2"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🚀 Installing Monitoring System      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Upload Scripts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📤 Step 1/6: Uploading scripts...${NC}"

# Create temp directory
TMP_DIR="/tmp/monitoring-install-$(date +%s)"
mkdir -p $TMP_DIR

# Copy scripts to temp
cp $SCRIPT_DIR/service-manager.sh $TMP_DIR/
cp $SCRIPT_DIR/watchdog.sh $TMP_DIR/
cp $SCRIPT_DIR/health-check.sh $TMP_DIR/
cp $SCRIPT_DIR/disk-cleanup.sh $TMP_DIR/
cp $SCRIPT_DIR/log-stats.sh $TMP_DIR/

# Upload to EC2
scp -q $TMP_DIR/*.sh $EC2_HOST:/tmp/

# Move to /usr/local/bin and make executable
ssh $EC2_HOST "sudo mv /tmp/service-manager.sh /usr/local/bin/"
ssh $EC2_HOST "sudo mv /tmp/watchdog.sh /usr/local/bin/"
ssh $EC2_HOST "sudo mv /tmp/health-check.sh /usr/local/bin/"
ssh $EC2_HOST "sudo mv /tmp/disk-cleanup.sh /usr/local/bin/"
ssh $EC2_HOST "sudo mv /tmp/log-stats.sh /usr/local/bin/"
ssh $EC2_HOST "sudo chmod +x /usr/local/bin/service-manager.sh"
ssh $EC2_HOST "sudo chmod +x /usr/local/bin/watchdog.sh"
ssh $EC2_HOST "sudo chmod +x /usr/local/bin/health-check.sh"
ssh $EC2_HOST "sudo chmod +x /usr/local/bin/disk-cleanup.sh"
ssh $EC2_HOST "sudo chmod +x /usr/local/bin/log-stats.sh"

echo -e "${GREEN}✅ Scripts uploaded${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Install Log Rotation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🔄 Step 2/6: Installing log rotation...${NC}"

scp -q $SCRIPT_DIR/logrotate-splash-fm.conf $EC2_HOST:/tmp/
ssh $EC2_HOST "sudo mv /tmp/logrotate-splash-fm.conf /etc/logrotate.d/splash-fm"
ssh $EC2_HOST "sudo chmod 644 /etc/logrotate.d/splash-fm"

# Test logrotate config
ssh $EC2_HOST "sudo logrotate -d /etc/logrotate.d/splash-fm" > /dev/null 2>&1 || true

echo -e "${GREEN}✅ Log rotation configured${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Setup Cron Jobs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}⏰ Step 3/6: Setting up cron jobs...${NC}"

scp -q $SCRIPT_DIR/splash-fm-cron $EC2_HOST:/tmp/
ssh $EC2_HOST "sudo mv /tmp/splash-fm-cron /etc/cron.d/splash-fm"
ssh $EC2_HOST "sudo chmod 644 /etc/cron.d/splash-fm"

echo -e "${GREEN}✅ Cron jobs configured${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Install CloudWatch Agent (if not already installed)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}☁️  Step 4/6: Installing CloudWatch Agent...${NC}"

# Check if already installed
if ssh $EC2_HOST "which amazon-cloudwatch-agent" > /dev/null 2>&1; then
    echo -e "${YELLOW}  CloudWatch Agent already installed${NC}"
else
    echo "  Downloading CloudWatch Agent..."
    ssh $EC2_HOST "wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb"
    
    echo "  Installing CloudWatch Agent..."
    ssh $EC2_HOST "sudo dpkg -i -E /tmp/amazon-cloudwatch-agent.deb"
    
    echo -e "${GREEN}  ✅ CloudWatch Agent installed${NC}"
fi

# Upload config
echo "  Uploading CloudWatch config..."
scp -q $SCRIPT_DIR/cloudwatch-config.json $EC2_HOST:/tmp/
ssh $EC2_HOST "sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc"
ssh $EC2_HOST "sudo mv /tmp/cloudwatch-config.json /opt/aws/amazon-cloudwatch-agent/etc/config.json"

# Start CloudWatch Agent
echo "  Starting CloudWatch Agent..."
ssh $EC2_HOST "sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json" > /dev/null 2>&1 || true

echo -e "${GREEN}✅ CloudWatch Agent configured${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Create Log Files
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📝 Step 5/6: Creating log files...${NC}"

ssh $EC2_HOST "sudo touch /var/log/splash-health.log"
ssh $EC2_HOST "sudo touch /var/log/splash-watchdog.log"
ssh $EC2_HOST "sudo touch /var/log/splash-cleanup.log"
ssh $EC2_HOST "sudo touch /var/log/splash-stats.log"
ssh $EC2_HOST "sudo chmod 644 /var/log/splash-*.log"

echo -e "${GREEN}✅ Log files created${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Test Installation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🧪 Step 6/6: Testing installation...${NC}"

# Test service manager
echo "  Testing service-manager..."
ssh $EC2_HOST "/usr/local/bin/service-manager.sh status" > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✅ service-manager works${NC}" || \
    echo -e "${RED}  ❌ service-manager failed${NC}"

# Test health check
echo "  Testing health-check..."
ssh $EC2_HOST "/usr/local/bin/health-check.sh" > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✅ health-check works${NC}" || \
    echo -e "${RED}  ❌ health-check failed${NC}"

# Test watchdog
echo "  Testing watchdog..."
ssh $EC2_HOST "/usr/local/bin/watchdog.sh" > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✅ watchdog works${NC}" || \
    echo -e "${RED}  ❌ watchdog failed${NC}"

# Check cron
echo "  Checking cron configuration..."
ssh $EC2_HOST "sudo systemctl status cron" > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✅ cron is running${NC}" || \
    echo -e "${RED}  ❌ cron is not running${NC}"

# Check CloudWatch Agent
echo "  Checking CloudWatch Agent..."
ssh $EC2_HOST "sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a query -m ec2 -c default -s" > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✅ CloudWatch Agent running${NC}" || \
    echo -e "${YELLOW}  ⚠️  CloudWatch Agent may need manual start${NC}"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cleanup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rm -rf $TMP_DIR

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Success
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ INSTALLATION COMPLETE!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   Scripts:           ${GREEN}✅ Installed in /usr/local/bin/${NC}"
echo -e "   Log Rotation:      ${GREEN}✅ Configured${NC}"
echo -e "   Cron Jobs:         ${GREEN}✅ Configured${NC}"
echo -e "   CloudWatch Agent:  ${GREEN}✅ Configured${NC}"
echo -e "   Log Files:         ${GREEN}✅ Created${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. Check status:  ssh $EC2_HOST '/usr/local/bin/service-manager.sh status'"
echo "   2. View health:   ssh $EC2_HOST 'tail -f /var/log/splash-health.log'"
echo "   3. Monitor:       Check CloudWatch console (namespace: SplashFM)"
echo ""
echo -e "${BLUE}🔄 Monitoring Active:${NC}"
echo "   - Health checks:  Every 1 minute"
echo "   - Watchdog:       Every 5 minutes"
echo "   - Disk cleanup:   Daily at 03:00"
echo "   - Log stats:      Every hour"
echo ""
