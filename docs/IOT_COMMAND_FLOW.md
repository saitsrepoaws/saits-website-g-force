# 🎛️ IoT Command Flow - Pure IoT Player Architecture

**Project:** G-Forge IoT Radio Player  
**Purpose:** Volledig IoT-gestuurde player zonder GraphQL dependencies  
**Date:** 2025-10-26

---

## 🎯 **Architecture Overview**

De player is een **pure IoT device** die:
- ✅ Alle commands via IoT ontvangt
- ✅ Alle data via IoT payload krijgt
- ✅ Alleen status terug rapporteert
- ❌ **GEEN GraphQL** gebruikt voor operaties

---

## 🔄 **Command Flow Pattern**

```
┌─────────────┐
│    USER     │
└──────┬──────┘
       │ Click button
       ↓
┌─────────────────────────────────────────┐
│  PLAYER (Frontend)                      │
│  - Publish IoT Command                  │
│  - Wait for response                    │
└──────┬──────────────────────────────────┘
       │ 📤 IoT Command
       ↓
┌─────────────────────────────────────────┐
│  STATE MACHINE (Backend Lambda)         │
│  - Validate state transition            │
│  - Fetch data via GraphQL               │
│  - Prepare complete payload             │
└──────┬──────────────────────────────────┘
       │ 📥 IoT Command Response
       ↓
┌─────────────────────────────────────────┐
│  PLAYER (Frontend)                      │
│  - Receive command with data            │
│  - Execute action                       │
│  - Publish state updates                │
└─────────────────────────────────────────┘
```

---

## 📡 **IoT Topics**

### **Commands (Bidirectional)**
```
Topic: radio/player/{playerId}/command
Direction: Player ↔ State Machine
QoS: 1
```

### **State Updates (Player → Backend)**
```
Topic: radio/player/{playerId}/state
Direction: Player → State Machine
QoS: 1
```

### **Track Info (Player → Backend)**
```
Topic: radio/player/{playerId}/track
Direction: Player → State Machine
QoS: 1
```

---

## 🎮 **Command Types**

### **1. LOAD Command**

**Player → State Machine:**
```json
{
  "command": "LOAD",
  "playerId": "player-main-001",
  "playlistId": "playlist-xyz-123",
  "timestamp": "2025-10-26T21:00:00Z"
}
```

**State Machine → Player:**
```json
{
  "command": "LOAD",
  "playerId": "player-main-001",
  "track": {
    "id": "track-abc-456",
    "title": "Amazing Song",
    "artist": "Cool Artist",
    "album": "Great Album",
    "fileUrl": "audio/tracks/file.mp3",
    "coverArtUrl": "images/covers/cover.jpg",
    "waveformUrl": "images/waveforms/waveform.svg",
    "duration": 180,
    "bpm": 128,
    "key": "Am",
    "energy": 0.8,
    "genre": "Techno",
    "year": 2024
  },
  "playlistId": "playlist-xyz-123",
  "timestamp": "2025-10-26T21:00:01Z"
}
```

**Player Actions:**
1. Publish state: `LOADING`
2. Load track data (from payload)
3. Resolve S3 URLs
4. Prepare audio element
5. Publish state: `LOADED`

---

### **2. PLAY Command**

**Player → State Machine:**
```json
{
  "command": "PLAY",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:00:05Z"
}
```

**State Machine → Player:**
```json
{
  "command": "PLAY",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:00:05Z"
}
```

**Player Actions:**
1. Validate track is loaded
2. Start audio playback
3. Publish state: `PLAYING`
4. Publish track info

---

### **3. PAUSE Command**

**Player → State Machine:**
```json
{
  "command": "PAUSE",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:01:30Z"
}
```

**State Machine → Player:**
```json
{
  "command": "PAUSE",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:01:30Z"
}
```

**Player Actions:**
1. Pause audio playback
2. Publish state: `PAUSED` (with position)

---

### **4. STOP Command**

**Player → State Machine:**
```json
{
  "command": "STOP",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:02:00Z"
}
```

**State Machine → Player:**
```json
{
  "command": "STOP",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:02:00Z"
}
```

**Player Actions:**
1. Stop audio playback
2. Reset position to 0
3. Publish state: `STOPPED`

---

### **5. UNLOAD Command**

**Player → State Machine:**
```json
{
  "command": "UNLOAD",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:02:30Z"
}
```

**State Machine → Player:**
```json
{
  "command": "UNLOAD",
  "playerId": "player-main-001",
  "timestamp": "2025-10-26T21:02:30Z"
}
```

**Player Actions:**
1. Clear track data
2. Release audio resources
3. Publish state: `IDLE`

---

## 🔐 **State Validation**

State Machine validates all transitions:

```typescript
const VALID_TRANSITIONS = {
  IDLE: ['LOADING'],
  LOADING: ['LOADED', 'ERROR'],
  LOADED: ['PLAYING', 'IDLE'],
  PLAYING: ['PAUSED', 'STOPPED'],
  PAUSED: ['PLAYING', 'STOPPED'],
  STOPPED: ['PLAYING', 'IDLE'],
  ERROR: ['IDLE']
}
```

**Invalid commands are rejected:**
```json
{
  "command": "PLAY",
  "error": "Invalid state transition: IDLE → PLAYING",
  "currentState": "IDLE",
  "requiredState": "LOADED"
}
```

---

## 📊 **State Updates**

Player publishes state after every action:

```json
{
  "playerId": "player-main-001",
  "state": "PLAYING",
  "previousState": "LOADED",
  "timestamp": "2025-10-26T21:00:06Z",
  "metadata": {
    "trackId": "track-abc-456",
    "playlistId": "playlist-xyz-123",
    "position": 0,
    "duration": 180,
    "volume": 0.8
  }
}
```

---

## 🎵 **Track Info Updates**

Player publishes track info when playback starts:

```json
{
  "playerId": "player-main-001",
  "trackId": "track-abc-456",
  "title": "Amazing Song",
  "artist": "Cool Artist",
  "album": "Great Album",
  "duration": 180,
  "bpm": 128,
  "key": "Am",
  "genre": "Techno",
  "playlistId": "playlist-xyz-123",
  "position": 0,
  "timestamp": "2025-10-26T21:00:06Z"
}
```

---

## 🚫 **What Player Does NOT Do**

❌ GraphQL queries for playlists  
❌ GraphQL queries for tracks  
❌ Direct database access  
❌ Business logic decisions  
❌ State validation  

**Player is a dumb terminal - all intelligence in State Machine!**

---

## ✅ **What Player DOES Do**

✅ Publish commands via IoT  
✅ Listen for commands via IoT  
✅ Execute commands with provided data  
✅ Publish state updates  
✅ Publish track info  
✅ Handle audio playback  
✅ Manage UI state  

---

## 🔄 **Complete Example Flow**

### **User clicks LOAD → PLAY:**

```
1. User clicks LOAD button
   Player → IoT: { command: "LOAD", playlistId: "..." }

2. State Machine receives command
   - Validates: IDLE → LOADING allowed ✅
   - Queries playlist via GraphQL
   - Gets first track data
   - Prepares complete payload

3. State Machine → IoT: { command: "LOAD", track: {...} }

4. Player receives command
   - Publishes: LOADING state
   - Loads track from payload (no GraphQL!)
   - Publishes: LOADED state

5. User clicks PLAY button
   Player → IoT: { command: "PLAY" }

6. State Machine receives command
   - Validates: LOADED → PLAYING allowed ✅
   - Confirms command

7. State Machine → IoT: { command: "PLAY" }

8. Player receives command
   - Starts audio playback
   - Publishes: PLAYING state
   - Publishes: Track info

9. State Machine receives PLAYING state
   - Updates dashboard
   - Logs event
   - Ready for next command
```

---

## 🎯 **Benefits**

✅ **Scalable:** Player has zero backend dependencies  
✅ **Testable:** Can mock IoT commands easily  
✅ **Flexible:** State Machine can be updated independently  
✅ **Resilient:** Player works offline with cached data  
✅ **Observable:** All actions visible in IoT logs  
✅ **Controllable:** Can control player from anywhere via IoT  

---

## 📝 **Implementation Notes**

### **Player Side (React):**
```typescript
// Publish command
await iotService.publishCommand({
  command: 'LOAD',
  playlistId: currentPlaylistId
})

// Listen for commands
iotService.subscribeToCommands((command) => {
  handleCommand(command)
})

// Handle command
function handleCommand(command) {
  switch(command.command) {
    case 'LOAD':
      executeLoad(command.track)  // Data in payload!
      break
    case 'PLAY':
      executePlay()
      break
    // ...
  }
}
```

### **State Machine Side (Lambda):**
```typescript
// Listen for commands
IoT.subscribe('radio/player/+/command', async (message) => {
  const { command, playerId, playlistId } = message
  
  // Validate state transition
  if (!isValidTransition(currentState, command)) {
    return publishError(playerId, 'Invalid transition')
  }
  
  // Fetch data if needed
  if (command === 'LOAD') {
    const playlist = await getPlaylist(playlistId)
    const track = await getFirstTrack(playlist)
    
    // Send complete data back
    await IoT.publish(`radio/player/${playerId}/command`, {
      command: 'LOAD',
      track: track  // Complete track data!
    })
  }
})
```

---

## 🎉 **Result**

**Pure IoT Player:**
- Zero GraphQL in player code
- All data via IoT payload
- Complete observability
- Easy to test and debug
- Scalable architecture

**State Machine:**
- All business logic
- All data fetching
- State validation
- Command orchestration
