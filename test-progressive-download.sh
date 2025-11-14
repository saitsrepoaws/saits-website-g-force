#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧪 PROGRESSIVE DOWNLOAD TEST SCRIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Tests the new progressive download strategy end-to-end
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "🧪 PROGRESSIVE DOWNLOAD SYSTEM TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
LAMBDA_FUNCTION="amplify-gforgeiot-gerard--streamplaylistupdaterlam-qbTpNx6cATgr"
REGION="eu-west-1"
EC2_HOST="radio-ec2"

echo "📋 Pre-flight Check:"
echo "  Lambda: $LAMBDA_FUNCTION"
echo "  EC2: $EC2_HOST"
echo ""

# Step 1: Clean state
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Clean EC2 state"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh $EC2_HOST "
  echo 'Cleaning tracks...'
  sudo rm -f /var/radio/tracks/*.mp3 /var/radio/tracks/*.wav 2>/dev/null
  echo 'Clearing playlist...'
  echo '#EXTM3U' | sudo tee /var/radio/playlists/current.m3u > /dev/null
  echo '✅ Clean state'
  echo ''
  echo 'Current state:'
  echo \"  Tracks: \$(ls /var/radio/tracks/ 2>/dev/null | wc -l)\"
  echo \"  Playlist lines: \$(wc -l /var/radio/playlists/current.m3u | awk '{print \$1}')\"
"

echo ""

# Step 2: Trigger Lambda
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Trigger Lambda"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Invoking $LAMBDA_FUNCTION..."

aws lambda invoke \
  --function-name $LAMBDA_FUNCTION \
  --region $REGION \
  --payload '{}' \
  /tmp/lambda-result.json > /tmp/lambda-invoke.json

echo ""
echo "Lambda Response:"
cat /tmp/lambda-invoke.json | jq '.'

echo ""
echo "Lambda Result:"
cat /tmp/lambda-result.json | jq '.'

# Extract success status
SUCCESS=$(cat /tmp/lambda-result.json | jq -r '.success // false')
TRACK_COUNT=$(cat /tmp/lambda-result.json | jq -r '.trackCount // 0')

if [ "$SUCCESS" == "true" ]; then
  echo ""
  echo "✅ Lambda executed successfully!"
  echo "   Tracks in playlist: $TRACK_COUNT"
else
  echo ""
  echo "❌ Lambda failed or no playlist"
  ERROR=$(cat /tmp/lambda-result.json | jq -r '.error // "Unknown"')
  echo "   Error: $ERROR"
  exit 1
fi

# Step 3: Monitor progressive downloads
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Monitor Progressive Downloads"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Waiting 30 seconds for initial downloads..."
sleep 30

echo ""
echo "Checking EC2 files..."
ssh $EC2_HOST "
  echo 'Files downloaded:'
  ls -lht /var/radio/tracks/ | head -10
  echo ''
  TRACK_COUNT=\$(ls /var/radio/tracks/ 2>/dev/null | wc -l)
  echo \"Total tracks: \$TRACK_COUNT\"
  
  echo ''
  echo 'Playlist entries:'
  PLAYLIST_LINES=\$(grep -v '^#' /var/radio/playlists/current.m3u 2>/dev/null | wc -l)
  echo \"  \$PLAYLIST_LINES tracks in playlist\"
  
  if [ \$TRACK_COUNT -ge 4 ]; then
    echo ''
    echo '✅ Initial batch downloaded! (4+ files)'
  else
    echo ''
    echo '⚠️  Only '\$TRACK_COUNT' files (expected 4+)'
  fi
"

# Step 4: Check Liquidsoap
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Liquidsoap Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh $EC2_HOST "
  if pgrep -f liquidsoap > /dev/null; then
    echo '✅ Liquidsoap running'
    echo ''
    echo 'Recent log (last 20 lines):'
    tail -20 /tmp/liq-fresh-start.log 2>/dev/null | tail -10
  else
    echo '❌ Liquidsoap not running!'
  fi
"

# Step 5: Stream check
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Stream Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh $EC2_HOST "
  curl -s http://localhost:8000/status-json.xsl | jq '.icestats.source[] | select(.mount==\"/stream.mp3\") | {title, listeners, audio_info}'
"

# Step 6: Monitor for crossfade (optional)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Crossfade Monitor (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "To monitor crossfade execution:"
echo "  ssh $EC2_HOST 'tail -f /tmp/liq-fresh-start.log | grep -E \"🔥|💥\"'"
echo ""
echo "You should see:"
echo "  🔥🔥🔥 CROSSFADE FUNCTION CALLED!"
echo "  💥💥💥 SLAM TRANSITION: 0.2s fadeout, NO fadein!"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  Lambda: ✅ Executed"
echo "  Tracks: $TRACK_COUNT in playlist"
echo "  Files: Check EC2 for progressive downloads"
echo "  Stream: Check Icecast status above"
echo ""
echo "Next steps:"
echo "  1. Wait 2-3 minutes for more tracks to download"
echo "  2. Monitor crossfade execution"
echo "  3. Verify smooth transitions"
echo ""
echo "Stream URL: http://46.137.184.91/stream.mp3"
echo ""
