#!/bin/bash

##############################################
# CLEANUP OLD SANDBOXES
# 
# Deletes sandboxes older than X days
# Automatically removes Route53 records too
##############################################

set -e

HOSTED_ZONE_ID="Z047697515CJEX2WUTUFW"
DOMAIN="splashfm.nl"

# Default: 7 days
MAX_AGE_DAYS=${1:-7}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 CLEANUP OLD SANDBOXES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Max age: $MAX_AGE_DAYS days"
echo ""

# Get current timestamp
NOW=$(date +%s)
CUTOFF=$((NOW - (MAX_AGE_DAYS * 86400)))

echo "Scanning for sandboxes older than $(date -r $CUTOFF '+%Y-%m-%d %H:%M:%S')..."
echo ""

# Get all Amplify apps
APPS=$(aws amplify list-apps --query "apps[?contains(name, 'g-forge-iot')]" --output json 2>/dev/null)

if [ "$(echo "$APPS" | jq length)" -eq 0 ]; then
  echo "ℹ️  No sandboxes found"
  exit 0
fi

# Find old sandboxes
OLD_SANDBOXES=()

echo "$APPS" | jq -c '.[]' | while read app; do
  NAME=$(echo "$app" | jq -r '.name')
  APP_ID=$(echo "$app" | jq -r '.appId')
  CREATE_TIME=$(echo "$app" | jq -r '.createTime')
  
  # Convert createTime to timestamp (format: 2025-11-16T20:30:45.123Z)
  CREATE_TIMESTAMP=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$(echo "$CREATE_TIME" | cut -d'.' -f1)" +%s 2>/dev/null || echo "0")
  
  # Calculate age in days
  AGE_SECONDS=$((NOW - CREATE_TIMESTAMP))
  AGE_DAYS=$((AGE_SECONDS / 86400))
  
  if [ "$CREATE_TIMESTAMP" -lt "$CUTOFF" ] && [ "$CREATE_TIMESTAMP" -gt 0 ]; then
    echo "  🗑️  OLD: $NAME"
    echo "     Age: $AGE_DAYS days"
    echo "     Created: $CREATE_TIME"
    echo "     App ID: $APP_ID"
    echo ""
    
    # Extract sandbox ID
    if [[ "$NAME" =~ g-forge-iot-(.+)$ ]]; then
      SANDBOX_ID="${BASH_REMATCH[1]}"
      echo "$SANDBOX_ID" >> /tmp/old_sandboxes.txt
    fi
  fi
done

# Check if any old sandboxes found
if [ ! -f /tmp/old_sandboxes.txt ] || [ ! -s /tmp/old_sandboxes.txt ]; then
  echo "✅ No old sandboxes found (all are recent)"
  echo ""
  exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  FOUND $(wc -l < /tmp/old_sandboxes.txt) OLD SANDBOX(ES)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Delete these sandboxes? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "❌ Cancelled"
  rm -f /tmp/old_sandboxes.txt
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗑️  DELETING OLD SANDBOXES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DELETED_COUNT=0
FAILED_COUNT=0

while read SANDBOX_ID; do
  echo "Deleting: $SANDBOX_ID"
  
  # Extract commit hash if commit-based
  if [[ "$SANDBOX_ID" =~ ^commit-(.+)$ ]]; then
    COMMIT_HASH="${BASH_REMATCH[1]}"
    SUBDOMAIN="${COMMIT_HASH}.${DOMAIN}"
    
    # Delete Route53 CNAME
    echo "  🌐 Cleaning up Route53: $SUBDOMAIN"
    EXISTING=$(aws route53 list-resource-record-sets \
      --hosted-zone-id "$HOSTED_ZONE_ID" \
      --query "ResourceRecordSets[?Name=='${SUBDOMAIN}.']" \
      --output json 2>/dev/null)
    
    if [ "$EXISTING" != "[]" ]; then
      CNAME_VALUE=$(echo "$EXISTING" | jq -r '.[0].ResourceRecords[0].Value')
      
      cat > /tmp/route53-delete-$COMMIT_HASH.json <<EOF
{
  "Changes": [
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "$SUBDOMAIN",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$CNAME_VALUE"
          }
        ]
      }
    }
  ]
}
EOF

      aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file:///tmp/route53-delete-$COMMIT_HASH.json \
        >/dev/null 2>&1 && echo "     ✅ Route53 deleted" || echo "     ⚠️  Route53 failed"
      
      rm -f /tmp/route53-delete-$COMMIT_HASH.json
    fi
  fi
  
  # Delete Amplify sandbox
  echo "  📦 Deleting Amplify sandbox"
  if pnpm exec ampx sandbox delete --identifier "$SANDBOX_ID" --yes >/dev/null 2>&1; then
    echo "  ✅ Deleted successfully"
    ((DELETED_COUNT++))
  else
    echo "  ❌ Failed to delete"
    ((FAILED_COUNT++))
  fi
  
  echo ""
done < /tmp/old_sandboxes.txt

# Cleanup temp file
rm -f /tmp/old_sandboxes.txt

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLEANUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Deleted: $DELETED_COUNT sandbox(es)"
if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "Failed:  $FAILED_COUNT sandbox(es)"
fi
echo ""
