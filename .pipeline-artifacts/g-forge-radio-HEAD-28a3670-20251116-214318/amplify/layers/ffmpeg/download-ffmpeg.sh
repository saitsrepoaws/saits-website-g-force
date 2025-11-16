#!/bin/bash

# Download FFmpeg static binary for Amazon Linux 2 (Lambda compatible)
# Using johnvansickle.com static builds

set -e

echo "📥 Downloading FFmpeg static binary for Amazon Linux 2..."

cd "$(dirname "$0")"

# Download FFmpeg static build (amd64)
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz

echo "📦 Extracting FFmpeg..."
tar xf ffmpeg.tar.xz

# Find the extracted directory
FFMPEG_DIR=$(find . -maxdepth 1 -name "ffmpeg-*-amd64-static" -type d | head -n 1)

# Copy ffmpeg binary to bin/
cp "$FFMPEG_DIR/ffmpeg" bin/ffmpeg
chmod +x bin/ffmpeg

# Cleanup
rm -rf ffmpeg.tar.xz "$FFMPEG_DIR"

echo "✅ FFmpeg binary ready: $(pwd)/bin/ffmpeg"
echo "📊 Binary size: $(du -h bin/ffmpeg | cut -f1)"

# Test it
./bin/ffmpeg -version | head -n 1
