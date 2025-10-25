# 🎯 Implementation Plan: Multi-Player State Machine System

## 📋 Project Requirements

✅ **Elke player heeft eigen state machine**  
✅ **Player als herbruikbaar component**  
✅ **Players kunnen in dashboard geplaatst worden**  
✅ **Multi-player support via IoT**  
✅ **Backend monitort alle players**  

---

## 🏗️ Architectuur Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard Page                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Player #1   │  │  Player #2   │  │  Player #3   │  │
│  │              │  │              │  │              │  │
│  │  playerId:   │  │  playerId:   │  │  playerId:   │  │
│  │  "main-001"  │  │  "studio-01" │  │  "backup-01" │  │
│  │              │  │              │  │              │  │
│  │  State:      │  │  State:      │  │  State:      │  │
│  │  PLAYING     │  │  PAUSED      │  │  IDLE        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
└─────────┼─────────────────┼─────────────────┼───────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │  AWS IoT Core  │
                   │                │
                   │  Topics per    │
                   │  player:       │
                   │  • state       │
                   │  • command     │
                   │  • track       │
                   └────────┬───────┘
                            │
                            ▼
                   ┌────────────────┐
                   │  Lambda        │
                   │  Monitoring    │
                   │                │
                   │  • All players │
                   │  • Analytics   │
                   │  • Alerts      │
                   └────────────────┘
```

---

## 📦 Component Structure

```
/apps/web/src/
├── components/
│   ├── RadioPlayer/
│   │   ├── index.tsx              # Main player component
│   │   ├── PlayerControls.tsx     # Play/Pause/Stop buttons
│   │   ├── PlayerProgress.tsx     # Progress bar & time
│   │   ├── PlayerTimers.tsx       # Countdown clocks
│   │   ├── PlayerVolume.tsx       # Volume control
│   │   ├── PlayerInfo.tsx         # Track info display
│   │   ├── usePlayerState.ts      # State machine hook
│   │   └── README.md
│   │
│   └── PlaylistViewer/            # Existing component
│
├── services/
│   ├── radioPlayerIoT.ts          # NEW: IoT service per player
│   ├── playlistIoT.ts             # Existing
│   └── tracks.ts
│
├── hooks/
│   └── useRadioPlayer.ts          # NEW: Player logic hook
│
├── pages/
│   ├── devices/
│   │   ├── Players.tsx            # Single player page (existing)
│   │   └── Dashboard.tsx          # NEW: Multi-player dashboard
│   │
│   └── DevicesDashboard.tsx       # NEW: Main dashboard
│
└── types/
    └── player.ts                  # NEW: Player types
```

---

## 🎯 Implementation Steps

### **FASE 1: Type Definitions** ⏱️ 30min

#### Step 1.1: Player Types
**File:** `/apps/web/src/types/player.ts`

```typescript
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

export interface PlayerConfig {
  playerId: string
  playerName: string
  autoPlay?: boolean
  defaultPlaylistId?: string | null
  scheduleEnabled?: boolean
}

export interface PlayerStateData {
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
  command: 'PLAY' | 'PAUSE' | 'STOP' | 'LOAD' | 'SEEK' | 'VOLUME'
  timestamp: string
  params?: {
    trackId?: string
    playlistId?: string
    position?: number
    volume?: number
  }
}

export interface PlayerInstance {
  config: PlayerConfig
  state: PlayerState
  currentTrack: Track | null
  currentPlaylistId: string | null
  isPlaying: boolean
  isPaused: boolean
  isLoaded: boolean
  currentTime: number
  duration: number
  volume: number
}
```

**Tasks:**
- [ ] Create `/types/player.ts`
- [ ] Export all types
- [ ] Add JSDoc comments

---

### **FASE 2: IoT Service per Player** ⏱️ 1h

#### Step 2.1: Radio Player IoT Service
**File:** `/apps/web/src/services/radioPlayerIoT.ts`

```typescript
import { PubSub } from '@aws-amplify/pubsub'
import { PlayerState, PlayerStateData, PlayerCommand } from '../types/player'

export class RadioPlayerIoT {
  private playerId: string
  private currentState: PlayerState = PlayerState.IDLE
  private subscriptions: Map<string, any> = new Map()
  
  constructor(playerId: string) {
    this.playerId = playerId
    console.log(`🎵 RadioPlayerIoT initialized for: ${playerId}`)
  }
  
  // Subscribe to commands for THIS player
  subscribeToCommands(callback: (command: PlayerCommand) => void) {
    const topic = `radio/player/${this.playerId}/command`
    
    // Implementation...
  }
  
  // Publish state changes for THIS player
  async publishState(
    newState: PlayerState,
    metadata?: PlayerStateData['metadata']
  ) {
    const message: PlayerStateData = {
      playerId: this.playerId,
      state: newState,
      previousState: this.currentState,
      timestamp: new Date().toISOString(),
      metadata
    }
    
    const topic = `radio/player/${this.playerId}/state`
    
    // Implementation...
  }
  
