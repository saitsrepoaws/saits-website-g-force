#!/bin/bash

# Check AWS IoT Messages
# Verifies if messages are arriving in AWS IoT Core

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 CHECKING AWS IOT MESSAGES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not installed"
    echo "Install: brew install awscli"
    exit 1
fi

echo "✅ AWS CLI found"
echo ""

# Get IoT endpoint
IOT_ENDPOINT=$(grep VITE_AWS_IOT_ENDPOINT apps/web/.env | cut -d'=' -f2 | tr -d '"')
echo "📡 IoT Endpoint: $IOT_ENDPOINT"
echo ""

# Check recent IoT logs (last 5 minutes)
echo "📊 Checking CloudWatch Logs for IoT activity..."
echo ""

# Get log groups related to IoT
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/iot" \
  --region eu-west-1 \
  --query 'logGroups[*].[logGroupName,creationTime]' \
  --output table

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 MANUAL CHECK INSTRUCTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open AWS Console: https://console.aws.amazon.com/iot"
echo "2. Go to: Test → MQTT test client"
echo "3. Subscribe to: radio/player/+/command"
echo "4. Click 'Test Publish' in your app"
echo "5. Check if message appears in AWS Console"
echo ""
echo "If message appears in AWS but NOT in your app:"
echo "  → Subscription issue in frontend"
echo ""
echo "If message does NOT appear in AWS:"
echo "  → Publish issue or IAM policy problem"
echo ""
