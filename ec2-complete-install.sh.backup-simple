#!/bin/bash
# Complete EC2 Stream Server Setup
# Run this script INSIDE the EC2 instance via SSM

set -e

echo "🚀 G-Forge Radio - Complete Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Update system
echo "📦 Step 1/7: Updating system..."
sudo apt-get update -qq

# 2. Install required packages
echo "📦 Step 2/7: Installing packages (Icecast, Liquidsoap, AWS CLI)..."
sudo apt-get install -y \
  icecast2 \
  liquidsoap \
  liquidsoap-plugin-all \
  curl \
  jq \
  awscli

# 3. Configure Icecast
echo "⚙️ Step 3/7: Configuring Icecast..."
sudo tee /etc/icecast2/icecast.xml > /dev/null <<'EOF'
<icecast>
  <location>EU</location>
  <admin>admin@gforge.radio</admin>
  <limits>
    <clients>100</clients>
    <sources>2</sources>
    <queue-size>524288</queue-size>
    <client-timeout>30</client-timeout>
    <header-timeout>15</header-timeout>
    <source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect>
    <burst-size>65535</burst-size>
  </limits>
  <authentication>
    <source-password>gforge2024radio</source-password>
    <relay-password>gforge2024radio</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>gforge2024radio</admin-password>
  </authentication>
  <hostname>localhost</hostname>
  <listen-socket>
    <port>8000</port>
  </listen-socket>
  <fileserve>1</fileserve>
  <paths>
    <basedir>/usr/share/icecast2</basedir>
    <logdir>/var/log/icecast2</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
    <alias source="/" destination="/status.xsl"/>
  </paths>
  <logging>
    <accesslog>access.log</accesslog>
    <errorlog>error.log</errorlog>
    <loglevel>3</loglevel>
  </logging>
</icecast>
EOF

sudo sed -i 's/ENABLE=false/ENABLE=true/' /etc/default/icecast2

# 4. Get SQS Queue URL from EC2 metadata
echo "📡 Step 4/7: Getting SQS Queue URL..."
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
QUEUE_URL=$(aws sqs list-queues --region $REGION --query "QueueUrls[?contains(@, 'radio-track-stream-queue')]" --output text)

echo "   Region: $REGION"
echo "   Queue: $QUEUE_URL"

# 5. Create Liquidsoap config
echo "⚙️ Step 5/7: Creating Liquidsoap configuration..."
sudo mkdir -p /opt/radio

sudo tee /opt/radio/radio.liq > /dev/null <<EOF
#!/usr/bin/liquidsoap

# Logging
log.file := true
log.stdout := true
log.level := 4

# SQS Configuration
queue_url = "$QUEUE_URL"
region = "$REGION"

# Function to get next track from SQS
def get_next_track() =
  log("Polling SQS for next track...")
  
  # Receive message from SQS
  cmd = "aws sqs receive-message --region #{region} --queue-url '#{queue_url}' --max-number-of-messages 1 --wait-time-seconds 20 --output json"
  result = process.read(cmd)
  
  # Parse JSON and extract track URL
  if string.contains(substring="Body", result) then
    log("Received track from SQS")
    
    # Extract fileUrl from message body
    body_start = string.index(substring="\\"Body\\":\\"", result)
    if body_start >= 0 then
      body_part = string.sub(result, start=body_start + 8)
      body_end = string.index(substring="\\"", body_part)
      if body_end > 0 then
        body = string.sub(body_part, start=0, length=body_end)
        
        # Parse fileUrl from body
        url_start = string.index(substring="\\"fileUrl\\":\\"", body)
        if url_start >= 0 then
          url_part = string.sub(body, start=url_start + 11)
          url_end = string.index(substring="\\"", url_part)
          if url_end > 0 then
            track_url = string.sub(url_part, start=0, length=url_end)
            
            # Unescape the S3 path
            track_url = string.replace(pattern="\\\\/", (fun (_) -> "/"), track_url)
            
            log("Track URL: #{track_url}")
            
            # Extract receipt handle for deletion
            handle_start = string.index(substring="\\"ReceiptHandle\\":\\"", result)
            if handle_start >= 0 then
              handle_part = string.sub(result, start=handle_start + 17)
              handle_end = string.index(substring="\\"", handle_part)
              if handle_end > 0 then
                receipt = string.sub(handle_part, start=0, length=handle_end)
                
                # Delete message from queue
                del_cmd = "aws sqs delete-message --region #{region} --queue-url '#{queue_url}' --receipt-handle '#{receipt}'"
                ignore(process.read(del_cmd))
                log("Message deleted from queue")
              end
            end
            
            # Return track request
            [request.create(track_url)]
          else
            log("Could not extract URL")
            []
          end
        else
          log("No fileUrl in message")
          []
        end
      else
        log("Could not parse body")
        []
      end
    else
      log("No Body in message")
      []
    end
  else
    log("No messages in queue, waiting...")
    []
  end
end

# Dynamic playlist from SQS
radio = request.dynamic(get_next_track)

# Crossfade between tracks
radio = crossfade(start_next=3., fade_in=2., fade_out=2., radio)

# Fallback to blank if no tracks
radio = fallback(track_sensitive=false, [radio, blank()])

# Normalize audio
radio = normalize(radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="Powered by SQS",
  genre="Electronic",
  url="http://gforge.radio",
  radio
)

log("Liquidsoap started - listening to SQS queue")
EOF

# 6. Create systemd service
echo "⚙️ Step 6/7: Creating systemd service..."
sudo tee /etc/systemd/system/liquidsoap-radio.service > /dev/null <<'EOF'
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
EOF

# 7. Start services
echo "🚀 Step 7/7: Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable icecast2
sudo systemctl restart icecast2
sleep 2
sudo systemctl enable liquidsoap-radio
sudo systemctl restart liquidsoap-radio
sleep 3

# 8. Verify
echo ""
echo "✅ Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Status:"
echo "   Icecast:    $(systemctl is-active icecast2)"
echo "   Liquidsoap: $(systemctl is-active liquidsoap-radio)"
echo ""
echo "🌐 Stream URL:"
echo "   http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000/stream.mp3"
echo ""
echo "📝 Check logs:"
echo "   sudo journalctl -u icecast2 -f"
echo "   sudo journalctl -u liquidsoap-radio -f"
echo ""
echo "🎵 Stream should be live in 1-2 minutes!"
