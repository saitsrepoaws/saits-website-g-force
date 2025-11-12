#!/bin/bash
# Check EC2 Stream Server Status

echo "🔍 Checking EC2 Stream Server Status..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get instance ID
echo "📋 Finding EC2 instance..."
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=*StreamServer*" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text 2>/dev/null)

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
  echo "❌ No running StreamServer instance found"
  exit 1
fi

echo "✅ Instance ID: $INSTANCE_ID"
echo ""

# Get instance details
echo "📊 Instance Details:"
aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query "Reservations[0].Instances[0].{State:State.Name,Type:InstanceType,IP:PublicIpAddress,LaunchTime:LaunchTime}" \
  --output table 2>/dev/null

echo ""

# Check user data execution (via CloudWatch logs if available)
echo "📝 Checking if user data script completed..."
echo "   (This requires the instance to have CloudWatch agent installed)"

# Try to connect via SSM
echo ""
echo "🔗 Attempting SSM connection..."
echo "   Run this command to connect:"
echo "   aws ssm start-session --target $INSTANCE_ID"

echo ""
echo "🌐 Testing web endpoints:"
echo "   Port 80 (nginx): $(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/ 2>/dev/null)"
echo "   Port 8000 (icecast): $(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91:8000/ 2>/dev/null)"
echo "   Stream endpoint: $(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/stream.mp3 2>/dev/null)"

echo ""
echo "📋 Manual SSH command (if you have the key):"
echo "   ssh -i ~/.ssh/your-key.pem ubuntu@46.137.184.91"

echo ""
echo "🔧 Manual checks once connected:"
echo "   sudo systemctl status icecast2"
echo "   sudo systemctl status liquidsoap-radio"
echo "   sudo journalctl -u cloud-init-output -f"
echo "   tail -f /var/log/cloud-init-output.log"

echo ""
echo "✅ Done!"
