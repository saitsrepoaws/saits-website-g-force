# Auto Load Debug Summary

## 🎯 DOEL
Auto Load button → Backend bepaalt track → Frontend laadt track

## ❌ GEVONDEN PROBLEMEN

### 1. ❌ Topic Mismatch (OPGELOST)
**Probleem:**
- Backend stuurt naar: `radio/player/{id}/command` (singular)
- Frontend luisterde naar: `radio/players/{id}/commands` (plural)

**Fix:**
```typescript
// apps/web/src/pages/devices/Players.tsx
- const commandsTopic = `radio/players/${playerId}/commands`
+ const commandsTopic = `radio/player/${playerId}/command`
```

**Commit:** `40820d6 - fix: Correct IoT topic to match backend State Machine`

---

### 2. ❌ State Machine JSONPath Error (OPGELOST)
**Probleem:**
- State Machine zocht: `$.loadResult.Payload.playlistId`
- Lambda returned: `$.loadResult.Payload.playlist.id`

**Fix:**
```json
// amplify/functions/state-machine/definition.asl.json
"params": {
-  "playlistId.$": "$.loadResult.Payload.playlistId",
+  "playlist.$": "$.loadResult.Payload.playlist",
+  "schedule.$": "$.loadResult.Payload.schedule",
+  "currentTrack.$": "$.loadResult.Payload.currentTrack",
   "track.$": "$.loadResult.Payload.track"
}
```

**Commit:** `5388625 - fix: State Machine JSONPath to match Lambda response structure`

---

### 3. ❌ Data.value Parsing Ontbreekt (OPGELOST)
**Probleem:**
- Amplify PubSub returned: `{value: '{"command":"LOAD"...}', provider: '...'}`
- Frontend gebruikte `message` direct zonder `.value` te parsen

**Fix:**
```typescript
// apps/web/src/pages/devices/Players.tsx
(data: any) => {
  // Parse Amplify PubSub format
  let message
  if (typeof data.value === 'string') {
    message = JSON.parse(data.value)
  } else {
    message = data.value || data
  }
  handleIncomingCommand(message)
}
```

**Commit:** `0cb9808 - fix: Parse Amplify PubSub data.value property`

---

### 4. ❌ VITE_ENABLE_PUBSUB=true Ontbrak (OPGELOST)
**Probleem:**
- PubSub was DISABLED in code
- Alle `subscribe()` en `publish()` calls werden geskipped

```typescript
// services/pubsub.ts
export function isEnabled(): boolean {
  return import.meta.env?.VITE_ENABLE_PUBSUB === 'true'
}

if (!isEnabled()) {
  return null  // ❌ Subscribe deed niets!
}
```

**Fix:**
```bash
# apps/web/.env
+ VITE_ENABLE_PUBSUB=true
```

**Commit:** `17099d5 - fix: Enable PubSub in .env`

---

## ✅ BACKEND FLOW (WERKEND)

```
1. IoT Rule luistert: radio/player/+/command-request
   ↓
2. Triggert Lambda: state-machine-trigger ✅
   ↓
3. Lambda start: RadioPlayerStateMachineV2 ✅
   ↓
4. State Machine → HandleLoadCommand ✅
   ↓
5. Lambda player-load-handler:
   - Leest schedule uit DynamoDB ✅
   - Bepaalt current track (🟢 green row) ✅
   - Haalt track data op ✅
   - Returns volledige payload ✅
   ↓
6. State Machine → PublishLoadResponse ✅
   ↓
7. Lambda player-iot-publisher:
   - Publiceert naar: radio/player/{id}/command ✅
   - Payload: {command, params: {track, playlist, schedule}} ✅
```

**Test Resultaat:**
```json
{
  "track": {
    "title": "Dream",
    "artist": "Tony Baltimore",
    "bpm": 137,
    "duration": 386
  },
  "playlist": "TECHNO",
  "currentTrack": {
    "index": 9,
    "progress": 100
  }
}
```

