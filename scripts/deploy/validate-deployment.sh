#!/bin/bash
# Validate Deployment - CodeDeploy Hook
# G-Forge IoT Radio Platform

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VALIDATING DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ERRORS=0

# Check Nginx
echo "Checking Nginx..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running"
    ERRORS=$((ERRORS + 1))
fi

# Check web files
echo "Checking web files..."
if [ -f "/var/www/splashfm/index.html" ]; then
    echo "✅ Web files present"
else
    echo "❌ Web files missing"
    ERRORS=$((ERRORS + 1))
fi

# Test HTTP response
echo "Testing HTTP response..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP 200 OK"
else
    echo "❌ HTTP $HTTP_CODE (expected 200)"
    ERRORS=$((ERRORS + 1))
fi

# Test HTTPS response
echo "Testing HTTPS response..."
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://splashfm.nl/ || echo "000")
if [ "$HTTPS_CODE" = "200" ]; then
    echo "✅ HTTPS 200 OK"
else
    echo "❌ HTTPS $HTTPS_CODE (expected 200)"
    ERRORS=$((ERRORS + 1))
fi

# Check Icecast
echo "Checking Icecast..."
if systemctl is-active --quiet icecast2; then
    echo "✅ Icecast is running"
else
    echo "⚠️  Icecast is not running (should be running)"
    ERRORS=$((ERRORS + 1))
fi

# Check Liquidsoap
echo "Checking Liquidsoap..."
if pgrep -f liquidsoap > /dev/null; then
    echo "✅ Liquidsoap is running"
else
    echo "⚠️  Liquidsoap is not running (should be running)"
    ERRORS=$((ERRORS + 1))
fi

# Final result
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
    echo "✅ DEPLOYMENT VALIDATION: PASSED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
else
    echo "❌ DEPLOYMENT VALIDATION: FAILED ($ERRORS errors)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi
