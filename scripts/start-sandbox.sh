#!/bin/bash
# Start Amplify Sandbox (once mode)
# Outputs: amplify_outputs.json in repo root

echo "🚀 Starting Amplify Sandbox..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir .

echo ""
echo "✅ Sandbox started!"
echo "📄 Outputs: amplify_outputs.json"
echo ""
echo "Next step: Copy outputs to web app"
echo "  cp amplify_outputs.json apps/web/public/amplify_outputs.json"
