#!/bin/bash
# Start Vite dev server for web app (with hot reload)

cd "$(dirname "$0")/.."

echo "🌐 Starting Vite Dev Server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 HOT RELOAD:"
echo "   • Frontend changes reload automatisch"
echo "   • React components, CSS, etc."
echo "   • Instant browser update"
echo ""
echo "💡 TIP: Laat dit draaien in apart terminal venster"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pnpm --filter web dev

# This will keep running until you Ctrl+C
