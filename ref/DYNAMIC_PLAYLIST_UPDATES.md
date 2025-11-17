# 🎯 Dynamic Playlist Updates - Track-Based Triggering

## Overzicht

Het systeem is aangepast van **vaste 5-minuten intervals** naar **dynamische track-based updates**.

### ✨ Nieuwe Functionaliteit

- ✅ **Track-based triggering**: Update playlist N seconden voor track einde
- ✅ **Configureerbaar**: Stel trigger timing in via UI (10-120 sec)
- ✅ **Smart filtering**: Alleen tracks >X seconden triggeren update
- ✅ **Cooldown protection**: Voorkomt duplicate triggers
- ✅ **Settings UI**: Volledig configureerbaar via `/devices/stream-settings`

---

## 🏗️ Architectuur

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ EventBridge (elke minuut)                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Stream Status Publisher Lambda                              │
│ - Fetch Icecast metadata                                    │
│ - Track start time & duration                               │
│ - Calculate remaining seconds                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │ Check Condition │
          │ Remaining <= N? │
          │ Duration > X?   │
          └────────┬────────┘
                   │
        ┌──────────┴──────────┐
        │ YES                 │ NO
        ▼                     ▼
┌──────────────────┐    ┌──────────┐
│ Trigger Lambda   │    │ Continue │
│ Playlist Updater │    └──────────┘
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Stream Playlist Updater Lambda                              │
│ - Read current schedule                                     │
│ - Generate M3U playlist                                     │
│ - Upload to S3                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Liquidsoap (EC2)                                            │
│ - Detects S3 file change                                    │
│ - Reloads playlist                                          │
│ - Prepares next track                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Model

### StreamSettings Table

```typescript
{
  settingKey: 'playlist_update_timing',
  
  // Trigger timing (seconden voor track einde)
  playlistUpdateTriggerSeconds: 60,      // Default: 60s
  
  // Min track duration (skip korte tracks)
  playlistUpdateMinTrackDuration: 60,    // Default: 60s
  
  // Fallback interval (backup check)
  playlistUpdateFallbackInterval: 300,   // Default: 5 min
  
  // Stream server config
  streamServerUrl: 'http://79.125.44.178:8000',
  streamMountPoint: '/stream.mp3'
}
```

### PlayerState Table (Extended)

```typescript
{
  id: 'nonstop',
  playerId: 'nonstop',
  
  // Track info
  currentTrackTitle: string,
  currentTrackArtist: string,
  duration: number,                      // Track duration in seconds
  
  // Timing
  trackStartTime: string,                // ISO timestamp
  
  // Trigger state
  playlistUpdateTriggered: boolean,      // Prevents duplicate triggers
  lastPlaylistUpdateTrigger: string,     // Last trigger timestamp
  
  // Status
  status: 'playing' | 'idle',
  lastActive: string,
  updatedAt: string
}
```

---

## ⚙️ Lambda Functions

### 1. Stream Status Publisher

**Trigger**: EventBridge elke minuut (AWS minimum)

**Functionaliteit**:
1. Fetch Icecast status via `http://79.125.44.178:8000/status-json.xsl`
2. Parse current track metadata
3. Load settings from DynamoDB
4. Check PlayerState:
   - **Track changed**: Reset trigger flag
   - **Same track**: Calculate remaining time
5. **Trigger condition**:
   ```typescript
   if (
     remainingSeconds > 0 &&
     remainingSeconds <= settings.triggerSeconds &&
     trackDuration > settings.minTrackDuration &&
     !playlistUpdateTriggered
   ) {
     triggerPlaylistUpdate()
     markAsTriggered()
   }
   ```
6. Publish status to IoT topics

**Environment Variables**:
```bash
PLAYLIST_BUCKET=radio-playlists-xxx
PLAYER_STATE_TABLE=PlayerState-xxx
SETTINGS_TABLE=StreamSettings-xxx
TRACK_TABLE=Track-xxx
STREAM_PLAYLIST_UPDATER_FUNCTION=streamPlaylistUpdater-xxx
```

**Permissions**:
- DynamoDB: Read/Write `PlayerState`, Read `StreamSettings`, Read `Track`
- S3: Read `PlaylistBucket`
- Lambda: Invoke `StreamPlaylistUpdater`
- IoT: Publish to topics

### 2. Stream Playlist Updater

**Trigger**: 
- Stream Status Publisher (dynamic)
- EventBridge fallback (every 5 min)

**Functionaliteit**:
1. Get current schedule slot (day/time)
2. Load playlist from DynamoDB
3. Load track details
4. Generate M3U file
5. Upload to S3
6. Liquidsoap detects change → reloads

---

## 🎨 UI - Settings Page

**Route**: `/devices/stream-settings`

**Configuratie Opties**:

1. **Trigger Timing** (10-120 sec)
   - Slider met real-time preview
   - Aanbeveling: 60 sec

2. **Min Track Duration** (30-600 sec)
   - Voorkomt triggers voor jingles/intros
   - Default: 60 sec

3. **Fallback Interval** (1-10 min)
   - Backup check interval
   - Default: 5 min

4. **Stream Server Config**
   - URL: `http://79.125.44.178:8000`
   - Mount: `/stream.mp3`

**Features**:
- ✅ Real-time validation
- ✅ Slider controls met visuele feedback
- ✅ Save/Load settings
- ✅ Success/Error messages
- ✅ Info box met uitleg

---

## 🚀 Deployment

### 1. Install Dependencies

```bash
cd amplify/functions/stream-status-publisher
npm install
```

### 2. Deploy Backend

```bash
npx amplify sandbox
# of
npx amplify push
```

### 3. Initialize Settings

Via UI of AWS Console:
1. Ga naar `/devices/stream-settings`
2. Configureer gewenste timings
3. Klik "Opslaan"

Of via AWS Console → DynamoDB → StreamSettings → Create Item:
```json
{
  "settingKey": "playlist_update_timing",
  "playlistUpdateTriggerSeconds": 60,
  "playlistUpdateMinTrackDuration": 60,
  "playlistUpdateFallbackInterval": 300,
  "streamServerUrl": "http://79.125.44.178:8000",
  "streamMountPoint": "/stream.mp3"
}
```

---

## 📝 Voorbeeld Scenario

### Track: 7 minuten (420 sec)

**Met settings**: `triggerSeconds: 60`, `minTrackDuration: 60`

```
Track speelt af (7 min track)
  ↓
Status checker elke minuut
  ↓
05:00 - Track tijd: 300s elapsed, 120s remaining
  → 120s > 60s → Nog niet triggeren
  ↓
06:00 - Track tijd: 360s elapsed, 60s remaining
  ✅ TRIGGER PLAYLIST UPDATE!
  ↓
Playlist updater Lambda → Nieuwe M3U naar S3
  ↓
Liquidsoap detecteert → Laadt nieuwe playlist
  ↓
07:00 - Track eindigt → Smooth overgang! 🎵
  
Note: Checks happen elke minuut, dus max 60s variance in timing.
Voor tracks >2 min is dit ruim voldoende voor smooth transitions.
```

### Track: 30 seconden (korte jingle)

**Skip**: Track duration (30s) < minTrackDuration (60s)
→ **Geen trigger**, voorkomt onnodige updates

---

## 🔍 Monitoring

### CloudWatch Logs

**Stream Status Publisher**:
```
⚙️ Settings: trigger=60s, minDuration=60s
⏱️ Track timing: elapsed=350s, remaining=70s, duration=420s
🎯 Trigger condition met: 60s remaining (trigger at 60s)
🔄 Triggering playlist updater Lambda...
✅ Playlist updater triggered
```

**Stream Playlist Updater**:
```
🎵 Stream Playlist Updater started
📅 Current: Saturday 17:30 (dayOfWeek=6)
✅ Active slot: 17:00-19:00, Playlist: peak-time-techno
📋 Playlist has 45 tracks
✅ Loaded 45 tracks
📝 M3U playlist generated
✅ Playlist uploaded to S3
```

### IoT Messages

**Topic**: `radio/stream/status`

```json
{
  "timestamp": "2025-11-09T17:30:00Z",
  "playerId": "nonstop",
  "isLive": true,
  "currentTrack": {
    "artist": "Artist Name",
    "title": "Track Title"
  },
  "listeners": 5,
  "playlist": {
    "current": "Artist - Track",
    "queue": ["Next 1", "Next 2", ...],
    "total": 45
  },
  "trackChanged": false,
  "playlistUpdateTriggered": true
}
```

---

## 🎯 Best Practices

### Aanbevolen Settings

**Voor lange tracks (5-10 min)**:
- `triggerSeconds`: 60-90s
- `minTrackDuration`: 60s

**Voor korte tracks (3-5 min)**:
- `triggerSeconds`: 45-60s
- `minTrackDuration`: 60s

**Voor mixed playlists (met jingles)**:
- `triggerSeconds`: 60s
- `minTrackDuration`: 90s (skip jingles <1.5 min)

### Performance Tips

1. **Status check interval**: 1 minuut (AWS EventBridge minimum)
   - EventBridge ondersteunt geen intervals <1 minuut
   - Voor real-time updates zou je AWS IoT Core kunnen gebruiken

2. **Trigger timing**: 
   - Te kort (<30s): Risico op late update
   - Te lang (>120s): Minder dynamisch
   - Sweet spot: 60s

3. **Min track duration**:
   - Voorkomt onnodige updates bij korte content
   - Bespaar Lambda invocaties

---

## 🐛 Troubleshooting

### Playlist wordt niet bijgewerkt

**Check**:
1. Settings correct opgeslagen?
   ```bash
   aws dynamodb get-item \
     --table-name StreamSettings-xxx \
     --key '{"settingKey":{"S":"playlist_update_timing"}}'
   ```

2. Track duration bekend in PlayerState?
   ```bash
   aws dynamodb get-item \
     --table-name PlayerState-xxx \
     --key '{"id":{"S":"nonstop"}}'
   ```

3. CloudWatch logs:
   ```bash
   aws logs tail /aws/lambda/streamStatusPublisher-xxx --follow
   ```

### Te veel triggers

**Oplossing**: Verhoog `triggerSeconds` of `minTrackDuration`

### Te weinig triggers

**Oplossing**: Verlaag `triggerSeconds`, check `minTrackDuration`

---

## 📚 Referenties

**Code Files**:
- Lambda: `amplify/functions/stream-status-publisher/handler.ts`
- Schema: `amplify/data/resource.ts`
- UI: `apps/web/src/pages/devices/StreamSettings.tsx`
- Backend: `amplify/backend.ts`

**AWS Resources**:
- EventBridge Rule: `StreamStatusEveryMinute`
- Lambda Functions: 
  - `streamStatusPublisher-xxx`
  - `streamPlaylistUpdater-xxx`
- DynamoDB Tables:
  - `StreamSettings-xxx`
  - `PlayerState-xxx`
- S3 Bucket: `radio-playlists-xxx`

---

✅ **READY TO USE!** 🎙️

Het systeem is nu volledig dynamisch en interactief configureerbaar!
