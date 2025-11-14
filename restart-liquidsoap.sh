#!/bin/bash

# 🔄 Quick Liquidsoap Restart
# Simple and fast restart without hanging

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EC2_HOST="radio-ec2"

echo -e "${BLUE}🔄 Restarting Liquidsoap...${NC}"
echo ""

# Step 1: Stop
echo -e "${YELLOW}1. Stopping Liquidsoap...${NC}"
ssh $EC2_HOST "sudo pkill -9 liquidsoap" 2>/dev/null || true
sleep 2
echo -e "${GREEN}   ✅ Stopped${NC}"
echo ""

# Step 2: Start
echo -e "${YELLOW}2. Starting Liquidsoap...${NC}"
ssh $EC2_HOST "cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 </dev/null & disown" &
sleep 3
echo -e "${GREEN}   ✅ Started${NC}"
echo ""

# Step 3: Verify
echo -e "${YELLOW}3. Verifying...${NC}"
sleep 2

# Check HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✅ Stream accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}   ⚠️  HTTP status: $HTTP_CODE${NC}"
fi

# Check process
PROCESS_COUNT=$(ssh $EC2_HOST "ps aux | grep -c '[l]iquidsoap radio.liq'")
if [ "$PROCESS_COUNT" -gt "0" ]; then
    echo -e "${GREEN}   ✅ Liquidsoap running ($PROCESS_COUNT process)${NC}"
else
    echo -e "${RED}   ❌ Liquidsoap not running!${NC}"
fi

# Check logs
echo ""
echo -e "${YELLOW}Recent logs:${NC}"
ssh $EC2_HOST "tail -5 /tmp/liquidsoap.log 2>/dev/null | grep -i 'G-Forge\|error\|warning' || echo '   (Check full log for details)'"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ RESTART COMPLETE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Stream URL:${NC} http://46.137.184.91/stream.mp3"
echo ""
