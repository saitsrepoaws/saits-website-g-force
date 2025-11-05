# IoT Debug Plan - Systematische Test Flow

**Doel:** Verifiëren dat IoT berichten correct worden verzonden en ontvangen

---

## 🎯 TEST STAPPEN

### **Stap 1: UI → IoT Test (Direct Publish)**

**Actie:**
1. Open: `http://localhost:5173/devices/players`
2. Wacht tot "IoT Connected" groen is
3. Wacht tot "Subscribed" groen is
4. Klik op **"🧪 Test Publish"** knop

**Verwacht Resultaat:**
```javascript
// In Console:
🧪 TEST PUBLISH - Sending test command
Topic: radio/player/player-001/command
Command: { command: 'PLAY', playerId: 'player-001', timestamp: '...', test: true }
✅ TEST command published successfully
⏳ Check if message arrives in subscription...

// Dan binnen 1 seconde:
📥 INCOMING raw data: { ... }
📥 PARSED command: { command: 'PLAY', ... }
🎯 Processing command: PLAY
▶️ PLAY command received
```

**Als het WERKT:**
- ✅ Publish werkt
- ✅ Subscribe werkt
- ✅ Geen filter probleem
- → Ga naar Stap 2

**Als het NIET WERKT:**
- ❌ Bericht komt niet aan
- → Check IoT Diagnostics sectie op pagina
- → Check subscribed topic matches publish topic
- → Check AWS IoT logs voor filters/policy issues

---

### **Stap 2: Auto Load Command Test (UI → Backend)**

**Actie:**
1. Klik op **"Auto Load"** toggle (zet aan)

**Verwacht Resultaat:**
```javascript
// In Console:
🎚️ AUTO LOAD TOGGLE
New value: ON
📤 Publishing LOAD command to backend...
Topic: radio/player/player-001/command-request
Command: { command: 'LOAD', playerId: 'player-001', ... }
✅ LOAD command sent to backend
⏳ Waiting for backend to determine track...
```

**Check:**
- Komt bericht aan in AWS IoT?
- Check AWS IoT Test Client: Subscribe to `radio/player/+/command-request`

**Als het NIET aankomt:**
- ❌ Topic filter probleem
- ❌ Policy probleem
- → Check IoT Policy in AWS Console
- → Check topic pattern: `radio/player/*/command-request`

---

### **Stap 3: Backend → UI Test (Lambda Response)**

**Verwacht na Stap 2:**
```javascript
// Backend Lambda triggered
// Lambda publishes to: radio/player/player-001/command

// In UI Console:
💿 LOAD COMMAND RECEIVED FROM BACKEND
Full message: { command: 'LOAD', params: { track: {...}, ... } }
✅ Track from backend:
   Title: ...
   Artist: ...
   File: ...
✅ Player state updated with track
```

**Als het NIET aankomt:**
- ❌ Lambda niet getriggerd
- ❌ Lambda publish faalt
- ❌ Topic mismatch
- → Check Lambda logs in CloudWatch
- → Check Lambda IoT policy permissions

---

## 🔍 DIAGNOSTICS CHECKLIST

### **IoT Diagnostics Sectie (op Players pagina)**

```
Subscribed Topic:    radio/player/player-001/command  ✅
Exact Topic:         radio/player/player-001/command  ✅
Wildcard Debug:      OFF  ✅
```

**Moet matchen:**
- Subscribed Topic = Exact Topic (als wildcard OFF)
- Als wildcard ON: Subscribed Topic = `radio/player/+/command`

---

### **AWS IoT Test Client**

**Subscribe Topics:**
```
radio/player/+/command           # Alle player commands
radio/player/+/command-request   # Alle command requests
radio/player/+/state             # Alle player states
radio/#                          # Alles (debug only!)
```

**Test:**
1. Subscribe to `radio/player/+/command` in AWS Console
2. Klik "Test Publish" in UI
3. Zie je bericht in AWS Console?
   - ✅ JA → Publish werkt, subscribe in UI is probleem
   - ❌ NEE → Publish faalt, policy/credentials probleem

---

### **Console Logs Analyse**

**Goede Flow:**
```
✅ IoT CONNECTED - Ready to Send/Receive
✅ Subscribed to: radio/player/player-001/command
🧪 TEST PUBLISH - Sending test command
✅ TEST command published successfully
📥 MESSAGE RECEIVED IN PUBSUB.TS
📥 INCOMING raw data: ...
🎯 Processing command: PLAY
```

**Probleem: Publish OK, maar geen receive:**
```
✅ TEST command published successfully
⏳ Check if message arrives in subscription...
(... stilte ...)
```
→ **Diagnose:** Subscribe filter probleem of topic mismatch

**Probleem: Publish faalt:**
```
❌ Failed to publish test command: Error: ...
```
→ **Diagnose:** IoT Policy of credentials probleem