  // More methods...
}
```

**Tasks:**
- [ ] Create service class
- [ ] Implement PubSub subscribe
- [ ] Implement PubSub publish
- [ ] Add error handling
- [ ] Add logging

---

### **FASE 3: Player State Hook** ⏱️ 2h

#### Step 3.1: useRadioPlayer Hook
**File:** `/apps/web/src/hooks/useRadioPlayer.ts`

```typescript
export function useRadioPlayer(config: PlayerConfig) {
  const [state, setState] = useState<PlayerState>(PlayerState.IDLE)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const iotService = useRef<RadioPlayerIoT | null>(null)
  
  // Initialize IoT service for THIS player
  useEffect(() => {
    iotService.current = new RadioPlayerIoT(config.playerId)
    
    // Subscribe to commands
    const unsubscribe = iotService.current.subscribeToCommands((cmd) => {
      handleRemoteCommand(cmd)
    })
    
    return () => {
      unsubscribe()
      iotService.current?.cleanup()
    }
  }, [config.playerId])
  
  // State machine logic
  async function transitionState(newState: PlayerState, metadata?: any) {
    // Validate transition
    if (!canTransition(state, newState)) {
      console.error(`Invalid transition: ${state} → ${newState}`)
      return false
    }
    
    // Update local state
    setState(newState)
    
    // Publish to IoT
    await iotService.current?.publishState(newState, metadata)
    
    return true
  }
  
  // Player actions
  async function handleLoad(trackId: string) {
    await transitionState(PlayerState.LOADING)
    // ... load logic
    await transitionState(PlayerState.LOADED, { trackId })
  }
  
  async function handlePlay() {
    await transitionState(PlayerState.PLAYING)
    // ... play logic
  }
  
  // Return player interface
  return {
    // State
    state,
    currentTrack,
    isPlaying: state === PlayerState.PLAYING,
    isPaused: state === PlayerState.PAUSED,
    isLoaded: state === PlayerState.LOADED,
    
    // Actions
    load: handleLoad,
    play: handlePlay,
    pause: handlePause,
    stop: handleStop,
    seek: handleSeek,
    setVolume: handleVolumeChange,
    
    // Config
    playerId: config.playerId,
    playerName: config.playerName
  }
}
```

**Tasks:**
- [ ] Create hook
- [ ] State machine logic
- [ ] IoT integration
- [ ] Audio handling
- [ ] Error handling

---

### **FASE 4: RadioPlayer Component** ⏱️ 3h

#### Step 4.1: Main Player Component
**File:** `/apps/web/src/components/RadioPlayer/index.tsx`

```typescript
interface RadioPlayerProps {
  config: PlayerConfig
  compact?: boolean
  showPlaylist?: boolean
  className?: string
}

