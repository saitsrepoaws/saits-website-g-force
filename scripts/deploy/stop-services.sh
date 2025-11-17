#!/bin/bash
# Stop Services - CodeDeploy Hook
# G-Forge IoT Radio Platform

# DON'T use set -e - allow script to continue on errors (fresh instance)
set +e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 STOPPING SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Stop Nginx (gracefully) - ignore errors if not installed
if command -v systemctl &> /dev/null && systemctl list-units --full --all | grep -q nginx; then
    if systemctl is-active --quiet nginx; then
        echo "Stopping Nginx..."
        systemctl stop nginx
        echo "✅ Nginx stopped"
    else
        echo "ℹ️  Nginx not running"
    fi
else
    echo "ℹ️  Nginx not installed (fresh instance)"
fi

# Don't stop Icecast/Liquidsoap (keep stream alive!)
echo "ℹ️  Keeping Icecast and Liquidsoap running (zero-downtime deployment)"

echo "✅ Services stop completed (no errors)"
exit 0
