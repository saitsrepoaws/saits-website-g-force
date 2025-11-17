#!/bin/bash

##############################################
# CLEANUP SANDBOX SUBDOMAIN
# 
# Removes Route53 record for sandbox subdomain
# Use after sandbox is destroyed
##############################################

set -e

HOSTED_ZONE_ID="Z047697515CJEX2WUTUFW"
DOMAIN="splashfm.nl"

# Get commit hash or accept as argument
if [ -z "$1" ]; then
  COMMIT_HASH=$(git rev-parse --short HEAD)
else
  COMMIT_HASH="$1"
fi

SUBDOMAIN="${COMMIT_HASH}.${DOMAIN}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 CLEANING UP SANDBOX SUBDOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Subdomain: $SUBDOMAIN"
echo "Zone ID:   $HOSTED_ZONE_ID"
echo ""

# Get existing record
echo "🔍 Checking if subdomain exists..."
EXISTING=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --query "ResourceRecordSets[?Name=='${SUBDOMAIN}.']" \
  --output json)

if [ "$EXISTING" == "[]" ]; then
  echo "ℹ️  Subdomain does not exist"
  exit 0
fi

# Extract CNAME value
CNAME_VALUE=$(echo "$EXISTING" | jq -r '.[0].ResourceRecords[0].Value')

echo "✅ Found record: $SUBDOMAIN → $CNAME_VALUE"
echo ""

# Create delete change batch
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

# Apply deletion
echo "🗑️  Deleting Route53 record..."
CHANGE_ID=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/route53-delete.json \
  --query "ChangeInfo.Id" \
  --output text)

echo "✅ Record deleted: $CHANGE_ID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CLEANUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup
rm -f /tmp/route53-delete.json
