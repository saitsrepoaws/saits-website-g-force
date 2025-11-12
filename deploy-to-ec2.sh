#!/bin/bash
# Deploy complete setup to EC2 via SSM

echo "🚀 Deploying to EC2 Stream Server..."

# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances --region eu-west-1 \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "❌ No running instance found"
  exit 1
fi

echo "✅ Found instance: $INSTANCE_ID"
echo ""

# Send setup script to instance
echo "📤 Uploading setup script..."
aws ssm send-command \
  --region eu-west-1 \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters file:///dev/stdin <<'EOFCOMMAND'
{
  "commands": [
    "#!/bin/bash",
    "set -e",
    "echo '🚀 G-Forge Radio - Complete Installation'",
    "echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'",
    "",
    "echo '📦 Step 1/7: Updating system...'",
    "apt-get update -qq",
    "",
    "echo '📦 Step 2/7: Installing packages...'",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y icecast2 liquidsoap liquidsoap-plugin-all curl jq awscli",
    "",
    "echo '⚙️ Step 3/7: Configuring Icecast...'",
    "cat > /etc/icecast2/icecast.xml <<'ICEEOF'",
    "<icecast>",
    "  <location>EU</location>",
    "  <admin>admin@gforge.radio</admin>",
    "  <limits>",
    "    <clients>100</clients>",
    "    <sources>2</sources>",
    "  </limits>",
    "  <authentication>",
    "    <source-password>gforge2024radio</source-password>",
    "    <admin-password>gforge2024radio</admin-password>",
    "  </authentication>",
    "  <hostname>localhost</hostname>",
    "  <listen-socket><port>8000</port></listen-socket>",
    "  <paths>",
    "    <basedir>/usr/share/icecast2</basedir>",
    "    <logdir>/var/log/icecast2</logdir>",
    "  </paths>",
    "</icecast>",
    "ICEEOF",
    "",
    "sed -i 's/ENABLE=false/ENABLE=true/' /etc/default/icecast2",
    "",
    "echo '📡 Step 4/7: Getting SQS Queue URL...'",
    "REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)",
    "QUEUE_URL=$(aws sqs list-queues --region $REGION --query \"QueueUrls[?contains(@, 'radio-track-stream-queue')]\" --output text)",
    "echo \"Queue: $QUEUE_URL\"",
    "",
    "echo '⚙️ Step 5/7: Creating Liquidsoap config...'",
    "mkdir -p /opt/radio",
    "# (Liquidsoap config will be created here)",
    "",
    "echo '🚀 Step 6/7: Starting services...'",
    "systemctl enable icecast2",
    "systemctl restart icecast2",
    "sleep 2",
    "",
    "echo '✅ Installation complete!'"
  ]
}
EOFCOMMAND

echo ""
echo "✅ Command sent! Check status:"
echo "   aws ssm list-command-invocations --region eu-west-1 --instance-id $INSTANCE_ID --details"
echo ""
echo "Or connect manually:"
echo "   aws ssm start-session --region eu-west-1 --target $INSTANCE_ID"
