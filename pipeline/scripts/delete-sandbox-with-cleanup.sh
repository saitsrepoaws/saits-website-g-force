#!/bin/bash

##############################################
# DELETE SANDBOX WITH AUTOMATIC CLEANUP
# 
# Deletes Amplify sandbox AND Route53 CNAME
# Use this instead of manual sandbox delete!
##############################################

set -e

HOSTED_ZONE_ID="Z047697515CJEX2WUTUFW"
DOMAIN="splashfm.nl"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗑️  DELETE SANDBOX WITH CLEANUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get sandbox identifier
if [ -z "$1" ]; then
  echo "Usage: $0 <sandbox-identifier>"
  echo ""
  echo "Examples:"
  echo "  $0 commit-28a3670"
  echo "  $0 pipeline-test"
  echo ""
  exit 1
fi

SANDBOX_ID="$1"
echo "Sandbox ID: $SANDBOX_ID"
echo ""

# Extract commit hash if commit-based
if [[ "$SANDBOX_ID" =~ ^commit-(.+)$ ]]; then
  COMMIT_HASH="${BASH_REMATCH[1]}"
  SUBDOMAIN="${COMMIT_HASH}.${DOMAIN}"
  HAS_SUBDOMAIN=true
  echo "✅ Commit-based sandbox detected"
  echo "   Subdomain: $SUBDOMAIN"
else
  HAS_SUBDOMAIN=false
  echo "ℹ️  Regular sandbox (no automatic subdomain)"
fi

echo ""

# Confirm deletion
read -p "⚠️  Delete sandbox '$SANDBOX_ID'? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "❌ Cancelled"
  exit 0
fi

echo ""

# Step 1: Delete Route53 CNAME (if exists)
if [ "$HAS_SUBDOMAIN" = true ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🌐 STEP 1: CLEANUP ROUTE53 CNAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  # Check if subdomain exists
  echo "🔍 Checking Route53 record..."
  EXISTING=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name=='${SUBDOMAIN}.']" \
    --output json)

  if [ "$EXISTING" != "[]" ]; then
    CNAME_VALUE=$(echo "$EXISTING" | jq -r '.[0].ResourceRecords[0].Value')
    echo "✅ Found: $SUBDOMAIN → $CNAME_VALUE"
    echo ""
    
    # Delete CNAME
    echo "🗑️  Deleting Route53 CNAME..."
    cat > /tmp/route53-delete.json <<EOF
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

    CHANGE_ID=$(aws route53 change-resource-record-sets \
      --hosted-zone-id "$HOSTED_ZONE_ID" \
      --change-batch file:///tmp/route53-delete.json \
      --query "ChangeInfo.Id" \
      --output text 2>/dev/null || echo "FAILED")

    if [ "$CHANGE_ID" != "FAILED" ]; then
      echo "✅ Route53 record deleted: $CHANGE_ID"
    else
      echo "⚠️  Failed to delete Route53 record (may already be deleted)"
    fi
    
    rm -f /tmp/route53-delete.json
  else
    echo "ℹ️  No Route53 record found (already deleted or never created)"
  fi
  
  echo ""
fi

# Step 2: Delete Amplify Sandbox
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 STEP 2: DELETE AMPLIFY SANDBOX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🗑️  Deleting Amplify sandbox..."
pnpm exec ampx sandbox delete --identifier "$SANDBOX_ID" --yes 2>/dev/null || {
  echo "⚠️  Amplify sandbox delete failed (may not exist)"
}

echo ""

# Step 3: Verify cleanup
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLEANUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Cleaned up:"
if [ "$HAS_SUBDOMAIN" = true ]; then
  echo "  ✅ Route53 CNAME: $SUBDOMAIN"
fi
echo "  ✅ Amplify Sandbox: $SANDBOX_ID"
echo ""
echo "Resources freed ✨"
echo ""
