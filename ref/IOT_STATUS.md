# IoT Player Command Flow - Status Report

## ✅ **WAT WERKT (Backend)**

### Complete Backend Flow
```
AWS CLI → IoT Core → IoT Rule → Lambda → State Machine → Lambda → IoT Core
```

**Test bewijs:**
```bash
# 1. Publish command via AWS CLI
aws iot-data publish \
  --topic "radio/player/player-main-001/command-request" \
  --payload '{"command":"LOAD","playerId":"player-main-001"}'

# 2. State Machine wordt getriggerd
aws stepfunctions list-executions --state-machine-arn [ARN]
# → SUCCEEDED

# 3. Track data wordt gepubliceerd naar IoT
aws logs tail /aws/lambda/player-iot-publisher
# → ✅ Published to IoT topic: radio/player/player-main-001/command
# → 📦 Track data: Test Track by Test Artist
```

### Deployed Resources
- ✅ **IoT Rule:** `RadioPlayerCommandRuleV2`
  - Topic: `radio/player/+/command-request`
  - Action: Trigger Lambda
  
- ✅ **Lambdas:**
  - `state-machine-trigger` - Starts State Machine
  - `player-load-handler` - Returns hardcoded track
  - `player-iot-publisher` - Publishes to IoT (dynamic import)

- ✅ **State Machine:** `RadioPlayerStateMachineV2`
  - Validates command
  - Calls load handler
  - Publishes response to IoT

- ✅ **IAM Permissions:**
  - Cognito authenticated role has IoT permissions
  - `iot:Connect`, `iot:Subscribe`, `iot:Publish`, `iot:Receive`

---

## ❌ **WAT NIET WERKT (Frontend)**

### Amplify PubSub Connection Issues

**Symptomen:**
```
Connection state: Connecting
Connection state: ConnectionDisrupted
Connection state: Connecting
Connection state: ConnectionDisrupted
[NEVER reaches: Connected]
```

**Gevolgen:**
- ❌ Subscribe werkt niet (ontvangt geen berichten)
- ❌ Publish bereikt IoT niet (IoT Rule wordt niet getriggerd)
- ⚠️ "Published successfully" log is misleidend (lokaal accepted, niet verzonden)

**Root Cause:**
- Amplify PubSub (v6) over WebSocket kan geen stabiele verbinding maken
- Handshake blijft hangen tussen Connecting/Disrupted
- IotTest pagina heeft HETZELFDE probleem

---

## 🎯 **VOLGENDE STAPPEN**

### Optie 1: MQTT.js Direct
Replace Amplify PubSub met directe MQTT.js over WebSocket:
```typescript
import mqtt from 'mqtt'

const client = mqtt.connect('wss://[endpoint]/mqtt', {
  clientId: identityId,
  username: '?SDK=JavaScript&Version=1.0.0',
  // AWS Signature v4 auth
})
```

### Optie 2: AWS IoT Device SDK
Gebruik AWS IoT Device SDK v2 voor browser:
```typescript
import { iot, mqtt } from 'aws-iot-device-sdk-v2'
```

### Optie 3: HTTP Polling Fallback
Als real-time niet essentieel is:
- Frontend pollt `/api/player-status` elke 5 seconden
- Backend pusht via IoT naar Lambda → writes to DynamoDB
- Frontend leest uit DynamoDB

---

## 📋 **HUIDIGE WORKAROUNDS**

### Voor Development/Testing
1. **IotTest pagina** werkt SOMS (inconsistent)
2. **AWS CLI** werkt altijd voor backend testing
3. **Backend flow** is volledig functioneel

### Voor Production
- Moet overstappen naar MQTT.js of AWS IoT SDK
- Amplify PubSub is niet production-ready in deze setup

---

## 🔧 **FILES AANGEPAST**

### Backend
- `amplify/backend.ts` - IoT Rule + State Machine
- `amplify/functions/state-machine/definition.asl.json`
- `amplify/functions/player-load-handler/handler.ts`
- `amplify/functions/player-iot-publisher/handler.ts`

### Frontend  
- `apps/web/src/services/pubsub.ts` - Singleton pattern, Hub listener fix
- `apps/web/src/services/radioPlayerIoT.ts` - Player IoT service
- `apps/web/src/components/IoTStatusIndicator.tsx` - Status + retry button
- `apps/web/src/pages/devices/Players.tsx` - IoT integration

---

## 📊 **METRICS**

- **Backend Success Rate:** 100% (AWS CLI tests)
- **Frontend Connection Rate:** 0% (never reaches Connected)
- **Time Spent on PubSub Issues:** ~3 hours
- **Recommendation:** Switch to MQTT.js → Expected fix time: 1-2 hours

---

**Laatst getest:** 2025-10-28 22:40
**Status:** Backend werkt, Frontend PubSub broken
