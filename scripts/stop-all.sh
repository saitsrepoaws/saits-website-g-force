#!/bin/bash
# Stop all running processes (sandbox + dev server)

echo "🛑 Stopping all processes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stop Vite dev server (port 5173)
echo "Stopping Vite dev server..."
lsof -ti:5173 | xargs kill -9 2>/dev/null && echo "✅ Vite stopped" || echo "⚠️ Vite not running"

# Stop any ampx sandbox processes
echo "Stopping Amplify sandbox..."
pkill -f "ampx sandbox" 2>/dev/null && echo "✅ Sandbox stopped" || echo "⚠️ Sandbox not running"

# Stop any node processes related to the project
echo "Stopping other Node processes..."
pkill -f "g-forge-iot" 2>/dev/null && echo "✅ Node processes stopped" || echo "⚠️ No Node processes found"

echo ""
echo "✅ All processes stopped!"
