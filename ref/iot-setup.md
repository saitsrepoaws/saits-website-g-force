# IoT PubSub Setup Guide

## Problem: ConnectionDisrupted

**Symptoom**: WebSocket verbinding wordt gemaakt maar meteen verbroken
```
[INFO] Connection state: Connecting
[WARN] PubSub connection disrupted
[INFO] Connection state: ConnectionDisrupted
```

**Oorzaak**: Cognito Identity heeft geen IoT permissions

## Solution: IoT Policy toevoegen aan Authenticated Role

### 1. Backend configuratie (`amplify/backend.ts`)

```typescript
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'

const authenticatedRole = backend.auth.resources.authenticatedUserIamRole

authenticatedRole.attachInlinePolicy(
  new Policy(authenticatedRole.stack, 'IotPubSubPolicy', {
    statements: [
      // Connect permission
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Connect'],
        resources: [
          `arn:aws:iot:eu-west-1:*:client/\${cognito-identity.amazonaws.com:sub}`,
        ],
      }),
      // Subscribe permission
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Subscribe'],
        resources: [
          'arn:aws:iot:eu-west-1:*:topicfilter/iot/demo/topic',
          'arn:aws:iot:eu-west-1:*:topicfilter/gforce/libery/input',
          'arn:aws:iot:eu-west-1:*:topicfilter/gforce/libery/output',
        ],
      }),
      // Publish & Receive permission
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish', 'iot:Receive'],
        resources: [
          'arn:aws:iot:eu-west-1:*:topic/iot/demo/topic',
          'arn:aws:iot:eu-west-1:*:topic/gforce/libery/input',
          'arn:aws:iot:eu-west-1:*:topic/gforce/libery/output',
        ],
      }),
    ],
  })
)
```

### 2. Dependencies

```bash
pnpm add -D -w aws-cdk-lib
```

### 3. Deploy

```bash
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir .
cp amplify_outputs.json apps/web/public/amplify_outputs.json
```

### 4. Restart dev server

```bash
corepack pnpm --filter web dev
```

## IoT Permissions Explained

### `iot:Connect`
- Resource: `client/${cognito-identity.amazonaws.com:sub}`
- Allows WebSocket connection to IoT endpoint
- Uses Cognito Identity ID as client ID

### `iot:Subscribe`
- Resource: `topicfilter/<topic>`
- Allows subscribing to specific topics
- Wildcard supported: `topicfilter/gforce/*`

### `iot:Publish`
- Resource: `topic/<topic>`
- Allows publishing messages to topics

### `iot:Receive`
- Resource: `topic/<topic>`
- Allows receiving messages from subscribed topics

## Topics in this project

- **`iot/demo/topic`**: Test topic for connection validation
- **`gforce/libery/input`**: Send messages to IoT
- **`gforce/libery/output`**: Receive messages from IoT

## Expected debug log after fix

```
[INFO] Testing connection to topic: iot/demo/topic (timeout: 1500ms)
[INFO] Initializing PubSub with endpoint: wss://acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com/mqtt
[INFO] PubSub instance created
[INFO] Connection state: Connecting
[INFO] PubSub connecting...
[INFO] testConnect subscribed to iot/demo/topic, waiting for timeout...
[INFO] Connection state: Connected
[INFO] PubSub connected successfully
[INFO] testConnect timeout reached for iot/demo/topic - connection OK
```

## Troubleshooting

### Still getting ConnectionDisrupted?
1. Check IAM role has policy attached (AWS Console → IAM → Roles → search for "amplify-gforgeiot-gerard-sandbox")
2. Verify IoT endpoint is correct in `.env.local`
3. Check CloudWatch logs for IoT Core errors
4. Ensure user is authenticated (has valid Cognito session)

### Permission denied errors?
- ARN region must match IoT endpoint region (`eu-west-1`)
- Account ID wildcard (`*`) is OK for sandbox, use specific account ID for production
- Topic names are case-sensitive

### WebSocket connection fails immediately?
- Check IoT endpoint format: `acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com` (no `wss://` or `/mqtt`)
- Verify endpoint is ATS endpoint (has `-ats` in domain)
