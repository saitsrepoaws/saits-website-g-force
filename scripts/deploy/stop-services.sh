#!/bin/bash
# Stop Services - CodeDeploy Hook
# G-Forge IoT Radio Platform

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 STOPPING SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stop Nginx (gracefully)
if systemctl is-active --quiet nginx; then
    echo "Stopping Nginx..."
    systemctl stop nginx
    echo "✅ Nginx stopped"
fi

# Don't stop Icecast/Liquidsoap (keep stream alive!)
echo "ℹ️  Keeping Icecast and Liquidsoap running (zero-downtime deployment)"

echo "✅ Services stopped successfully"
