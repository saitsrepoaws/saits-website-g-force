#!/bin/bash

# =============================================================================
# G-FORGE RADIO - SETUP STANDALONE PIPELINE
# =============================================================================
#
# Initial setup script for standalone CI/CD pipeline
#
# =============================================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 G-FORGE RADIO - PIPELINE SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to codedeploy-pipeline folder
cd "$(dirname "$0")/.."

echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔍 Verifying installation..."
pnpm list --depth=0

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Set environment variables:"
echo "     export GITHUB_OWNER=your-username"
echo "     export GITHUB_REPO=your-repo"
echo "     export GITHUB_TOKEN=ghp_your_token"
echo ""
echo "  2. Deploy pipeline:"
echo "     ./scripts/deploy.sh"
echo ""
