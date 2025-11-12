#!/bin/bash
# Check SQS Queue Status

source ~/.zshrc
nvm use default > /dev/null 2>&1

echo "📬 Checking SQS Queue Status..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Find queue URL
QUEUE_URL=$(aws sqs list-queues --query "QueueUrls[?contains(@, 'radio-track-stream-queue')]" --output text 2>/dev/null)

if [ -z "$QUEUE_URL" ]; then
  echo "❌ Queue not found"
  exit 1
fi

echo "✅ Queue URL: $QUEUE_URL"
echo ""

# Get queue attributes
echo "📊 Queue Attributes:"
aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --output table 2>/dev/null

echo ""
echo "📝 Recent Messages (peek without removing):"
aws sqs receive-message \
  --queue-url "$QUEUE_URL" \
  --max-number-of-messages 1 \
  --wait-time-seconds 5 \
  --attribute-names All \
  2>/dev/null | jq -r '.Messages[0].Body' 2>/dev/null || echo "No messages in queue"

echo ""
echo "✅ Done!"
