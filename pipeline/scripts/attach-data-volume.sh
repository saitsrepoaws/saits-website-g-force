#!/bin/bash
################################################################################
# ATTACH DATA VOLUME TO INSTANCE
################################################################################
# Purpose: Attach persistent data volume to EC2 instance
# Usage: ./attach-data-volume.sh <instance-id>
################################################################################

set -e

INSTANCE_ID="$1"
REGION="eu-west-1"
DEVICE_NAME="/dev/xvdf"

if [ -z "$INSTANCE_ID" ]; then
  echo "Usage: $0 <instance-id>"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 ATTACHING DATA VOLUME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get volume ID from parameter store
VOLUME_ID=$(aws ssm get-parameter \
  --name /g-forge-radio/production/storage/data-volume-id \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text)

if [ -z "$VOLUME_ID" ] || [ "$VOLUME_ID" = "None" ]; then
  echo "❌ No data volume found in Parameter Store!"
  echo "   Create one first with: ./create-data-volume.sh"
  exit 1
fi

echo "Volume ID: $VOLUME_ID"
echo "Instance ID: $INSTANCE_ID"
echo "Device: $DEVICE_NAME"
echo ""

# Check if already attached
CURRENT_STATE=$(aws ec2 describe-volumes \
  --volume-ids "$VOLUME_ID" \
  --region "$REGION" \
  --query 'Volumes[0].State' \
  --output text)

if [ "$CURRENT_STATE" = "in-use" ]; then
  ATTACHED_TO=$(aws ec2 describe-volumes \
    --volume-ids "$VOLUME_ID" \
    --region "$REGION" \
    --query 'Volumes[0].Attachments[0].InstanceId' \
    --output text)
  
  if [ "$ATTACHED_TO" = "$INSTANCE_ID" ]; then
    echo "✅ Volume already attached to this instance!"
    exit 0
  else
    echo "⚠️  Volume attached to different instance: $ATTACHED_TO"
    echo "   Detaching first..."
    aws ec2 detach-volume \
      --volume-id "$VOLUME_ID" \
      --region "$REGION"
    
    aws ec2 wait volume-available \
      --volume-ids "$VOLUME_ID" \
      --region "$REGION"
    
    echo "✅ Volume detached"
  fi
fi

# Attach volume
echo "Attaching volume..."
aws ec2 attach-volume \
  --volume-id "$VOLUME_ID" \
  --instance-id "$INSTANCE_ID" \
  --device "$DEVICE_NAME" \
  --region "$REGION"

# Wait for attachment
aws ec2 wait volume-in-use \
  --volume-ids "$VOLUME_ID" \
  --region "$REGION"

echo "✅ Volume attached!"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ATTACHMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: Setup volume on instance with:"
echo "  ./setup-data-volume.sh $INSTANCE_ID"
echo ""
