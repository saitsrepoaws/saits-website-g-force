#!/bin/bash
# Start Amplify Sandbox in WATCH MODE
# Automatically detects backend changes and redeploys
# Outputs: amplify_outputs.json in repo root (auto-updated)

cd "$(dirname "$0")/.."

echo "🚀 Starting Amplify Sandbox (Watch Mode)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 WATCH MODE:"
echo "   • Sandbox blijft draaien"
echo "   • Detecteert backend changes automatisch"
echo "   • Redeploys Lambda's bij code changes"
echo "   • Updates amplify_outputs.json automatisch"
echo ""
echo "💡 TIP: Laat dit draaien in apart terminal venster"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run sandbox in watch mode (no --once flag)
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox

# This will keep running until you Ctrl+C
