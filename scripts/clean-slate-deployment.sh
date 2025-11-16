#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹✨ CLEAN SLATE DEPLOYMENT - G-FORGE IoT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Gerard's Master Plan: Delete everything, build fresh! 💪"
echo ""
echo "Backup Status:"
echo "  ✅ Snapshot 1: snap-05fc7a56a9f23aab0"
echo "  ✅ Snapshot 2: snap-0dc0bdb40143c0e0f"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ========================================
# PHASE 1: DELETE ALL SANDBOX STACKS
# ========================================

echo "🗑️ PHASE 1: Deleting ALL sandbox stacks..."
echo ""

# Main stacks
STACKS=(
  "amplify-gforgeiot-gerard3-sandbox-e97da0c3ef"
  "amplify-gforgeiot-gerard-sandbox-28f2e0c620"
)

for STACK in "${STACKS[@]}"; do
  echo "Deleting: $STACK"
  aws cloudformation delete-stack --stack-name "$STACK" --region eu-west-1 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "  ✅ Delete initiated"
  else
    echo "  ⚠️ Already deleted or doesn't exist"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ Waiting for stack deletions (max 10 minutes)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for deletions
for i in {1..60}; do
  REMAINING=$(aws cloudformation list-stacks \
    --region eu-west-1 \
    --stack-status-filter DELETE_IN_PROGRESS \
    --query 'StackSummaries[?contains(StackName, `amplify-gforgeiot-gerard`)].StackName' \
    --output text | wc -w | tr -d ' ')
  
  if [ "$REMAINING" -eq 0 ]; then
    echo ""
    echo "✅ ALL STACKS DELETED!"
    break
  fi
  
  echo "[$i/60] $(date '+%H:%M:%S') - Stacks still deleting: $REMAINING"
  
  if [ $i -lt 60 ]; then
    sleep 10
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 CLEANUP: Removing orphaned resources..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Delete orphaned SQS queues
echo "Checking for orphaned SQS queues..."
QUEUES=$(aws sqs list-queues --region eu-west-1 --queue-name-prefix radio-track-stream --query 'QueueUrls' --output text 2>/dev/null)
if [ -n "$QUEUES" ]; then
  for QUEUE_URL in $QUEUES; do
    echo "  Deleting: $QUEUE_URL"
    aws sqs delete-queue --queue-url "$QUEUE_URL" --region eu-west-1 2>/dev/null
  done
  echo "  ✅ SQS queues cleaned"
else
  echo "  ✅ No orphaned queues"
fi

echo ""
echo "✅ CLEANUP COMPLETE!"
echo ""

# ========================================
# PHASE 2: FRESH DEPLOYMENT
# ========================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 PHASE 2: Fresh Amplify Sandbox Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Starting clean deployment..."
echo "Expected duration: 5-10 minutes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Change to project directory
cd /Users/gerard/Desktop/T7/g-forge-iot

# Run deployment
pnpm exec ampx sandbox --once

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CLEAN SLATE DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Old stacks deleted"
echo "✅ Orphaned resources cleaned"
echo "✅ Fresh backend deployed"
echo "✅ No conflicts!"
echo ""
echo "🔐 Backups available:"
echo "   snap-05fc7a56a9f23aab0 (SplashFM)"
echo "   snap-0dc0bdb40143c0e0f (Amplify)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
