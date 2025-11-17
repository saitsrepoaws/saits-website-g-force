#!/bin/bash
# Update Configurations - CodeDeploy Hook
# G-Forge IoT Radio Platform

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  UPDATING CONFIGURATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Update environment variables
if [ -f "/opt/g-forge/amplify/.env.production" ]; then
    echo "Updating environment variables..."
    cp /opt/g-forge/amplify/.env.production /var/www/splashfm/.env
    echo "✅ Environment variables updated"
fi

# Reload systemd if needed
if [ -d "/opt/g-forge/systemd" ]; then
    echo "Reloading systemd configs..."
    systemctl daemon-reload
    echo "✅ Systemd reloaded"
fi

echo "✅ Configurations updated successfully"
