#!/bin/bash

##############################################
# LIST ALL SANDBOXES
# 
# Shows all Amplify sandboxes and Route53 records
# Helps identify which sandboxes to cleanup
##############################################

set -e

HOSTED_ZONE_ID="Z047697515CJEX2WUTUFW"
DOMAIN="splashfm.nl"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ALL SANDBOXES OVERVIEW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AMPLIFY SANDBOXES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🔧 AMPLIFY SANDBOXES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get all Amplify apps for g-forge-iot
APPS=$(aws amplify list-apps --query "apps[?contains(name, 'g-forge-iot')]" --output json 2>/dev/null)

if [ "$(echo "$APPS" | jq length)" -eq 0 ]; then
  echo "ℹ️  No sandboxes found"
else
  echo "$APPS" | jq -r '.[] | "  📦 \(.name)\n     App ID: \(.appId)\n     Created: \(.createTime)\n     Domain: \(.defaultDomain)\n"'
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ROUTE53 CNAME RECORDS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🌐 ROUTE53 CNAME RECORDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get all CNAME records that look like commit hashes
CNAMES=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, '${DOMAIN}')]" \
  --output json 2>/dev/null)

if [ "$(echo "$CNAMES" | jq length)" -eq 0 ]; then
  echo "ℹ️  No CNAME records found"
else
  echo "$CNAMES" | jq -r '.[] | "  🌐 \(.Name)\n     → \(.ResourceRecords[0].Value)\n     TTL: \(.TTL)s\n"'
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ORPHANED RECORDS CHECK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🔍 ORPHANED RECORDS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Checking for Route53 records without matching Amplify sandbox..."
echo ""

ORPHANED=false

# Check each CNAME
echo "$CNAMES" | jq -r '.[].Name' | while read subdomain; do
  # Extract commit hash from subdomain
  COMMIT=$(echo "$subdomain" | cut -d'.' -f1)
  SANDBOX_NAME="g-forge-iot-commit-${COMMIT}"
  
  # Check if Amplify app exists
  APP_EXISTS=$(echo "$APPS" | jq -r --arg name "$SANDBOX_NAME" '.[] | select(.name==$name) | .appId')
  
  if [ -z "$APP_EXISTS" ]; then
    echo "  ⚠️  ORPHANED: $subdomain (sandbox deleted but DNS remains)"
    echo "     Cleanup: ./pipeline/scripts/cleanup-sandbox-subdomain.sh $COMMIT"
    echo ""
    ORPHANED=true
  fi
done

if [ "$ORPHANED" = false ]; then
  echo "  ✅ No orphaned records found"
  echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

APP_COUNT=$(echo "$APPS" | jq length)
CNAME_COUNT=$(echo "$CNAMES" | jq length)

echo "  Amplify Sandboxes: $APP_COUNT"
echo "  Route53 CNAMEs:    $CNAME_COUNT"
echo ""

if [ "$APP_COUNT" -gt 0 ]; then
  echo "Cleanup commands:"
  echo ""
  echo "$APPS" | jq -r '.[] | "  ./pipeline/scripts/delete-sandbox-with-cleanup.sh \(.name | split("-") | .[-1])"' | \
    sed 's/g-forge-iot-commit-/commit-/'
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
