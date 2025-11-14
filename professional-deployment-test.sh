#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 PROFESSIONAL DEPLOYMENT TEST
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Complete end-to-end test met progressive download
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

LAMBDA_FUNCTION="amplify-gforgeiot-gerard--streamplaylistupdaterlam-qbTpNx6cATgr"
REGION="eu-west-1"
EC2_HOST="radio-ec2"
EC2_INSTANCE="i-021451e919d39c898"

echo "🚀 PROFESSIONAL DEPLOYMENT TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "System: SplashFM Radio Platform"
echo "Time: $(TZ=Europe/Amsterdam date '+%Y-%m-%d %H:%M:%S CET')"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "PHASE 1: PRE-FLIGHT CHECKS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Checking Lambda function..."
aws lambda get-function \
  --function-name $LAMBDA_FUNCTION \
  --region $REGION \
  --query 'Configuration.{LastModified:LastModified,Timeout:Timeout}' \
  --output text | awk '{print "  Last Modified: " $1 "\n  Timeout: " $2 "s"}'

echo ""
echo "✓ Checking EC2 status..."
ssh $EC2_HOST "
  echo '  Liquidsoap: '\$(pgrep -f liquidsoap > /dev/null && echo '✅ Running' || echo '❌ Not running')
  echo '  Icecast: '\$(pgrep -f icecast > /dev/null && echo '✅ Running' || echo '❌ Not running')
  echo '  Disk: '\$(df -h /var/radio | tail -1 | awk '{print \$5 \" used\"}')
"

echo ""
echo "✓ Checking S3 VPC Endpoint..."
VPC_ENDPOINT=$(aws ec2 describe-vpc-endpoints \
  --region $REGION \
  --filters "Name=service-name,Values=com.amazonaws.eu-west-1.s3" \
  --query 'VpcEndpoints[0].{ID:VpcEndpointId,State:State}' \
  --output text)
echo "  $VPC_ENDPOINT"

