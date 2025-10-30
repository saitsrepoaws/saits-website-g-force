# Players.tsx Refactoring Strategy

## Current State
- **1984 lines** 😱
- Own IoT setup & subscriptions
- Mixed concerns: UI, logic, IoT, state

## Refactoring Plan

### Phase 1: Use IoTContext (CURRENT)
Replace local IoT setup with central IoTContext

**Changes:**
1. Remove: `iotServiceRef.current = createRadioPlayerIoT(playerId)`
2. Remove: Local IoT subscription setup
3. Add: `const { publish, subscribe } = useIoT()`
4. Update: Use context methods instead of iotServiceRef

**Impact:**
- Remove ~100 lines of IoT setup code
- Use shared connection
- Cleaner, more maintainable

### Phase 2: Extract State Management
Create custom hooks for state

**Hooks to create:**
- `usePlayerState()` - Core player state
- `usePlayerAudio()` - Audio element management
- `usePlayerControls()` - Play/Pause/Stop logic

### Phase 3: Extract Scheduling
Move schedule logic to dedicated hook

**Hook:**
- `usePlayerSchedule(playerId)` - Schedule slots & track info

### Phase 4: Extract UI Components
Split large JSX into smaller components

**Components:**
- `PlayerControls` - Control buttons
- `PlayerSeekBar` - Seek bar
- `PlayerScheduleCard` - Schedule info display

---

## Step-by-Step: Phase 1 Implementation

### 1. Remove Old IoT Setup

**Remove these lines:**
```typescript
// OLD - Remove this
const iotServiceRef = useRef<ReturnType<typeof createRadioPlayerIoT> | null>(null)

// OLD - Remove this entire useEffect
useEffect(() => {
  if (!iotServiceRef.current) {
    iotServiceRef.current = createRadioPlayerIoT(playerId)
  }
  // ... subscription setup ...
}, [playerId])
```

### 2. Add useIoT Hook

**Add at top:**
```typescript
import { useIoT } from '../../contexts/IoTContext'

function Players() {
  const { publish, subscribe, isConnected } = useIoT()
  // ...
}
```

### 3. Update Station Broadcast Subscription

**OLD:**
```typescript
const subscription = await subscribe(
  { topic: 'radio/station/current-track' },
  async (message: any) => {
    // handler
  }
)
```

**NEW:**
```typescript
const unsubscribe = await subscribe(
  'radio/station/current-track',
  async (message: any) => {
    // handler
  }
)
```

### 4. Update State Publishing

**OLD:**
```typescript
await iotServiceRef.current?.publishState(PlayerState.PLAYING, { ... })
await iotServiceRef.current?.publishTrackInfo({ ... })
```

**NEW:**
```typescript
// Publish directly to topics
await publish('radio/player/player-main-001/state', {
  state: 'PLAYING',
  ...
})
await publish('radio/player/player-main-001/track-info', { ... })
```

---

## Benefits After Refactor

| Aspect | Before | After |
|--------|--------|-------|
| **Lines** | 1984 | ~1800 (Phase 1) |
| **IoT Setup** | Per component | Shared ✅ |
| **Subscriptions** | Multiple | Managed ✅ |
| **Connection** | Multiple WebSockets | Single ✅ |
| **State** | Mixed | Cleaner ✅ |

---

## Testing Checklist

After refactor, test:
- ✅ Page loads without errors
- ✅ IoT connection shows as connected
- ✅ Station broadcast messages received
- ✅ Play/Pause/Stop still work
- ✅ State is saved correctly
- ✅ No console errors

---

## Next Steps After Phase 1

1. Test thoroughly
2. Commit changes
3. Start Phase 2: State Management hooks
4. Continue until complete refactor

---

## Safety

- Make changes incrementally
- Test after each change
- Commit working states
- Keep old code commented temporarily
