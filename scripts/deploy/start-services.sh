#!/bin/bash
# Start Services - CodeDeploy Hook
# G-Forge IoT Radio Platform

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 STARTING SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start Nginx
echo "Starting Nginx..."
systemctl start nginx
systemctl enable nginx
echo "✅ Nginx started"

# Icecast and Liquidsoap stay running (zero-downtime)
echo "ℹ️  Icecast and Liquidsoap remain running (zero-downtime deployment)"

# Wait for services to stabilize
sleep 5

echo "✅ Services started successfully"
