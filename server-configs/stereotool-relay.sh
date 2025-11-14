#!/bin/bash
# Stereo Tool Processing Relay with Web Interface + LICENSE KEY (OPEN ACCESS)
# MP3 → WAV → Stereo Tool (with web UI) → MP3 → Icecast

set -e

RAW_URL="http://localhost:8000/stream-raw.mp3"
ICECAST_URL="icecast://source:gforge2024radio@localhost:8000/stream-processed.mp3"
STEREO_TOOL="/usr/local/bin/stereotool-cmd"
WEB_PORT="9001"
LICENSE_KEY="<3fa047595fd7f30240fdd93981a10b3581c1a1812197a4f27c2dec0fec2c>"

echo "🎛️ Stereo Tool Relay Starting with LICENSE (OPEN WEB ACCESS)..."
echo "Preset: DEFAULT (FM broadcast quality)"
echo "Web Interface: http://localhost:${WEB_PORT}"
echo "Input: $RAW_URL"
echo "Output: /stream-processed.mp3"
echo "License: REGISTERED"
echo "⚠️  Web interface OPEN for initial setup!"
echo ""

sleep 5

echo "Starting processing pipeline with web interface..."

# Processing pipeline met WEB INTERFACE + LICENSE KEY (no IP restrictions for setup)
exec curl -s "$RAW_URL" | \
  ffmpeg -hide_banner -loglevel error -i - -f wav -acodec pcm_s16le -ar 44100 -ac 2 - | \
  $STEREO_TOOL -k "$LICENSE_KEY" -w "$WEB_PORT" - - | \
  ffmpeg -hide_banner -loglevel error -f wav -i - -f mp3 -b:a 192k \
    -ice_name "Splash FM - Stereo Tool Professional" \
    -ice_description "Professional Audio Processing" \
    -ice_genre "Dance/Pop" \
    -content_type audio/mpeg \
    "$ICECAST_URL"
