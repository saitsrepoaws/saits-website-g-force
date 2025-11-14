#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 SQS Queue Statistics Logger
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Monitors SQS queue depth and sends metrics to CloudWatch
# Runs every minute via cron
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# Configuration
QUEUE_URL="https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
NAMESPACE="SplashFM"
REGION="eu-west-1"
LOG_FILE="/var/log/splash-queue-stats.log"

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Get Queue Attributes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUEUE_ATTRS=$(aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names All \
  --region "$REGION" \
  --output json 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') | ERROR | Failed to get queue attributes" >> "$LOG_FILE"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Parse Attributes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MESSAGES=$(echo "$QUEUE_ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
IN_FLIGHT=$(echo "$QUEUE_ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // "0"')
OLDEST_MSG_AGE=$(echo "$QUEUE_ATTRS" | jq -r '.Attributes.ApproximateAgeOfOldestMessage // "0"')
DELAYED=$(echo "$QUEUE_ATTRS" | jq -r '.Attributes.ApproximateNumberOfMessagesDelayed // "0"')

# Calculate total
TOTAL_QUEUE=$((MESSAGES + IN_FLIGHT + DELAYED))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Log to File (Structured Format)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_MESSAGE="[$TIMESTAMP] | QUEUE_STATUS | Messages: $MESSAGES | InFlight: $IN_FLIGHT | Delayed: $DELAYED | Total: $TOTAL_QUEUE | OldestAge: ${OLDEST_MSG_AGE}s"

echo "$LOG_MESSAGE" >> "$LOG_FILE"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Send Metrics to CloudWatch
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Metric 1: Queue Depth (messages waiting)
aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueDepth \
  --value "$MESSAGES" \
  --region "$REGION" \
  --dimensions QueueName=radio-track-stream-queue \
  2>/dev/null || echo "Failed to send QueueDepth metric"

# Metric 2: In-Flight (currently processing)
aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueInFlight \
  --value "$IN_FLIGHT" \
  --region "$REGION" \
  --dimensions QueueName=radio-track-stream-queue \
  2>/dev/null || echo "Failed to send QueueInFlight metric"

# Metric 3: Delayed messages
aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueDelayed \
  --value "$DELAYED" \
  --region "$REGION" \
  --dimensions QueueName=radio-track-stream-queue \
  2>/dev/null || echo "Failed to send QueueDelayed metric"

# Metric 4: Total queue size
aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueTotal \
  --value "$TOTAL_QUEUE" \
  --region "$REGION" \
  --dimensions QueueName=radio-track-stream-queue \
  2>/dev/null || echo "Failed to send QueueTotal metric"

# Metric 5: Oldest message age (if > 0)
if [ "$OLDEST_MSG_AGE" -gt 0 ]; then
  aws cloudwatch put-metric-data \
    --namespace "$NAMESPACE" \
    --metric-name QueueOldestMessageAge \
    --value "$OLDEST_MSG_AGE" \
    --unit Seconds \
    --region "$REGION" \
    --dimensions QueueName=radio-track-stream-queue \
    2>/dev/null || echo "Failed to send QueueOldestMessageAge metric"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Alert on Low Queue (optional)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$TOTAL_QUEUE" -lt 2 ]; then
  # Queue is running low!
  aws cloudwatch put-metric-data \
    --namespace "$NAMESPACE" \
    --metric-name QueueLowAlert \
    --value 1 \
    --region "$REGION" \
    2>/dev/null
  
  echo -e "${YELLOW}⚠️  Queue running low: $TOTAL_QUEUE tracks${NC}"
else
  # Queue is healthy
  aws cloudwatch put-metric-data \
    --namespace "$NAMESPACE" \
    --metric-name QueueLowAlert \
    --value 0 \
    --region "$REGION" \
    2>/dev/null
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Success
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}✅ Queue stats sent to CloudWatch${NC}"
echo -e "   Messages: ${GREEN}$MESSAGES${NC} | In-Flight: ${YELLOW}$IN_FLIGHT${NC} | Total: ${GREEN}$TOTAL_QUEUE${NC}"

exit 0
