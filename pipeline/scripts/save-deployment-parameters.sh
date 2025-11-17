#!/bin/bash
################################################################################
# SAVE DEPLOYMENT PARAMETERS
################################################################################
# Purpose: Save all deployment parameters to Parameter Store and Stack Outputs
# Usage: Called automatically by CodeDeploy hooks
################################################################################

set -e

DEPLOYMENT_ID="${1:-unknown}"
INSTANCE_ID="${2:-unknown}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 SAVING DEPLOYMENT PARAMETERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Deployment ID: $DEPLOYMENT_ID"
echo "Instance ID: $INSTANCE_ID"
echo "Timestamp: $TIMESTAMP"
echo ""

# Get instance details if instance ID provided
if [ "$INSTANCE_ID" != "unknown" ]; then
  PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region eu-west-1 \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text 2>/dev/null || echo "unknown")
    
  PRIVATE_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region eu-west-1 \
    --query 'Reservations[0].Instances[0].PrivateIpAddress' \
    --output text 2>/dev/null || echo "unknown")
    
  AVAILABILITY_ZONE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region eu-west-1 \
    --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' \
    --output text 2>/dev/null || echo "unknown")
else
  PUBLIC_IP="unknown"
  PRIVATE_IP="unknown"
  AVAILABILITY_ZONE="unknown"
fi

echo "Public IP: $PUBLIC_IP"
echo "Private IP: $PRIVATE_IP"
echo "AZ: $AVAILABILITY_ZONE"
echo ""

# Parameter Store path
PARAM_PATH="/g-forge-radio/production"

# Save parameters to Parameter Store
echo "Saving to Parameter Store..."

aws ssm put-parameter \
  --name "$PARAM_PATH/deployment/last-deployment-id" \
  --value "$DEPLOYMENT_ID" \
  --type "String" \
  --overwrite \
  --region eu-west-1 \
  --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio

aws ssm put-parameter \
  --name "$PARAM_PATH/deployment/last-deployment-time" \
  --value "$TIMESTAMP" \
  --type "String" \
  --overwrite \
  --region eu-west-1 \
  --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio

aws ssm put-parameter \
  --name "$PARAM_PATH/ec2/instance-id" \
  --value "$INSTANCE_ID" \
  --type "String" \
  --overwrite \
  --region eu-west-1 \
  --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio

aws ssm put-parameter \
  --name "$PARAM_PATH/ec2/public-ip" \
  --value "$PUBLIC_IP" \
  --type "String" \
  --overwrite \
  --region eu-west-1 \
  --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio

aws ssm put-parameter \
  --name "$PARAM_PATH/ec2/private-ip" \
  --value "$PRIVATE_IP" \
  --type "String" \
  --overwrite \
  --region eu-west-1 \
  --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio

aws ssm put-parameter \
  --name "$PARAM_PATH/ec2/availability-zone" \
  --value "$AVAILABILITY_ZONE" \
  --type "String" \
  --overwrite \
  --region eu-west-1 \
  --tags Key=Application,Value=g-forge-radio Key=CostCenter,Value=g-forge-radio

echo "✅ Parameters saved to Parameter Store"
echo ""

# Save to CloudFormation-style outputs file
OUTPUT_FILE="/opt/g-forge/deployment-outputs.json"
mkdir -p /opt/g-forge

cat > "$OUTPUT_FILE" << EOF
{
  "StackOutputs": {
    "DeploymentId": "$DEPLOYMENT_ID",
    "DeploymentTime": "$TIMESTAMP",
    "InstanceId": "$INSTANCE_ID",
    "PublicIp": "$PUBLIC_IP",
    "PrivateIp": "$PRIVATE_IP",
    "AvailabilityZone": "$AVAILABILITY_ZONE",
    "StreamUrl": "https://splashfm.nl/splashfm.mp3",
    "PlayerUrl": "https://splashfm.nl/",
    "Application": "g-forge-radio",
    "Environment": "production",
    "Version": "v1.0.0"
  },
  "ParameterStorePath": "$PARAM_PATH",
  "Timestamp": "$TIMESTAMP"
}
EOF

echo "✅ Stack outputs saved to: $OUTPUT_FILE"
echo ""

# Display outputs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 DEPLOYMENT OUTPUTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$OUTPUT_FILE" | jq '.'
echo ""

echo "✅ All parameters saved!"
echo ""
