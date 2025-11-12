#!/bin/bash
# Complete stream startup script

echo "🎵 Starting G-Forge Radio Stream..."

# 1. Sync playlist and audio
echo "📥 Syncing from S3..."
/opt/radio/sync-playlist.sh

# 2. Fix permissions
echo "🔐 Fixing permissions..."
chown -R ubuntu:ubuntu /tmp/audio/
chown ubuntu:ubuntu /tmp/current-playlist.m3u
chmod 644 /tmp/current-playlist.m3u
chmod 644 /tmp/audio/*

# 3. Restart services
echo "🔄 Restarting services..."
systemctl restart icecast2
sleep 3
systemctl restart liquidsoap
sleep 5

# 4. Check status
echo ""
echo "📊 Status:"
systemctl is-active icecast2 && echo "✅ Icecast running" || echo "❌ Icecast failed"
systemctl is-active liquidsoap && echo "✅ Liquidsoap running" || echo "❌ Liquidsoap failed"

echo ""
echo "🎵 Stream info:"
curl -s http://localhost:8000/status-json.xsl | jq -r '.icestats.source | "Title: \(.title // "No track")\nStart: \(.stream_start)"'

echo ""
echo "✅ Done!"
