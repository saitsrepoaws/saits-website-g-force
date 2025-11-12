#!/bin/bash
# Complete EC2 setup: Create SSH key + Install everything

set -e

echo "🔧 Setting up SSH access and installing stream server..."
echo ""

# 1. Get instance ID
echo "📋 Step 1: Finding EC2 instance..."
INSTANCE_ID=$(aws ec2 describe-instances --region eu-west-1 \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "❌ No running instance found"
  exit 1
fi

PUBLIC_IP=$(aws ec2 describe-instances --region eu-west-1 \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text)

echo "✅ Instance ID: $INSTANCE_ID"
echo "✅ Public IP: $PUBLIC_IP"
echo ""

# 2. Create SSH key via SSM
echo "🔑 Step 2: Creating SSH key on instance..."
CMD_ID=$(aws ssm send-command \
  --region eu-west-1 \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Create SSH key for ubuntu user" \
  --parameters 'commands=["#!/bin/bash","set -e","# Generate SSH key","mkdir -p /home/ubuntu/.ssh","ssh-keygen -t rsa -b 4096 -f /tmp/gforge-key -N \"\" -C \"gforge-radio-$(date +%Y%m%d)\"","# Add public key to authorized_keys","cat /tmp/gforge-key.pub >> /home/ubuntu/.ssh/authorized_keys","chmod 600 /home/ubuntu/.ssh/authorized_keys","chown -R ubuntu:ubuntu /home/ubuntu/.ssh","# Output private key","echo \"=== PRIVATE KEY START ===\"","cat /tmp/gforge-key","echo \"=== PRIVATE KEY END ===\"","# Cleanup","rm /tmp/gforge-key /tmp/gforge-key.pub","echo \"SSH key created successfully\""]' \
  --output text \
  --query "Command.CommandId")

echo "   Command ID: $CMD_ID"
echo "   Waiting for completion..."
sleep 5

# 3. Get the private key from command output
echo ""
echo "🔑 Step 3: Retrieving private key..."
ATTEMPTS=0
MAX_ATTEMPTS=10

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  STATUS=$(aws ssm get-command-invocation \
    --region eu-west-1 \
    --command-id "$CMD_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")
  
  if [ "$STATUS" = "Success" ]; then
    echo "✅ Command completed successfully"
    break
  elif [ "$STATUS" = "Failed" ]; then
    echo "❌ Command failed"
    aws ssm get-command-invocation \
      --region eu-west-1 \
      --command-id "$CMD_ID" \
      --instance-id "$INSTANCE_ID" \
      --query "StandardErrorContent" \
      --output text
    exit 1
  fi
  
  echo "   Status: $STATUS (attempt $((ATTEMPTS+1))/$MAX_ATTEMPTS)"
  sleep 3
  ATTEMPTS=$((ATTEMPTS+1))
done

# Extract private key
aws ssm get-command-invocation \
  --region eu-west-1 \
  --command-id "$CMD_ID" \
  --instance-id "$INSTANCE_ID" \
  --query "StandardOutputContent" \
  --output text | \
  sed -n '/=== PRIVATE KEY START ===/,/=== PRIVATE KEY END ===/p' | \
  grep -v "=== PRIVATE KEY" > ~/.ssh/gforge-stream-key.pem

chmod 600 ~/.ssh/gforge-stream-key.pem

echo "✅ Private key saved to: ~/.ssh/gforge-stream-key.pem"
echo ""

# 4. Test SSH connection
echo "🔗 Step 4: Testing SSH connection..."
if ssh -i ~/.ssh/gforge-stream-key.pem -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP "echo 'SSH connection successful!'" 2>/dev/null; then
  echo "✅ SSH connection works!"
else
  echo "⚠️ SSH connection not ready yet, waiting 5 seconds..."
  sleep 5
fi

echo ""
echo "📦 Step 5: Running complete installation..."
echo ""

# 5. Run complete installation
ssh -i ~/.ssh/gforge-stream-key.pem -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP 'bash -s' <<'ENDSSH'
#!/bin/bash
set -ex

echo "🚀 Starting complete installation..."

# Update system
sudo apt-get update -qq

# Install packages
echo "Installing Icecast, Liquidsoap, AWS CLI..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  icecast2 \
  liquidsoap \
  liquidsoap-plugin-all \
  awscli \
  jq \
  curl

# Configure Icecast
echo "Configuring Icecast..."
sudo tee /etc/icecast2/icecast.xml > /dev/null <<'ICEEOF'
<icecast>
  <location>EU</location>
  <admin>admin@gforge.radio</admin>
  <limits>
    <clients>100</clients>
    <sources>2</sources>
  </limits>
  <authentication>
    <source-password>gforge2024radio</source-password>
    <admin-password>gforge2024radio</admin-password>
  </authentication>
  <hostname>localhost</hostname>
  <listen-socket><port>8000</port></listen-socket>
  <paths>
    <basedir>/usr/share/icecast2</basedir>
    <logdir>/var/log/icecast2</logdir>
  </paths>
</icecast>
ICEEOF

sudo sed -i 's/ENABLE=false/ENABLE=true/' /etc/default/icecast2

# Get SQS Queue URL
echo "Getting SQS Queue URL..."
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
QUEUE_URL=$(aws sqs list-queues --region $REGION --query "QueueUrls[?contains(@, 'radio-track-stream-queue')]" --output text)

echo "Region: $REGION"
echo "Queue URL: $QUEUE_URL"

if [ -z "$QUEUE_URL" ]; then
  echo "ERROR: Could not find SQS queue!"
  exit 1
fi

# Create Liquidsoap config
echo "Creating Liquidsoap configuration..."
sudo mkdir -p /opt/radio

sudo tee /opt/radio/radio.liq > /dev/null <<LIQEOF
#!/usr/bin/liquidsoap

log.level := 4
log.stdout := true

queue_url = "$QUEUE_URL"
region = "$REGION"

def get_next_track() =
  log("📡 Polling SQS for next track...")
  
  cmd = "aws sqs receive-message --region #{region} --queue-url '#{queue_url}' --max-number-of-messages 1 --wait-time-seconds 20 --output json 2>/dev/null"
  result = process.read(cmd)
  
  if string.contains(substring="fileUrl", result) then
    log("✅ Received track from SQS")
    
    # Extract fileUrl (simplified parsing)
    url_start = string.index(substring="\\"fileUrl\\":\\"", result)
    if url_start >= 0 then
      url_part = string.sub(result, start=url_start + 11)
      url_end = string.index(substring="\\"", url_part)
      if url_end > 0 then
        track_url = string.sub(url_part, start=0, length=url_end)
        track_url = string.replace(pattern="\\\\/", (fun (_) -> "/"), track_url)
        
        log("🎵 Playing: #{track_url}")
        
        # Delete message from queue
        handle_start = string.index(substring="\\"ReceiptHandle\\":\\"", result)
        if handle_start >= 0 then
          handle_part = string.sub(result, start=handle_start + 17)
          handle_end = string.index(substring="\\"", handle_part)
          if handle_end > 0 then
            receipt = string.sub(handle_part, start=0, length=handle_end)
            del_cmd = "aws sqs delete-message --region #{region} --queue-url '#{queue_url}' --receipt-handle '#{receipt}' 2>/dev/null"
            ignore(process.read(del_cmd))
            log("🗑️ Message deleted from queue")
          end
        end
        
        [request.create(track_url)]
      else
        log("⚠️ Could not extract URL")
        []
      end
    else
      log("⚠️ No fileUrl found")
      []
    end
  else
    log("⏳ No messages in queue")
    []
  end
end

# Create dynamic source
radio = request.dynamic(get_next_track)

# Add crossfade
radio = crossfade(start_next=3., fade_in=2., fade_out=2., radio)

# Fallback to blank
radio = fallback(track_sensitive=false, [radio, blank()])

# Normalize
radio = normalize(radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="SQS Streaming",
  genre="Electronic",
  radio
)

log("🎵 Liquidsoap started - listening to SQS")
LIQEOF

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/liquidsoap-radio.service > /dev/null <<'SERVICEEOF'
[Unit]
Description=Liquidsoap Radio Stream
After=network.target icecast2.service
Requires=icecast2.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/liquidsoap /opt/radio/radio.liq
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Start services
echo "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable icecast2
sudo systemctl restart icecast2
sleep 2
sudo systemctl enable liquidsoap-radio
sudo systemctl restart liquidsoap-radio
sleep 3

# Check status
echo ""
echo "✅ Installation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Status:"
sudo systemctl status icecast2 --no-pager -l | head -5
echo ""
sudo systemctl status liquidsoap-radio --no-pager -l | head -5
echo ""
echo "🌐 Stream URL:"
echo "   http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000/stream.mp3"
echo ""
echo "🎵 Stream should be live now!"

ENDSSH

SSH_EXIT=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $SSH_EXIT -eq 0 ]; then
  echo "✅ Complete installation finished successfully!"
  echo ""
  echo "🌐 Stream URL: http://$PUBLIC_IP:8000/stream.mp3"
  echo ""
  echo "🔗 SSH access:"
  echo "   ssh -i ~/.ssh/gforge-stream-key.pem ubuntu@$PUBLIC_IP"
  echo ""
  echo "📝 Check logs:"
  echo "   ssh -i ~/.ssh/gforge-stream-key.pem ubuntu@$PUBLIC_IP 'sudo journalctl -u liquidsoap-radio -f'"
else
  echo "❌ Installation encountered errors"
  exit 1
fi
