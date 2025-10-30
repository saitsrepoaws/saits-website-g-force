# 🏛️ Application Architecture - Visual Overview

## Current Architecture (Problems)

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼────────┐ ┌───▼────────┐ ┌───▼────────┐
    │   Players.tsx    │ │ Libery.tsx │ │ Other.tsx  │
    │   1984 lines 😱  │ │            │ │            │
    ├──────────────────┤ ├────────────┤ ├────────────┤
    │ Own IoT setup    │ │ Own state  │ │ Own state  │
    │ Own schedule     │ │ Own API    │ │ Own API    │
    │ Own player state │ │ Own cache  │ │ Duplicates │
    │ Duplicate logic  │ │            │ │            │
    └──────────────────┘ └────────────┘ └────────────┘
              │               │               │
         ┌────▼───────────────▼───────────────▼────┐
         │       PubSub Singleton (OK ✅)          │
         │       But each component sets up own     │
         │       subscriptions & state (BAD ❌)     │
         └──────────────────────────────────────────┘
```

**Problems:**
❌ Duplicate state management  
❌ Multiple IoT setups  
❌ No shared cache  
❌ Hard to maintain  
❌ Can't scale to multi-player  

---

## New Architecture (Solution)

```
┌─────────────────────────────────────────────────────────────────┐
│                          App.tsx                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CONTEXT PROVIDERS                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ IoTContext   │  │ AuthContext  │  │ PlayerMgr    │  │  │
│  │  │ (singleton)  │  │ (user/auth)  │  │ (multi)      │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼────────┐ ┌───▼────────┐ ┌───▼────────┐
    │   Players.tsx    │ │ Libery.tsx │ │ Other.tsx  │
    │   ~200 lines ✅  │ │            │ │            │
    ├──────────────────┤ ├────────────┤ ├────────────┤
    │ useIoT()         │ │ useIoT()   │ │ useIoT()   │
    │ useSchedule()    │ │ useTracks()│ │ useAuth()  │
    │ usePlayerState() │ │ useAuth()  │ │            │
    └──────────────────┘ └────────────┘ └────────────┘
              │               │               │
         ┌────▼───────────────▼───────────────▼────┐
         │         SHARED SERVICES LAYER            │
         │  ┌────────────┐  ┌────────────┐        │
         │  │  PubSub    │  │ Connection │        │
         │  │ Singleton  │  │  Manager   │        │
         │  └────────────┘  └────────────┘        │
         │  ┌────────────┐  ┌────────────┐        │
         │  │  Logger    │  │   Stores   │        │
         │  │  Service   │  │  (Zustand) │        │
         │  └────────────┘  └────────────┘        │
         └──────────────────────────────────────────┘
```

---

## Data Flow Examples

### **Example 1: IoT Message Flow**

```
AWS IoT Core (MQTT Broker)
      │
      │ WebSocket/MQTT
      ▼
┌─────────────────┐
│  PubSub         │ ◄──── Singleton instance
│  (pubsub.ts)    │
└─────────────────┘
      │
      │ Wrapped by
      ▼
┌─────────────────┐
│  IoTContext     │ ◄──── React Context
│  - connection   │       Provides to entire app
│  - status       │
│  - subscribe()  │
└─────────────────┘
      │
      │ Used by multiple components
      ├──────────┬──────────┬──────────┐
      ▼          ▼          ▼          ▼
  Players.tsx  Libery.tsx  Admin.tsx  Dashboard.tsx
  
  All share same connection! ✅
  No duplicate subscriptions! ✅
```

---

### **Example 2: Schedule Data Flow**

```
DynamoDB (Schedule Table)
      │
      │ GraphQL API
      ▼
┌─────────────────┐
│ scheduleStore   │ ◄──── Zustand store
│ (Singleton)     │       Single source of truth
│                 │
│ - slots[]       │
│ - activeSlot    │
│ - loadSchedule()│
└─────────────────┘
      │
      │ Auto-refresh every 60s
      │ Computed activeSlot
      │
      │ Subscribe from multiple components
      ├──────────┬──────────┬──────────┐
      ▼          ▼          ▼          ▼
  Players.tsx  Schedule.tsx Dashboard.tsx Header.tsx
  
  All get SAME schedule! ✅
  No duplicate loading! ✅
  Automatic updates! ✅
```

---

### **Example 3: Multi-Player Scenario**

```
┌─────────────────────────────────────────────────────────┐
│              PlayerManagerContext                        │
│                                                          │
│  players: Map<string, PlayerState>                      │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │ player-main-001 │  │ player-lounge   │             │
│  │ - isPlaying ✅  │  │ - isPlaying ❌  │             │
│  │ - currentTrack  │  │ - currentTrack  │             │
│  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────┘
              │                    │
      ┌───────┴────────┐   ┌──────┴───────┐
      │                │   │              │
┌─────▼──────┐  ┌──────▼───▼─┐  ┌────────▼─────┐
│ Players    │  │ Multi-Player│  │ Dashboard    │
│ Page       │  │ Control Page│  │ (overview)   │
│            │  │             │  │              │
│ Main Room  │  │ All Players │  │ Status of All│
└────────────┘  └─────────────┘  └──────────────┘

Each player isolated ✅
Cross-player sync possible ✅
Centrally managed ✅
```

---

## Component Communication

### **Before (Bad):**
```
Players.tsx
    │
    └─► Direct PubSub call
    └─► Own state
    └─► Own IoT setup
    └─► No sharing with other components ❌
```

### **After (Good):**
```
Players.tsx
    │
    └─► useIoT() hook
          │
          └─► IoTContext
                │
                └─► Shared by all components ✅
                └─► Single WebSocket ✅
                └─► Centralized state ✅
```

---

## Folder Structure (Detailed)

```
/src
  /contexts/                    ← NEW: React Contexts
    IoTContext.tsx             (IoT connection provider)
    AuthContext.tsx            (Auth state provider)
    PlayerManagerContext.tsx   (Multi-player manager)
    
  /stores/                      ← NEW: Zustand stores
    scheduleStore.ts           (Schedule data)
    tracksStore.ts             (Tracks cache)
    uiStore.ts                 (UI state: modals, etc)
    
  /hooks/
    /player/                    ← NEW: Player hooks
      usePlayerState.ts
      usePlayerControls.ts
      usePlayerIoT.ts
      usePlayerSchedule.ts
      usePlayerPersistence.ts
    /app/                       ← NEW: App-wide hooks
      useConnectionStatus.ts
      useSchedule.ts
      useTracks.ts
      
  /services/
    pubsub.ts                  ✅ Already singleton
    radioPlayerIoT.ts          ✅ Already exists
    connectionManager.ts       ← NEW: Connection mgmt
    logger.ts                  ← NEW: Central logging
    
  /components/
    /Player/                    ← NEW: Player components
      PlayerControls.tsx
      PlayerSeekBar.tsx
      PlayerVolumeControl.tsx
      IoTLogsPanel.tsx
      BackendStateCard.tsx
      
  /pages/
    /devices/
      Players.tsx              (~200 lines after refactor)
      Libery.tsx
      Schedule.tsx
```

---

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Players.tsx size** | 1984 lines | ~200 lines |
| **Code reuse** | ❌ Duplicate | ✅ Shared |
| **IoT connections** | Multiple | Single ✅ |
| **State management** | Scattered | Centralized ✅ |
| **Multi-player support** | ❌ No | ✅ Yes |
| **Testability** | Hard | Easy ✅ |
| **Performance** | Slower | Faster ✅ |
| **Maintainability** | Poor | Good ✅ |

---

## Implementation Phases

### **Phase 1: Contexts (3 days)**
- IoTContext
- AuthContext
- PlayerManagerContext

### **Phase 2: Stores (2 days)**
- scheduleStore
- tracksStore

### **Phase 3: Hooks (3 days)**
- Extract player hooks
- Extract app hooks

### **Phase 4: Refactor (2 days)**
- Refactor Players.tsx
- Update other pages
- Testing

**Total: ~10 days work**

---

## 🤔 Start Immediately?

Choose:
1. **"Start Phase 1"** - Begin with IoTContext (most impact)
2. **"Start Phase 2"** - Begin with stores (easier)
3. **"Full refactor"** - Do everything (takes time but complete)

What do you want?