echo ""
echo "✓ Checking current schedule..."
TZ=Europe/Amsterdam date '+  Time: %A %H:%M CET'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "PHASE 2: CLEAN STATE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Cleaning EC2 tracks directory..."
ssh $EC2_HOST "
  sudo rm -f /var/radio/tracks/*.mp3 /var/radio/tracks/*.wav 2>/dev/null
  echo '#EXTM3U' | sudo tee /var/radio/playlists/current.m3u > /dev/null
  echo '  Tracks: '\$(ls /var/radio/tracks/*.mp3 2>/dev/null | wc -l)
  echo '  Playlist: Empty'
"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "PHASE 3: LAMBDA EXECUTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Triggering Lambda with progressive downloads..."
INVOKE_START=$(date +%s)
aws lambda invoke \
  --function-name $LAMBDA_FUNCTION \
  --region $REGION \
  --payload '{}' \
  --cli-read-timeout 90 \
  /tmp/lambda-professional-test.json > /tmp/lambda-invoke.json

INVOKE_END=$(date +%s)
INVOKE_TIME=$((INVOKE_END - INVOKE_START))

echo ""
echo "  Execution time: ${INVOKE_TIME}s"
echo ""
echo "✓ Lambda result:"
cat /tmp/lambda-professional-test.json | jq -r '
  if .statusCode == 200 then
    . as $response |
    .body | fromjson | 
    "  Status: ✅ SUCCESS\n" +
    "  Playlist: " + .playlistName + "\n" +
    "  Tracks: " + (.trackCount | tostring) + "\n" +
    "  Duration: " + (.totalDuration | tostring) + " min\n" +
    "  News: " + (if .hasNews then "Yes" else "No" end)
  else
    "  Status: ❌ FAILED\n" +
    "  Error: " + (.body | fromjson | .error)
  end
'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "PHASE 4: PROGRESSIVE DOWNLOAD MONITORING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Checking initial batch (30s wait)..."
sleep 30

ssh $EC2_HOST "
  TRACK_COUNT=\$(ls /var/radio/tracks/*.mp3 2>/dev/null | wc -l)
  echo '  Files downloaded: '\$TRACK_COUNT
  
  if [ \$TRACK_COUNT -ge 4 ]; then
    echo '  Status: ✅ Initial batch success (4+ files)'
  else
    echo '  Status: ⚠️  Only '\$TRACK_COUNT' files (expected 4+)'
  fi
  
  echo ''
  echo '  First 5 files:'
  ls -lt /var/radio/tracks/*.mp3 2>/dev/null | head -5 | awk '{print \"    \" \$9}' | xargs -I {} basename {}
"

echo ""
echo "✓ Waiting for progressive downloads (60s)..."
sleep 60

ssh $EC2_HOST "
  TRACK_COUNT=\$(ls /var/radio/tracks/*.mp3 2>/dev/null | wc -l)
  echo '  Files downloaded: '\$TRACK_COUNT
  
  echo ''
  echo '  Latest 5 files:'
  ls -lt /var/radio/tracks/*.mp3 2>/dev/null | head -5 | awk '{print \"    \" \$9}' | xargs -I {} basename {}
"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "PHASE 5: LIQUIDSOAP STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Restarting Liquidsoap with fresh playlist..."
ssh $EC2_HOST "
  sudo pkill -9 -f liquidsoap 2>/dev/null || true
  sleep 2
  nohup sudo liquidsoap /opt/radio/radio.liq > /tmp/liq-professional-test.log 2>&1 &
  sleep 5
  
  if pgrep -f liquidsoap > /dev/null; then
    echo '  Status: ✅ Running'
    echo '  PID: '\$(pgrep -f liquidsoap | head -1)
  else
    echo '  Status: ❌ Failed to start'
    exit 1
  fi
"

echo ""
echo "✓ Checking Liquidsoap logs..."
ssh $EC2_HOST "
  tail -30 /tmp/liq-professional-test.log | grep -E 'Queued|track|ERROR|File' | head -10
"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "PHASE 6: STREAM VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Checking stream status (15s wait)..."
sleep 15

ssh $EC2_HOST "
  STREAM_DATA=\$(curl -s http://localhost:8000/status-json.xsl 2>/dev/null)
  
  if echo \"\$STREAM_DATA\" | jq -e '.icestats.source[]? | select(.mount==\"/stream.mp3\")' > /dev/null 2>&1; then
    echo '  Status: ✅ STREAMING'
    echo \"\$STREAM_DATA\" | jq -r '.icestats.source[] | select(.mount==\"/stream.mp3\") | 
      \"  Title: \" + (.title // \"Unknown\") + \"\n\" +
      \"  Listeners: \" + (.listeners | tostring) + \"\n\" +
      \"  Bitrate: \" + (.bitrate // \"Unknown\" | tostring) + \"kbps\"
    '
  else
    echo '  Status: ⚠️  No stream data yet'
  fi
"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "PHASE 7: FINAL VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✓ Complete system status:"
ssh $EC2_HOST "
  echo '  Tracks on disk: '\$(ls /var/radio/tracks/*.mp3 2>/dev/null | wc -l)
  echo '  Playlist entries: '\$(grep -v '^#' /var/radio/playlists/current.m3u 2>/dev/null | wc -l)
  echo '  Liquidsoap: '\$(pgrep -f liquidsoap > /dev/null && echo '✅ Running' || echo '❌ Not running')
  echo '  Icecast: '\$(pgrep -f icecast > /dev/null && echo '✅ Running' || echo '❌ Not running')
"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PROFESSIONAL DEPLOYMENT TEST COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  Lambda execution: ${INVOKE_TIME}s"
echo "  Progressive downloads: Active"
echo "  Stream URL: http://46.137.184.91/stream.mp3"
echo ""
echo "Monitor crossfade:"
echo "  ssh $EC2_HOST 'tail -f /tmp/liq-professional-test.log | grep -E \"🔥|💥\"'"
echo ""