---

## 🛠️ FIXES

### **Fix 1: Topic Mismatch**

**Check:**
```typescript
// In Players.tsx line ~94
const exactTopic = `radio/player/${playerId}/command`  // Moet exact zijn!
```

**En:**
```typescript
// In handleTestPublish line ~341
const testTopic = `radio/player/${playerId}/command`  // Moet matchen!
```

---

### **Fix 2: Wildcard Debug Mode**

**Als berichten niet aankomen, probeer wildcard:**

```bash
# In apps/web/.env.local
VITE_IOT_DEBUG_WILDCARD=true
```

**Herstart dev server:**
```bash
cd apps/web
npm run dev
```

**Nu subscribed naar:** `radio/player/+/command` (alle players)

---

### **Fix 3: IoT Policy Check**

**AWS Console → IoT Core → Secure → Policies → RadioPlayerCognitoPolicy**

**Moet bevatten:**
```json
{
  "Effect": "Allow",
  "Action": [
    "iot:Connect",
    "iot:Subscribe",
    "iot:Publish",
    "iot:Receive"
  ],
  "Resource": [
    "arn:aws:iot:eu-west-1:*:topic/radio/*",
    "arn:aws:iot:eu-west-1:*:topicfilter/radio/*",
    "arn:aws:iot:eu-west-1:*:client/${cognito-identity.amazonaws.com:sub}"
  ]
}
```

**Let op:** `topicfilter` is nodig voor Subscribe met wildcards!

---

### **Fix 4: Lambda IoT Permissions**

**Check amplify/backend.ts:**

```typescript
defineBackend({
  auth,
  data,
  // ... functions
})

// Managed policies voor authenticated role:
backend.auth.resources.authenticatedUserIamRole.addManagedPolicy(
  ManagedPolicy.fromAwsManagedPolicyName('AWSIoTDataAccess')
)
backend.auth.resources.authenticatedUserIamRole.addManagedPolicy(
  ManagedPolicy.fromAwsManagedPolicyName('AWSIoTConfigAccess')
)
```

**Als Lambda moet publishen, check Lambda execution role!**

---

## 📊 EXPECTED TIMELINE

```
00:00 - Open Players page
00:02 - IoT Connected ✅
00:03 - Subscribed ✅
00:05 - Click "Test Publish"
00:05 - Publish succeeds ✅
00:06 - Message received ✅ (binnen 1 seconde!)
00:07 - Command processed ✅
```

**Als message niet binnen 2 seconden aankomt → Probleem!**

---

## 🚨 COMMON ISSUES

### **Issue 1: Socket Closed Loop**
```
[WARN] Socket closed
✅ Reconnected
[WARN] Socket closed
✅ Reconnected
```
→ **Oorzaak:** Credential refresh (normaal elke ~1 uur)
→ **Fix:** Geen, dit is normaal gedrag (zie IOT_SOCKET_CLOSED_EXPLAINED.md)

---

### **Issue 2: Messages Not Arriving**
```
✅ Published successfully
(... no incoming message ...)
```
→ **Diagnose:**
1. Check AWS IoT Test Client - zie je bericht daar?
2. Check subscribed topic matches publish topic
3. Check IoT Policy heeft `iot:Receive` permission
4. Check geen typo in topic naam

---

### **Issue 3: Authorization Failure**
```
❌ AUTHORIZATION_FAILURE
```
→ **Fix:**
1. Check IoT Policy attached to identity
2. Run: `npm run attach-policy` (if script exists)
3. Logout & login voor fresh credentials
4. Redeploy backend: `npx ampx sandbox`

---

## ✅ SUCCESS CRITERIA

**Test Publish werkt als:**
1. ✅ Publish log verschijnt in console
2. ✅ Binnen 1 seconde: "MESSAGE RECEIVED" log
3. ✅ Command wordt geparsed en processed
4. ✅ IoT Log Window toont outgoing + incoming message

**Auto Load werkt als:**
1. ✅ LOAD command-request wordt gepublished
2. ✅ Lambda wordt getriggerd (check CloudWatch)
3. ✅ Lambda publishes LOAD command terug
4. ✅ UI ontvangt LOAD command met track data
5. ✅ Player state wordt updated met track

---

## 🎓 DEBUGGING TIPS

1. **Open Console ALTIJD** - Alle logs zijn daar
2. **Check IoT Diagnostics sectie** - Zie subscribed topic
3. **Use AWS IoT Test Client** - Verify messages arrive in AWS
4. **Check CloudWatch Logs** - Voor Lambda execution
5. **Enable Wildcard Debug** - Als berichten niet aankomen
6. **Hard Refresh** - Cmd+Shift+R na .env changes

---

**Last Updated:** 3 November 2025  
**Status:** 🧪 Ready for Testing
