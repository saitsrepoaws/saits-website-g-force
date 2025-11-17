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

# Run the complete setup script
SCRIPT_DIR="/opt/g-forge-iot/pipeline/ami"
if [ -f "$SCRIPT_DIR/ami-setup.sh" ]; then
  echo "🚀 Running complete setup script..."
  bash "$SCRIPT_DIR/ami-setup.sh"
  
  # Mark as installed
  mkdir -p /opt/g-forge
  echo "$(date)" > /opt/g-forge/.dependencies-installed
  
  echo ""
  echo "✅ Dependencies installed successfully!"
else
  echo "❌ Setup script not found at $SCRIPT_DIR/ami-setup.sh"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPENDENCY INSTALLATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
