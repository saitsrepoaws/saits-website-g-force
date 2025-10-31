# IoT Quick Reference - G-Forge IoT

**Snelle naslagwerk voor IoT setup en troubleshooting**

---

## 🚀 QUICK START

### **1. Environment Setup**
```bash
# apps/web/.env
VITE_AWS_IOT_ENDPOINT=acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com
VITE_AWS_REGION=eu-west-1
```

### **2. Backend Requirements**
```typescript
// Managed policies (backend.ts):
✅ AWSIoTDataAccess
✅ AWSIoTConfigAccess

// IoT Policy (AWS Console):
✅ RadioPlayerCognitoPolicy (must exist in AWS IoT)
```

### **3. Frontend Auto-Configuration**
```typescript
// IoTContext automatically:
✅ Attaches IoT Policy to identity
✅ Creates PubSub singleton
✅ Opens WebSocket via keepalive subscription
✅ Monitors connection state
```

---

## 📝 CRITICAL PATTERNS

### **Singleton Pattern (VERPLICHT!)**
```typescript
// ❌ WRONG - Multiple instances
function MyComponent() {
  const pubsub = new PubSub({...}) // Creates new instance!
}

// ✅ CORRECT - Use singleton
import { useIoT } from '@/contexts/IoTContext'

function MyComponent() {
  const iot = useIoT() // Uses shared instance
  
  useEffect(() => {
    return iot.subscribe('my/topic', (data) => {
      console.log(data)
    })
  }, [])
}
```

### **Keepalive Subscription (Required for WebSocket)**
```typescript
// Amplify PubSub v6: WebSocket only opens on first subscribe!
const keepaliveSubscription = pubsub.subscribe({ 
  topics: 'radio/system/keepalive' 
}).subscribe({ next: () => {} })

// NEVER unsubscribe - maintains connection!
```

### **Publish (Simple)**
```typescript
await iot.publish('radio/players/player-001/state', {
  status: 'playing',
  track: 'My Track'
})
```

### **Subscribe (With Cleanup)**
```typescript
useEffect(() => {
  const unsubscribe = iot.subscribe('radio/players/+/commands', (data) => {
    handleCommand(data)
  })
  
  return unsubscribe // Cleanup on unmount
}, [])
```

---

## 🔧 TROUBLESHOOTING

### **Connection Stuck "Connecting"**
```bash
1. Check .env file exists
2. Hard refresh (Cmd+Shift+R)
3. Check console for errors
4. Check AWS IoT logs
```

### **AUTHORIZATION_FAILURE**
```bash
1. Check managed policies in backend.ts
2. Redeploy backend: npx ampx sandbox
3. Logout & login (fresh credentials)
4. Check IoT Policy attached to identity
```

### **Reconnect Loop**
```bash
1. Check for duplicate autoConnect calls
2. Verify singleton pattern
3. Check keepalive subscription is single
```

### **Manual Reset**
```javascript
// In browser console:
import { resetPubSub } from './services/pubsub'
resetPubSub()
location.reload()
```

---

## 📊 CONNECTION STATES

```typescript
enum ConnectionState {
  Disconnected = 'Disconnected',     // Not connected
  Connecting = 'Connecting',         // Opening WebSocket
  Connected = 'Connected',           // Ready for pub/sub ✅
  ConnectionDisrupted = 'ConnectionDisrupted', // Network issue
}
```

**Normal Flow:**
```
Disconnected → Connecting (2-5s) → Connected ✅
```

**If stuck on Connecting:**
- Check .env file
- Check managed policies
- Check IoT Policy attachment

---

## 🎯 TOPIC NAMING

### **Players:**
```
radio/players/{playerId}/commands       (SUB) Receive commands
radio/players/{playerId}/state          (PUB) Publish state
radio/players/{playerId}/track-info     (PUB) Current track
```

### **Broadcast:**
```
radio/broadcast/all                     (SUB) Global commands
radio/broadcast/schedule-update         (SUB) Schedule changes
```

