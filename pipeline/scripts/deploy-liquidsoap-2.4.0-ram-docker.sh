#!/bin/bash
################################################################################
# LIQUIDSOAP 2.4.0 DOCKER + RAM DISK - ULTRA PERFORMANCE!
################################################################################

set -e

echo "🚀 LIQUIDSOAP 2.4.0 DOCKER + RAM DISK DEPLOYMENT"
echo "=================================================="
echo ""

# Stop any running Liquidsoap
echo "🛑 Stopping old Liquidsoap..."
sudo pkill -9 -f liquidsoap || true
sudo systemctl stop liquidsoap 2>/dev/null || true
sudo systemctl stop liquidsoap-docker 2>/dev/null || true
sudo docker stop liquidsoap 2>/dev/null || true
sudo docker rm liquidsoap 2>/dev/null || true
sleep 2

# Backup old config
echo "💾 Backing up old config..."
if [[ -f /opt/radio/radio.liq ]]; then
    sudo cp /opt/radio/radio.liq /opt/radio/radio.liq.backup-2.0.2-$(date +%Y%m%d_%H%M%S)
fi

# Create new Liquidsoap 2.4.0 config with INTERNAL AUTOCUE
echo "📝 Creating Liquidsoap 2.4.0 config with internal autocue..."
sudo tee /opt/radio/radio.liq > /dev/null <<'LIQUIDSOAP_EOF'
#!/usr/bin/liquidsoap

################################################################################
# LIQUIDSOAP 2.4.0 + INTERNAL AUTOCUE - ULTRA PERFORMANCE!
################################################################################
# RAM Disk: /mnt/ramdisk
# Features: Internal autocue, LUFS normalization, professional crossfading
################################################################################

# Settings
settings.init.allow_root.set(true)
log.level.set(4)

# INTERNAL AUTOCUE (New in 2.3+!)
settings.autocue.cue_file.set(true)
settings.autocue.cue_file.silence.set(-42.0)
settings.autocue.cue_file.overlay.set(-8.0)
settings.autocue.cue_file.overlay_longtail.set(-20.0)
settings.autocue.cue_file.longtail.set(15.0)
settings.autocue.cue_file.fade_out.set(2.5)
settings.autocue.target_loudness.set(-18.0)

log.info("✅ Liquidsoap 2.4.0 with INTERNAL AUTOCUE started!")
log.info("💾 RAM Disk: /mnt/ramdisk")

# AWS Config
sqs_queue_url = "https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
aws_region = "eu-west-1"
ram_disk = "/mnt/ramdisk"

