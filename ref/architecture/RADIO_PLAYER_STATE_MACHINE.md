# 📻 Radio Player State Machine via AWS IoT Core

## 🎯 Doel
**Backend kan real-time de state van alle radio players monitoren en besturen via AWS IoT Core PubSub.**

---

## 🏗️ Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS IoT Core                            │
│                                                              │
│  Topics:                                                     │
│  • radio/player/{playerId}/state        ← Player state      │
│  • radio/player/{playerId}/command      → Commands          │
│  • radio/player/{playerId}/track        ← Track info        │
│  • radio/schedule/current               ← Schedule          │
│  • radio/players/status                 ← All players       │
└─────────────────────────────────────────────────────────────┘
         ↑                                           ↓
         │ Subscribe                        Publish  │
         │                                           │
┌────────┴────────┐                        ┌────────┴────────┐
│  Frontend       │                        │   Backend       │
│  (React App)    │                        │   (Lambda)      │
│                 │                        │                 │
│  • Player UI    │                        │  • Monitor      │
│  • State sync   │                        │  • Control      │
│  • Auto-play    │                        │  • Analytics    │
└─────────────────┘                        └─────────────────┘
```

---

## 🔄 State Machine

### States:
```typescript
enum PlayerState {
  IDLE = 'IDLE',           // Geen track geladen
  LOADING = 'LOADING',     // Track aan het laden
  LOADED = 'LOADED',       // Track geladen, klaar om te spelen
  PLAYING = 'PLAYING',     // Track speelt
  PAUSED = 'PAUSED',       // Track gepauzeerd
  STOPPED = 'STOPPED',     // Track gestopt
  BUFFERING = 'BUFFERING', // Audio buffering
  ERROR = 'ERROR'          // Error state
}
```

### Transitions:
```
IDLE ────────────────────┐
  │                      │
  │ LOAD                 │
  ↓                      │
LOADING                  │
  │                      │
  │ SUCCESS              │ ERROR
  ↓                      ↓
LOADED ─────────────→ ERROR
  │         │            ↑
  │ PLAY    │ UNLOAD     │
  ↓         ↓            │
PLAYING   IDLE           │
  │  ↑                   │
  │  │ RESUME            │
  │  │                   │
  │  └─── PAUSED         │
  │         ↑            │
  │ PAUSE   │            │
  └─────────┘            │
  │                      │
  │ STOP                 │
  ↓                      │
STOPPED ─────────────────┘
  │
  │ RESET
  ↓
IDLE
```

---

## 📡 IoT Topics

### 1. **State Updates** (Player → Backend)
```
Topic: radio/player/{playerId}/state
QoS: 1 (At least once delivery)

Message:
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "previousState": "LOADED",
  "timestamp": "2025-10-25T19:00:00Z",
  "metadata": {
    "trackId": "abc123",
    "playlistId": "morning-mix",
    "position": 45.5,
    "duration": 180.0,
    "volume": 0.7
  }
}
```

### 2. **Commands** (Backend → Player)
```
Topic: radio/player/{playerId}/command
QoS: 1

Message:
{
  "command": "PLAY" | "PAUSE" | "STOP" | "LOAD" | "SEEK" | "VOLUME",
  "timestamp": "2025-10-25T19:00:00Z",
  "params": {
    "trackId": "abc123",      // For LOAD
    "position": 30.0,         // For SEEK
    "volume": 0.5             // For VOLUME
  }
}
```

### 3. **Track Info** (Player → Backend)
```
Topic: radio/player/{playerId}/track
QoS: 0

Message:
{
  "playerId": "player-main-001",
  "trackId": "abc123",
  "title": "Resonant Shift",
  "artist": "D_n",
  "album": "Techno Collection",
  "duration": 316,
  "bpm": 138,
  "key": "A# minor",
  "playlistId": "morning-mix",
  "position": 1,
  "timestamp": "2025-10-25T19:00:00Z"
}
```

### 4. **Schedule Updates** (Backend → Players)
```
Topic: radio/schedule/current
QoS: 1

Message:
{
  "hour": 19,
  "playlistId": "evening-vibes",
  "playlistName": "Evening Vibes",
  "autoSwitch": true,
  "timestamp": "2025-10-25T19:00:00Z"
}
```

### 5. **Status Broadcast** (All Players → Backend)
```
Topic: radio/players/status
QoS: 0

