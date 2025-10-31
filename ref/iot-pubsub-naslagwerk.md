# IoT & PubSub Naslagwerk - G-Forge IoT

**Reference Guide voor AWS IoT Core en PubSub implementatie**

> **✨ UPDATE 31 Oct 2025:** Complete setup analyse toegevoegd!  
> **Score: 9.5/10** - Zie `/ref/SETUP_ANALYSE_2025.md` voor volledige vergelijking met Amplify docs.

---

## 🎯 QUICK LINKS

- **Complete Setup Review:** `SETUP_ANALYSE_2025.md` ⭐ **NEW!**
- **Amplify Gen 2 Overview:** `amplify-gen2-overview.md`
- **Backend CLI Commands:** `backend-cli-commands.md`
- **PubSub Gen 2 Setup:** `pubsub-gen2-react.md`

---

## 📚 **INHOUDSOPGAVE**

1. [Architectuur Overzicht](#architectuur-overzicht)
2. [Amplify Gen 2 Setup](#amplify-gen-2-setup)
3. [PubSub API Reference](#pubsub-api-reference)
4. [IoT Topics Structuur](#iot-topics-structuur)
5. [React Integration Patterns](#react-integration-patterns)
6. [Testing & Debugging](#testing--debugging)
7. [Best Practices](#best-practices)

---

## 🏗️ **ARCHITECTUUR OVERZICHT**

### **G-Forge IoT Stack:**
```
┌─────────────────┐
│  React Web App  │  ← Vite + React Router
└────────┬────────┘
         │
         ├─ @aws-amplify/pubsub
         ├─ aws-amplify (Auth, Storage, Data)
         │
┌────────▼────────┐
│  AWS IoT Core   │  ← MQTT over WebSocket
└────────┬────────┘
         │
         ├─ IoT Rules Engine
         ├─ IoT Topics (pub/sub)
         │
┌────────▼────────┐
│  State Machine  │  ← AWS Step Functions
└────────┬────────┘
         │
         ├─ Lambda Functions
         ├─ DynamoDB (PlayerState)
         └─ S3 (Audio files)
```

### **Componenten:**
- **Frontend:** React + Amplify PubSub
- **Backend:** IoT Core + Lambda + Step Functions
- **Storage:** S3 (audio) + DynamoDB (state)
- **Auth:** Cognito via Amplify

---

## 🚀 **AMPLIFY GEN 2 SETUP**

### **1. Backend Definitie (amplify/backend.ts):**

```typescript
import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'

const backend = defineBackend({
  auth,
  data
})

// IoT Policy voor authenticated users
const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole
authenticatedUserIamRole.addToPrincipalPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'iot:Connect',
      'iot:Subscribe', 
      'iot:Receive',
      'iot:Publish'
    ],
    resources: [
      `arn:aws:iot:${Stack.of(backend.auth).region}:${Stack.of(backend.auth).account}:topic/*`,
      `arn:aws:iot:${Stack.of(backend.auth).region}:${Stack.of(backend.auth).account}:topicfilter/*`,
      `arn:aws:iot:${Stack.of(backend.auth).region}:${Stack.of(backend.auth).account}:client/*`
    ]
  })
)
```

### **2. PubSub Configuratie (Frontend):**

```typescript
import { Amplify } from 'aws-amplify'
import { PubSub } from '@aws-amplify/pubsub'
import outputs from './amplify_outputs.json'

// Configure Amplify
Amplify.configure(outputs)

// Add PubSub provider
PubSub.addPluggable(
  new AWSIoTProvider({
    aws_pubsub_region: outputs.custom?.AWS_REGION,
    aws_pubsub_endpoint: `wss://your-iot-endpoint.iot.region.amazonaws.com/mqtt`
  })
)
```

---

## 📡 **PUBSUB API REFERENCE**

### **Subscribe (Ontvangen):**

```typescript
import { PubSub } from '@aws-amplify/pubsub'

// Subscribe to topic
const subscription = PubSub.subscribe({
  topics: 'radio/players/player-001/commands'
}).subscribe({
  next: (data) => {
    console.log('Message received:', data.value)
    const message = JSON.parse(data.value)
    handleCommand(message)
  },
  error: (error) => {
    console.error('Subscription error:', error)
  }
})

// Cleanup
subscription.unsubscribe()
```

### **Publish (Verzenden):**

```typescript
import { PubSub } from '@aws-amplify/pubsub'

// Publish to topic
await PubSub.publish({
  topics: 'radio/players/player-001/state',
  message: {
    status: 'playing',
    trackId: 'track-123',
    position: 45.2
  }
})
```

### **Multi-Topic Subscribe:**

```typescript
const subscription = PubSub.subscribe({
  topics: [
    'radio/players/+/commands',  // Wildcard
    'radio/broadcast/all'
  ]
}).subscribe({
  next: (data) => {
    console.log(`Message on ${data.topic}:`, data.value)
  }
})
```

---

## 🎯 **IOT TOPICS STRUCTUUR**

### **G-Forge IoT Topics:**

```
radio/
├── players/
│   ├── {playerId}/
│   │   ├── commands      (SUB) Player ontvangt commands
│   │   ├── state         (PUB) Player publiceert state
│   │   ├── track-info    (PUB) Current track info
│   │   └── logs          (PUB) Debug logs
│   │
│   └── +/                (Wildcard subscriptions)
│       ├── commands
│       └── state
│
├── broadcast/
│   ├── all               (SUB) Broadcast naar alle players
│   ├── schedule-update   (SUB) Schedule wijzigingen
│   └── emergency-stop    (SUB) Emergency commands
│
└── system/
    ├── health            (PUB) System health checks
    └── telemetry         (PUB) Performance metrics
```

### **Command Formats:**

```typescript
// PLAY Command
{
  command: 'PLAY',
  timestamp: '2025-10-31T00:00:00Z',
  playerId: 'player-001'
}

// LOAD Command
{
  command: 'LOAD',
  trackId: 'track-123',
  playlistId: 'playlist-456',
  timestamp: '2025-10-31T00:00:00Z'
}

// State Update
{
  status: 'playing',
  trackId: 'track-123',
  position: 45.2,
  duration: 180.0,
  volume: 0.8,
  timestamp: '2025-10-31T00:00:00Z'
}
```

---

## ⚛️ **REACT INTEGRATION PATTERNS**

### **1. IoT Context (Recommended):**

```typescript
// contexts/IoTContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { PubSub } from '@aws-amplify/pubsub'

interface IoTContextValue {
  connected: boolean
  publish: (topic: string, message: any) => Promise<void>
  subscribe: (topic: string, handler: (msg: any) => void) => () => void
}

const IoTContext = createContext<IoTContextValue | null>(null)

export function IoTProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)

  const publish = async (topic: string, message: any) => {
    await PubSub.publish({ topics: topic, message })
  }

  const subscribe = (topic: string, handler: (msg: any) => void) => {
    const subscription = PubSub.subscribe({ topics: topic }).subscribe({
      next: (data) => handler(JSON.parse(data.value))
    })
    return () => subscription.unsubscribe()
  }

  return (
    <IoTContext.Provider value={{ connected, publish, subscribe }}>
      {children}
    </IoTContext.Provider>
  )
}

export const useIoT = () => {
  const context = useContext(IoTContext)
  if (!context) throw new Error('useIoT must be used within IoTProvider')
  return context
}
```

### **2. Component Usage:**

```typescript
// In component
import { useIoT } from '../contexts/IoTContext'

function PlayerControls() {
  const { publish, subscribe } = useIoT()

  useEffect(() => {
    // Subscribe to commands
    const unsubscribe = subscribe(
      'radio/players/player-001/commands',
      (message) => {
        if (message.command === 'PLAY') handlePlay()
      }
    )
    return unsubscribe
  }, [subscribe])

  const handlePlay = async () => {
    // Publish state
    await publish('radio/players/player-001/state', {
      status: 'playing',
      timestamp: new Date().toISOString()
    })
  }

  return <button onClick={handlePlay}>Play</button>
}
```

---

## 🧪 **TESTING & DEBUGGING**

### **AWS IoT Core Test Client:**

1. Open AWS Console → IoT Core
2. Navigate to **Test** → **MQTT test client**
3. **Subscribe to topic:**
   ```
   radio/players/+/state
   ```
4. **Publish test message:**
   ```json
   {
     "command": "PLAY",
     "timestamp": "2025-10-31T00:00:00Z"
   }
   ```

### **Browser Console Debugging:**

```typescript
// Enable PubSub logging
import { Logger } from 'aws-amplify/utils'

const logger = new Logger('PubSub')
logger.enable()

// Test publish
await PubSub.publish({
  topics: 'test/topic',
  message: { test: 'hello' }
})
```

### **React DevTools:**

Check IoT Context state:
- Components tab → IoTProvider
- View `connected`, `subscriptions`, `publishQueue`

---

## ✅ **BEST PRACTICES**

### **1. Topic Naming:**
- ✅ Use hierarchical structure: `domain/entity/id/action`
- ✅ Use wildcards wisely: `radio/players/+/state`
- ❌ Avoid deep nesting: `a/b/c/d/e/f/g`

### **2. Message Size:**
- ✅ Keep messages < 128KB
- ✅ Use references for large data (S3 URLs)
- ❌ Don't send binary data directly

### **3. Connection Management:**
- ✅ Reuse single PubSub connection
- ✅ Implement reconnection logic
- ✅ Cleanup subscriptions on unmount
- ❌ Don't create new connection per component

### **4. Error Handling:**
```typescript
const subscription = PubSub.subscribe({ topics: 'my/topic' }).subscribe({
  next: (data) => { /* handle */ },
  error: (error) => {
    console.error('PubSub error:', error)
    // Implement retry logic
    setTimeout(() => resubscribe(), 5000)
  }
})
```

### **5. Security:**
- ✅ Use IAM policies per user role
- ✅ Validate messages on both ends
- ✅ Use HTTPS/WSS only
- ❌ Never put credentials in messages

---

## 🔗 **REFERENTIES**

### **Documentatie:**
- [Amplify Gen 2 Docs](https://docs.amplify.aws/)
- [PubSub API Reference](https://docs.amplify.aws/react/build-a-backend/add-aws-services/pubsub/)
- [AWS IoT Core](https://docs.aws.amazon.com/iot/)

### **Project Files:**
- `/ref/pubsub-gen2-react.md` - Gen 2 PubSub setup
- `/ref/pubsub-js.md` - Amplify JS v6 PubSub APIs
- `/ref/iot-policy-examples.md` - IoT policy templates
- `/docs/IOT_TOPICS_SPECIFICATION.md` - Complete topic spec

### **Implementation Examples:**
- ~~`/apps/web/src/pages/IotTest.tsx`~~ (REMOVED - was test page)
- `/apps/web/src/contexts/IoTContext.tsx` - Production IoT context
- `/apps/web/src/services/radioPlayerIoT.ts` - Player IoT service
- `/amplify/backend.ts` - Backend IoT configuration

---

## 📝 **CHANGELOG**

### **2025-10-31:**
- ✅ Removed `/iot-test` route en pages
- ✅ Created comprehensive IoT/PubSub reference guide
- ✅ Documented production patterns and best practices

---

**Voor meer details, zie:**
- Architecture docs: `/docs/ARCHITECTURE_*.md`
- IoT flow: `/docs/IOT_COMMAND_FLOW.md`
- State machine: `/docs/STATE_MACHINE_ARCHITECTURE.md`
