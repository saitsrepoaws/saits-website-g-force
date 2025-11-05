#!/bin/bash
# Start Vite dev server for web app

echo "🌐 Starting Vite dev server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$(dirname "$0")/.."

pnpm --filter web dev

echo ""
echo "✅ Dev server started!"
echo "🔗 http://localhost:5173"
