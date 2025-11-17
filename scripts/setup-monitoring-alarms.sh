#!/bin/bash
################################################################################
# G-FORGE RADIO - Monitoring & Alarms Setup
################################################################################
# Sets up CloudWatch alarms for:
# - Performance monitoring (CPU, Memory, Disk)
# - Cost monitoring (Budgets & alerts)
# - Security alerts
# - Service health checks
################################################################################

set -e

REGION="eu-west-1"
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d ' ' -f 2)
SNS_TOPIC_NAME="g-forge-radio-alerts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚨 MONITORING & ALARMS SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Region: $REGION"
echo ""

# ============================================================================
# STEP 1: CREATE SNS TOPIC FOR ALERTS
# ============================================================================
echo "=== 1. CREATING SNS TOPIC FOR ALERTS ==="

SNS_TOPIC_ARN=$(aws sns create-topic \
  --name "$SNS_TOPIC_NAME" \
  --region "$REGION" \
  --query 'TopicArn' \
  --output text 2>/dev/null || \
  aws sns list-topics \
    --region "$REGION" \
    --query "Topics[?contains(TopicArn, '$SNS_TOPIC_NAME')].TopicArn" \
    --output text)

echo "SNS Topic ARN: $SNS_TOPIC_ARN"
echo "✅ SNS Topic ready!"
echo ""

# ============================================================================
# STEP 2: CREATE PERFORMANCE ALARMS
# ============================================================================
echo "=== 2. CREATING PERFORMANCE ALARMS ==="

# CPU Alarm (>80% for 5 minutes)
aws cloudwatch put-metric-alarm \
  --alarm-name "GForgeRadio-HighCPU-${INSTANCE_ID}" \
  --alarm-description "CPU usage above 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --region "$REGION"

echo "  ✓ CPU alarm created (>80%)"

# Memory Alarm (>85% for 5 minutes)
aws cloudwatch put-metric-alarm \
  --alarm-name "GForgeRadio-HighMemory-${INSTANCE_ID}" \
  --alarm-description "Memory usage above 85%" \
  --metric-name MEM_USED \
  --namespace GForgeRadio/StreamServer \
  --statistic Average \
  --period 300 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --region "$REGION"

echo "  ✓ Memory alarm created (>85%)"

# Disk Alarm (>90% for root disk)
aws cloudwatch put-metric-alarm \
  --alarm-name "GForgeRadio-HighDiskRoot-${INSTANCE_ID}" \
  --alarm-description "Root disk usage above 90%" \
  --metric-name DISK_USED \
  --namespace GForgeRadio/StreamServer \
  --statistic Average \
  --period 300 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=InstanceId,Value="$INSTANCE_ID" Name=path,Value="/" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --region "$REGION"

echo "  ✓ Disk alarm created (>90%)"

# Data Disk Alarm (>80% for /data)
aws cloudwatch put-metric-alarm \
  --alarm-name "GForgeRadio-HighDiskData-${INSTANCE_ID}" \
  --alarm-description "Data disk usage above 80%" \
  --metric-name DISK_USED \
  --namespace GForgeRadio/StreamServer \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=InstanceId,Value="$INSTANCE_ID" Name=path,Value="/data" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --region "$REGION"

echo "  ✓ Data disk alarm created (>80%)"

# Status Check Failed Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "GForgeRadio-StatusCheckFailed-${INSTANCE_ID}" \
  --alarm-description "EC2 status check failed" \
  --metric-name StatusCheckFailed \
  --namespace AWS/EC2 \
  --statistic Maximum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2 \
  --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --alarm-actions "$SNS_TOPIC_ARN" \
  --region "$REGION"

echo "  ✓ Status check alarm created"

echo "✅ Performance alarms created!"
echo ""

# ============================================================================
# STEP 3: CREATE COST BUDGET
# ============================================================================
echo "=== 3. CREATING COST BUDGET ==="

