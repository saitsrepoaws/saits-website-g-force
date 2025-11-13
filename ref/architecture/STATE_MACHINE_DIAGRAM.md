# 📊 Radio Player State Machine - Visual Diagram

## 🔄 Complete State Flow

```
                                    ┌─────────────┐
                                    │    ERROR    │
                                    │             │
                                    └──────▲──────┘
                                           │
                                           │ Error
                    ┌──────────────────────┴────────────────────────┐
                    │                                                │
                    │                                                │
           ┌────────┴────────┐                              ┌───────┴────────┐
           │      IDLE       │                              │    LOADING     │
           │                 │                              │                │
           │  • No track     │◄─────────────────────────────│  • Fetching    │
           │  • Ready        │         Unload               │  • Resolving   │
           └────────┬────────┘                              │    S3 URL      │
                    │                                       └───────┬────────┘
                    │                                               │
                    │ Load Track                                    │ Success
                    └───────────────────────────────────────────────┘
                                                                    │
                                                                    ▼
                                                            ┌───────────────┐
                                                            │    LOADED     │
                                                            │               │
                                                            │  • Ready      │
                                                            │  • Can play   │
                                                            └───────┬───────┘
                                                                    │
                                          ┌─────────────────────────┴──────────┐
                                          │                                    │
                                          │ Play                               │ Stop
                                          ▼                                    ▼
                                  ┌───────────────┐                   ┌──────────────┐
                                  │   PLAYING     │                   │   STOPPED    │
                                  │               │                   │              │
                                  │  • Audio on   │                   │  • Reset     │
                                  │  • Time++     │                   │  • Position  │
                                  └───────┬───────┘                   │    = 0       │
                                          │                           └──────┬───────┘
                                          │                                  │
                                          │ Pause                            │ Reset
                                          ▼                                  ▼
                                  ┌───────────────┐                   ┌──────────────┐
                                  │    PAUSED     │                   │     IDLE     │
                                  │               │                   └──────────────┘
                                  │  • Audio off  │
                                  │  • Position   │
                                  │    saved      │
                                  └───────┬───────┘
                                          │
                                          │ Resume
                                          │
                                          └──────────────────────────────────┐
                                                                             │
                                                                             ▼
                                                                     ┌───────────────┐
                                                                     │   PLAYING     │
                                                                     └───────────────┘


                                  ┌───────────────┐
                                  │  BUFFERING    │  ← Network slow
                                  │               │
                                  │  • Loading    │
                                  │    data       │
                                  └───────┬───────┘
                                          │
                                          │ Buffered
                                          ▼
                                  ┌───────────────┐
                                  │   PLAYING     │
                                  └───────────────┘
```

---

## 🎬 State Details

### **IDLE**
```
• No track loaded
• Player ready for new track
• All resources cleared
• Waiting for LOAD command

Actions:
→ Can receive LOAD command
```

### **LOADING**
```
• Fetching track from library
• Resolving S3 signed URL
• Loading metadata
• Preparing audio element

Transitions:
→ LOADED (success)
→ ERROR (failed to load)
```

### **LOADED**
```
• Track ready to play
• Metadata available
• Audio element created
• Waiting for PLAY

Actions:
→ Can PLAY
→ Can UNLOAD
→ Can view track info
```

### **PLAYING**
```
• Audio actively playing
• Time incrementing
• Progress bar updating
• Can interact

Actions:
→ Can PAUSE
→ Can STOP
→ Can SEEK
→ Can adjust VOLUME

Transitions:
→ PAUSED (pause button)
→ STOPPED (stop button)
→ BUFFERING (network slow)
→ IDLE (track ends)
→ ERROR (playback error)
```

### **PAUSED**
```
• Audio paused
• Position saved
• Can resume

Actions:
→ Can RESUME (→ PLAYING)
→ Can STOP
→ Can SEEK

Transitions:
→ PLAYING (resume)
→ STOPPED (stop)
```

### **STOPPED**
```
• Audio stopped
• Position reset to 0
• Still loaded

Actions:
→ Can PLAY from start
→ Can UNLOAD

Transitions:
→ PLAYING (play)
→ IDLE (unload)
```

