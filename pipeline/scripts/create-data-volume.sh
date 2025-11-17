#!/bin/bash
################################################################################
# CREATE PERSISTENT DATA VOLUME
################################################################################
# Purpose: Create EBS volume for persistent data (logs, media, playlists)
# Usage: ./create-data-volume.sh [size-gb] [az]
################################################################################

set -e

SIZE_GB="${1:-20}"
AVAILABILITY_ZONE="${2:-eu-west-1a}"
REGION="eu-west-1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 CREATING PERSISTENT DATA VOLUME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Size: ${SIZE_GB}GB"
echo "AZ: $AVAILABILITY_ZONE"
echo "Type: gp3 (fast SSD)"
echo ""

# Create volume
VOLUME_ID=$(aws ec2 create-volume \
  --availability-zone "$AVAILABILITY_ZONE" \
  --size "$SIZE_GB" \
  --volume-type gp3 \
  --iops 3000 \
  --throughput 125 \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=g-forge-radio-data},{Key=Application,Value=g-forge-radio},{Key=CostCenter,Value=g-forge-radio},{Key=Owner,Value=gerard},{Key=Environment,Value=production},{Key=Component,Value=persistent-data},{Key=Backup,Value=daily},{Key=DataType,Value=logs-media-playlists},{Key=Persistent,Value=true},{Key=DeleteOnTermination,Value=false}]' \
  --region "$REGION" \
  --query 'VolumeId' \
  --output text)

echo "✅ Volume created: $VOLUME_ID"
echo ""

# Wait for volume to be available
echo "Waiting for volume to be available..."
aws ec2 wait volume-available \
  --volume-ids "$VOLUME_ID" \
  --region "$REGION"

echo "✅ Volume is available!"
echo ""

# Save to parameter store
if aws ssm get-parameter --name /g-forge-radio/production/storage/data-volume-id --region "$REGION" &>/dev/null; then
  # Parameter exists, update it
  aws ssm put-parameter \
    --name /g-forge-radio/production/storage/data-volume-id \
    --value "$VOLUME_ID" \
    --type "String" \
    --overwrite \
    --region "$REGION"
else
  # Parameter doesn't exist, create with tags
  aws ssm put-parameter \
    --name /g-forge-radio/production/storage/data-volume-id \
    --value "$VOLUME_ID" \
    --type "String" \
    --region "$REGION" \
    --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio
fi

echo "✅ Saved to Parameter Store"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DATA VOLUME READY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Volume ID: $VOLUME_ID"
echo "Size: ${SIZE_GB}GB"
echo "Type: gp3 (3000 IOPS, 125 MB/s)"
echo "AZ: $AVAILABILITY_ZONE"
echo ""
echo "💰 Cost: ~€${SIZE_GB} per month (€1/GB/month)"
echo ""
echo "Next: Attach to instance with:"
echo "  ./attach-data-volume.sh <instance-id>"
echo ""
