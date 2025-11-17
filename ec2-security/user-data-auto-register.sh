#!/bin/bash
##############################################
# G-FORGE RADIO - EC2 AUTO-REGISTER USER DATA
# 
# Runs on EC2 first boot to:
# 1. Get instance metadata
# 2. Trigger Lambda to update Parameter Store
# 3. Update DNS records
# 4. Log results to CloudWatch
##############################################

set -e

# Logging
exec > >(tee /var/log/ec2-auto-register.log)
exec 2>&1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 EC2 AUTO-REGISTER - $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get instance metadata
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d " " -f 2)
PUBLIC_IP=$(ec2-metadata --public-ipv4 | cut -d " " -f 2)
PRIVATE_IP=$(ec2-metadata --local-ipv4 | cut -d " " -f 2)
REGION=$(ec2-metadata --availability-zone | cut -d " " -f 2 | sed 's/[a-z]$//')

echo "📋 Instance Metadata:"
echo "   Instance ID:  $INSTANCE_ID"
echo "   Public IP:    $PUBLIC_IP"
echo "   Private IP:   $PRIVATE_IP"
echo "   Region:       $REGION"
echo ""

# Trigger Lambda via AWS CLI
echo "🔄 Triggering Parameter Store update Lambda..."

# Create payload
PAYLOAD=$(cat <<EOF
{
  "instanceId": "$INSTANCE_ID",
  "publicIp": "$PUBLIC_IP",
  "privateIp": "$PRIVATE_IP",
  "region": "$REGION",
  "source": "user-data-script"
}
EOF
)

# Invoke Lambda
LAMBDA_RESULT=$(aws lambda invoke \
  --function-name ec2-parameter-updater \
  --payload "$PAYLOAD" \
  --region $REGION \
  /tmp/lambda-response.json 2>&1)

if [ $? -eq 0 ]; then
  echo "✅ Lambda invoked successfully"
  cat /tmp/lambda-response.json
  echo ""
else
  echo "❌ Lambda invocation failed:"
  echo "$LAMBDA_RESULT"
  echo ""
  echo "⚠️  Falling back to direct Parameter Store update..."
  
  # Fallback: Direct SSM update
  aws ssm put-parameter --name "/gforge-radio/ec2/instance-id" --value "$INSTANCE_ID" --type String --overwrite --region $REGION
  aws ssm put-parameter --name "/gforge-radio/ec2/public-ip" --value "$PUBLIC_IP" --type String --overwrite --region $REGION
  aws ssm put-parameter --name "/gforge-radio/ec2/private-ip" --value "$PRIVATE_IP" --type String --overwrite --region $REGION
  
  echo "✅ Parameters updated via fallback"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ EC2 AUTO-REGISTER COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Send success notification to CloudWatch Logs
echo "Instance $INSTANCE_ID registered successfully at $(date)" | logger -t ec2-auto-register

exit 0
