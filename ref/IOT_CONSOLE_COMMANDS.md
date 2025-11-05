# IoT Console Commands - Quick Reference

**Handige commands voor browser console tijdens debugging**

---

## 🔍 INSPECTION COMMANDS

### **Check Connection Status**
```javascript
// Check if IoT is connected
console.log('Connected:', window.__iotContext?.isConnected)
console.log('State:', window.__iotContext?.connectionState)
```

### **View Recent Logs**
```javascript
// Get last 10 PubSub logs
import { getLogs } from './services/pubsub'
console.table(getLogs().slice(0, 10))
```

### **Check Auth Session**
```javascript
// Check current credentials
import { fetchAuthSession } from 'aws-amplify/auth'
const session = await fetchAuthSession()
console.log('Identity:', session.identityId)
console.log('Expires:', new Date(session.credentials?.expiration * 1000))
```

---

## 📤 PUBLISH COMMANDS

### **Test Publish (Manual)**
```javascript
// Direct publish via IoT context
const iot = window.__iotContext
await iot.publish('radio/player/player-001/command', {
  command: 'PLAY',
  playerId: 'player-001',
  timestamp: new Date().toISOString(),
  test: true
})
console.log('✅ Test command published')
```

### **Publish LOAD Command**
```javascript
// Trigger backend to load track
const iot = window.__iotContext
await iot.publish('radio/player/player-001/command-request', {
  command: 'LOAD',
  playerId: 'player-001',
  timestamp: new Date().toISOString()
})
console.log('✅ LOAD request sent to backend')
```

### **Publish State Update**
```javascript
// Update player state
const iot = window.__iotContext
await iot.publish('radio/player/player-001/state', {
  playerId: 'player-001',
  status: 'playing',
  track: { title: 'Test Track', artist: 'Test Artist' },
  timestamp: new Date().toISOString()
})
console.log('✅ State published')
```

---

## 📥 SUBSCRIBE COMMANDS

### **Subscribe to Topic (Temporary)**
```javascript
// Subscribe and log messages
const iot = window.__iotContext
const unsub = await iot.subscribe(
  'radio/player/+/command',
  (data) => {
    console.log('📥 Received:', data)
  },
  (err) => {
    console.error('❌ Error:', err)
  }
)

// Later: unsubscribe
// unsub()
```

### **Monitor All Player Commands**
```javascript
// Wildcard subscribe
const iot = window.__iotContext
await iot.subscribe('radio/player/+/command', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📥 PLAYER COMMAND:', data)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})
```

---

## 🔧 DIAGNOSTIC COMMANDS

### **Check Subscriptions**
```javascript
// List active subscriptions (if exposed)
console.log('Active subscriptions:', window.__iotSubscriptions)
```

### **Test Connection**
```javascript
// Test if connection works
import { testConnect } from './services/pubsub'
const works = await testConnect('radio/system/health-check', 5000)
console.log('Connection test:', works ? '✅ OK' : '❌ FAILED')
```

### **View IoT Endpoint**
```javascript
// Check configured endpoint
console.log('IoT Endpoint:', import.meta.env.VITE_AWS_IOT_ENDPOINT)
console.log('Region:', import.meta.env.VITE_AWS_REGION)
```

### **View Tab ID**
```javascript
// Check unique tab ID (allows multiple tabs to connect)
import { getTabId } from './services/pubsub'
console.log('Tab ID:', getTabId())
// Each tab/window has its own unique ID
```

---

## 🚨 TROUBLESHOOTING COMMANDS

### **Reset PubSub Connection**
```javascript
// Force reconnect
import { resetPubSub, autoConnect } from './services/pubsub'
resetPubSub()
await autoConnect()
console.log('✅ Connection reset')
```

### **Clear Logs**
```javascript
// Clear PubSub logs
import { clearLogs } from './services/pubsub'
clearLogs()
console.log('✅ Logs cleared')
```

### **Force Credential Refresh**
```javascript
// Refresh auth credentials
import { fetchAuthSession } from 'aws-amplify/auth'
const session = await fetchAuthSession({ forceRefresh: true })
console.log('✅ Credentials refreshed')
console.log('New expiration:', new Date(session.credentials?.expiration * 1000))
```

---