---

## ⚠️ KRITIEK PROBLEEM: DEV SERVER HERSTART

**VITE LAADT .ENV ALLEEN BIJ OPSTARTEN!**

Als de dev server draaide VOOR de .env change, heeft hij de nieuwe `VITE_ENABLE_PUBSUB=true` NIET!

### Check of herstart nodig is:
```bash
# Check wanneer dev server is gestart
ps aux | grep vite

# Als deze draait van VOOR 13:00, moet hij herstarten!
```

### Herstart Dev Server:
```bash
# Optie 1: Handmatig
1. Terminal met dev server: Ctrl+C
2. cd apps/web
3. pnpm dev
4. Wacht op: Local: http://localhost:5173/

# Optie 2: Kill & Restart
pkill -f 'vite'
cd apps/web && pnpm dev
```

### Hard Refresh Browser:
```
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows)
```

---

## 🧪 TEST FLOW

### Test Script:
```bash
./test-complete-iot-flow.sh
```

Dit stuurt een test bericht naar `radio/player/player-001/command`.

### Verwachte Output in Browser Console:
```
[PubSub INFO] Subscribing to topic: radio/player/player-001/command
[PubSub INFO] Subscribed successfully to radio/player/player-001/command
✅ Subscribed to: radio/player/player-001/command

... na test bericht ...

[PubSub INFO] Message received on radio/player/player-001/command
📥 INCOMING raw data: {value: '...', provider: 'AWSIoTProvider'}
📥 PARSED command: {command: 'LOAD', params: {...}}
💿 LOAD COMMAND RECEIVED FROM BACKEND
✅ Track from backend:
   Title: CLI TEST
   Artist: Test Bot
✅ Player state updated with track
```

### Als je dit NIET ziet:
❌ Dev server heeft .env nog niet geladen
❌ Herstart is vereist!

---

## 📊 COMPLETE FRONTEND FLOW (NA FIX)

```
1. User klikt Auto Load ON
   ↓
2. publishState() called
   Topic: radio/player/{id}/state ✅ (was plural!)
   ↓
3. handleAutoLoadToggle() called
   ↓
4. Publish LOAD command
   Topic: radio/player/{id}/command-request ✅
   ↓
5. Backend flow (zie boven) → ~3-4 seconden
   ↓
6. Frontend subscription ontvangt
   Topic: radio/player/{id}/command ✅
   ↓
7. Parse data.value → message ✅ (was missing!)
   ↓
8. handleIncomingCommand(message) ✅
   ↓
9. Switch case: 'LOAD' ✅
   ↓
10. handleLoadCommand(message) ✅
    ↓
11. Update playerState met track ✅
    ↓
12. Player ready to play! 🎉
```

---

## 📝 COMMITS

```bash
git log --oneline -5

17099d5 fix: Enable PubSub in .env
80de881 fix: State topic to singular (radio/player not players)
0cb9808 fix: Parse Amplify PubSub data.value property
5388625 fix: State Machine JSONPath to match Lambda response structure
40820d6 fix: Correct IoT topic to match backend State Machine
```

---

## ✅ CHECKLIST

- [x] .env heeft VITE_ENABLE_PUBSUB=true
- [ ] Dev server herstart NA .env change
- [ ] Browser hard refresh
- [x] Backend flow werkt (tested)
- [x] Topics consistent (singular 'player')
- [x] State Machine JSONPath correct
- [x] Data.value parsing implemented
- [ ] Frontend ontvangt berichten (needs restart!)

---

## 🚀 VOLGENDE STAP

**1. HERSTART DEV SERVER**
**2. REFRESH BROWSER**
**3. RUN: ./test-complete-iot-flow.sh**
**4. CHECK CONSOLE FOR INCOMING MESSAGES**

Als je daarna INCOMING messages ziet → ✅ WERKT!
Als je alleen OUTGOING ziet → ❌ Nog steeds issue
