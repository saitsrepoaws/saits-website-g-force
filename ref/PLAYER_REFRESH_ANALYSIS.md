# 🔍 PLAYER REFRESH PROBLEEM - ROOT CAUSE

## SYMPTOOM
Player pagina refresht/remount steeds

## ROOT CAUSE GEVONDEN

### 1. **IoT Connection Loop** (PRIMAIR PROBLEEM)

**In Playwright logs:**
```javascript
[log] [PubSub INFO] Connection state: Connecting
[log] 🔌 IoT Connecting...
[log] [PubSub INFO] 🔄 Brief disconnect (credential refresh...) - auto-reconnecting...
[log] [PubSub INFO] Connection state: Connecting
[log] 🔌 IoT Connecting...
[log] [PubSub INFO] 🔄 Brief disconnect... // REPEATS!
```

**Waarom dit gebeurt:**
```
1. IoT Policy attach FAALT (AccessDeniedException)
   ↓
2. PubSub probeert te connecten maar faalt
   ↓
3. Hub event: ConnectionDisrupted
   ↓
4. Auto-reconnect logic triggert
   ↓
5. Probeert opnieuw → faalt weer (nog steeds geen policy!)
   ↓
6. Loop: Connecting → Disrupted → Connecting → Disrupted
```

### 2. **isConnected State Flip-Flop**

**IoTContext.tsx (regel 107-163):**
```typescript
useEffect(() => {
  const checkInterval = setInterval(() => {
    const recentLogs = pubsub.getLogs().slice(0, 10)
    
    // Als "connecting" log in recent logs → setConnectionState(Connecting)
    // Als "disconnected" log in recent logs → setIsConnected(false)
    // Als "connected" log in recent logs → setIsConnected(true)
    
    // PROBLEEM: Logs bevatten BEIDE "connecting" EN "disconnected"
    // State flipped elke seconde: true → false → true → false
  }, 1000) // Elke seconde!
}, [isConnected])
```

### 3. **Players Component Remount**

**Players.tsx (regel 84-158):**
```typescript
useEffect(() => {
  if (!iot.isConnected) {
    return // Skip subscriptions
  }
  
  console.log('🎵 Player starting - setting up IoT subscriptions...')
  // Setup subscriptions...
  
  return () => {
    console.log('🧹 Player unmounting - cleaning up subscriptions')
    // Cleanup
  }
}, [iot.isConnected, playerId]) // ← DEPENDENCY op isConnected!
```

**Wat gebeurt er:**
```
iot.isConnected = true  → Setup subscriptions
  ↓ (1 seconde later)
iot.isConnected = false → Cleanup (unmount logs)
  ↓ (1 seconde later)
iot.isConnected = true  → Setup opnieuw
  ↓
REPEAT!
```

## CASCADE EFFECT

```
IoT Policy attach fails
  ↓
PubSub connecting/disconnecting loop
  ↓
Hub events: ConnectionDisrupted (elke paar seconden)
  ↓
IoTContext checkInterval (elke seconde) ziet "disconnected" logs
  ↓
setIsConnected(false)
  ↓
Players useEffect cleanup triggered
  ↓
Console: "🧹 Player unmounting - cleaning up subscriptions"
  ↓
(Next second: connecting log appears)
  ↓
setIsConnected(true)
  ↓
Players useEffect setup triggered
  ↓
Console: "🎵 Player starting - setting up IoT subscriptions..."
  ↓
LOOP REPEATS!
```

## WAAROM DIT NU GEBEURT

**Je ziet dit NU omdat:**
1. ✅ autoConnect={true} is actief (onze fix)
2. ✅ IoTProvider initializes correct
3. ❌ Unauthenticated role heeft GEEN IoT permissions (nog niet deployed)
4. ❌ iot:AttachPolicy fails
5. ❌ PubSub stuck in connecting/disconnecting loop
6. ❌ Players component mount/unmount loop

**VOORHEEN zag je dit NIET omdat:**
- autoConnect={false} was actief
- IoT connection werd nooit getriggered
- Geen connection = geen loops
- Maar ook geen berichten ontvangen!

## OPLOSSING

### ✅ **Primaire Fix (al gecommit, moet deployen):**
```typescript
// amplify/backend.ts
// Add IoT permissions to unauthenticated role
unauthenticatedRole.attachInlinePolicy(...)
```

**Deploy:**
```bash
npx ampx sandbox
```

**Dit zal:**
- ✅ IoT Policy attach SUCCEEDS
- ✅ PubSub connection SUCCEEDS
- ✅ Hub event: Connected (STABLE)
- ✅ isConnected blijft true
- ✅ Players component mount EENMALIG
- ✅ Geen refresh loop meer!

### 🔧 **Secundaire Fix (defensief programmeren):**

