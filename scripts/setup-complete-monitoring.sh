#!/bin/bash
################################################################################
# G-FORGE RADIO - Complete Monitoring Setup (Master Script)
################################################################################
# Executes all monitoring setup scripts in the correct order:
# 1. Update IAM permissions for CloudWatch
# 2. Setup CloudWatch logging infrastructure
# 3. Create monitoring alarms and cost budgets
################################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION="eu-west-1"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  🚀 G-FORGE RADIO - COMPLETE MONITORING SETUP                 ║"
echo "║                                                                ║"
echo "║  This will setup:                                             ║"
echo "║  ✓ CloudWatch Logs (hierarchical structure)                  ║"
echo "║  ✓ CloudWatch Metrics (custom namespace)                     ║"
echo "║  ✓ CloudWatch Alarms (performance + cost)                    ║"
echo "║  ✓ CloudWatch Dashboard (real-time monitoring)               ║"
echo "║  ✓ Cost Budget (\$50/month with alerts)                       ║"
echo "║  ✓ SNS Alerts (email notifications)                          ║"
echo "║                                                                ║"
echo "║  Mode: VERBOSE (maximum logging detail!)                     ║"
echo "║  Retention: 30 days                                           ║"
echo "║  Region: $REGION                                              ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

read -p "Continue with setup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Setup cancelled."
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: IAM PERMISSIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bash "$SCRIPT_DIR/update-iam-cloudwatch-permissions.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: CLOUDWATCH LOGGING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bash "$SCRIPT_DIR/setup-cloudwatch-logging.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 3: MONITORING & ALARMS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bash "$SCRIPT_DIR/setup-monitoring-alarms.sh"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  ✅ COMPLETE MONITORING SETUP FINISHED!                       ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 CloudWatch Log Groups:"
echo "   /g-forge-radio/stream-server/docker"
echo "   /g-forge-radio/stream-server/liquidsoap"
echo "   /g-forge-radio/stream-server/icecast"
echo "   /g-forge-radio/stream-server/nginx"
echo "   /g-forge-radio/stream-server/system"
echo "   /g-forge-radio/stream-server/deployment"
echo "   /g-forge-radio/stream-server/security"
echo "   /g-forge-radio/stream-server/performance"
echo ""
echo "🚨 Alarms Created:"
echo "   - CPU >80% for 5 min"
echo "   - Memory >85% for 5 min"
echo "   - Root Disk >90%"
echo "   - Data Disk >80%"
echo "   - Status check failures"
echo ""
echo "💰 Cost Budget:"
echo "   - Monthly: \$50"
echo "   - Alerts: 80% and 100%"
echo ""
echo "📈 Dashboard:"
echo "   https://${REGION}.console.aws.amazon.com/cloudwatch/dashboards#dashboards:name=GForgeRadio-StreamServer"
echo ""
echo "📧 NEXT STEP: Subscribe to SNS topic for email alerts"
echo ""
echo "Get SNS topic ARN:"
echo "aws sns list-topics --region ${REGION} --query \"Topics[?contains(TopicArn, 'g-forge-radio-alerts')].TopicArn\" --output text"
echo ""
echo "Subscribe with your email:"
echo "aws sns subscribe --topic-arn <ARN> --protocol email --notification-endpoint your-email@example.com --region ${REGION}"
echo ""
echo "🎉 All logs are now streaming to CloudWatch in VERBOSE mode!"
echo ""
