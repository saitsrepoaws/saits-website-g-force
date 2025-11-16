#!/bin/bash

##############################################
# CREATE SANDBOX SUBDOMAIN FOR COMMIT HASH
# 
# Creates A record in Route53: {commit}.splashfm.nl
# Points to Amplify Hosting distribution
##############################################

set -e

HOSTED_ZONE_ID="Z047697515CJEX2WUTUFW"
DOMAIN="splashfm.nl"

# Get current commit hash (short)
COMMIT_HASH=$(git rev-parse --short HEAD)
SUBDOMAIN="${COMMIT_HASH}.${DOMAIN}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 CREATING SANDBOX SUBDOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Commit:    $COMMIT_HASH"
echo "Subdomain: $SUBDOMAIN"
echo "Zone ID:   $HOSTED_ZONE_ID"
echo ""

# Check if Amplify app ID is provided
if [ -z "$1" ]; then
  echo "⚠️  Usage: $0 <amplify-app-id>"
  echo ""
  echo "Example: $0 d2u23abc123def"
  exit 1
fi

AMPLIFY_APP_ID="$1"

# Get Amplify default domain
echo "📡 Getting Amplify hosting domain..."
AMPLIFY_DOMAIN=$(aws amplify get-app --app-id "$AMPLIFY_APP_ID" --query "app.defaultDomain" --output text)

if [ -z "$AMPLIFY_DOMAIN" ]; then
  echo "❌ Failed to get Amplify domain"
  exit 1
fi

echo "✅ Amplify domain: $AMPLIFY_DOMAIN"
echo ""

# Create Route53 CNAME record
echo "🔧 Creating Route53 CNAME record..."

cat > /tmp/route53-change.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$SUBDOMAIN",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$AMPLIFY_DOMAIN"
          }
        ]
      }
    }
  ]
}
EOF

# Apply change
CHANGE_ID=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/route53-change.json \
  --query "ChangeInfo.Id" \
  --output text)

echo "✅ Route53 change created: $CHANGE_ID"
echo ""

# Wait for DNS propagation
echo "⏳ Waiting for DNS propagation (30 seconds)..."
sleep 30

# Test DNS resolution
echo "🧪 Testing DNS resolution..."
if dig +short "$SUBDOMAIN" | grep -q "$AMPLIFY_DOMAIN"; then
  echo "✅ DNS resolves correctly!"
else
  echo "⚠️  DNS not yet propagated (can take up to 5 minutes)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SUBDOMAIN CREATED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Sandbox URL: https://$SUBDOMAIN"
echo ""
echo "Next steps:"
echo "1. Configure custom domain in Amplify"
echo "2. Wait for SSL certificate (5-10 min)"
echo "3. Test: https://$SUBDOMAIN"
echo ""

# Cleanup
rm -f /tmp/route53-change.json
