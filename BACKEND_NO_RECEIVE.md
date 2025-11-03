# ❌ BACKEND ONTVANGT GEEN BERICHTEN

**Timestamp:** 3 Nov 2025, 20:47:26  
**User Action:** Auto Load button clicked  
**Expected:** State Machine execution → Track data teruggestuurd  
**Actual:** NIETS komt aan in backend

---

## 📤 WAT DE FRONTEND STUURT

### Outgoing Message 1: State Update
```json
Topic: radio/player/player-001/state
Message: {
  "status": "loading",
  "autoLoad": true,
  "track": null,
  "volume": 100
}
```

### Outgoing Message 2: LOAD Command
```json
Topic: radio/player/player-001/command-request
Message: {
  "command": "LOAD",
  "playerId": "player-001",
  "timestamp": "2025-11-03T19:47:26.619Z"
}
```

**Zichtbaar in:** IoT Log Window (frontend UI)  
**Status:** ✅ Frontend publish aangeroepen

---

## 📥 WAT DE BACKEND ONTVANGT

### State Machine Executions:
```
Laatste execution: 2025-11-03T17:46:13 (3 uur geleden)
Nieuwe execution:  GEEN! ❌
```

### state-machine-trigger Lambda:
```
Logs (laatste 10 min): GEEN! ❌
Invocations:           GEEN! ❌
```

### IoT Rule (RadioPlayerCommandRuleV2):
```
SQL: SELECT * FROM 'radio/player/+/command-request'
Status: Enabled ✅
Triggered: GEEN! ❌
```

**Conclusie:** ❌ **BERICHT KOMT NIET AAN BIJ AWS IOT CORE**

---

## 🔍 WAAROM NIET?

### Root Cause: Frontend Publish Faalt

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. User klikt Auto Load button                            │
│     ↓                                                       │
│  2. Frontend: iot.publish('radio/player/.../command-req')  │
│     ↓                                                       │
│  3. IoTContext.publish() → pubsub.publish()                │
│     ↓                                                       │
│  4. PubSub.publish() probeert WebSocket te gebruiken       │
│     ↓                                                       │
│  ❌ FAALT HIER! ❌                                          │
│     Reden: WebSocket is niet echt connected                │
│     Waarom: IoT Policy attach failed (no permissions)      │
│     Effect: Publish faalt SILENTLY (geen error throw)      │
│     Resultaat: Bericht komt NIET aan bij AWS IoT Core      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

5. AWS IoT Core: (ontvangt niets)
   ↓
6. IoT Rule: (triggered niet)
   ↓
7. state-machine-trigger Lambda: (niet aangeroepen)
   ↓
8. State Machine: (niet gestart)
   ↓
9. Backend response: (geen)
   ↓
10. Frontend: (wacht op bericht dat nooit komt)
```

---

## 🛑 BLOKKERENDE ISSUE

### Unauthenticated Role heeft GEEN IoT Permissions

**In Playwright test console:**
```javascript
[error] ❌ Failed to attach IoT Policy: 
AccessDeniedException: User: arn:aws:sts::...:assumed-role/
amplifyAuthunauthenticate/CognitoIdentityCredentials 
is not authorized to perform: iot:AttachPolicy
```

**Effect:**
- ❌ IoT Policy niet attached
- ❌ PubSub WebSocket niet volledig connected
- ❌ `iot:Publish` permission ontbreekt
- ❌ Berichten komen niet aan bij AWS

**Oplossing:**
```typescript
// amplify/backend.ts (already committed)
const unauthenticatedRole = backend.auth.resources.unauthenticatedUserIamRole

unauthenticatedRole.attachInlinePolicy(
  new Policy(unauthenticatedRole.stack, 'IotPubSubPolicyUnauth', {
    statements: [
      new PolicyStatement({
        actions: ['iot:Publish'], // ← CRITICAL!
        resources: ['arn:aws:iot:eu-west-1:*:topic/*'],
      }),
      // + andere IoT permissions
    ],
  })
)
```

---

## ✅ DEPLOY NU

```bash
npx ampx sandbox
```

**Dit deployed:**
- ✅ IAM unauthenticated role update
- ✅ IoT permissions toegevoegd
- ✅ `iot:Publish` permission actief

**Na deploy (in browser console):**
```javascript
// VOOR (NU):
[error] ❌ Failed to attach IoT Policy: AccessDeniedException
[log] [PubSub INFO] Connection state: Connecting (blijft hangen)
📤 OUTGOING berichten (maar komen niet aan)

// NA (na deploy):
[log] ✅ IoT Policy attached successfully
[log] [PubSub INFO] Connection state: Connected
[log] 💚 IoT CONNECTED - Ready to Send/Receive
📤 OUTGOING berichten (komen WEL aan!)
📥 INCOMING berichten (komen terug!)
```

---

## 🧪 TEST FLOW NA DEPLOY

### 1. Hard Refresh Browser
```
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows)
```

### 2. Check Console
```javascript
✅ IoT Policy attached successfully
💚 IoT CONNECTED - Ready to Send/Receive
✅ Subscribed to: radio/player/player-001/command
```

### 3. Click Auto Load Button
```
📤 Outgoing: radio/player/player-001/command-request
   {command: "LOAD", playerId: "player-001", ...}
```

### 4. Check Backend (binnen 3-4 seconden)
```bash
# Check State Machine
aws stepfunctions list-executions \
  --state-machine-arn "arn:aws:states:eu-west-1:035636364722:stateMachine:RadioPlayerStateMachineV2" \
  --max-results 1 \
  --region eu-west-1

# Should show NEW execution with recent timestamp
```

### 5. Check Frontend (binnen 3-4 seconden)
```javascript
// Browser console:
📥 MESSAGE RECEIVED IN PUBSUB.TS
📥 INCOMING raw data: {value: '...', provider: 'AWSIoTProvider'}
📥 PARSED command: {command: "LOAD", params: {...}}
💿 LOAD COMMAND RECEIVED FROM BACKEND
✅ Track from backend: Dream - Tony Baltimore

// IoT Log Window:
📥 Incoming: 1
Track: Dream - Tony Baltimore
BPM: 137
```

---

## 📊 HUIDIGE STATUS

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  FRONTEND → AWS IoT Core:  ❌ FAALT (no permissions)    │
│  AWS IoT Core → Backend:   ⏸️  NIET GETEST (niets aan)  │
│  Backend → AWS IoT Core:   ✅ WERKT (verified eerder)   │
│  AWS IoT Core → Frontend:  ❌ FAALT (no subscription)   │
│                                                          │
└──────────────────────────────────────────────────────────┘

ROOT CAUSE:
  Unauthenticated role heeft GEEN IoT permissions
  
FIX:
  Deploy met: npx ampx sandbox
  
AFTER FIX:
  ✅ Frontend → AWS IoT Core
  ✅ AWS IoT Core → Backend
  ✅ Backend → AWS IoT Core  
  ✅ AWS IoT Core → Frontend
  
RESULT:
  🎉 Complete end-to-end flow works!
```

---

## 🚀 ACTION REQUIRED

**RUN THIS NOW:**
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
npx ampx sandbox
```

**Wait for:**
```
✓ Deployed resources to amplify-gforgeiot-gerard--main branch
✓ IAM role updated: amplifyAuthunauthenticate
✓ Inline policy attached: IotPubSubPolicyUnauth
```

**Then:**
1. Hard refresh browser
2. Click Auto Load
3. See incoming track data! 🎉

---

**STATUS:** ⏳ Waiting for deployment
