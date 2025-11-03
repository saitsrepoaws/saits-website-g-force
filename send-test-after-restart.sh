#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏸️  WACHT TOT DEV SERVER HERSTART IS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Druk ENTER als dev server draait..."
read

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 VERSTUUR TEST BERICHT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

aws iot-data publish \
  --topic "radio/player/player-001/command" \
  --cli-binary-format raw-in-base64-out \
  --payload '{"command":"LOAD","params":{"track":{"title":"✅ NA HERSTART TEST","artist":"Ready Bot","bpm":130}}}' \
  --region eu-west-1 \
  --endpoint-url https://acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ BERICHT VERZONDEN!"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 CHECK NU IN BROWSER:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1. Browser Console:"
  echo "   📥 INCOMING raw data"
  echo "   📥 PARSED command"
  echo "   💿 LOAD COMMAND RECEIVED"
  echo "   ✅ Track: ✅ NA HERSTART TEST"
  echo ""
  echo "2. IoT Log Window:"
  echo "   📥 Incoming: 1 (was 0!)"
  echo "   Track: ✅ NA HERSTART TEST"
  echo ""
  echo "3. Player State:"
  echo "   status: 'loaded'"
  echo "   track: { title: '✅ NA HERSTART TEST', ... }"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "ZIE JE DIT? Type JA of NEE:"
  read ANSWER
  
  if [ "$ANSWER" = "JA" ] || [ "$ANSWER" = "ja" ]; then
    echo ""
    echo "🎉 PERFECT! Subscription werkt!"
    echo ""
    echo "Nu kun je Auto Load testen:"
    echo "  1. Klik Auto Load button"
    echo "  2. Wacht 3-4 seconden"
    echo "  3. Zie track van backend komen!"
    echo ""
  else
    echo ""
    echo "❌ Nog steeds niet? Screenshot sturen van:"
    echo "   1. Browser console"
    echo "   2. Terminal met dev server"
    echo ""
  fi
else
  echo ""
  echo "❌ FAILED to publish"
fi