Message:
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "online": true,
  "lastHeartbeat": "2025-10-25T19:00:00Z",
  "uptime": 3600,
  "errors": 0
}
```

---

## 💾 Implementation

### Service: `/services/radioPlayerIoT.ts`

```typescript
import { PubSub } from '@aws-amplify/pubsub'
import { Hub } from 'aws-amplify/utils'

export enum PlayerState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  BUFFERING = 'BUFFERING',
  ERROR = 'ERROR'
}

export interface PlayerStateMessage {
  playerId: string
  state: PlayerState
  previousState: PlayerState
  timestamp: string
  metadata?: {
    trackId?: string
    playlistId?: string
    position?: number
    duration?: number
    volume?: number
    error?: string
  }
}

export interface PlayerCommand {
  command: 'PLAY' | 'PAUSE' | 'STOP' | 'LOAD' | 'SEEK' | 'VOLUME' | 'SKIP'
  timestamp: string
  params?: {
    trackId?: string
    position?: number
    volume?: number
  }
}

class RadioPlayerIoTService {
  private playerId: string = 'player-main-001'
  private currentState: PlayerState = PlayerState.IDLE
  private subscriptions: Map<string, any> = new Map()
  
  // Subscribe to commands
  subscribeToCommands(callback: (command: PlayerCommand) => void) {
    const topic = `radio/player/${this.playerId}/command`
    
    console.log(`📡 Subscribing to commands: ${topic}`)
    
    const subscription = (PubSub as any).subscribe({ topics: [topic] }).subscribe({
      next: (data: any) => {
        console.log('📩 Command received:', data.value)
        callback(data.value as PlayerCommand)
      },
      error: (error: any) => console.error('❌ Command subscription error:', error),
    })
    
    this.subscriptions.set('commands', subscription)
    
    return () => {
      subscription.unsubscribe()
      this.subscriptions.delete('commands')
    }
  }
  
  // Subscribe to schedule updates
  subscribeToSchedule(callback: (schedule: any) => void) {
    const topic = 'radio/schedule/current'
    
    const subscription = (PubSub as any).subscribe({ topics: [topic] }).subscribe({
      next: (data: any) => {
        console.log('📅 Schedule update:', data.value)
        callback(data.value)
      },
      error: (error: any) => console.error('❌ Schedule subscription error:', error),
    })
    
    this.subscriptions.set('schedule', subscription)
    
    return () => {
      subscription.unsubscribe()
      this.subscriptions.delete('schedule')
    }
  }
  
  // Publish state change
  async publishState(
    newState: PlayerState,
    metadata?: PlayerStateMessage['metadata']
  ) {
    const message: PlayerStateMessage = {
      playerId: this.playerId,
      state: newState,
      previousState: this.currentState,
      timestamp: new Date().toISOString(),
      metadata
    }
    
    const topic = `radio/player/${this.playerId}/state`
    
    try {
      await (PubSub as any).publish({
        topics: [topic],
        message
      })
      
      console.log(`✅ State published: ${this.currentState} → ${newState}`)
      this.currentState = newState
    } catch (error) {
      console.error('❌ Failed to publish state:', error)
    }
  }
  
  // Publish track info
  async publishTrackInfo(track: any) {
    const topic = `radio/player/${this.playerId}/track`
    
    const message = {
      playerId: this.playerId,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      bpm: track.bpm,
      key: track.key,
      timestamp: new Date().toISOString()
    }
    
    try {
      await (PubSub as any).publish({
        topics: [topic],
        message
      })
      console.log('✅ Track info published')
    } catch (error) {
      console.error('❌ Failed to publish track info:', error)
    }
  }
  
  // Publish heartbeat
  async publishHeartbeat() {
    const topic = 'radio/players/status'
    
    const message = {
      playerId: this.playerId,
      state: this.currentState,
      online: true,
      lastHeartbeat: new Date().toISOString(),
      uptime: performance.now() / 1000
    }
    
    try {
      await (PubSub as any).publish({
        topics: [topic],
        message
      })
    } catch (error) {
      console.error('❌ Failed to publish heartbeat:', error)
    }
  }
  
  // Start heartbeat (every 30s)
  startHeartbeat() {
    setInterval(() => this.publishHeartbeat(), 30000)
  }
  
  // Get current state
  getCurrentState(): PlayerState {
    return this.currentState
  }
  
  // Cleanup
  unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions.clear()
  }
}

