#!/bin/bash
set -e

echo "🔧 Fixing G-Forge Radio Stream"
echo "=============================="

# 1. Download S3-enabled config
echo "📥 Downloading Liquidsoap S3 config..."
aws s3 cp s3://radio-playlists-035636364722/scripts/radio-s3.liq /etc/liquidsoap/radio.liq

# 2. Download and run sync script
echo "📥 Syncing playlist..."
aws s3 cp s3://radio-playlists-035636364722/scripts/sync-playlist.sh /opt/radio/sync-playlist.sh
chmod +x /opt/radio/sync-playlist.sh
/opt/radio/sync-playlist.sh

# 3. Verify playlist has S3 paths
echo "📋 Playlist check:"
head -5 /tmp/current-playlist.m3u

# 4. Stop services
echo "🛑 Stopping services..."
systemctl stop liquidsoap || true
systemctl stop icecast2 || true
sleep 2

# 5. Start Icecast
echo "▶️  Starting Icecast..."
systemctl start icecast2
sleep 3

# 6. Start Liquidsoap
echo "▶️  Starting Liquidsoap..."
systemctl start liquidsoap
sleep 8

# 7. Check status
echo ""
echo "📊 Status:"
systemctl is-active icecast2 && echo "✅ Icecast running" || echo "❌ Icecast failed"
systemctl is-active liquidsoap && echo "✅ Liquidsoap running" || echo "❌ Liquidsoap failed"

echo ""
echo "🎵 Stream check:"
curl -s http://localhost:8000/status-json.xsl | jq -r '.icestats.source | "Title: \(.title // "Starting...")\nStart: \(.stream_start)"' || echo "Connecting..."

echo ""
echo "📝 Recent Liquidsoap logs:"
journalctl -u liquidsoap -n 10 --no-pager

echo ""
echo "✅ Fix script complete!"
