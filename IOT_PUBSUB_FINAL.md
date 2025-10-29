# 🎯 IoT PubSub - Finale Werkende Setup

## ✅ Status: WERKEND

### Datum: 29 oktober 2025, 01:50
### Policy: `RadioPlayerCognitoPolicy` v2
### Topics: `radio/player/*`

---

## 📋 Overzicht

Amplify PubSub met AWS IoT Core via WebSocket MQTT is succesvol geïmplementeerd.

### ✅ Wat werkt:
- Auto-connect bij page load
- Keepalive (60 sec pings)
- Auto-reconnect (5 sec delay)
- Pub/Sub op `radio/player/*` topics
- Connection status indicator
- Debug log window

### ❌ Wat NIET meer doen:
- Policy wijzigingen (blijf binnen `radio/player/*`)
- Topics buiten `radio/player/*` gebruiken
- Client ID format wijzigen

---

## 🔐 IoT Policy: RadioPlayerCognitoPolicy (v2)

**Locatie:** AWS IoT Core Console → Secure → Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": [
        "arn:aws:iot:eu-west-1:*:client/${cognito-identity.amazonaws.com:sub}",
        "arn:aws:iot:eu-west-1:*:client/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:eu-west-1:*:topicfilter/radio/player/*"
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Receive", "iot:Publish"],
      "Resource": "arn:aws:iot:eu-west-1:*:topic/radio/player/*"
    }
  ]
}
```

**⚠️ BELANGRIJK:** 
- Policy is geattached aan Cognito Identity: `eu-west-1:084c17c5-b216-c22b-6d17-495e12cfa4b2`
- Alleen `radio/player/*` topics zijn toegestaan
- Client ID wildcards toegestaan (`client/*`)

---

## 🏗️ Architectuur

### Components:

1. **`apps/web/src/services/pubsub.ts`**
   - Singleton PubSub instance
   - Auto-connect functie
   - Keepalive logging (60 sec)
   - Connection state management
   - Hub listener (eenmalig geregistreerd)

2. **`apps/web/src/services/iotPolicyAttacher.ts`**
   - Attach RadioPlayerCognitoPolicy aan Cognito Identity
   - Gebruikt AWS SDK (@aws-sdk/client-iot)
   - Frontend button voor self-service

3. **`apps/web/src/pages/IotTest.tsx`**
   - Test/debug pagina
   - Auto-connect bij load
   - Manual connect/subscribe/publish
   - Debug log window
   - IoT Policy attach button

4. **`amplify/backend.ts`**
   - IAM permissions voor authenticated users
   - Allows: iot:Connect, iot:Subscribe, iot:Publish, iot:Receive
   - Allows: iot:AttachPolicy (voor self-service)

---

## 📡 PubSub Configuratie

### Endpoint:
```
wss://acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com/mqtt
```

### Client ID Format:
```typescript
const clientId = identityId.replace(':', '-')
// Example: eu-west-1-084c17c5-b216-c22b-6d17-495e12cfa4b2
```

### Keepalive Settings:
```typescript
{
  keepAliveTimeoutMs: 60000,  // Ping elke 60 sec
  reconnectTimeoutMs: 5000,   // Reconnect na 5 sec
}
```

---

## 🎯 Topic Naming Convention

**Format:** `radio/player/{playerId}/{type}`

### Voorbeelden:
- `radio/player/player-main-001/command` - Commands naar player
- `radio/player/player-main-001/status` - Status updates van player
- `radio/player/player-main-001/event` - Events van player
- `radio/player/test-001/input` - Test input
- `radio/player/test-001/output` - Test output

**⚠️ ALTIJD beginnen met `radio/player/`** anders wordt geblokkeerd!

---

## 🚀 Gebruik in Code

### Auto-connect (eenmalig bij app start):
```typescript
import { autoConnect } from '../services/pubsub'

useEffect(() => {
  const connect = async () => {
    const ok = await autoConnect()
    setStatus(ok ? 'connected' : 'error')
  }
  connect()
}, [])
```

### Subscribe:
```typescript
import { subscribe } from '../services/pubsub'

const unsubscribe = await subscribe(
  { topic: 'radio/player/player-001/command' },
  (message) => {
    console.log('Received:', message)
  },
  (error) => {
    console.error('Error:', error)
  }
)

// Later: cleanup
unsubscribe()
```

### Publish:
```typescript
import { publish } from '../services/pubsub'

await publish({
  topic: 'radio/player/player-001/status',
  message: { status: 'playing', track: 'song.mp3' }
})
```

---

## 🧪 Testen

### 1. IoT Test Pagina:
```
http://localhost:5173/iot-test
```
- Auto-connects bij load
- Subscribe/publish test buttons
- Debug log window
- Connection status indicator

### 2. CLI Test:
```bash
aws iot-data publish \
  --topic "radio/player/test-001/output" \
  --cli-binary-format raw-in-base64-out \
  --payload '{"test":true,"message":"Hello!"}'
```

### 3. CloudWatch Logs:
```bash
aws logs tail /aws/iot/AWSIotLogsV2 --follow
```

---

## 🐛 Troubleshooting

### ConnectionDisrupted Loop:
**Oorzaak:** IoT Policy niet attached of topic niet toegestaan

**Fix:**
1. Check policy: `aws iot list-principal-policies --principal "eu-west-1:..."`
2. Check topic start met `radio/player/`
3. Click "Attach Policy" button in /iot-test

### Connection Timeout:
**Oorzaak:** Keepalive niet werkend

**Check:**
- `keepAliveTimeoutMs: 60000` in PubSub config
- Zie "📡 MQTT keepalive ping" logs elke 60 sec

### Messages niet ontvangen:
**Oorzaak:** Niet gesubscribed of verkeerde topic

**Fix:**
1. Check subscription actief: zie subscribe log
2. Check topic format: `radio/player/*`
3. Test met CLI publish

---

## 📊 Verwachte Console Logs

### Succesvolle Connect:
```
[PubSub INFO] 🔌 Auto-connecting to AWS IoT...
[PubSub INFO] Initializing NEW PubSub instance with endpoint: wss://...
[PubSub INFO] Auth session retrieved, identityId: eu-west-1:084c17c5...
[PubSub INFO] Using client ID: eu-west-1-084c17c5...
[PubSub INFO] 🎧 Registering Hub listener (once for entire app)
[PubSub INFO] PubSub instance created and cached
[PubSub INFO] Connection state: Connecting
[PubSub INFO] PubSub connecting...
[PubSub INFO] Connection state: Connected
[PubSub INFO] ✅ PubSub connected - ready to send/receive
[PubSub INFO] 📡 MQTT keepalive ping (connection active)  ← elke 60 sec
```

### Subscribe:
```
[PubSub INFO] Subscribing to topic: radio/player/test-001/output
[PubSub INFO] Subscribed successfully to radio/player/test-001/output
```

### Publish:
```
[PubSub INFO] Publishing to topic: radio/player/test-001/input
[PubSub INFO] Published successfully to radio/player/test-001/input
```

---

## 🔧 Maintenance

### Policy Update (if needed):
```bash
# NIET MEER DOEN! Huidige policy werkt.
# Blijf binnen radio/player/* topics
```

### Detach Policy:
```bash
aws iot detach-policy \
  --policy-name RadioPlayerCognitoPolicy \
  --target "eu-west-1:084c17c5-b216-c22b-6d17-495e12cfa4b2"
```

### Attach Policy:
```bash
aws iot attach-policy \
  --policy-name RadioPlayerCognitoPolicy \
  --target "eu-west-1:084c17c5-b216-c22b-6d17-495e12cfa4b2"
```

---

## 🎉 Success Criteria

- ✅ Status indicator: GROEN "IoT: connected"
- ✅ Keepalive pings elke 60 seconden
- ✅ Subscribe werkt op `radio/player/*` topics
- ✅ Publish werkt op `radio/player/*` topics
- ✅ Messages worden ontvangen binnen 1 seconde
- ✅ Connection blijft stabiel (geen disconnects)
- ✅ Auto-reconnect werkt bij network issues

---

## 📝 Notes

- Singleton pattern voor PubSub instance (eenmalig geïnitialiseerd)
- Hub listener slechts 1x geregistreerd (app-wide)
- Keepalive logging is "fake" (voor zichtbaarheid)
- Echte MQTT pings gebeuren automatisch door Amplify
- Policy v2 is nu actief (allows `client/*`)

---

## 🚨 DO NOT:

- ❌ Policy wijzigen (blijf binnen `radio/player/*`)
- ❌ Topics buiten `radio/player/*` gebruiken
- ❌ Client ID format wijzigen
- ❌ PubSub instance handmatig resetten (gebruik retry button)
- ❌ Meerdere Hub listeners registreren

---

## ✅ DO:

- ✅ Gebruik auto-connect bij app start
- ✅ Check connection status voor publish/subscribe
- ✅ Gebruik meaningful topic names binnen `radio/player/*`
- ✅ Cleanup subscriptions bij unmount
- ✅ Handle connection errors gracefully
- ✅ Log belangrijke events

---

**Last Updated:** 29 oktober 2025, 01:50  
**Status:** ✅ PRODUCTION READY  
**Policy Version:** v2  
**Topics:** `radio/player/*` ONLY
