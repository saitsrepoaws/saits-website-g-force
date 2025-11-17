#!/bin/bash
################################################################################
# INSTALL DEPENDENCIES - CodeDeploy BeforeInstall Hook
################################################################################
# This script installs all necessary dependencies on a fresh EC2 instance
# Uses the complete ami-setup.sh script from the pipeline directory
################################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 INSTALLING DEPENDENCIES VIA CODEDEPLOY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Time: $(date)"
echo ""

# Check if dependencies are already installed
if [ -f "/opt/g-forge/.dependencies-installed" ]; then
  echo "✅ Dependencies already installed, skipping..."
  echo "   Installed: $(cat /opt/g-forge/.dependencies-installed)"
  exit 0
fi

# Find the setup script in the deployment directory
# CodeDeploy extracts files to /opt/codedeploy-agent/deployment-root/{deployment-group-id}/{deployment-id}/deployment-archive/
# We can use the DEPLOYMENT_GROUP_ID and DEPLOYMENT_ID environment variables
# OR we can run the script inline since we have it in the repo

# Get the deployment directory from CodeDeploy environment
DEPLOYMENT_DIR="${DEPLOYMENT_ROOT_DIRECTORY:-/opt/codedeploy-agent/deployment-root}"

# Find ami-setup.sh in the deployment archive
SCRIPT_PATH=$(find "$DEPLOYMENT_DIR" -name "ami-setup.sh" -path "*/pipeline/ami/*" 2>/dev/null | head -1)

if [ -n "$SCRIPT_PATH" ] && [ -f "$SCRIPT_PATH" ]; then
  echo "🚀 Running complete setup script..."
  echo "   Script: $SCRIPT_PATH"
  bash "$SCRIPT_PATH"
  
  # Mark as installed
  mkdir -p /opt/g-forge
  echo "$(date)" > /opt/g-forge/.dependencies-installed
  
  echo ""
  echo "✅ Dependencies installed successfully!"
else
  echo "❌ Setup script not found in deployment directory"
  echo "   Searched in: $DEPLOYMENT_DIR"
  echo "   Result: $SCRIPT_PATH"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPENDENCY INSTALLATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
