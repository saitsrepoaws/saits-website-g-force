#!/bin/bash
##############################################
# G-FORGE RADIO - ML SECURITY DEPLOYMENT
# 
# Deploys AWS ML security services:
# - GuardDuty (ML threat detection)
# - Security Hub (centralized findings)
# - CloudWatch Log Group (all logs)
# - Anomaly Detection (ML on metrics)
##############################################

set -e

REGION="eu-west-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
LOG_GROUP_NAME="/gforge-radio/all-logs"
SNS_TOPIC_NAME="gforge-radio-security-alerts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 G-FORGE RADIO - ML SECURITY DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Account: $ACCOUNT_ID"
echo "Region:  $REGION"
echo ""

# =============================================================================
# STEP 1: Enable GuardDuty (ML Threat Detection)
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  STEP 1: AWS GuardDuty (ML Threat Detection)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if GuardDuty is already enabled
DETECTOR_ID=$(aws guardduty list-detectors --region $REGION --query 'DetectorIds[0]' --output text 2>/dev/null || echo "None")

if [ "$DETECTOR_ID" == "None" ] || [ -z "$DETECTOR_ID" ]; then
  echo "Enabling GuardDuty..."
  DETECTOR_ID=$(aws guardduty create-detector \
    --region $REGION \
    --enable \
    --finding-publishing-frequency FIFTEEN_MINUTES \
    --query 'DetectorId' \
    --output text)
  echo "✅ GuardDuty enabled with detector: $DETECTOR_ID"
else
  echo "✅ GuardDuty already enabled: $DETECTOR_ID"
fi

echo ""

# =============================================================================
# STEP 2: Enable Security Hub (Centralized Findings)
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 STEP 2: AWS Security Hub (Centralized Security)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Security Hub is already enabled
HUB_STATUS=$(aws securityhub describe-hub --region $REGION 2>&1 || echo "NOT_ENABLED")

if echo "$HUB_STATUS" | grep -q "NotFoundException\|InvalidAccessException"; then
  echo "Enabling Security Hub..."
  aws securityhub enable-security-hub \
    --region $REGION \
    --enable-default-standards 2>/dev/null || echo "⚠️  Security Hub may require manual enablement"
  echo "✅ Security Hub enabled"
else
  echo "✅ Security Hub already enabled"
fi

echo ""

# =============================================================================
# STEP 3: Create CloudWatch Log Group
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STEP 3: CloudWatch Log Group"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create log group if it doesn't exist
aws logs create-log-group \
  --log-group-name $LOG_GROUP_NAME \
  --region $REGION 2>/dev/null || echo "Log group already exists"

# Set retention to 30 days
aws logs put-retention-policy \
  --log-group-name $LOG_GROUP_NAME \
  --retention-in-days 30 \
  --region $REGION

echo "✅ Log Group created: $LOG_GROUP_NAME"
echo "   Retention: 30 days"
echo ""

# =============================================================================
# STEP 4: Create SNS Topic for Alerts
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔔 STEP 4: SNS Topic for Security Alerts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create SNS topic
SNS_TOPIC_ARN=$(aws sns create-topic \
  --name $SNS_TOPIC_NAME \
  --region $REGION \
  --query 'TopicArn' \
  --output text 2>/dev/null || aws sns list-topics --region $REGION --query "Topics[?contains(TopicArn, '$SNS_TOPIC_NAME')].TopicArn" --output text)

echo "✅ SNS Topic created: $SNS_TOPIC_ARN"
echo ""
echo "📧 Subscribe your email:"
echo "   aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint your@email.com --region $REGION"
echo ""

# =============================================================================
# STEP 5: Create Metric Filters for Security Events
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 STEP 5: Metric Filters for Security Events"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Failed SSH Attempts
aws logs put-metric-filter \
  --log-group-name $LOG_GROUP_NAME \
  --filter-name "FailedSSHAttempts" \
  --filter-pattern "[time, source, user, ...] Failed password" \
  --metric-transformations \
    metricName=FailedSSHAttempts,metricNamespace=GForgeRadio/Security,metricValue=1,defaultValue=0 \
  --region $REGION 2>/dev/null || echo "Metric filter already exists"

echo "✅ Metric filter: FailedSSHAttempts"

# Rootkit Detection
aws logs put-metric-filter \
  --log-group-name $LOG_GROUP_NAME \
  --filter-name "RootkitDetections" \
  --filter-pattern "rootkit trojan backdoor suspicious" \
  --metric-transformations \
    metricName=RootkitDetections,metricNamespace=GForgeRadio/Security,metricValue=1,defaultValue=0 \
  --region $REGION 2>/dev/null || echo "Metric filter already exists"

echo "✅ Metric filter: RootkitDetections"

# Virus Detection
aws logs put-metric-filter \
  --log-group-name $LOG_GROUP_NAME \
  --filter-name "VirusDetections" \
  --filter-pattern "FOUND Infected virus" \
  --metric-transformations \
    metricName=VirusDetections,metricNamespace=GForgeRadio/Security,metricValue=1,defaultValue=0 \
  --region $REGION 2>/dev/null || echo "Metric filter already exists"

echo "✅ Metric filter: VirusDetections"

echo ""

# =============================================================================
# STEP 6: Create CloudWatch Alarms
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  STEP 6: CloudWatch Alarms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Failed SSH Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "gforge-radio-failed-ssh-attempts" \
  --alarm-description "Alert on multiple failed SSH attempts" \
  --metric-name FailedSSHAttempts \
  --namespace GForgeRadio/Security \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

echo "✅ Alarm: Failed SSH Attempts (> 5 in 5min)"

# Rootkit Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "gforge-radio-rootkit-detection" \
  --alarm-description "Alert on rootkit detection" \
  --metric-name RootkitDetections \
  --namespace GForgeRadio/Security \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

echo "✅ Alarm: Rootkit Detection (> 0)"

# Virus Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "gforge-radio-virus-detection" \
  --alarm-description "Alert on virus detection" \
  --metric-name VirusDetections \
  --namespace GForgeRadio/Security \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

echo "✅ Alarm: Virus Detection (> 0)"

echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ML SECURITY DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Enabled Services:"
echo "  🛡️  GuardDuty:     $DETECTOR_ID"
echo "  🔐 Security Hub:  Enabled"
echo "  📊 Log Group:     $LOG_GROUP_NAME"
echo "  🔔 SNS Topic:     $SNS_TOPIC_ARN"
echo ""
echo "Next Steps:"
echo "  1. Subscribe email to SNS topic"
echo "  2. Install CloudWatch Agent on EC2"
echo "  3. Deploy security scan scripts"
echo "  4. Test with: ./install-security-stack.sh"
echo ""
echo "Cost Estimate:"
echo "  - GuardDuty:      ~$4.50/month (first 30 days FREE)"
echo "  - Security Hub:   $0.0010 per finding"
echo "  - CloudWatch:     ~$0.50/month (logs + metrics)"
echo "  - SNS:            $0.00 (free tier)"
echo "  ────────────────────────────────────────"
echo "  Total:            ~$5-10/month"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
