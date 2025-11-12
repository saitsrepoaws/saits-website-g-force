#!/bin/bash
set -e

echo "🚀 Complete G-Forge Radio Setup"
echo "================================"
echo ""

# 1. Download all scripts
echo "📥 Step 1: Downloading scripts..."
aws s3 cp s3://radio-playlists-035636364722/scripts/sync-playlist.sh /opt/radio/sync-playlist.sh
aws s3 cp s3://radio-playlists-035636364722/scripts/radio-final.liq /etc/liquidsoap/radio.liq
chmod +x /opt/radio/sync-playlist.sh

# 2. Run sync
echo "📥 Step 2: Syncing playlist and audio files..."
/opt/radio/sync-playlist.sh
echo "   Audio files: $(ls /tmp/audio/ | wc -l)"

# 3. Fix permissions
echo "🔐 Step 3: Fixing permissions..."
chown -R ubuntu:ubuntu /tmp/audio/
chown ubuntu:ubuntu /tmp/current-playlist.m3u
chmod 644 /tmp/current-playlist.m3u

# 4. Update systemd service
echo "⚙️ Step 4: Configuring systemd..."
cat > /etc/systemd/system/liquidsoap.service <<EOF
[Unit]
Description=Liquidsoap Radio Server
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/bin/liquidsoap /etc/liquidsoap/radio.liq
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable liquidsoap

# 5. Restart services
echo "🔄 Step 5: Restarting services..."
systemctl restart icecast2
sleep 2
systemctl restart liquidsoap
sleep 5

# 6. Verify
echo ""
echo "✅ Setup complete! Status:"
echo "   Icecast: $(systemctl is-active icecast2)"
echo "   Liquidsoap: $(systemctl is-active liquidsoap)"
echo ""
echo "🎵 Stream info:"
curl -s http://localhost:8000/status-json.xsl | jq -r '.icestats.source | "   Title: \(.title // "Starting...")\n   Started: \(.stream_start)"' 2>/dev/null || echo "   Checking..."

echo ""
echo "✅ Done!"
