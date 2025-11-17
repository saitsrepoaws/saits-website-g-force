#!/bin/bash
################################################################################
# G-FORGE RADIO - POST-DEPLOYMENT VERIFICATION
################################################################################
# Verifieert deployment door CloudWatch logs te checken op errors
# Usage: ./verify-deployment.sh [deployment-id]
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REGION="eu-west-1"
INSTANCE_ID="i-0924372740ff587ca"
TIME_WINDOW="10m"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 POST-DEPLOYMENT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: CHECK DEPLOYMENT STATUS
# ============================================================================
echo "=== 1. DEPLOYMENT STATUS ==="
if [ ! -z "$1" ]; then
  DEPLOYMENT_ID="$1"
  echo "Checking deployment: $DEPLOYMENT_ID"
  
  STATUS=$(aws deploy get-deployment \
    --deployment-id "$DEPLOYMENT_ID" \
    --region "$REGION" \
    --query 'deploymentInfo.status' \
    --output text 2>/dev/null || echo "NOT_FOUND")
  
  if [ "$STATUS" = "Succeeded" ]; then
    echo -e "${GREEN}✅ Deployment Status: $STATUS${NC}"
  elif [ "$STATUS" = "Failed" ]; then
    echo -e "${RED}❌ Deployment Status: $STATUS${NC}"
  else
    echo -e "${YELLOW}⚠️  Deployment Status: $STATUS${NC}"
  fi
else
  echo "No deployment ID provided, skipping deployment status check"
fi

echo ""

# ============================================================================
# STEP 2: CHECK EC2 INSTANCE HEALTH
# ============================================================================
echo "=== 2. EC2 INSTANCE HEALTH ==="

INSTANCE_STATE=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text)

echo "Instance State: $INSTANCE_STATE"

if [ "$INSTANCE_STATE" = "running" ]; then
  echo -e "${GREEN}✅ Instance is running${NC}"
else
  echo -e "${RED}❌ Instance is not running!${NC}"
fi

echo ""

# ============================================================================
# STEP 3: CHECK CLOUDWATCH LOGS FOR ERRORS
# ============================================================================
echo "=== 3. CLOUDWATCH LOGS VERIFICATION ==="
echo ""

# Function to check logs for errors
check_log_group() {
  LOG_GROUP=$1
  LOG_NAME=$2
  
  echo "📋 Checking $LOG_NAME logs..."
  
  # Check if log group exists
  if ! aws logs describe-log-groups \
    --log-group-name-prefix "$LOG_GROUP" \
    --region "$REGION" \
    --query 'logGroups[0].logGroupName' \
    --output text > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Log group not found: $LOG_GROUP${NC}"
    echo ""
    return
  fi
  
  # Get recent logs
  LOGS=$(aws logs tail "$LOG_GROUP" \
    --since "$TIME_WINDOW" \
    --region "$REGION" \
    --format short 2>&1 || echo "")
  
  if [ -z "$LOGS" ]; then
    echo -e "${YELLOW}⚠️  No logs found in last $TIME_WINDOW${NC}"
    echo ""
    return
  fi
  
  # Check for errors
  ERROR_COUNT=$(echo "$LOGS" | grep -ciE "error|failed|exception|fatal" || echo "0")
  
  if [ "$ERROR_COUNT" -gt "0" ]; then
    echo -e "${RED}❌ Found $ERROR_COUNT error(s) in logs!${NC}"
    echo ""
    echo "Sample errors:"
    echo "$LOGS" | grep -iE "error|failed|exception|fatal" | head -5
    echo ""
  else
    echo -e "${GREEN}✅ No errors found${NC}"
  fi
  
  echo ""
}

# Check all log groups
check_log_group "/g-forge-radio/stream-server/deployment" "Deployment"
check_log_group "/g-forge-radio/stream-server/system" "System"
check_log_group "/g-forge-radio/stream-server/docker" "Docker"
check_log_group "/g-forge-radio/stream-server/liquidsoap" "Liquidsoap"
check_log_group "/g-forge-radio/stream-server/icecast" "Icecast"
check_log_group "/g-forge-radio/stream-server/nginx" "Nginx"

# ============================================================================
# STEP 4: CHECK SERVICES STATUS
# ============================================================================
echo "=== 4. SERVICES STATUS ==="
echo ""

# Check via SSM
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["echo \"=== DOCKER CONTAINERS ===\"","docker ps -a --format \"table {{.Names}}\t{{.Status}}\"","echo \"\"","echo \"=== SYSTEMD SERVICES ===\"","systemctl is-active icecast2 || echo \"icecast2: inactive\"","systemctl is-active nginx || echo \"nginx: inactive\"","systemctl is-active amazon-cloudwatch-agent || echo \"cloudwatch-agent: inactive\""]' \
  --region "$REGION" \
  --timeout-seconds 30 \
  --query 'Command.CommandId' \
  --output text)

sleep 3

SERVICES_STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' \
  --output text 2>/dev/null || echo "Failed to get services status")

echo "$SERVICES_STATUS"
echo ""

# ============================================================================
# STEP 5: SUMMARY
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -z "$1" ] && [ "$STATUS" = "Succeeded" ]; then
  echo -e "✅ Deployment: ${GREEN}SUCCESS${NC}"
elif [ ! -z "$1" ]; then
  echo -e "❌ Deployment: ${RED}$STATUS${NC}"
fi

if [ "$INSTANCE_STATE" = "running" ]; then
  echo -e "✅ EC2 Instance: ${GREEN}RUNNING${NC}"
else
  echo -e "❌ EC2 Instance: ${RED}$INSTANCE_STATE${NC}"
fi

echo -e "✅ CloudWatch Logs: ${GREEN}CHECKED${NC}"
echo ""

# Check if we found any errors across all logs
TOTAL_ERRORS=$(aws logs filter-log-events \
  --log-group-name /g-forge-radio/stream-server/deployment \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-10M +%s)000 \
  --region "$REGION" \
  --query 'events[].message' \
  --output text 2>/dev/null | wc -l || echo "0")

if [ "$TOTAL_ERRORS" -gt "0" ]; then
  echo -e "⚠️  Total Errors Found: ${YELLOW}$TOTAL_ERRORS${NC}"
  echo ""
  echo "To investigate further, run:"
  echo "aws logs filter-log-events \\"
  echo "  --log-group-name /g-forge-radio/stream-server/deployment \\"
  echo "  --filter-pattern \"ERROR\" \\"
  echo "  --region eu-west-1"
else
  echo -e "✅ Errors Found: ${GREEN}NONE${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VERIFICATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exit with error if deployment failed or errors found
if [ "$STATUS" = "Failed" ] || [ "$TOTAL_ERRORS" -gt "0" ]; then
  exit 1
fi

exit 0
