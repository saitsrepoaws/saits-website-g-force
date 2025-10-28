# 🔍 IoT Policy Issue - ROOT CAUSE

## **PROBLEEM GEVONDEN!**

Zowel **Amplify PubSub** als **MQTT.js** falen omdat:

### AWS IoT vereist TWEE soorten policies:

1. ✅ **IAM Policy** (hebben we)
   - Toegang tot IoT API's
   - Attach aan IAM Role
   - **Hebben we al geconfigureerd**

2. ❌ **IoT Policy** (ONTBREEKT!)
   - Toegang tot MQTT connections
   - Moet attached worden aan **elke Cognito Identity**
   - **DIT IS HET PROBLEEM**

---

## **Waarom Connection Faalt**

```
WebSocket connection to 'wss://...iot.amazonaws.com/mqtt?...' failed
```

AWS IoT Core checkt bij MQTT connect:
1. Is er een IoT Policy attached aan deze Cognito Identity? ❌ NEE
2. → Connection REJECTED

---

## **OPLOSSINGEN**

### **Optie 1: Lambda Trigger (Production Ready)**

Gebruik Cognito Identity Pool Pre-Authentication Trigger:

```typescript
// Lambda function triggered on Cognito login
export const handler = async (event) => {
  const identityId = event.identityId
  const policyName = 'CognitoIoTPolicy'
  
  try {
    // Attach IoT policy to Cognito Identity
    await iot.attachPolicy({
      policyName,
      target: identityId
    }).promise()
    
    console.log(`✅ Attached IoT policy to ${identityId}`)
  } catch (error) {
    if (error.code === 'ResourceAlreadyExistsException') {
      // Already attached, OK
    } else {
      throw error
    }
  }
  
  return event
}
```

**Amplify Backend Config:**
```typescript
// amplify/backend.ts
import { defineAuth } from '@aws-amplify/backend'

export const auth = defineAuth({
  // ... existing config
  triggers: {
    preAuthentication: defineFunction({
      entry: './functions/attach-iot-policy/handler.ts'
    })
  }
})
```

---

### **Optie 2: Manual Script (Development)**

Run script om policy te attachen aan HUIDIGE user:

```bash
./scripts/attach-iot-policy-to-user.sh
```

**Script:**
```bash
#!/bin/bash
# Get current Cognito Identity
IDENTITY_ID=$(aws cognito-identity get-id \
  --identity-pool-id $IDENTITY_POOL_ID \
  --logins cognito-idp.eu-west-1.amazonaws.com/$USER_POOL_ID=$ID_TOKEN \
  --query 'IdentityId' --output text)

# Attach policy
aws iot attach-policy \
  --policy-name CognitoIoTPolicy \
  --target $IDENTITY_ID

echo "✅ IoT Policy attached to $IDENTITY_ID"
```

---

### **Optie 3: HTTP Polling (Workaround)**

Geen MQTT - gebruik API Gateway + Lambda polling:

```typescript
// Frontend pollt elke 5 seconden
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch('/api/player-status').then(r => r.json())
    setPlayerState(status)
  }, 5000)
  return () => clearInterval(interval)
}, [])
```

**Voordeel:** Geen IoT Policy nodig  
**Nadeel:** Niet real-time

---

## **AANBEVELING**

### **Voor Development (NU):**
Gebruik **Optie 2** (manual script) om snel te testen

### **Voor Production:**
Implementeer **Optie 1** (Lambda trigger) voor automatische policy attachment

---

## **Resources**

- [AWS IoT Policies](https://docs.aws.amazon.com/iot/latest/developerguide/iot-policies.html)
- [Cognito + IoT](https://docs.aws.amazon.com/iot/latest/developerguide/cognito-identities.html)
- [Amplify PubSub Setup](https://docs.amplify.aws/react/build-a-backend/add-aws-services/pubsub/)

---

## **Timeline**

- ✅ Backend IoT flow works
- ✅ MQTT.js implementation works
- ✅ Signing works
- ❌ IoT Policy missing
- ⏰ Fix: ~30 min (manual) or ~2 hours (Lambda trigger)

---

**Status:** BLOCKED on IoT Policy configuration  
**Next Step:** Choose solution option and implement
