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

# Step 1: Launch temporary EC2 instance (WITHOUT user-data - we'll use SSM!)
echo "🔧 Step 1: Launching temporary build instance..."

# Get IAM instance profile from existing EC2 (for SSM access)
INSTANCE_PROFILE=$(aws ec2 describe-instances \
  --instance-ids i-054754fbca0bda346 \
  --region $REGION \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' \
  --output text)

echo "   Using IAM profile: $INSTANCE_PROFILE"

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0d64bb532e0502c46 \
  --instance-type $INSTANCE_TYPE \
  --subnet-id $SUBNET_ID \
  --security-group-ids $SECURITY_GROUP \
  --iam-instance-profile Arn="$INSTANCE_PROFILE" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=AMI-Build-Temp},{Key=Purpose,Value=AMI-Builder}]" \
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

# Step 3: Wait for SSM agent to be ready
echo "⏳ Step 3: Waiting for SSM agent (90 sec)..."
sleep 90
echo "✅ SSM should be ready"
echo ""

# Step 4: Run setup script via SSM
echo "🔧 Step 4: Running setup script via SSM..."
echo "   Encoding and sending setup script..."

# Base64 encode the setup script for safe transfer
SETUP_SCRIPT_B64=$(cat $(dirname $0)/ami-setup.sh | base64)

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --comment "AMI Setup - Installing all dependencies" \
  --parameters commands="echo '$SETUP_SCRIPT_B64' | base64 -d > /tmp/ami-setup.sh && chmod +x /tmp/ami-setup.sh && bash /tmp/ami-setup.sh" \
  --region $REGION \
  --query 'Command.CommandId' \
  --output text)

echo "✅ Command sent: $CMD_ID"
echo ""

# Step 5: Monitor setup progress
echo "⏳ Step 5: Monitoring setup progress..."
echo "   This will take ~15 minutes..."
echo ""

for i in {1..30}; do
  sleep 30
  STATUS=$(aws ssm get-command-invocation \
    --command-id $CMD_ID \
    --instance-id $INSTANCE_ID \
    --region $REGION \
    --query 'Status' \
    --output text 2>/dev/null || echo "Pending")
  
  echo "   Check $i/30: Status = $STATUS"
  
  if [ "$STATUS" = "Success" ]; then
    echo ""
    echo "✅ Setup completed successfully!"
    break
  elif [ "$STATUS" = "Failed" ]; then
    echo ""
    echo "❌ Setup failed! Check output:"
    aws ssm get-command-invocation \
      --command-id $CMD_ID \
      --instance-id $INSTANCE_ID \
      --region $REGION \
      --query 'StandardErrorContent' \
      --output text
    exit 1
  fi
done

echo ""
echo "📋 Setup output (last 50 lines):"
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region $REGION \
  --query 'StandardOutputContent' \
  --output text | tail -50
echo ""

# Step 6: Stop the instance
echo "🛑 Step 6: Stopping instance for AMI creation..."
aws ec2 stop-instances --instance-ids $INSTANCE_ID --region $REGION
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID --region $REGION
echo "✅ Instance stopped"
echo ""

# Step 7: Create AMI
echo "📸 Step 7: Creating AMI..."
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

# Step 8: Wait for AMI to be available
echo "⏳ Step 8: Waiting for AMI to be available..."
aws ec2 wait image-available --image-ids $AMI_ID --region $REGION
echo "✅ AMI is ready!"
echo ""

# Step 9: Terminate build instance
echo "🗑️  Step 9: Cleaning up build instance..."
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