# SQS Track Fetcher
def get_next_track()
  result = process.run.read("
    aws sqs receive-message \
      --queue-url #{sqs_queue_url} \
      --region #{aws_region} \
      --max-number-of-messages 1 \
      --visibility-timeout 300 \
      --wait-time-seconds 10 \
      --output json
  ")
  
  parsed = of_json(default=[("Messages", [[("ReceiptHandle", ""), ("Body", "")]])], result)
  messages = list.assoc(default=[], "Messages", parsed)
  
  if list.length(messages) > 0 then
    message = list.hd(default=[("ReceiptHandle", ""), ("Body", "")], messages)
    receipt_handle = list.assoc(default="", "ReceiptHandle", message)
    body = list.assoc(default="", "Body", message)
    
    if body != "" then
      track_data = of_json(default=[("fileUrl", "")], body)
      file_url = list.assoc(default="", "fileUrl", track_data)
      
      if file_url != "" then
        filename = list.hd(default="track.mp3", string.split(separator="/", file_url) |> list.rev)
        local_path = "#{ram_disk}/#{filename}"
        
        log.info("📥 Downloading to RAM: #{file_url}")
        download_result = process.run("aws s3 cp \"#{file_url}\" \"#{local_path}\" --region #{aws_region}")
        
        if download_result == 0 then
          log.info("✅ Downloaded to RAM: #{local_path}")
          
          # Delete from SQS
          ignore(process.run("
            aws sqs delete-message \
              --queue-url #{sqs_queue_url} \
              --region #{aws_region} \
              --receipt-handle '#{receipt_handle}'
          "))
          
          # Use autocue: protocol for automatic analysis!
          [request.create("autocue:#{local_path}")]
        else
          log.error("❌ Download failed: #{file_url}")
          []
        end
      else
        []
      end
    else
      []
    end
  else
    log.info("ℹ️ Queue empty")
    []
  end
end

# Cleanup after playback
def cleanup_track(m)
  filename = m["filename"]
  if filename != "" and string.contains(substring=ram_disk, filename) then
    log.info("🧹 Cleaning RAM disk: #{filename}")
    ignore(process.run("rm -f #{process.quote(filename)}"))
  end
end

# Create dynamic source with autocue
radio = request.dynamic.list(
  prefetch=1,
  timeout=20.0,
  get_next_track
)

# Apply autocue (redundant but safe)
radio = autocue.cue_file(radio)

# Apply amplify with autocue gain
radio = amplify(
  override="liq_amplify",
  radio
)

# Professional crossfade (uses autocue metadata!)
radio = crossfade(
  duration=4.0,
  minimum=0.5,
  fade_in=1.5,
  fade_out=2.5,
  radio
)

# Cleanup after track ends
radio = source.on_end(radio, cleanup_track)

# Silent fallback
silent = single(mksafe=true, "/opt/radio/silent-stream.mp3")
radio = fallback(track_sensitive=false, [radio, silent])

# Safety
radio = mksafe(radio)

# Metadata logging
def log_metadata(m)
  artist = m["artist"]
  title = m["title"]
  cue_in = m["liq_cue_in"]
  cue_out = m["liq_cue_out"]
  loudness = m["liq_loudness"]
  
  log.info("🎵 NOW PLAYING: #{artist} - #{title}")
  log.info("   Autocue: cue_in=#{cue_in}s, cue_out=#{cue_out}s, loudness=#{loudness} LUFS")
end

radio = source.on_metadata(radio, log_metadata)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192, samplerate=44100, stereo=true),
  host="localhost",
  port=8000,
  password="hackme",
  mount="stream.mp3",
  name="Splash FM - Liquidsoap 2.4.0 + Autocue",
  description="Professional broadcast with internal autocue - RAM disk powered!",
  genre="Electronic/Dance/Pop",
  url="https://splashfm.nl",
  icy_metadata="true",
  radio
)

log.info("🚀 Stream started! RAM disk: #{ram_disk}")
LIQUIDSOAP_EOF

echo "✅ Config created!"

# Create systemd service with Docker + tmpfs in RAM
echo ""
echo "⚙️ Creating systemd service with RAM disk optimization..."
sudo tee /etc/systemd/system/liquidsoap.service > /dev/null <<'SERVICE_EOF'
[Unit]
Description=Liquidsoap 2.4.0 (Docker + RAM Disk)
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
Group=root
Restart=always
RestartSec=10

# Docker run with tmpfs in RAM for ultra performance
ExecStart=/usr/bin/docker run --rm \
  --name liquidsoap \
  --network host \
  --tmpfs /tmp:rw,size=256M,mode=1777 \
  --tmpfs /var/tmp:rw,size=128M,mode=1777 \
  -v /opt/radio:/opt/radio:ro \
  -v /mnt/ramdisk:/mnt/ramdisk:rw \
  -v /var/radio/tracks:/var/radio/tracks:rw \
  -v /home/ubuntu/.aws:/root/.aws:ro \
  -e AWS_DEFAULT_REGION=eu-west-1 \
  -e HOME=/root \
  savonet/liquidsoap:v2.4.0 \
  /opt/radio/radio.liq

ExecStop=/usr/bin/docker stop liquidsoap

# Performance optimizations
Nice=-10
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=50

[Install]
WantedBy=multi-user.target
SERVICE_EOF

echo "✅ Systemd service created!"

# Reload and start
echo ""
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

echo "✅ Enabling service..."
sudo systemctl enable liquidsoap

echo "🚀 Starting Liquidsoap 2.4.0..."
sudo systemctl start liquidsoap

echo ""
echo "⏳ Waiting for startup..."
sleep 5

# Check status
echo ""
echo "📊 Service status:"
sudo systemctl status liquidsoap --no-pager -l | head -20

echo ""
echo "🔍 Docker container:"
sudo docker ps | grep liquidsoap || echo "⚠️ Container not running yet"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "Commands:"
echo "  Status:  sudo systemctl status liquidsoap"
echo "  Logs:    sudo journalctl -u liquidsoap -f"
echo "  Docker:  sudo docker logs -f liquidsoap"
echo "  Stop:    sudo systemctl stop liquidsoap"
echo "  Restart: sudo systemctl restart liquidsoap"
echo ""
echo "Stream:  https://splashfm.nl/splashfm.mp3"
echo "RAM Disk: /mnt/ramdisk (512MB)"
echo ""
echo "💎 LIQUIDSOAP 2.4.0 + INTERNAL AUTOCUE + RAM DISK!"
echo "🚀 ULTRA PERFORMANCE MODE ACTIVATED!"
