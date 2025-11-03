# 🔍 DEBUGGING CHECKLIST - WAAROM GEEN BERICHTEN?

## ✅ CODE STATUS (CORRECT)
- [x] autoConnect={true} in main.tsx
- [x] PubSub feature flag removed
- [x] data.value parsing implemented
- [x] Topics correct (singular 'player')
- [x] State Machine JSONPath fixed

## ❓ BROWSER STATUS (CHECK DIT)

### STAP 1: Open Browser Console
```
F12 of Cmd+Option+I
```

### STAP 2: Refresh (HARD!)
```
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows)
```

### STAP 3: Check Console Output
**METEEN NA PAGE LOAD moet je dit zien:**

```javascript
// ✅ DIT MOET ER STAAN:
[PubSub INFO] Auto-connecting to AWS IoT...
[PubSub INFO] Creating PubSub instance...
[PubSub INFO] Attaching Hub listener...
[PubSub INFO] Triggering connection with keepalive subscribe...
[PubSub INFO] Subscribing to topic: radio/system/keepalive
[PubSub INFO] Subscribed successfully to radio/system/keepalive

// En dan (na paar seconden):
💚 IoT CONNECTED - Ready to Send/Receive
✅ IoTProvider: Connection initialized: true
```

**ZIE JE DIT?**
- **JA** → Ga naar STAP 4
- **NEE** → Browser heeft oude code! Zie FIX A

---

### STAP 4: Check Player Subscription
**Scroll in console, moet je zien:**

```javascript
🎵 Player starting - setting up IoT subscriptions...
[PubSub INFO] Subscribing to topic: radio/player/player-001/command
[PubSub INFO] Subscribed successfully to radio/player/player-001/command
✅ Subscribed to: radio/player/player-001/command
```

**ZIE JE DIT?**
- **JA** → Ga naar STAP 5
- **NEE** → Players component niet geladen! Zie FIX B

---

### STAP 5: Test Incoming Message
**Ik stuur nu een test bericht...**

```javascript
// In console moet je zien:
[PubSub INFO] Message received on radio/player/player-001/command
📥 INCOMING raw data: {value: '...', provider: 'AWSIoTProvider'}
📥 PARSED command: {command: "LOAD", params: {...}}
💿 LOAD COMMAND RECEIVED FROM BACKEND
✅ Track from backend: ...
✅ Player state updated with track
```

**ZIE JE DIT?**
- **JA** → 🎉 HET WERKT!
- **NEE** → Subscription niet actief! Zie FIX C

---

## 🔧 FIXES

### FIX A: Browser heeft oude code
```bash
# Optie 1: Clear browser cache
1. Open DevTools (F12)
2. Right-click op refresh button
3. Select "Empty Cache and Hard Reload"

# Optie 2: Disable cache in DevTools
1. Open DevTools (F12)
2. Network tab
3. Check "Disable cache"
4. Keep DevTools open
5. Refresh

# Optie 3: Kill dev server en herstart
pkill -f 'vite'
cd apps/web
pnpm dev
# Wait for: Local: http://localhost:5173/
# Then hard refresh browser
```

### FIX B: Players component niet geladen
```bash
# Check je op /devices/players pagina?
# URL moet zijn: http://localhost:5173/devices/players

# Als je op andere pagina bent:
# Navigate naar: http://localhost:5173/devices/players
```

### FIX C: Subscription werkt niet
```bash
# Check IoT Policy
aws iot get-policy \
  --policy-name RadioPlayerCognitoPolicy \
  --region eu-west-1 \
  --query 'policyDocument' \
  --output text | jq .

# Moet bevatten:
# - iot:Subscribe on radio/player/*
# - iot:Receive on radio/player/*
```

---

## 📊 SUPER SIMPLE TEST

**Kopieer dit in browser console:**

```javascript
// Test 1: Check if PubSub loaded
console.log('PubSub module:', window.aws_amplify_pubsub ? '✅ Loaded' : '❌ Not loaded')

// Test 2: Check IoT Provider settings
console.log('IoT Provider autoConnect:', 
  // Check if we see auto-connect logs
  performance.getEntriesByType('navigation').length > 0 ? 'Check logs above ↑' : 'Unknown'
)

// Test 3: Manual subscribe test
import { PubSub } from 'aws-amplify/pubsub';
PubSub.subscribe({ topics: 'radio/player/player-001/command' }).subscribe({
  next: data => console.log('📥 MANUAL TEST RECEIVED:', data),
  error: err => console.error('❌ MANUAL TEST ERROR:', err)
});
console.log('✅ Manual subscription created - send test message now!')
```

---

## 🎯 QUICK DIAGNOSTIC

**In browser console, run:**
```javascript
console.log('=== DIAGNOSTIC ===')
console.log('URL:', window.location.href)
console.log('Vite HMR:', import.meta?.hot ? 'Active' : 'Not active')
```

**Expected:**
```
URL: http://localhost:5173/devices/players
Vite HMR: Active
```

---

## 📝 VERTEL ME:

1. **Zie je in console:** `[PubSub INFO] Auto-connecting to AWS IoT...`
   - JA of NEE?

2. **Zie je in console:** `✅ Subscribed to: radio/player/player-001/command`
   - JA of NEE?

3. **Welke URL staat in browser?**
   - http://localhost:5173/devices/players
   - Of iets anders?

4. **DevTools open en cache disabled?**
   - JA of NEE?
