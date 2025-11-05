#!/bin/bash
# Start both sandbox and dev server

echo "🚀 Starting Amplify Sandbox + Vite Dev Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$(dirname "$0")/.."

# Start sandbox in background
echo "1️⃣ Starting Amplify Sandbox..."
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir . &
SANDBOX_PID=$!

# Wait for sandbox to complete
echo "⏳ Waiting for sandbox to complete..."
wait $SANDBOX_PID

# Copy outputs to web app
echo ""
echo "2️⃣ Copying outputs to web app..."
cp amplify_outputs.json apps/web/public/amplify_outputs.json
echo "✅ Outputs copied!"

# Start dev server
echo ""
echo "3️⃣ Starting Vite dev server..."
pnpm --filter web dev

echo ""
echo "✅ All services started!"
echo "🔗 http://localhost:5173"
