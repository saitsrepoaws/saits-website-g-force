# 📡 IoT Topics Specification - Complete Overview

**Project:** G-Forge IoT Radio Player  
**Purpose:** Multi-player state machine met AWS IoT Core  
**Date:** 2025-10-25

---

## 🎯 Overview

Dit document beschrijft **alle** IoT topics, message formats, en controle procedures voor het radio player systeem.

---

## 📋 Topic Naming Convention

```
radio/player/{playerId}/state       ← Player publiceert state changes
radio/player/{playerId}/command     ← Backend stuurt commands
radio/player/{playerId}/track       ← Player publiceert track info
radio/player/{playerId}/heartbeat   ← Player heartbeat (elke 30s)
radio/schedule/current              ← Backend publiceert schedule updates
radio/players/status                ← Alle players publishen status
radio/system/alerts                 ← System alerts & errors
```

---

## 🔐 IoT Permissions Required

### In `amplify/backend.ts`:

```typescript
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'

const authenticatedRole = backend.auth.resources.authenticatedUserIamRole

authenticatedRole.attachInlinePolicy(
  new Policy(authenticatedRole.stack, 'RadioPlayerIotPolicy', {
    statements: [
      // Connect
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Connect'],
        resources: [
          `arn:aws:iot:eu-west-1:*:client/\${cognito-identity.amazonaws.com:sub}`,
        ],
      }),
      
      // Subscribe (topics je ONTVANGT)
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Subscribe'],
        resources: [
          'arn:aws:iot:eu-west-1:*:topicfilter/radio/player/*/command',
          'arn:aws:iot:eu-west-1:*:topicfilter/radio/schedule/current',
          'arn:aws:iot:eu-west-1:*:topicfilter/radio/system/alerts',
        ],
      }),
      
      // Publish & Receive (topics je STUURT + ontvangt van subscribes)
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iot:Publish', 'iot:Receive'],
        resources: [
          'arn:aws:iot:eu-west-1:*:topic/radio/player/*/state',
          'arn:aws:iot:eu-west-1:*:topic/radio/player/*/track',
          'arn:aws:iot:eu-west-1:*:topic/radio/player/*/heartbeat',
          'arn:aws:iot:eu-west-1:*:topic/radio/players/status',
          'arn:aws:iot:eu-west-1:*:topic/radio/schedule/current',
          'arn:aws:iot:eu-west-1:*:topic/radio/system/alerts',
        ],
      }),
    ],
  })
)
```

---

## 📡 Topic #1: Player State

### **Topic:** `radio/player/{playerId}/state`
**Direction:** Player → Backend  
**QoS:** 1 (At least once)  
**Frequency:** Bij elke state change

### **Message Format:**
```typescript
interface PlayerStateMessage {
  playerId: string              // "player-main-001"
  state: PlayerState            // "PLAYING" | "PAUSED" | "STOPPED" | etc.
  previousState: PlayerState    // Vorige state
  timestamp: string             // ISO 8601: "2025-10-25T19:00:00Z"
  metadata?: {
    trackId?: string            // Track UUID
    playlistId?: string         // Playlist UUID
    position?: number           // Current playback position (seconds)
    duration?: number           // Track duration (seconds)
    volume?: number             // Volume (0.0 - 1.0)
    error?: string              // Error message (if state = ERROR)
  }
}
```

### **Example:**
```json
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "previousState": "LOADED",
  "timestamp": "2025-10-25T19:00:00.123Z",
  "metadata": {
    "trackId": "abc123-def456",
    "playlistId": "morning-mix",
    "position": 45.5,
    "duration": 316.8,
    "volume": 0.7
  }
}
```

### **State Values:**
```typescript
enum PlayerState {
  IDLE = 'IDLE',           // Geen track geladen
  LOADING = 'LOADING',     // Track aan het laden
  LOADED = 'LOADED',       // Track geladen, ready
  PLAYING = 'PLAYING',     // Speelt
  PAUSED = 'PAUSED',       // Gepauzeerd
  STOPPED = 'STOPPED',     // Gestopt
  BUFFERING = 'BUFFERING', // Buffering data
  ERROR = 'ERROR'          // Error state
}
```

### **Valid Transitions:**
```
IDLE → LOADING → LOADED → PLAYING ⟷ PAUSED
                     ↓        ↓
                   ERROR   STOPPED
```

---

## 📡 Topic #2: Player Command

### **Topic:** `radio/player/{playerId}/command`
**Direction:** Backend → Player  
**QoS:** 1  
**Frequency:** On demand

### **Message Format:**
```typescript
interface PlayerCommand {
  command: CommandType          // Command type
  timestamp: string             // ISO 8601
  params?: CommandParams        // Optional parameters
  requestId?: string            // Voor tracking
}

type CommandType = 
  | 'PLAY'      // Start playback
  | 'PAUSE'     // Pause playback
  | 'STOP'      // Stop playback
  | 'LOAD'      // Load track
  | 'SEEK'      // Seek to position
  | 'VOLUME'    // Set volume
  | 'SKIP'      // Skip to next track
  | 'RESTART'   // Restart player

interface CommandParams {
  trackId?: string      // Voor LOAD command
  playlistId?: string   // Voor LOAD command
  position?: number     // Voor SEEK (seconds)
  volume?: number       // Voor VOLUME (0.0 - 1.0)
}
```

