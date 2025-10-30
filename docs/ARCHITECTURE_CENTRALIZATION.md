# 🏛️ Application Architecture - Centralization Plan

## 📊 Current Situation

**Problems:**
- Socket connection managed per component
- Player state scattered across components
- Auth state checked multiple times
- Schedule data loaded multiple times
- No single source of truth

---

## 🎯 Centralization Strategy

### **1. SINGLETON SERVICES** (Already Implemented ✅)

#### ✅ PubSub Service (IoT WebSocket)
**Location:** `/services/pubsub.ts`

**Status:** ✅ Already singleton!
```typescript
// Single instance for entire app
let pubsubInstance: PubSub | null = null

export async function getPubSubInstance(): Promise<PubSub> {
  if (!pubsubInstance) {
    pubsubInstance = new PubSub({ ... })
  }
  return pubsubInstance
}
```

**Used by:**
- RadioPlayerIoT service
- Any component that needs IoT messaging

---

### **2. REACT CONTEXTS** (To Implement)

#### 🔲 IoTContext - Central IoT Connection Management
**Location:** `/contexts/IoTContext.tsx`

**Purpose:**
- Single IoT connection for entire app
- Connection status monitoring
- Automatic reconnection handling
- Credentials refresh management

**Interface:**
```typescript
interface IoTContextValue {
  isConnected: boolean
  connectionState: ConnectionState
  lastPingTime: number | null
  logs: LogEntry[]
  
  // Methods
  publish: (topic: string, message: any) => Promise<void>
  subscribe: (topic: string, handler: (msg: any) => void) => () => void
  clearLogs: () => void
}

export const IoTProvider: React.FC<{ children: ReactNode }>
export const useIoT: () => IoTContextValue
```

**Usage:**
```typescript
// In App.tsx
<IoTProvider>
  <RouterProvider />
</IoTProvider>

// In any component
const { isConnected, publish, subscribe } = useIoT()
```

---

#### 🔲 AuthContext - Authentication State
**Location:** `/contexts/AuthContext.tsx`

**Purpose:**
- User authentication state
- Cognito session management
- Auto token refresh
- User profile data

**Interface:**
```typescript
interface AuthContextValue {
  user: CognitoUser | null
  isAuthenticated: boolean
  isLoading: boolean
  identityId: string | null
  
  // Methods
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}
```

---

#### 🔲 PlayerManagerContext - Multi-Player Management
**Location:** `/contexts/PlayerManagerContext.tsx`

**Purpose:**
- Manage multiple players (player-main-001, player-lounge-002, etc.)
- Central player registry
- Cross-player communication
- Shared player state

**Interface:**
```typescript
interface PlayerManagerContextValue {
  players: Map<string, PlayerState>
  activePlayerId: string | null
  
  // Methods
  registerPlayer: (playerId: string) => void
  unregisterPlayer: (playerId: string) => void
  setActivePlayer: (playerId: string) => void
  getPlayerState: (playerId: string) => PlayerState | null
  publishPlayerEvent: (playerId: string, event: PlayerEvent) => void
}
```

---

### **3. GLOBAL STATE STORES** (To Implement)

#### 🔲 Schedule Store - Central Schedule Management
**Location:** `/stores/scheduleStore.ts`

**Technology:** Zustand (lightweight Redux alternative)

**Purpose:**
- Single source of truth for schedule data
- Automatic background refresh
- Computed current slot
- Track preloading

**Interface:**
```typescript
interface ScheduleStore {
  slots: ScheduleSlot[]
  activeSlot: ScheduleSlot | null
  currentTrackInfo: CurrentTrackInfo | null
  isLoading: boolean
  lastUpdated: number | null
  
  // Actions
  loadSchedule: () => Promise<void>
  refreshSchedule: () => Promise<void>
  subscribeToSlotChanges: (callback: (slot: ScheduleSlot) => void) => () => void
}

export const useScheduleStore = create<ScheduleStore>(...)
```

**Usage:**
```typescript
// In any component
const { activeSlot, loadSchedule } = useScheduleStore()
```

---

#### 🔲 Tracks Cache Store
**Location:** `/stores/tracksStore.ts`

**Purpose:**
- Central tracks cache
- Reduce duplicate API calls
- Preload cover art & waveforms
- Track metadata caching