### **System:**
```
radio/system/keepalive                  (SUB) Connection maintenance
radio/system/health-check               (PUB) Connection test
```

---

## ⚡ COMMON TASKS

### **Subscribe to Player Commands**
```typescript
const { subscribe } = useIoT()

useEffect(() => {
  return subscribe(`radio/players/${playerId}/commands`, (cmd) => {
    switch(cmd.action) {
      case 'PLAY': handlePlay(); break
      case 'PAUSE': handlePause(); break
      case 'STOP': handleStop(); break
    }
  })
}, [playerId])
```

### **Publish Player State**
```typescript
const { publish } = useIoT()

async function updateState(status: string) {
  await publish(`radio/players/${playerId}/state`, {
    playerId,
    status,
    timestamp: new Date().toISOString(),
    track: currentTrack
  })
}
```

### **Monitor Connection**
```typescript
const { connectionState, isConnected } = useIoT()

return (
  <div>
    Status: {connectionState}
    {isConnected ? '✅' : '❌'}
  </div>
)
```

---

## 📚 DOCUMENTATION

- **Complete Journey:** `IOT_SETUP_JOURNEY_31OCT2025.md`
- **Setup Analysis:** `SETUP_ANALYSE_2025.md`
- **Comprehensive Guide:** `iot-pubsub-naslagwerk.md`
- **Policy Setup:** `/docs/IOT_POLICY_SETUP.md`
- **Topics Spec:** `/docs/IOT_TOPICS_SPECIFICATION.md`

---

## ✅ HEALTH CHECK

### **Quick Verification:**
```bash
1. Open: http://localhost:5173/devices/network
2. Check: Status = "● Connected" (green)
3. Click: Test Connection
4. Expect: "✅ Connection test successful!"
5. Console: Should see "💚 IoT PING" every 10s
```

### **Expected Console Logs:**
```javascript
✅ IoT CONNECTED - Ready to Send/Receive
💚 IoT PING - Connection Alive (every 10s)
✅ Auto-connect confirmed
🔗 Keepalive subscription active
```

### **AWS IoT Logs Check:**
```json
{
  "eventType": "Connect",
  "status": "Success"  // ✅ Good
}
{
  "eventType": "Subscribe", 
  "status": "Success"  // ✅ Good
}
// NO AUTHORIZATION_FAILURE ✅
// NO CLIENT_ERROR ✅
```

---

## 🚨 CRITICAL DON'TS

### **❌ DON'T:**
```typescript
// Multiple PubSub instances
const pubsub1 = new PubSub({...})
const pubsub2 = new PubSub({...}) // ❌ Creates duplicate connections!

// Unsubscribe keepalive
keepaliveSubscription.unsubscribe() // ❌ Breaks connection!

// Use testConnect in production
await testConnect('topic') // ❌ Creates temporary sub/unsub

// Call autoConnect multiple times
await autoConnect()
await autoConnect() // ❌ Singleton guards prevent but wasteful
```

### **✅ DO:**
```typescript
// Use shared IoT context
const iot = useIoT()

// Keep subscriptions alive
useEffect(() => {
  return iot.subscribe('topic', handler) // ✅ Auto cleanup
}, [])

// Publish without subscribe
await iot.publish('topic', data) // ✅ Simple

// Use singleton pattern everywhere
// ✅ One connection, multiple subscribers
```

---

## 🎓 KEY LEARNINGS

1. **Amplify PubSub v6 is lazy** - WebSocket only opens on subscribe/publish
2. **Keepalive subscription required** - Triggers AND maintains WebSocket
3. **Two auth layers** - IAM Policies + IoT Policy (both needed!)
4. **Singleton is critical** - Prevents duplicate connections
5. **Hub listener is reliable** - Use for state monitoring
6. **Don't test with subscribe** - Use publish only for testing

---

**Last Updated:** 31 October 2025  
**Status:** ✅ Production Ready  
**Version:** 1.0
