#!/bin/bash
# G-Forge Radio - Custom AMI Builder
# Creates production-ready AMI with all dependencies

set -e

echo "🚀 G-Forge Radio AMI Builder"
echo "================================"
echo ""

# Configuration
AMI_NAME="g-forge-radio-base-v1.0"
AMI_DESCRIPTION="Ubuntu 22.04 with Liquidsoap 2.4.0 (Docker), Icecast, Nginx, CodeDeploy Agent"
INSTANCE_TYPE="t3.small"
REGION="eu-west-1"
SUBNET_ID="subnet-0cdb078c275014e24"  # Same subnet as current EC2
SECURITY_GROUP="sg-005c8d71776faf97b"   # Same SG as current EC2

echo "📋 Configuration:"
echo "  AMI Name: $AMI_NAME"
echo "  Instance Type: $INSTANCE_TYPE"
echo "  Region: $REGION"
echo ""

# Step 1: Launch temporary EC2 instance
echo "🔧 Step 1: Launching temporary build instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0d64bb532e0502c46 \
  --instance-type $INSTANCE_TYPE \
  --subnet-id $SUBNET_ID \
  --security-group-ids $SECURITY_GROUP \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=AMI-Build-Temp},{Key=Purpose,Value=AMI-Builder}]" \
  --user-data file://$(dirname $0)/ami-setup.sh \
  --region $REGION \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✅ Instance launched: $INSTANCE_ID"
echo ""

# Step 2: Wait for instance to be running
echo "⏳ Step 2: Waiting for instance to start..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION
echo "✅ Instance is running"
echo ""

# Step 3: Wait for user-data script to complete (15 minutes)
echo "⏳ Step 3: Waiting for setup script to complete (15 min)..."
echo "   This installs all dependencies..."
sleep 900  # 15 minutes

# Step 4: Stop the instance
echo "🛑 Step 4: Stopping instance for AMI creation..."
aws ec2 stop-instances --instance-ids $INSTANCE_ID --region $REGION
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID --region $REGION
echo "✅ Instance stopped"
echo ""

# Step 5: Create AMI
echo "📸 Step 5: Creating AMI..."
AMI_ID=$(aws ec2 create-image \
  --instance-id $INSTANCE_ID \
  --name $AMI_NAME \
  --description "$AMI_DESCRIPTION" \
  --region $REGION \
  --tag-specifications "ResourceType=image,Tags=[{Key=Name,Value=$AMI_NAME},{Key=Version,Value=1.0},{Key=Application,Value=g-forge-radio}]" \
  --query 'ImageId' \
  --output text)

echo "✅ AMI created: $AMI_ID"
echo ""

# Step 6: Wait for AMI to be available
echo "⏳ Step 6: Waiting for AMI to be available..."
aws ec2 wait image-available --image-ids $AMI_ID --region $REGION
echo "✅ AMI is ready!"
echo ""

# Step 7: Terminate build instance
echo "🗑️  Step 7: Cleaning up build instance..."
aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region $REGION
echo "✅ Build instance terminated"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 AMI BUILD COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 AMI Details:"
echo "  AMI ID: $AMI_ID"
echo "  AMI Name: $AMI_NAME"
echo "  Region: $REGION"
echo ""
echo "🔍 View AMI:"
echo "  aws ec2 describe-images --image-ids $AMI_ID --region $REGION"
echo ""
echo "🚀 Launch instance from AMI:"
echo "  aws ec2 run-instances --image-id $AMI_ID --instance-type t3.small ..."
echo ""
echo "💾 Save this AMI ID for pipeline configuration!"
echo ""
