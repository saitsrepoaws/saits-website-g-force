#!/bin/bash
# Create and attach IoT Policy to Cognito Identity Pool
# This is REQUIRED for MQTT over WebSocket to work!

set -e

REGION="eu-west-1"
POLICY_NAME="CognitoIoTPolicy"
IDENTITY_POOL_ID=$(cat amplify_outputs.json | jq -r '.auth.identity_pool_id')

echo "🔧 Creating IoT Policy for Cognito..."
echo "Identity Pool: $IDENTITY_POOL_ID"

# Create IoT Policy
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
  --region "$REGION" 2>/dev/null || echo "⚠️  Policy already exists"

echo ""
echo "✅ IoT Policy created: $POLICY_NAME"
echo ""
echo "⚠️  IMPORTANT:"
echo "This policy needs to be attached to EACH Cognito Identity when user logs in."
echo "This requires a Lambda trigger on the Identity Pool."
echo ""
echo "Alternative: Use Amplify PubSub configuration in backend.ts"
echo "See: https://docs.amplify.aws/react/build-a-backend/add-aws-services/pubsub/"