## 📊 MONITORING COMMANDS

### **Watch Connection State**
```javascript
// Monitor connection changes
let lastState = null
setInterval(() => {
  const state = window.__iotContext?.connectionState
  if (state !== lastState) {
    console.log('🔄 State changed:', lastState, '→', state)
    lastState = state
  }
}, 1000)
```

### **Count Messages**
```javascript
// Count incoming messages
let messageCount = 0
const iot = window.__iotContext
await iot.subscribe('radio/#', () => {
  messageCount++
  console.log('📊 Total messages:', messageCount)
})
```

### **Measure Latency**
```javascript
// Publish and measure round-trip time
const iot = window.__iotContext
const topic = 'radio/test/latency'

// Subscribe first
await iot.subscribe(topic, (data) => {
  const latency = Date.now() - data.timestamp
  console.log('⏱️ Latency:', latency, 'ms')
})

// Then publish
await iot.publish(topic, { timestamp: Date.now() })
```

---

## 🧪 TEST SCENARIOS

### **Scenario 1: Echo Test**
```javascript
// Subscribe to echo topic
const iot = window.__iotContext
const echoTopic = 'radio/test/echo'

await iot.subscribe(echoTopic, (data) => {
  console.log('🔊 Echo received:', data)
})

// Publish to same topic
await iot.publish(echoTopic, {
  message: 'Hello IoT!',
  timestamp: Date.now()
})

// Should see echo within 1 second
```

### **Scenario 2: Stress Test**
```javascript
// Send 10 messages rapidly
const iot = window.__iotContext
for (let i = 0; i < 10; i++) {
  await iot.publish('radio/test/stress', {
    index: i,
    timestamp: Date.now()
  })
  console.log(`📤 Sent message ${i + 1}/10`)
}
```

### **Scenario 3: Reconnect Test**
```javascript
// Test auto-reconnect
import { resetPubSub, autoConnect } from './services/pubsub'

console.log('🔌 Disconnecting...')
resetPubSub()

console.log('⏳ Waiting 3 seconds...')
await new Promise(r => setTimeout(r, 3000))

console.log('🔌 Reconnecting...')
await autoConnect()

console.log('✅ Reconnect test complete')
```

---

## 📝 LOGGING HELPERS

### **Pretty Print Message**
```javascript
// Format IoT message nicely
function prettyPrint(topic, message) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📨 Topic:', topic)
  console.log('📦 Message:')
  console.log(JSON.stringify(message, null, 2))
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Usage
const iot = window.__iotContext
await iot.subscribe('radio/player/+/command', (data) => {
  prettyPrint('radio/player/+/command', data)
})
```

### **Log with Timestamp**
```javascript
// Add timestamp to logs
function logWithTime(message, ...args) {
  const time = new Date().toLocaleTimeString('nl-NL', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  })
  console.log(`[${time}]`, message, ...args)
}

// Usage
logWithTime('Test message', { foo: 'bar' })
```

---

## 🎯 QUICK TESTS

### **1-Minute Smoke Test**
```javascript
// Complete smoke test
const iot = window.__iotContext

console.log('🧪 Starting smoke test...')

// 1. Check connection
console.log('1️⃣ Connection:', iot.isConnected ? '✅' : '❌')

// 2. Test publish
try {
  await iot.publish('radio/test/smoke', { test: true })
  console.log('2️⃣ Publish: ✅')
} catch (e) {
  console.log('2️⃣ Publish: ❌', e)
}

// 3. Test subscribe
try {
  const unsub = await iot.subscribe('radio/test/smoke', () => {})
  console.log('3️⃣ Subscribe: ✅')
  unsub()
} catch (e) {
  console.log('3️⃣ Subscribe: ❌', e)
}

console.log('✅ Smoke test complete')
```

---

## 💡 TIPS

1. **Copy-paste friendly** - Alle commands zijn direct uitvoerbaar
2. **Check imports** - Sommige commands vereisen imports (zie code)
3. **Async/await** - Meeste commands zijn async, gebruik `await`
4. **Error handling** - Wrap in try/catch voor productie code
5. **Cleanup** - Vergeet niet te unsubscribe na testen

---

**Last Updated:** 3 November 2025  
**Status:** ✅ Ready to Use
