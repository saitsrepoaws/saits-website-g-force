#!/bin/bash

# 🚀 Setup EC2 Daily Backup System
# Option 1: EventBridge + Lambda (Recommended)
# Option 2: Cron on local machine

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Setup EC2 Daily Backup           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Select backup method:${NC}"
echo ""
echo -e "  ${GREEN}1. EventBridge + Lambda${NC} (Recommended)"
echo -e "     - Runs in AWS cloud"
echo -e "     - No local machine needed"
echo -e "     - Reliable and scalable"
echo ""
echo -e "  ${BLUE}2. Local Cron Job${NC}"
echo -e "     - Runs on your local machine"
echo -e "     - Requires machine to be on at 00:00"
echo -e "     - Simple setup"
echo ""

read -p "Choose option (1 or 2): " OPTION

if [ "$OPTION" = "1" ]; then
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Option 1: EventBridge + Lambda
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    echo ""
    echo -e "${BLUE}📦 Option 1: EventBridge + Lambda Setup${NC}"
    echo ""
    
    echo -e "${YELLOW}This will create:${NC}"
    echo "  1. Lambda function (ec2-snapshot-backup)"
    echo "  2. EventBridge rule (daily at 00:00 UTC = 01:00 CET)"
    echo "  3. IAM role with EC2 snapshot permissions"
    echo ""
    
    read -p "Continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    echo -e "${RED}⚠️  TODO: Deploy via Amplify${NC}"
    echo ""
    echo "Add to amplify/backend.ts:"
    echo ""
    echo -e "${BLUE}// Lambda function for EC2 backup${NC}"
    echo "const ec2BackupFunction = new lambda.Function(stack, 'EC2BackupFunction', {"
    echo "  runtime: lambda.Runtime.PYTHON_3_11,"
    echo "  handler: 'index.handler',"
    echo "  code: lambda.Code.fromAsset('functions/ec2-backup'),"
    echo "  timeout: Duration.minutes(15),"
    echo "  environment: {"
    echo "    INSTANCE_ID: 'i-021451e919d39c898',"
    echo "    RETENTION_DAYS: '7'"
    echo "  }"
    echo "});"
    echo ""
    echo -e "${BLUE}// EventBridge rule (daily at 00:00 UTC)${NC}"
    echo "new events.Rule(stack, 'EC2DailyBackup', {"
    echo "  schedule: events.Schedule.cron({"
    echo "    minute: '0',"
    echo "    hour: '0',"
    echo "    weekDay: '*'"
    echo "  }),"
    echo "  targets: [new targets.LambdaFunction(ec2BackupFunction)]"
    echo "});"
    echo ""
    echo -e "${YELLOW}Or use the AWS Console:${NC}"
    echo "1. Lambda → Create function → ec2-snapshot-backup"
    echo "2. EventBridge → Create rule → Schedule: cron(0 0 * * ? *)"
    echo "3. Target: Lambda function ec2-snapshot-backup"
    echo ""

elif [ "$OPTION" = "2" ]; then
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Option 2: Local Cron Job
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    echo ""
    echo -e "${BLUE}⏰ Option 2: Local Cron Job Setup${NC}"
    echo ""
    
    # Make script executable
    chmod +x ec2-monitoring/ec2-snapshot-backup.sh
    
    # Get absolute path
    SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/ec2-monitoring" && pwd)/ec2-snapshot-backup.sh"
    LOG_PATH="$HOME/.splash-fm-backups.log"
    
    # Create cron entry
    CRON_ENTRY="0 0 * * * $SCRIPT_PATH >> $LOG_PATH 2>&1"
    
    echo -e "${YELLOW}Cron entry to add:${NC}"
    echo "$CRON_ENTRY"
    echo ""
    echo -e "${YELLOW}This will run daily at 00:00 (midnight)${NC}"
    echo ""
    
    read -p "Add to crontab now? (yes/no): " ADD_CRON
    
    if [ "$ADD_CRON" = "yes" ]; then
        # Add to crontab
        (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
        
        echo -e "${GREEN}✅ Cron job added!${NC}"
        echo ""
        echo -e "${BLUE}Verify:${NC}"
        echo "  crontab -l | grep ec2-snapshot-backup"
        echo ""
        echo -e "${BLUE}Test manually:${NC}"
        echo "  $SCRIPT_PATH"
        echo ""
        echo -e "${BLUE}View logs:${NC}"
        echo "  tail -f $LOG_PATH"
        echo ""
    else
        echo ""
        echo -e "${YELLOW}Manual setup:${NC}"
        echo "1. Edit crontab:"
        echo "   crontab -e"
        echo ""
        echo "2. Add this line:"
        echo "   $CRON_ENTRY"
        echo ""
        echo "3. Save and exit"
        echo ""
    fi
    
else
    echo -e "${RED}Invalid option${NC}"
    exit 1
fi

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ SETUP COMPLETE!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