**Probleem:** `isConnected` dependency te gevoelig voor state changes

**Oplossing:** Debounce connection state changes

**File:** `apps/web/src/contexts/IoTContext.tsx`

```typescript
// Monitor connection state via logs
useEffect(() => {
  let connectionChangeTimeout: NodeJS.Timeout | null = null
  
  const checkInterval = setInterval(() => {
    const currentLogs = pubsub.getLogs()
    setLogs(currentLogs)
    
    const recentLogs = currentLogs.slice(0, 10)
    const hasConnectedLog = recentLogs.some(log => ...)
    const hasDisconnectedLog = recentLogs.some(log => ...)
    
    // DEBOUNCE: Only change state after 3 seconds of consistent logs
    if (hasConnectedLog && !hasDisconnectedLog) {
      if (!isConnected && !connectionChangeTimeout) {
        connectionChangeTimeout = setTimeout(() => {
          setIsConnected(true)
          setConnectionState(ConnectionState.Connected)
          connectionStartTime.current = Date.now()
          console.log('✅ IoTContext: Detected stable connection')
          connectionChangeTimeout = null
        }, 3000) // Wait 3 seconds before confirming
      }
    } else if (hasDisconnectedLog) {
      // Clear pending connection timeout
      if (connectionChangeTimeout) {
        clearTimeout(connectionChangeTimeout)
        connectionChangeTimeout = null
      }
      
      if (isConnected) {
        // Only disconnect after 5 seconds of disruption logs
        setTimeout(() => {
          const stillDisconnected = pubsub.getLogs().slice(0, 10)
            .some(log => log.message.toLowerCase().includes('disconnected'))
          
          if (stillDisconnected) {
            setIsConnected(false)
            setConnectionState(ConnectionState.ConnectionDisrupted)
            console.log('⚠️ IoTContext: Confirmed disconnection')
          }
        }, 5000)
      }
    }
  }, 1000)
  
  return () => {
    clearInterval(checkInterval)
    if (connectionChangeTimeout) {
      clearTimeout(connectionChangeTimeout)
    }
  }
}, [isConnected])
```

### 🛡️ **Tertiaire Fix (prevent rapid remount):**

**File:** `apps/web/src/pages/devices/Players.tsx`

```typescript
useEffect(() => {
  // Add delay before skipping subscriptions to prevent rapid mount/unmount
  if (!iot.isConnected) {
    console.log('⏳ IoT not connected yet, waiting...')
    return
  }

  // Add small delay to ensure stable connection
  const setupTimer = setTimeout(() => {
    console.log('🎵 Player starting - setting up IoT subscriptions...')
    setupSubscriptions()
  }, 1000) // Wait 1 second after connection detected

  return () => {
    clearTimeout(setupTimer)
    console.log('🧹 Player unmounting - cleaning up subscriptions')
    if (unsubCommands) {
      unsubCommands()
    }
  }
}, [iot.isConnected, playerId])
```

## PRIORITEIT

### 🔥 **URGENT (Deploy nu):**
```bash
npx ampx sandbox
```
Dit deployed de unauthenticated role permissions fix.

Na deploy:
- ✅ IoT connection succeeds
- ✅ Refresh loop stopt
- ✅ Messages komen binnen

### 🔧 **NICE-TO-HAVE (later implementeren):**
- Debounce connection state changes (defensief)
- Add delay in Players subscription setup (defensief)
- Better error recovery logic

## VERIFICATION

Na `npx ampx sandbox` deploy, check console:

**VOOR (NU - met loop):**
```javascript
🎵 Player starting - setting up IoT subscriptions...
🧹 Player unmounting - cleaning up subscriptions
🎵 Player starting - setting up IoT subscriptions...
🧹 Player unmounting - cleaning up subscriptions
// REPEATS!
```

**NA (na deploy - geen loop):**
```javascript
🔌 IoTProvider: Initializing connection...
✅ IoT Policy attached successfully
💚 IoT CONNECTED - Ready to Send/Receive
🎵 Player starting - setting up IoT subscriptions...
✅ Subscribed to: radio/player/player-001/command
// STABLE!
```

## SAMENVATTING

**Waarom refresht de player steeds?**
- IoT Policy attach fails (unauthenticated role geen permissions)
- PubSub connecting/disconnecting loop
- isConnected flip-flops elke seconde
- Players component mount/unmount loop
- Console toont: "Player unmounting" → "Player starting" → repeat

**Oplossing:**
1. Deploy unauthenticated role permissions (`npx ampx sandbox`)
2. (Optioneel) Debounce connection state changes
3. (Optioneel) Add setup delay in Players component

**Status:**
- ✅ Root cause identified
- ✅ Primary fix committed
- ⏳ Waiting for deploy
- 🎯 Secondary/tertiary fixes optional