### **Examples:**

**LOAD:**
```json
{
  "command": "LOAD",
  "timestamp": "2025-10-25T19:00:00Z",
  "params": {
    "trackId": "abc123",
    "playlistId": "evening-vibes"
  },
  "requestId": "req-001"
}
```

**PLAY:**
```json
{
  "command": "PLAY",
  "timestamp": "2025-10-25T19:00:05Z",
  "requestId": "req-002"
}
```

**SEEK:**
```json
{
  "command": "SEEK",
  "timestamp": "2025-10-25T19:01:00Z",
  "params": {
    "position": 120.5
  }
}
```

**VOLUME:**
```json
{
  "command": "VOLUME",
  "timestamp": "2025-10-25T19:02:00Z",
  "params": {
    "volume": 0.5
  }
}
```

---

## 📡 Topic #3: Track Info

### **Topic:** `radio/player/{playerId}/track`
**Direction:** Player → Backend  
**QoS:** 0 (At most once)  
**Frequency:** Bij track load

### **Message Format:**
```typescript
interface TrackInfoMessage {
  playerId: string
  trackId: string
  title: string
  artist: string
  album?: string
  duration: number          // seconds
  bpm?: number
  key?: string
  genre?: string
  label?: string
  playlistId?: string
  position: number          // Track position in playlist
  timestamp: string
}
```

### **Example:**
```json
{
  "playerId": "player-main-001",
  "trackId": "abc123",
  "title": "Resonant Shift",
  "artist": "D_n",
  "album": "Techno Collection",
  "duration": 316.8,
  "bpm": 138,
  "key": "A# minor",
  "genre": "Techno",
  "label": "Deeply Rooted",
  "playlistId": "evening-vibes",
  "position": 3,
  "timestamp": "2025-10-25T19:00:00Z"
}
```

---

## 📡 Topic #4: Heartbeat

### **Topic:** `radio/player/{playerId}/heartbeat`
**Direction:** Player → Backend  
**QoS:** 0  
**Frequency:** Elke 30 seconden

### **Message Format:**
```typescript
interface HeartbeatMessage {
  playerId: string
  state: PlayerState
  online: boolean
  timestamp: string
  uptime: number            // seconds since player start
  errors: number            // total error count
  tracksPlayed: number      // total tracks played
  lastTrackId?: string
}
```

### **Example:**
```json
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "online": true,
  "timestamp": "2025-10-25T19:00:30Z",
  "uptime": 3600,
  "errors": 0,
  "tracksPlayed": 12,
  "lastTrackId": "abc123"
}
```

---

## 📡 Topic #5: Schedule Update

### **Topic:** `radio/schedule/current`
**Direction:** Backend → All Players  
**QoS:** 1  
**Frequency:** Bij schedule change (elk uur)

### **Message Format:**
```typescript
interface ScheduleMessage {
  hour: number              // 0-23
  playlistId: string
  playlistName: string
  autoSwitch: boolean       // Should players auto-switch?
  timestamp: string
  metadata?: {
    genre?: string
    mood?: string
    description?: string
  }
}
```

### **Example:**
```json
{
  "hour": 19,
  "playlistId": "evening-vibes",
  "playlistName": "Evening Vibes",
  "autoSwitch": true,
  "timestamp": "2025-10-25T19:00:00Z",
  "metadata": {
    "genre": "Techno",
    "mood": "Energetic",
    "description": "Deep techno for evening sessions"
  }
}
```

---

## 📡 Topic #6: Players Status

### **Topic:** `radio/players/status`
**Direction:** All Players → Backend  
**QoS:** 0  
**Frequency:** Elke 60 seconden

### **Message Format:**
```typescript
interface PlayersStatusMessage {
  playerId: string
  state: PlayerState
  online: boolean
  lastHeartbeat: string
  uptime: number
  currentTrack?: {
    trackId: string
    title: string
    position: number
    duration: number
  }
}
```

### **Example:**
```json
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "online": true,
  "lastHeartbeat": "2025-10-25T19:05:00Z",
  "uptime": 3900,
  "currentTrack": {
    "trackId": "abc123",
    "title": "Resonant Shift",
    "position": 145.2,
    "duration": 316.8
  }
}
```

---

## 📡 Topic #7: System Alerts

### **Topic:** `radio/system/alerts`
**Direction:** Backend → Players (en admins)  
**QoS:** 1  
**Frequency:** On error/alert

### **Message Format:**
```typescript
interface AlertMessage {
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  message: string
  timestamp: string
  source?: string           // playerId or 'system'
  context?: any             // Additional context
}
```

### **Examples:**