# Create budget for monthly costs (alert at 80% and 100%)
cat > /tmp/budget.json << EOF
{
  "BudgetName": "g-forge-radio-monthly-budget",
  "BudgetLimit": {
    "Amount": "50",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {
    "TagKeyValue": [
      "user:Project$g-forge-radio"
    ]
  }
}
EOF

cat > /tmp/notifications.json << EOF
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "SNS",
        "Address": "$SNS_TOPIC_ARN"
      }
    ]
  },
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "SNS",
        "Address": "$SNS_TOPIC_ARN"
      }
    ]
  }
]
EOF

aws budgets create-budget \
  --account-id "$(aws sts get-caller-identity --query Account --output text)" \
  --budget file:///tmp/budget.json \
  --notifications-with-subscribers file:///tmp/notifications.json \
  --region us-east-1 2>/dev/null || echo "  (budget already exists)"

rm /tmp/budget.json /tmp/notifications.json

echo "✅ Cost budget created ($50/month with alerts at 80% and 100%)"
echo ""

# ============================================================================
# STEP 4: CREATE CLOUDWATCH DASHBOARD
# ============================================================================
echo "=== 4. CREATING CLOUDWATCH DASHBOARD ==="

cat > /tmp/dashboard.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/EC2", "CPUUtilization", { "stat": "Average", "label": "CPU %" } ],
          [ "GForgeRadio/StreamServer", "MEM_USED", { "stat": "Average", "label": "Memory %" } ]
        ],
        "period": 300,
        "stat": "Average",
        "region": "$REGION",
        "title": "CPU & Memory Usage",
        "yAxis": {
          "left": {
            "min": 0,
            "max": 100
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "GForgeRadio/StreamServer", "DISK_USED", { "stat": "Average", "label": "Root /" } ],
          [ "...", { "stat": "Average", "label": "Data /data" } ]
        ],
        "period": 300,
        "stat": "Average",
        "region": "$REGION",
        "title": "Disk Usage",
        "yAxis": {
          "left": {
            "min": 0,
            "max": 100
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          [ "AWS/EC2", "NetworkIn", { "stat": "Sum", "label": "In" } ],
          [ ".", "NetworkOut", { "stat": "Sum", "label": "Out" } ]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "$REGION",
        "title": "Network Traffic"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/g-forge-radio/stream-server/liquidsoap'\n| fields @timestamp, @message\n| sort @timestamp desc\n| limit 100",
        "region": "$REGION",
        "title": "Liquidsoap Logs (Recent)"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/g-forge-radio/stream-server/icecast'\n| fields @timestamp, @message\n| sort @timestamp desc\n| limit 100",
        "region": "$REGION",
        "title": "Icecast Logs (Recent)"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/g-forge-radio/stream-server/security'\n| fields @timestamp, @message\n| filter @message like /Failed/\n| sort @timestamp desc\n| limit 50",
        "region": "$REGION",
        "title": "Security Events (Failed logins)"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name "GForgeRadio-StreamServer" \
  --dashboard-body file:///tmp/dashboard.json \
  --region "$REGION"

rm /tmp/dashboard.json

echo "✅ CloudWatch Dashboard created!"
echo ""

# ============================================================================
# STEP 5: VERIFICATION
# ============================================================================
echo "=== 5. VERIFICATION ==="

echo "Alarms:"
aws cloudwatch describe-alarms \
  --alarm-name-prefix "GForgeRadio-" \
  --region "$REGION" \
  --query 'MetricAlarms[].AlarmName' \
  --output table

echo ""
echo "Dashboard:"
echo "https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=GForgeRadio-StreamServer"

echo ""
echo "✅ MONITORING & ALARMS SETUP COMPLETE!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚨 ALARMS CONFIGURED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Performance Alarms:"
echo "  - CPU >80% for 5 min"
echo "  - Memory >85% for 5 min"
echo "  - Root Disk >90%"
echo "  - Data Disk >80%"
echo "  - Status check failures"
echo ""
echo "Cost Budget:"
echo "  - Monthly limit: \$50"
echo "  - Alert at 80% (\$40)"
echo "  - Alert at 100% (\$50)"
echo ""
echo "SNS Topic: $SNS_TOPIC_ARN"
echo ""
echo "⚠️  IMPORTANT: Subscribe to SNS topic for email alerts!"
echo "aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint your-email@example.com"
echo ""
