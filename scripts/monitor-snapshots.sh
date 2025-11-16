#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📸 SNAPSHOT MONITOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SNAP1="snap-05fc7a56a9f23aab0"
SNAP2="snap-0dc0bdb40143c0e0f"

while true; do
  STATUS=$(aws ec2 describe-snapshots \
    --snapshot-ids $SNAP1 $SNAP2 \
    --region eu-west-1 \
    --query 'Snapshots[].[SnapshotId,State,Progress]' \
    --output text)
  
  clear
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📸 SNAPSHOT STATUS - $(date '+%H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "$STATUS" | while read line; do
    SNAP_ID=$(echo $line | awk '{print $1}')
    STATE=$(echo $line | awk '{print $2}')
    PROGRESS=$(echo $line | awk '{print $3}')
    
    if [ "$STATE" == "completed" ]; then
      echo "  ✅ $SNAP_ID: COMPLETED!"
    else
      echo "  ⏳ $SNAP_ID: $STATE - $PROGRESS"
    fi
  done
  
  # Check if both completed
  COMPLETED=$(echo "$STATUS" | grep -c "completed")
  if [ "$COMPLETED" -eq 2 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ BEIDE SNAPSHOTS COMPLETE!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ EC2 backups complete!"
    echo "✅ SAFE TO PROCEED with clean slate!"
    echo ""
    echo "Next: Run clean-slate deployment script"
    echo ""
    break
  fi
  
  echo ""
  echo "Refreshing in 15 seconds... (Ctrl+C to stop)"
  sleep 15
done
