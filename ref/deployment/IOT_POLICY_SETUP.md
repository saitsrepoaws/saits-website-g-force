# IoT Policy Setup - CRITICAL FOR PUBSUB

## Problem
Subscribe/Publish to topics causes DISCONNECT because IoT Policy is missing!

AWS IoT requires TWO layers:
1. IAM Policies (Cognito Role) ✅ - We have this
2. IoT Policy (per Identity) ❌ - MISSING!

## Solution: Create IoT Policy

### Step 1: Go to AWS Console
```
AWS Console → IoT Core → Security → Policies → Create
```

### Step 2: Create Policy
**Policy Name:** `RadioPlayerCognitoPolicy`

**Policy Document:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:eu-west-1:*:client/${cognito-identity.amazonaws.com:sub}"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:eu-west-1:*:topicfilter/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish",
        "iot:Receive"
      ],
      "Resource": "arn:aws:iot:eu-west-1:*:topic/*"
    }
  ]
}
```

### Step 3: Attach to Cognito Identity

**Option A: Via AWS CLI (Automated)**
```bash
# Get your Cognito Identity ID (from browser console after login)
# Then attach policy:
aws iot attach-policy \
  --policy-name RadioPlayerCognitoPolicy \
  --target "eu-west-1:YOUR-IDENTITY-ID-HERE"
```

**Option B: Via Lambda (Automatic on login)**
Create a Lambda that runs after authentication:
```typescript
import { IoTClient, AttachPolicyCommand } from '@aws-sdk/client-iot'

export const handler = async (event: any) => {
  const identityId = event.request.userAttributes['custom:identityId']
  
  const iot = new IoTClient({ region: 'eu-west-1' })
  await iot.send(new AttachPolicyCommand({
    policyName: 'RadioPlayerCognitoPolicy',
    target: identityId
  }))
  
  return event
}
```

### Step 4: Verify
Check if policy is attached:
```bash
aws iot list-attached-policies \
  --target "eu-west-1:YOUR-IDENTITY-ID-HERE"
```

## Why This Is Needed

### IAM Policies (Cognito Role)
```
✅ Allows the ROLE to call IoT APIs
❌ Does NOT allow actual MQTT operations
```

### IoT Policies (Cognito Identity)
```
✅ Allows actual MQTT connect/subscribe/publish
✅ Per-identity access control
✅ Topic-level permissions
```

## Production Setup

For production, use dynamic policy attachment:
1. Post-authentication Lambda trigger
2. Attach policy automatically
3. Cache identity → policy mapping in DynamoDB

## Testing

After attaching policy, test:
```typescript
// Should work now:
await PubSub.publish({ topics: 'radio/test/ping', message: {...} })
```

No more DISCONNECT after subscribe!
