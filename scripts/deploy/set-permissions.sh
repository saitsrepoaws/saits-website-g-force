#!/bin/bash
# Set Permissions - CodeDeploy Hook
# G-Forge IoT Radio Platform

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 SETTING FILE PERMISSIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Web files
if [ -d "/var/www/splashfm" ]; then
    echo "Setting web files permissions..."
    chown -R www-data:www-data /var/www/splashfm
    find /var/www/splashfm -type d -exec chmod 755 {} \;
    find /var/www/splashfm -type f -exec chmod 644 {} \;
    echo "✅ Web files permissions set"
fi

# Scripts
if [ -d "/opt/g-forge/scripts" ]; then
    echo "Setting script permissions..."
    chmod +x /opt/g-forge/scripts/deploy/*.sh
    chmod +x /opt/g-forge/scripts/*.sh
    echo "✅ Script permissions set"
fi

# Amplify configs
if [ -d "/opt/g-forge/amplify" ]; then
    echo "Setting amplify permissions..."
    chown -R ubuntu:ubuntu /opt/g-forge/amplify
    chmod -R 755 /opt/g-forge/amplify
    echo "✅ Amplify permissions set"
fi

echo "✅ Permissions set successfully"