**Interface:**
```typescript
interface TracksStore {
  tracks: Map<string, Track>
  playlists: Map<string, Playlist>
  coverArtUrls: Map<string, string>
  waveformUrls: Map<string, string>
  
  // Actions
  loadTrack: (id: string) => Promise<Track>
  loadPlaylist: (id: string) => Promise<Playlist>
  preloadCoverArt: (trackId: string) => Promise<string>
  clearCache: () => void
}
```

---

### **4. SERVICE LAYER** (To Centralize)

#### 🔲 ConnectionManager Service
**Location:** `/services/connectionManager.ts`

**Purpose:**
- Manage ALL network connections
- Monitor connection health
- Automatic reconnection
- Offline mode handling

**Interface:**
```typescript
class ConnectionManager {
  private iotConnection: PubSub | null
  private apiConnection: GraphQLClient | null
  
  isOnline: boolean
  
  initialize(): Promise<void>
  reconnectAll(): Promise<void>
  disconnect(): void
  
  onConnectionChange(callback: (online: boolean) => void): () => void
}

export const connectionManager = new ConnectionManager()
```

---

#### 🔲 Logger Service
**Location:** `/services/logger.ts`

**Purpose:**
- Central logging for entire app
- Log levels (debug, info, warn, error)
- Persistent log storage
- Log export functionality

**Interface:**
```typescript
class Logger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, error?: Error): void
  
  getLogs(filter?: LogFilter): LogEntry[]
  clearLogs(): void
  exportLogs(): Blob
}

export const logger = new Logger()
```

---

## 📁 New Folder Structure

```
/src
  /contexts/
    IoTContext.tsx          ← Central IoT connection
    AuthContext.tsx         ← Authentication state
    PlayerManagerContext.tsx ← Multi-player management
  
  /stores/
    scheduleStore.ts        ← Schedule data (Zustand)
    tracksStore.ts          ← Tracks cache (Zustand)
    uiStore.ts              ← UI state (modals, etc.)
  
  /services/
    pubsub.ts              ✅ Already singleton
    connectionManager.ts    ← NEW: Connection management
    logger.ts              ← NEW: Central logging
    radioPlayerIoT.ts      ✅ Already exists
    
  /hooks/
    /player/               ← Player-specific hooks
      usePlayerState.ts
      usePlayerControls.ts
      usePlayerIoT.ts
      ...
    /app/                  ← App-wide hooks
      useConnectionStatus.ts
      useSchedule.ts
      useTracks.ts
```

---

## 🚀 Implementation Order

### **PHASE 1: Contexts** (Week 1)
1. Create `IoTContext` - wrap PubSub singleton
2. Create `AuthContext` - centralize auth state
3. Update `App.tsx` with providers

### **PHASE 2: Stores** (Week 2)
4. Install Zustand: `npm install zustand`
5. Create `scheduleStore` - move schedule logic
6. Create `tracksStore` - centralize track caching

### **PHASE 3: Services** (Week 3)
7. Create `ConnectionManager` - wrap all connections
8. Create `Logger` service - centralize logging
9. Create `PlayerManagerContext` - multi-player support

### **PHASE 4: Refactor Players.tsx** (Week 4)
10. Use new contexts in Players.tsx
11. Replace local state with stores
12. Extract hooks as planned

---

## 📊 Expected Results

### **Before:**
```
Players.tsx: 1984 lines
- Own IoT setup
- Own schedule loading
- Own state management
- Duplicate logic across pages
```

### **After:**
```
Players.tsx: ~200 lines
- Uses IoTContext ✅
- Uses scheduleStore ✅
- Uses usePlayerState hook ✅
- Reusable across app ✅

Other pages can now easily:
- Show connection status
- Display schedule info
- Access track cache
- Use player controls
```

---

## 🎯 Benefits

✅ **Single Source of Truth** - No duplicate state  
✅ **Better Performance** - Shared caching  
✅ **Easier Testing** - Centralized logic  
✅ **Code Reuse** - Hooks & contexts everywhere  
✅ **Scalability** - Easy to add new players  
✅ **Maintainability** - Clear separation of concerns  

---

## 🤔 Next Steps?

**Option 1:** Start with IoTContext (most impactful)  
**Option 2:** Start with scheduleStore (easier)  
**Option 3:** Do full architecture refactor (1-2 days work)

What do you prefer?