export const radioPlayerIoT = new RadioPlayerIoTService()
```

---

## 🔌 Integration in Player Component

```typescript
// In Players.tsx

useEffect(() => {
  // Subscribe to commands
  const unsubCommands = radioPlayerIoT.subscribeToCommands((command) => {
    console.log('🎛️ Remote command:', command.command)
    
    switch (command.command) {
      case 'PLAY':
        handlePlay()
        break
      case 'PAUSE':
        handlePause()
        break
      case 'STOP':
        handleStop()
        break
      case 'LOAD':
        if (command.params?.trackId) {
          loadTrackById(command.params.trackId)
        }
        break
      case 'SEEK':
        if (command.params?.position) {
          seekTo(command.params.position)
        }
        break
      case 'VOLUME':
        if (command.params?.volume) {
          setVolume(command.params.volume)
        }
        break
    }
  })
  
  // Subscribe to schedule
  const unsubSchedule = radioPlayerIoT.subscribeToSchedule((schedule) => {
    console.log('📅 Schedule changed:', schedule.playlistName)
    if (schedule.autoSwitch) {
      setCurrentPlaylistId(schedule.playlistId)
      // Auto-load first track
      loadFirstTrackFromPlaylist(schedule.playlistId)
    }
  })
  
  // Start heartbeat
  radioPlayerIoT.startHeartbeat()
  
  return () => {
    unsubCommands()
    unsubSchedule()
    radioPlayerIoT.unsubscribeAll()
  }
}, [])

// Publish state changes
async function handlePlay() {
  // ... existing play logic ...
  
  await radioPlayerIoT.publishState(PlayerState.PLAYING, {
    trackId: currentTrack?.id,
    playlistId: currentPlaylistId,
    position: currentTime,
    duration: duration,
    volume
  })
}

async function handleLoad() {
  await radioPlayerIoT.publishState(PlayerState.LOADING)
  
  try {
    // ... load track ...
    
    await radioPlayerIoT.publishState(PlayerState.LOADED, {
      trackId: track.id,
      playlistId: currentPlaylistId
    })
    
    await radioPlayerIoT.publishTrackInfo(track)
  } catch (error) {
    await radioPlayerIoT.publishState(PlayerState.ERROR, {
      error: error.message
    })
  }
}
```

---

## 📊 Backend Monitoring (Lambda)

```typescript
// Lambda function to monitor player states

export const handler = async (event: any) => {
  const { topic, message } = event
  
  if (topic.includes('/state')) {
    const state: PlayerStateMessage = message
    
    // Log to CloudWatch
    console.log(`Player ${state.playerId}: ${state.previousState} → ${state.state}`)
    
    // Store in DynamoDB
    await savePlayerState(state)
    
    // Send alerts if ERROR
    if (state.state === 'ERROR') {
      await sendAlert(`Player ${state.playerId} encountered error: ${state.metadata?.error}`)
    }
    
    // Analytics
    await recordMetric({
      metric: 'PlayerStateChange',
      playerId: state.playerId,
      state: state.state,
      timestamp: state.timestamp
    })
  }
  
  if (topic.includes('/track')) {
    // Log track plays
    await recordTrackPlay(message)
  }
}
```

---

## 🎯 Benefits

✅ **Real-time monitoring** - Backend weet altijd wat er speelt  
✅ **Remote control** - Backend kan players besturen  
✅ **Auto-scheduling** - Automatic playlist switching per uur  
✅ **Analytics** - Track alle plays, pauses, errors  
✅ **Multi-player** - Meerdere players te monitoren  
✅ **Failover** - Detect offline players  
✅ **Debugging** - Complete state history in CloudWatch  

---

## 🚀 Implementatie Stappen

1. ✅ **Basis IoT al aanwezig** (`playlistIoT.ts`)
2. 🔲 Maak `radioPlayerIoT.ts` service
3. 🔲 Integreer in `Players.tsx`
4. 🔲 Test lokaal met IoT console
5. 🔲 Maak Lambda voor monitoring
6. 🔲 Setup IoT Rules in AWS
7. 🔲 Dashboard voor monitoring

---

## 💡 Volgende Stappen

**Zal ik beginnen met:**
1. `radioPlayerIoT.ts` service maken?
2. Integratie in `Players.tsx`?
3. Lambda monitoring function?

**Laat me weten!** 🚀