export function RadioPlayer({ 
  config, 
  compact = false,
  showPlaylist = true,
  className = ''
}: RadioPlayerProps) {
  const player = useRadioPlayer(config)
  
  return (
    <div className={`radio-player ${className}`}>
      {/* Header with player name and state */}
      <div className="player-header">
        <h3>{config.playerName}</h3>
        <div className="state-badge">
          {player.state}
        </div>
      </div>
      
      {/* Timers */}
      <PlayerTimers 
        state={player.state}
        currentTime={player.currentTime}
        duration={player.duration}
      />
      
      {/* Track Info */}
      <PlayerInfo track={player.currentTrack} />
      
      {/* Controls */}
      <PlayerControls
        onLoad={() => player.load()}
        onPlay={player.play}
        onPause={player.pause}
        onStop={player.stop}
        disabled={!player.isLoaded}
      />
      
      {/* Progress */}
      <PlayerProgress
        currentTime={player.currentTime}
        duration={player.duration}
        onSeek={player.seek}
      />
      
      {/* Volume */}
      <PlayerVolume
        volume={player.volume}
        onChange={player.setVolume}
      />
      
      {/* Playlist */}
      {showPlaylist && player.currentPlaylistId && (
        <PlaylistViewer 
          playlistId={player.currentPlaylistId}
          onTrackSelect={(track) => player.load(track.trackId)}
        />
      )}
    </div>
  )
}
```

**Tasks:**
- [ ] Create main component
- [ ] Create sub-components
- [ ] Styling with TailwindCSS
- [ ] Responsive design
- [ ] Compact mode

---

### **FASE 5: Dashboard Page** ⏱️ 2h

#### Step 5.1: Multi-Player Dashboard
**File:** `/apps/web/src/pages/DevicesDashboard.tsx`

```typescript
export default function DevicesDashboard() {
  const [players, setPlayers] = useState<PlayerConfig[]>([
    {
      playerId: 'player-main-001',
      playerName: 'Main Studio',
      scheduleEnabled: true
    },
    {
      playerId: 'player-studio-002',
      playerName: 'Studio B',
      scheduleEnabled: true
    },
    {
      playerId: 'player-backup-003',
      playerName: 'Backup Player',
      scheduleEnabled: false
    }
  ])
  
  return (
    <Layout>
      <div className="dashboard">
        <h1>📻 Radio Players Dashboard</h1>
        
        <div className="players-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {players.map(config => (
            <RadioPlayer
              key={config.playerId}
              config={config}
              compact={true}
              showPlaylist={false}
            />
          ))}
        </div>
        
        <button onClick={addNewPlayer}>
          + Add Player
        </button>
      </div>
    </Layout>
  )
}
```

**Tasks:**
- [ ] Create dashboard page
- [ ] Player grid layout
- [ ] Add/remove players
- [ ] Save player configs
- [ ] Route setup

---

### **FASE 6: Backend Monitoring** ⏱️ 2h

#### Step 6.1: Lambda Monitoring Function
**File:** `/amplify/functions/player-monitor/handler.ts`

```typescript
export const handler = async (event: any) => {
  const { topic, message } = event
  
  // Parse topic to get playerId
  const match = topic.match(/radio\/player\/([^\/]+)\/state/)
  if (!match) return
  
  const playerId = match[1]
  const stateData: PlayerStateData = message
  
  console.log(`Player ${playerId}: ${stateData.previousState} → ${stateData.state}`)
  
  // Store in DynamoDB
  await storePlayerState(playerId, stateData)
  
  // Send alerts if ERROR
  if (stateData.state === PlayerState.ERROR) {
    await sendAlert({
      subject: `Player ${playerId} Error`,
      message: `Error: ${stateData.metadata?.error}`
    })
  }
  
  // Update metrics
  await updateCloudWatchMetrics(playerId, stateData)
}
```

**Tasks:**
- [ ] Create Lambda function
- [ ] DynamoDB table design
- [ ] IoT Rule setup
- [ ] CloudWatch metrics
- [ ] SNS alerts

---

### **FASE 7: Testing** ⏱️ 2h

#### Step 7.1: Component Tests
```typescript
describe('RadioPlayer', () => {
  test('initializes with IDLE state', () => {
    // Test
  })
  
  test('transitions IDLE → LOADING → LOADED', async () => {
    // Test
  })
  
  test('publishes state to IoT', async () => {
    // Test
  })
  
  test('receives remote commands', async () => {
    // Test
  })
})
```

**Tasks:**
- [ ] Unit tests for hook
- [ ] Component tests
- [ ] IoT integration tests
- [ ] E2E tests

---

## 📊 Timeline

| Fase | Tijd | Deliverable |
|------|------|-------------|
| 1. Types | 30min | Type definitions |
| 2. IoT Service | 1h | RadioPlayerIoT class |
| 3. Player Hook | 2h | useRadioPlayer hook |
| 4. Component | 3h | RadioPlayer component |
| 5. Dashboard | 2h | Multi-player page |
| 6. Backend | 2h | Lambda monitoring |
| 7. Testing | 2h | Test suite |
| **TOTAAL** | **~13h** | **Complete system** |

---

## 🎯 Prioriteiten

### **Must Have (MVP):**
- ✅ Player component met state machine
- ✅ IoT state publishing
- ✅ Basic dashboard (2-3 players)
- ✅ Local state management

### **Should Have:**
- ✅ IoT command receiving
- ✅ Backend monitoring
- ✅ Error handling
- ✅ Analytics

### **Could Have:**
- ⭕ Player templates
- ⭕ Drag & drop dashboard
- ⭕ Custom player configs
- ⭕ Player grouping

### **Won't Have (Future):**
- ⭕ Mobile app
- ⭕ Voice control
- ⭕ Advanced analytics dashboard

---

## 🚀 Getting Started

### **Option A: Start Small (Recommended)**
1. Maak Types (Fase 1)
2. Maak IoT Service (Fase 2)
3. Extract huidige Players.tsx logica naar hook (Fase 3)
4. Test met 1 player
5. Maak herbruikbare component (Fase 4)
6. Maak dashboard met 2 players (Fase 5)

### **Option B: Start with Component**
1. Refactor huidige Players.tsx
2. Maak RadioPlayer component
3. Add IoT later

### **Option C: Backend First**
1. Setup IoT topics
2. Maak Lambda monitoring
3. Test met mock data
4. Integreer frontend

---

## 🎯 Next Steps

**Welke optie kies je?**

1. **Option A** - Stap voor stap, types eerst?
2. **Option B** - Component eerst, refactor bestaande player?
3. **Option C** - Backend eerst, monitoring opzetten?

**Of beginnen met specifieke fase?**
- Fase 1: Types maken?
- Fase 2: IoT service maken?
- Fase 3: Hook maken?

**Laat me weten en ik begin!** 🚀
