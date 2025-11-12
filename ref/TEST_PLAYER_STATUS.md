# 🧪 Player Status Test & Debug

## ✅ STATUS NU
- **IoT:** Connected ✓
- **Subscription:** Active ✓
- **Track Info:** Leeg ❌

## 🔍 DIAGNOSE STAPPEN

### Stap 1: Check Console Logs

Open browser console (F12) en zoek naar:

```
📤 [player-001] Sent registration & status request
📤 [player-002] Sent registration & status request
```

**Als JA:** Frontend vraagt status aan ✓
**Als NEE:** Subscription werkt niet ❌

---

### Stap 2: Check voor Status Messages

Zoek in console naar:

```
📊 [player-001] STATUS UPDATE
📊 [player-002] STATUS UPDATE
```

**Als JA:** Backend reageert ✓
**Als NEE:** Backend stuurt geen response ❌

---

### Stap 3: Simuleer Status Message

**Plak dit in console om te testen of de UI werkt:**

```javascript
// Simuleer een status update voor Player 1
const testStatus = {
  status: 'playing',
  currentTrack: {
    id: 'test-123',
    title: 'Test Track',
    artist: 'Test Artist',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    coverArtUrl: 'https://via.placeholder.com/400',
    waveformUrl: '',
    duration: 180,
    bpm: 128,
    key: 'Am',
    genre: 'Test',
    year: 2024
  },
  position: 30,
  duration: 180
}

// Trigger handleStatusUpdate (simulate IoT message)
console.log('🧪 Simulating status update...')
window.postMessage({ 
  type: 'TEST_PLAYER_STATUS',
  playerId: 'player-001',
  data: testStatus
}, '*')
```

---

## 🎯 MOGELIJKE OORZAKEN

### A. Backend Stuurt Geen Status
**Symptoom:** Alleen registration logs, geen status logs

**Check backend voor:**
```python
# Backend moet luisteren naar:
topic: radio/player/player-001/register

# En reageren met:
topic: radio/player/player-001/status
payload: {
  "status": "playing",
  "currentTrack": { ... }
}
```

---

### B. Topic Mismatch
**Frontend verwacht:**
```
radio/player/player-001/status
radio/player/player-002/status
```

**Backend stuurt misschien:**
```
player/player-001/status  (verkeerd - mist "radio/")
radio/players/player-001/status  (verkeerd - "players" ipv "player")
```

---

### C. Backend Heeft Geen Track Loaded
**Symptoom:** Backend reageert met status maar zonder currentTrack

**Backend response:**
```json
{
  "status": "idle",
  "currentTrack": null
}
```

Dit is CORRECT als er geen track speelt!

---

## 🔧 OPLOSSINGEN

### Als Backend Niet Reageert

**Backend moet implementeren:**

```python
@mqtt_client.on_message('radio/player/+/register')
def handle_player_registration(topic, payload):
    player_id = extract_player_id(topic)  # player-001 of player-002
    
    # Get current player state
    player_state = get_player_state(player_id)
    
    # Send status response
    mqtt_client.publish(
        f'radio/player/{player_id}/status',
        {
            'status': player_state.status,  # 'idle', 'playing', 'paused'
            'currentTrack': player_state.current_track,
            'position': player_state.position,
            'duration': player_state.duration,
            'timestamp': datetime.now().isoformat()
        }
    )
```

---

### Als Topics Niet Kloppen

**Check backend topic names:**
```python
# CORRECT:
'radio/player/player-001/status'
'radio/player/player-002/status'

# FOUT:
'player/player-001/status'  # mist "radio/"
'radio/players/player-001/status'  # "players" ipv "player"
```

---

### Als Backend Idle Is

Dit is NORMAAL als er geen track speelt!

**Om te testen, load een track via backend:**
```python
# Backend command om track te laden
mqtt_client.publish('radio/player/player-001/command', {
    'command': 'LOAD',
    'params': {
        'track': {
            'id': 'track-123',
            'title': 'Song Title',
            'artist': 'Artist Name',
            'fileUrl': 'public/audio/song.mp3',
            'coverArtUrl': 'public/covers/cover.jpg',
            'duration': 300
        }
    }
})
```

---

## 📊 EXPECTED MESSAGE FLOW

```
Frontend Startup:
  ↓
Subscribes to:
  - radio/player/player-001/command
  - radio/player/player-001/status
  ↓
Sends registration:
  topic: radio/player/player-001/register
  payload: { playerId: 'player-001', action: 'register', requestStatus: true }
  ↓
Backend receives registration
  ↓
Backend sends status:
  topic: radio/player/player-001/status
  payload: { status: 'playing', currentTrack: {...} }
  ↓
Frontend receives status
  ↓
Frontend updates UI:
  - Cover art
  - Track title/artist
  - Playback status
  - Progress bar
```

---

## 🧪 MANUAL TEST

**Test of frontend IoT werkt:**

```javascript
// In browser console:

// 1. Check IoT connection
console.log('IoT connection:', window.iotContext?.connectionState)
// Expected: "Connected"

// 2. Manually publish to backend
window.iotContext?.publish('test/frontend', { message: 'Hello from frontend!' })

// 3. Check subscriptions
console.log('Check console for subscription logs')
```

---

## ✅ SUCCESS CRITERIA

When working, you should see:

1. **Console logs:**
   ```
   📡 [player-001] Subscribing to command and status topics...
   ✅ [player-001] Subscribed to commands
   ✅ [player-001] Subscribed to status
   📤 [player-001] Sent registration & status request
   📊 [player-001] STATUS UPDATE: { status: 'playing', ... }
   🎵 [player-001] Current track: Artist - Title
   ✅ [player-001] Track info updated from status
   ```

2. **Player Card UI:**
   - Cover art visible
   - Track title & artist shown
   - Status: "Playing" (not "Idle")
   - Progress bar active

3. **IoT indicators:**
   - IoT: Green dot (connected)
   - Sub: Green dot (subscribed)

---

## 📋 ACTIE VOOR JOU

**Plak deze console output:**

1. Filter console op "player-001" of "player-002"
2. Copy alle logs
3. Stuur naar mij

**Of run backend check:**
- Kijk in backend logs naar "registration" messages
- Check of backend "status" responses stuurt
