#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 COMPLETE IOT FLOW TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check .env
echo "━━━ STEP 1: Check .env ━━━"
echo "VITE_ENABLE_PUBSUB in .env:"
grep "VITE_ENABLE_PUBSUB" apps/web/.env || echo "❌ NOT FOUND!"
echo ""

# Step 2: Send test message to command topic
echo "━━━ STEP 2: Send test to command topic ━━━"
TEST_MSG='{"command":"LOAD","playerId":"player-001","params":{"track":{"title":"CLI TEST","artist":"Test Bot","bpm":140}}}'
echo "Sending: $TEST_MSG"
echo ""
echo "$TEST_MSG" | base64 | xargs -I {} aws iot-data publish \
  --topic "radio/player/player-001/command" \
  --payload {} \
  --region eu-west-1 \
  --endpoint-url https://acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com

if [ $? -eq 0 ]; then
  echo "✅ Message published to IoT"
else
  echo "❌ Failed to publish"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 EXPECTED IN BROWSER (if working):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "[PubSub INFO] Message received on radio/player/player-001/command"
echo "📥 INCOMING raw data: {value: '...', provider: 'AWSIoTProvider'}"
echo "📥 PARSED command: {command: 'LOAD', params: {...}}"
echo "💿 LOAD COMMAND RECEIVED FROM BACKEND"
echo "✅ Track from backend:"
echo "   Title: CLI TEST"
echo "   Artist: Test Bot"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "❓ DID YOU SEE THIS IN BROWSER?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "YES → Subscription works! ✅"
echo "NO  → Dev server needs restart ❌"
echo ""
echo "To restart dev server:"
echo "  1. In terminal with dev server: Ctrl+C"
echo "  2. Run: pnpm dev"
echo "  3. Hard refresh browser: Cmd+Shift+R"
echo ""