**ERROR:**
```json
{
  "severity": "ERROR",
  "message": "Player player-main-001 failed to load track",
  "timestamp": "2025-10-25T19:00:00Z",
  "source": "player-main-001",
  "context": {
    "trackId": "abc123",
    "error": "Network timeout"
  }
}
```

**WARNING:**
```json
{
  "severity": "WARNING",
  "message": "Player offline for 2 minutes",
  "timestamp": "2025-10-25T19:02:00Z",
  "source": "player-backup-003"
}
```

---

## 🧪 Testing & Debugging

### **1. Test IoT Connection**

```typescript
import { PubSub } from '@aws-amplify/pubsub'

// Test publish
await PubSub.publish({
  topics: ['radio/player/test-001/state'],
  message: {
    playerId: 'test-001',
    state: 'IDLE',
    previousState: 'IDLE',
    timestamp: new Date().toISOString()
  }
})

// Test subscribe
PubSub.subscribe({ 
  topics: ['radio/player/test-001/command'] 
}).subscribe({
  next: (data) => console.log('✅ Received:', data),
  error: (err) => console.error('❌ Error:', err)
})
```

### **2. AWS IoT Core Test Client**

Via AWS Console → IoT Core → Test → MQTT test client:

**Subscribe to all player messages:**
```
radio/player/#
```

**Publish test command:**
```json
Topic: radio/player/test-001/command

{
  "command": "PLAY",
  "timestamp": "2025-10-25T19:00:00Z"
}
```

### **3. Browser Console Logging**

```typescript
// Enable debug logging
localStorage.setItem('aws-amplify-debug', 'true')

// Check connection state
Hub.listen('pubsub', (data) => {
  console.log('PubSub event:', data.payload)
})
```

---

## ✅ Checklist voor Controle

### **IoT Setup:**
- [ ] IoT policy attached to Cognito authenticated role
- [ ] IoT endpoint in `.env.local` (VITE_AWS_IOT_ENDPOINT)
- [ ] Permissions voor alle topics (Connect, Subscribe, Publish, Receive)
- [ ] amplify_outputs.json up-to-date

### **Frontend:**
- [ ] PubSub package installed (`@aws-amplify/pubsub`)
- [ ] Amplify configured met IoT endpoint
- [ ] RadioPlayerIoT service geïmplementeerd
- [ ] Subscribe to commands works
- [ ] Publish state changes works

### **Backend:**
- [ ] Lambda function voor monitoring
- [ ] DynamoDB table voor state history
- [ ] IoT Rules voor routing
- [ ] CloudWatch metrics

### **Testing:**
- [ ] Connection test werkt
- [ ] Publish test message werkt
- [ ] Subscribe ontvangt messages
- [ ] State transitions worden gepubliceerd
- [ ] Commands worden ontvangen
- [ ] Heartbeat werkt

---

## 🚨 Troubleshooting

### **ConnectionDisrupted Error:**
```
✅ Check: IoT policy attached to Cognito role?
✅ Check: Permissions correct (Connect, Subscribe, Publish, Receive)?
✅ Check: Topic names match exactly?
✅ Check: Region correct (eu-west-1)?
```

### **No Messages Received:**
```
✅ Check: Subscribed to correct topic?
✅ Check: Topic name match (case-sensitive)?
✅ Check: QoS level correct?
✅ Check: IoT Rules configured?
```

### **Permission Denied:**
```
✅ Check: ARN region matches IoT endpoint region
✅ Check: Wildcard topics correct (radio/player/*)
✅ Check: Both Publish AND Receive permissions
```

### **WebSocket Fails:**
```
✅ Check: IoT endpoint format (no wss:// prefix)
✅ Check: ATS endpoint (-ats in domain)
✅ Check: User authenticated (valid Cognito session)
```

---

## 📊 Message Flow Diagram

```
┌─────────────────┐
│  Radio Player   │
│  (Frontend)     │
└────────┬────────┘
         │
         │ Publish: state, track, heartbeat, status
         │ Subscribe: command, schedule, alerts
         │
         ▼
┌─────────────────┐
│  AWS IoT Core   │
│   (PubSub)      │
└────────┬────────┘
         │
         │ IoT Rules route messages
         │
         ▼
┌─────────────────┐         ┌──────────────┐
│  Lambda         │────────▶│  DynamoDB    │
│  (Monitor)      │         │  (History)   │
└─────────────────┘         └──────────────┘
         │
         │
         ▼
┌─────────────────┐
│  CloudWatch     │
│  (Metrics)      │
└─────────────────┘
```

---

## 📝 Implementation Priority

1. **Phase 1:** Setup IoT permissions ✅
2. **Phase 2:** Test connection & basic pub/sub
3. **Phase 3:** Implement state publishing
4. **Phase 4:** Implement command receiving
5. **Phase 5:** Heartbeat & monitoring
6. **Phase 6:** Schedule integration
7. **Phase 7:** Alert system

---

**Volgende stap:** Begin met Phase 1 - IoT permissions setup! 🚀
