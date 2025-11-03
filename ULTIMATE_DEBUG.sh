#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 ULTIMATE DEBUGGING SESSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Code status
echo "━━━ CHECK 1: Code Status ━━━"
echo "autoConnect in main.tsx:"
grep "IoTProvider autoConnect" apps/web/src/main.tsx | grep -o "autoConnect={[^}]*}"
echo ""

# Check 2: Dev server
echo "━━━ CHECK 2: Dev Server ━━━"
if lsof -i :5173 > /dev/null 2>&1; then
  PID=$(lsof -ti :5173)
  echo "✅ Dev server running (PID: $PID)"
else
  echo "❌ NO DEV SERVER RUNNING!"
  echo "   Run: cd apps/web && pnpm dev"
  exit 1
fi
echo ""

# Check 3: Browser must be on correct URL
echo "━━━ CHECK 3: Browser URL ━━━"
echo "Browser MOET op deze URL zijn:"
echo "  http://localhost:5173/devices/players"
echo ""
echo "Ben je op deze URL? (type: ja/nee)"
read ON_CORRECT_URL

if [ "$ON_CORRECT_URL" != "ja" ]; then
  echo ""
  echo "❌ Ga eerst naar: http://localhost:5173/devices/players"
  echo "   Refresh de pagina hard (Cmd+Shift+R)"
  echo "   Run dit script opnieuw"
  exit 1
fi

echo ""
echo "━━━ CHECK 4: Browser Console Check ━━━"
echo ""
echo "Open browser console (F12 of Cmd+Option+I)"
echo "Scroll naar BOVEN in de console logs"
echo ""
echo "Zie je deze tekst ergens? (type nummer)"
echo ""
echo "1. [PubSub INFO] Auto-connecting to AWS IoT..."
echo "2. 🎵 Player starting - setting up IoT..."
echo "3. ✅ Subscribed to: radio/player/player-001/command"
echo "4. Geen van bovenstaande"
echo ""
read CONSOLE_STATUS

if [ "$CONSOLE_STATUS" = "4" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ PROBLEEM: Oude code in browser!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "STAPPEN:"
  echo "1. Open DevTools (F12)"
  echo "2. Right-click refresh button"
  echo "3. Select 'Empty Cache and Hard Reload'"
  echo ""
  echo "OF:"
  echo "1. DevTools → Network tab"
  echo "2. Check 'Disable cache'"
  echo "3. Keep DevTools OPEN"
  echo "4. Refresh (Cmd+Shift+R)"
  echo ""
  echo "Gedaan? Type 'klaar' om door te gaan"
  read CACHE_CLEARED
fi

echo ""
echo "━━━ CHECK 5: Stuur Test Bericht ━━━"
echo ""
echo "Ik stuur nu een test bericht..."
echo "LET OP DE BROWSER CONSOLE!"
echo ""

aws iot-data publish \
  --topic "radio/player/player-001/command" \
  --cli-binary-format raw-in-base64-out \
  --payload '{"command":"LOAD","params":{"track":{"title":"🎯 ULTIMATE DEBUG TEST","artist":"Debug Script","bpm":999}}}' \
  --region eu-west-1 \
  --endpoint-url https://acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com

if [ $? -eq 0 ]; then
  echo "✅ Bericht verzonden naar AWS IoT"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 WAT ZIE JE IN BROWSER?"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "A. Console:"
  echo "   📥 INCOMING raw data: {...}"
  echo "   📥 PARSED command: {...}"
  echo "   💿 LOAD COMMAND RECEIVED"
  echo ""
  echo "B. IoT Log Window:"
  echo "   📥 Incoming: 1"
  echo "   Track: 🎯 ULTIMATE DEBUG TEST"
  echo ""
  echo "Zie je A of B of beide? (type: A/B/beide/niks)"
  read RESULT
  
  echo ""
  case $RESULT in
    "beide")
      echo "🎉 PERFECT! Het werkt!"
      echo ""
      echo "Nu kun je Auto Load testen:"
      echo "  1. Click Auto Load button"
      echo "  2. Wait 3-4 seconds"
      echo "  3. See track from backend!"
      ;;
    "A")
      echo "✅ Console werkt!"
      echo "❌ IoT Log Window niet"
      echo ""
      echo "IoT Log Window zit rechts op de pagina."
      echo "Scroll naar beneden op /devices/players"
      ;;
    "B")
      echo "✅ IoT Log werkt!"
      echo "❌ Console logs niet zichtbaar"
      echo ""
      echo "Open DevTools console (F12)"
      ;;
    "niks")
      echo "❌ Niets aangekomen!"
      echo ""
      echo "SCREENSHOT STUREN VAN:"
      echo "  1. Browser console (volledig)"
      echo "  2. Browser URL bar"
      echo "  3. IoT Log Window"
      ;;
  esac
else
  echo "❌ Failed to publish to AWS"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
