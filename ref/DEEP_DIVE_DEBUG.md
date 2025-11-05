# DEEP DIVE DEBUG - IOT MESSAGE NIET ONTVANGEN

## PROBLEEM
Frontend ontvangt GEEN IoT berichten op `radio/player/player-001/command`

## VERIFICATIE STAPPEN

### 1. CODE VERIFICATIE ✅
- [x] `autoConnect={true}` in main.tsx (line 138)
- [x] PubSub feature flag removed
- [x] Subscribe code correct in Players.tsx
- [x] Topic correct: `radio/player/${playerId}/command`
- [x] data.value parsing implemented
- [x] handleIncomingCommand function exists

### 2. BACKEND VERIFICATIE ✅
- [x] State Machine executes: SUCCEEDED
- [x] Track data returned: "Dream - Tony Baltimore"
- [x] Published to: radio/player/player-001/command
- [x] Payload correct met track data

### 3. FRONTEND FLOW
```
main.tsx
  └─ <IoTProvider autoConnect={true}>
       │
       ├─ useEffect (autoConnect)
       │    └─ attachIoTPolicyToCurrentUser()
       │    └─ pubsub.autoConnect()
       │         └─ getPubSubInstance()
       │         └─ keepalive subscribe
       │
       └─ Provides: iot.subscribe()
            │
            └─ Players.tsx
                 └─ useEffect (iot.isConnected)
                      └─ iot.subscribe(commandsTopic, onMessage)
                           └─ pubsub.subscribe()
                                └─ PubSub.subscribe()
```

### 4. CRITICAL CHECKS

#### A. Is PubSub Initialized?
```javascript
// Check in browser console:
console.log('PubSub logs:', window.pubsubLogs)
```

#### B. Is autoConnect Running?
```javascript
// Should see in console on page load:
// 🔌 IoTProvider: Initializing connection...
// 🔗 Attaching IoT Policy to identity...
// [PubSub INFO] Auto-connecting to AWS IoT...
```

#### C. Is Subscription Active?
```javascript
// Should see in console:
// 🎵 Player starting - setting up IoT subscriptions...
// [PubSub INFO] Subscribing to topic: radio/player/player-001/command
// ✅ Subscribed to: radio/player/player-001/command
```

### 5. MOGELIJKE OORZAKEN

#### Oorzaak A: Browser Cache
- Browser heeft oude JavaScript code
- autoConnect={false} nog steeds actief
- Fix: Empty cache and hard reload

#### Oorzaak B: PubSub Singleton Niet Initialized
- autoConnect wordt niet getriggered
- getPubSubInstance() faalt
- Fix: Check Amplify configuration

#### Oorzaak C: Subscription Fails Silently
- subscribe() returned maar geen error
- WebSocket niet open
- Fix: Check AWS IoT Policy

#### Oorzaak D: iot.isConnected is false
- Players.tsx useEffect skips subscription
- Connection state detection faalt
- Fix: Check connection state logic

### 6. DEBUG PLAN

#### STAP 1: Trace PubSub Initialization
Add logs to pubsub.ts autoConnect()

#### STAP 2: Trace Subscribe Call
Add logs to IoTContext subscribe()

#### STAP 3: Trace Message Receive
Add logs to PubSub.subscribe callback

#### STAP 4: Check Amplify Hub Events
Monitor ConnectionStateChange events

#### STAP 5: Direct Test
Use AWS SDK directly to bypass all layers