### **BUFFERING**
```
• Network slow
• Loading audio data
• Temporary state

Auto-transitions:
→ PLAYING (buffered)
→ ERROR (timeout)
```

### **ERROR**
```
• Something went wrong
• Error message available
• Cannot play

Possible errors:
• Track not found
• S3 access denied
• Network error
• Audio decode error
• CORS error

Actions:
→ Can RETRY
→ Can UNLOAD

Transitions:
→ LOADING (retry)
→ IDLE (unload)
```

---

## 📡 IoT Message Examples

### State Change: IDLE → LOADING
```json
{
  "playerId": "player-main-001",
  "state": "LOADING",
  "previousState": "IDLE",
  "timestamp": "2025-10-25T19:00:00Z",
  "metadata": {
    "trackId": "abc123",
    "playlistId": "morning-mix"
  }
}
```

### State Change: LOADING → LOADED
```json
{
  "playerId": "player-main-001",
  "state": "LOADED",
  "previousState": "LOADING",
  "timestamp": "2025-10-25T19:00:01Z",
  "metadata": {
    "trackId": "abc123",
    "playlistId": "morning-mix",
    "duration": 316.5,
    "title": "Resonant Shift",
    "artist": "D_n"
  }
}
```

### State Change: LOADED → PLAYING
```json
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "previousState": "LOADED",
  "timestamp": "2025-10-25T19:00:05Z",
  "metadata": {
    "trackId": "abc123",
    "playlistId": "morning-mix",
    "position": 0.0,
    "duration": 316.5,
    "volume": 0.7
  }
}
```

### State Change: PLAYING → ERROR
```json
{
  "playerId": "player-main-001",
  "state": "ERROR",
  "previousState": "PLAYING",
  "timestamp": "2025-10-25T19:02:30Z",
  "metadata": {
    "trackId": "abc123",
    "error": "Network error: Failed to fetch audio data",
    "errorCode": "NETWORK_ERROR"
  }
}
```

---

## 🎯 Valid Transitions

```typescript
const validTransitions: Record<PlayerState, PlayerState[]> = {
  IDLE: [
    PlayerState.LOADING,
    PlayerState.ERROR
  ],
  
  LOADING: [
    PlayerState.LOADED,
    PlayerState.ERROR,
    PlayerState.IDLE  // Cancel
  ],
  
  LOADED: [
    PlayerState.PLAYING,
    PlayerState.IDLE,  // Unload
    PlayerState.ERROR
  ],
  
  PLAYING: [
    PlayerState.PAUSED,
    PlayerState.STOPPED,
    PlayerState.BUFFERING,
    PlayerState.IDLE,  // Track ended
    PlayerState.ERROR
  ],
  
  PAUSED: [
    PlayerState.PLAYING,
    PlayerState.STOPPED,
    PlayerState.ERROR
  ],
  
  STOPPED: [
    PlayerState.PLAYING,
    PlayerState.IDLE,
    PlayerState.ERROR
  ],
  
  BUFFERING: [
    PlayerState.PLAYING,
    PlayerState.ERROR
  ],
  
  ERROR: [
    PlayerState.LOADING,  // Retry
    PlayerState.IDLE      // Reset
  ]
}
```

---

## 🔒 State Validation

```typescript
function canTransition(from: PlayerState, to: PlayerState): boolean {
  const allowed = validTransitions[from]
  return allowed.includes(to)
}

function transitionState(to: PlayerState) {
  const current = getCurrentState()
  
  if (!canTransition(current, to)) {
    console.error(`❌ Invalid transition: ${current} → ${to}`)
    return false
  }
  
  console.log(`✅ Transition: ${current} → ${to}`)
  setCurrentState(to)
  publishStateToIoT(to)
  return true
}
```

---

## 📊 State Metrics

Track deze metrics per state:
- **Time in state** - Hoelang in elke state
- **Transition count** - Hoeveel transitions
- **Error rate** - Errors per state
- **Success rate** - Successful transitions

```typescript
interface StateMetrics {
  state: PlayerState
  enterTime: number
  exitTime: number
  duration: number
  transitionsFrom: Record<PlayerState, number>
  transitionsTo: Record<PlayerState, number>
  errorCount: number
}
```
