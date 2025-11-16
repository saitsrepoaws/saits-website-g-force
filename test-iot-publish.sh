#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📡 IoT Test Script - Publish Track Metadata to Player
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Configuration
IOT_ENDPOINT="d08571201ngqyrl7gmlrx-ats.iot.eu-west-1.amazonaws.com"
IOT_TOPIC="radio/stream/nowplaying"
REGION="eu-west-1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 IoT MESSAGE PUBLISHER - Mac to Player Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Endpoint: $IOT_ENDPOINT"
echo "📢 Topic: $IOT_TOPIC"
echo "🌍 Region: $REGION"
echo ""

# Get track info from arguments or use defaults
ARTIST="${1:-G-Forge Radio}"
TITLE="${2:-Test Track from Mac}"
GENRE="${3:-House}"
BPM="${4:-128}"
ENERGY="${5:-0.75}"

echo "🎵 Track Info:"
echo "   Artist: $ARTIST"
echo "   Title: $TITLE"
echo "   Genre: $GENRE"
echo "   BPM: $BPM"
echo "   Energy: $ENERGY"
echo ""

# Create JSON payload
PAYLOAD=$(cat <<EOF
{
  "artist": "$ARTIST",
  "title": "$TITLE",
  "genre": "$GENRE",
  "bpm": $BPM,
  "energy": $ENERGY,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "Mac Test Script"
}
EOF
)

echo "📦 Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

# Publish to IoT
echo "📡 Publishing to IoT Core..."
echo ""

# Save payload to temp file
TEMP_FILE=$(mktemp)
echo -n "$PAYLOAD" > "$TEMP_FILE"

aws iot-data publish \
    --topic "$IOT_TOPIC" \
    --payload "file://$TEMP_FILE" \
    --region "$REGION"

# Cleanup
rm -f "$TEMP_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ MESSAGE PUBLISHED SUCCESSFULLY!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🎯 Next Steps:"
    echo "   1. Open https://splashfm.nl/"
    echo "   2. Check browser console for: 📥 Message received"
    echo "   3. Watch for 💫 Flash effect on IoT dot"
    echo "   4. Verify metadata updates:"
    echo "      - Track: $TITLE"
    echo "      - Artist: $ARTIST"
    echo ""
    echo "💡 Tip: Keep browser console open (F12)"
    echo ""
else
    echo ""
    echo "❌ PUBLISH FAILED!"
    echo ""
    echo "Possible issues:"
    echo "  - AWS credentials not configured"
    echo "  - No permission to publish to IoT"
    echo "  - Network connectivity issue"
    echo ""
    echo "Run: aws configure"
    echo ""
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 USAGE EXAMPLES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "# Default test message:"
echo "./test-iot-publish.sh"
echo ""
echo "# Custom artist & title:"
echo "./test-iot-publish.sh \"Daft Punk\" \"Around the World\""
echo ""
echo "# Full metadata:"
echo "./test-iot-publish.sh \"The Prodigy\" \"Firestarter\" \"Breakbeat\" \"138\" \"0.95\""
echo ""
