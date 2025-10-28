#!/bin/bash
# Attach IoT Policy to CURRENT logged-in Cognito user
# Run this ONCE per user to enable MQTT connections

set -e

REGION="eu-west-1"
POLICY_NAME="CognitoIoTPolicy"

# Get Identity Pool ID from amplify_outputs
IDENTITY_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.identity_pool_id')

echo "🔧 Attaching IoT Policy to current Cognito user..."
echo ""
echo "Identity Pool: $IDENTITY_POOL_ID"
echo "Policy Name: $POLICY_NAME"
echo ""

# First, create the policy if it doesn't exist
echo "1️⃣  Creating IoT Policy (if not exists)..."
aws iot create-policy \
  --policy-name "$POLICY_NAME" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "iot:Connect",
        "Resource": "arn:aws:iot:'"$REGION"':*:client/${cognito-identity.amazonaws.com:sub}"
      },
      {
        "Effect": "Allow",
        "Action": ["iot:Subscribe"],
        "Resource": "arn:aws:iot:'"$REGION"':*:topicfilter/*"
      },
      {
        "Effect": "Allow",
        "Action": ["iot:Publish", "iot:Receive"],
        "Resource": "arn:aws:iot:'"$REGION"':*:topic/*"
      }
    ]
  }' \
  --region "$REGION" 2>/dev/null && echo "✅ Policy created" || echo "✅ Policy already exists"

echo ""
echo "2️⃣  Getting your Cognito Identity ID..."
echo "⚠️  You need to be LOGGED IN to the web app for this to work!"
echo ""
echo "📋 Go to browser console and run:"
echo ""
echo "   import { fetchAuthSession } from 'aws-amplify/auth'"
echo "   const session = await fetchAuthSession()"
echo "   console.log('Identity ID:', session.identityId)"
echo ""
echo "Then paste the Identity ID here:"
read -p "Identity ID: " IDENTITY_ID

if [ -z "$IDENTITY_ID" ]; then
  echo "❌ No Identity ID provided!"
  exit 1
fi

echo ""
echo "3️⃣  Attaching IoT Policy to $IDENTITY_ID..."

aws iot attach-policy \
  --policy-name "$POLICY_NAME" \
  --target "$IDENTITY_ID" \
  --region "$REGION" && echo "✅ Policy attached successfully!" || echo "✅ Policy already attached"

echo ""
echo "🎉 DONE!"
echo ""
echo "Now refresh the browser and try MQTT connection again!"
echo "It should work now! 🚀"
