#!/bin/bash
# Launch new Ubuntu 24.04 instance for Liquidsoap 2.2.5+

echo "🚀 Launching new Ubuntu 24.04 instance..."

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-049442a6cf8319180 \
  --instance-type t3.small \
  --subnet-id subnet-0b65a010f3283e56f \
  --security-group-ids sg-0d77592e5d47c3761 \
  --iam-instance-profile Arn="arn:aws:iam::035636364722:instance-profile/amplify-gforgeiot-gerard-sandbox-28f2e0c620-function1351588B-18SZQZAVQ6JS8-StreamServerInstanceProfileC0407D9A-u1HK6ZJ2e8ss" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=G-Forge-Radio-v2-Ubuntu24},{Key=Environment,Value=production},{Key=Application,Value=radio-stream}]' \
  --user-data file://instance-setup.sh \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✅ Instance launched: $INSTANCE_ID"
echo ""
echo "⏳ Waiting for instance to be running..."

aws ec2 wait instance-running --instance-ids $INSTANCE_ID

echo "✅ Instance is running!"
echo ""
echo "📋 Instance details:"
aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].{ID:InstanceId,State:State.Name,IP:PrivateIpAddress,PublicIP:PublicIpAddress}' \
  --output table

echo ""
echo "🔧 Setup will continue via user-data script..."
echo "⏱️  Wait 5-10 minutes for complete setup"
echo ""
echo "📝 To check progress:"
echo "   aws ssm start-session --target $INSTANCE_ID"
echo "   tail -f /var/log/cloud-init-output.log"
echo ""
echo "Instance ID: $INSTANCE_ID"
