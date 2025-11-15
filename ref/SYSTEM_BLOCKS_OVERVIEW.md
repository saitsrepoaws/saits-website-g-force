# 🎯 SYSTEM BLOCKS OVERVIEW - G-Forge Radio Platform

**Created:** 15 November 2025, 17:01 CET  
**Purpose:** Complete overview van alle 6 systeem blokken  
**Status:** Planning & Documentation Phase

---

## 📋 Alle 6 Systeem Blokken

De G-Forge radio platform bestaat uit 6 onafhankelijke maar geïntegreerde blokken.  
Elk blok heeft eigen functionaliteit, componenten, en testing procedures.

---

## 1️⃣ BLOK LIBERY - Track Library System ✅

**Purpose:** Upload en beheer van audio tracks met automatische metadata extractie

**Components:**
- Frontend: `apps/web/src/pages/devices/Libery.tsx`
- Lambda: `audio-metadata` (metadata + cover art)
- Lambda: `waveform-generator` (waveform SVG)
- Lambda: `audio-analyzer` (Docker + FFmpeg voor BPM/Key)
- Storage: DynamoDB Track table, S3 audio/covers/waveforms

**Flow:**
```
User uploads MP3 
  → S3 (public/audio/)
  → Trigger audio-metadata Lambda
  → Extract: Artist, Title, BPM, Key, Duration
  → Generate cover art
  → Invoke waveform-generator
  → Invoke audio-analyzer
  → Save to DynamoDB
  → UI auto-refresh
```

**Key Features:**
- Multi-file drag & drop upload
- Automatic metadata extraction (music-metadata)
- BPM detection (music-tempo + Essentia.js)
- Musical key detection
- Cover art extraction & thumbnail generation
- Waveform visualization (SVG)
- Search & filter (genre, label, BPM, key)

**Status:** ✅ Documented in `BLOK_LIBERY_END_TO_END.md`

---

## 2️⃣ BLOK PLAY - Real-time Player 🚧

**Purpose:** Real-time audio player met IoT synchronisatie

**Components:**
- Frontend: Player UI component
- Lambda: `player-iot-publisher` (broadcast now playing)
- Lambda: `player-load-handler` (initialize player state)
- Lambda: `player-simple-handler` (player API)
- IoT Core: Real-time PubSub voor sync
- DynamoDB: PlayerState table

**Flow:**
```
User opens player
  → Load current track info
  → Subscribe to IoT topic
  → Receive real-time updates
  → Sync across all devices
  → Display: Now Playing, Cover Art, Progress
```

**Key Features:**
- Real-time track updates via IoT
- Multi-device synchronization
- Now playing info (title, artist, cover)
- Progress bar
- Volume control
- Play/Pause/Skip (future)
- Listener count (future)

**Topics to Test:**
- Player loads current track
- IoT messages received
- Track changes update UI
- Cover art displays
- Multiple tabs stay synced

**Status:** 🚧 Pending documentation

---

## 3️⃣ BLOK PLAYLIST - Playlist Management 🚧

**Purpose:** Create en beheer playlists met smart generation

**Components:**
- Frontend: Playlist management UI
- Lambda: `playlist-generator` (smart playlist creation)
- Lambda: `track-queue-manager` (track rotation)
- Lambda: `genre-merger` (genre normalization)
- DynamoDB: Playlist table

**Flow:**
```
User creates playlist
  → Set criteria (genre, BPM, key, mood, duration)
  → playlist-generator Lambda
  → Query tracks from DynamoDB
  → Apply filters & sorting
  → Generate track list
  → Save playlist
  → UI displays playlist
```

**Key Features:**
- Manual playlist creation (drag & drop tracks)
- Smart playlist generation
- Genre mix (60% Dance, 30% Pop, 10% Rock)
- BPM range filtering
- Key filtering for harmonic mixing
- Mood/tags filtering
- Duration targets (55-60 min)
- Jingles every N tracks
- Track rotation (prevent repeats)

**Topics to Test:**
- Create manual playlist
- Generate smart playlist
- Genre mix percentages work
- BPM filtering works
- Key filtering works
- Duration target met
- Jingles inserted correctly

**Status:** 🚧 Pending documentation

---

## 4️⃣ BLOK PLANNER - Radio Scheduler 🚧

**Purpose:** Hourly radio station scheduling met automated programming

**Components:**
- Frontend: Scheduler UI (time slots)
- Lambda: `radio-scheduler` (schedule lookup)
- Lambda: `stream-playlist-updater` (queue tracks to SQS)
- EventBridge: Hourly cron trigger (0 * * * ? *)
- SQS: FIFO queue voor track ordering
- DynamoDB: Schedule table

**Flow:**
```
EventBridge triggers (every hour)
  → stream-playlist-updater Lambda
  → Download news bulletin
  → Lookup current schedule (day/hour)
  → Get playlist for time slot
  → Purge SQS queue
  → Queue: News + All tracks (FIFO order)
  → Liquidsoap plays in order
```

**Key Features:**
- Time-based scheduling (hourly slots)
- Day-of-week programming
- Date range scheduling (start/end dates)
- Priority system (overlapping slots)
- News bulletin integration (top of hour)
- Playlist rotation per hour
- Fallback playlist (no schedule)
- CET timezone support

**Topics to Test:**
- Create schedule slot
- Schedule matches current time
- Correct playlist selected
- News downloaded
- SQS queue filled
- Tracks play in order
- Hourly rotation works

**Status:** 🚧 Pending documentation

---

## 5️⃣ BLOK EC2 - Stream Server 🚧

**Purpose:** EC2 streaming infrastructure met Liquidsoap + Icecast

**Components:**
- EC2 Instance: `i-021451e919d39c898` (46.137.184.91)
- Liquidsoap: Audio playout engine
- Icecast: Streaming server
- Nginx: Reverse proxy + web server
- Stereo Tool: Professional audio processing
- Lambda: `stream-monitor` (health checks)
- Lambda: `stream-status-publisher` (status updates)
- SQS: FIFO queue (track source)
- CloudFront: CDN distribution (future)

**Flow:**
```
Liquidsoap fetches track from SQS
  → Download from S3
  → Apply crossfade
  → Send to Stereo Tool (processing)
  → Stream to Icecast
  → Nginx serves stream
  → CloudFront caches (future)
  → Listeners connect
```

**Key Features:**
- Professional audio processing (Stereo Tool)
- Crossfade between tracks
- Dynamic track fetching (SQS)
- Stream health monitoring
- Automatic restart on failure
- Multiple stream formats (MP3, AAC)
- Metadata updates (now playing)
- CloudFront CDN (future)

**Topics to Test:**
- EC2 instance running
- Liquidsoap playing tracks
- Icecast streaming
- Stereo Tool processing
- Stream accessible
- Crossfade working
- SQS queue processing
- Health monitoring active

**Status:** 🚧 Pending documentation

---

## 6️⃣ BLOK STREAMING - Audio Processing 🚧

**Purpose:** Professional audio processing pipeline

**Components:**
- Lambda: `crossfade-controller` (crossfade settings)
- Stereo Tool: Professional processing (on EC2)
- Liquidsoap: Audio engine (on EC2)
- DynamoDB: StreamSettings table
- S3: VPC Endpoint voor progressive download

**Flow:**
```
Track queued
  → Liquidsoap fetches
  → crossfade-controller gets settings
  → Apply fade-in/fade-out
  → Send to Stereo Tool
  → Stereo Tool applies:
     - Normalization
     - EQ
     - Compression
     - Limiting
     - Stereo enhancement
  → Output to Icecast
  → Stream to listeners
```

**Key Features:**
- Smart crossfade (BPM-aware)
- Fade-in/fade-out control
- Professional audio processing
- Loudness normalization
- EQ presets
- Compression
- Limiting (prevent clipping)
- Stereo enhancement
- Progressive download (S3 VPC Endpoint)

**Topics to Test:**
- Crossfade between tracks
- Fade durations correct
- BPM sync works
- Stereo Tool processing
- Loudness consistent
- No clipping
- Progressive download works
- Audio quality good

**Status:** 🚧 Pending documentation

---

## 🔄 Integration Flow

**Complete end-to-end flow:**

```
1. BLOK LIBERY
   User uploads MP3
   ↓
   Metadata extracted, BPM/Key detected
   ↓
   Track saved to DynamoDB

2. BLOK PLAYLIST
   User creates playlist
   ↓
   Smart generation with filters
   ↓
   Playlist saved with track list

3. BLOK PLANNER
   User creates schedule
   ↓
   Playlist assigned to time slot
   ↓
   EventBridge triggers hourly

4. STREAM FLOW
   stream-playlist-updater Lambda
   ↓
   Downloads news, gets playlist
   ↓
   Queues tracks to SQS (FIFO)

5. BLOK EC2
   Liquidsoap fetches from SQS
   ↓
   Downloads track from S3
   ↓
   Applies crossfade

6. BLOK STREAMING
   Stereo Tool processes audio
   ↓
   Icecast streams
   ↓
   Listeners receive

7. BLOK PLAY
   Player displays now playing
   ↓
   IoT updates in real-time
   ↓
   All devices synchronized
```

---

## 🧪 Testing Strategy

### Phase 1: Individual BLOK Testing
Test elk blok apart met mock data:
- ✅ BLOK LIBERY: Upload test MP3
- ⏳ BLOK PLAY: Open player, check updates
- ⏳ BLOK PLAYLIST: Create playlist
- ⏳ BLOK PLANNER: Create schedule
- ⏳ BLOK EC2: Check stream playing
- ⏳ BLOK STREAMING: Test crossfade

### Phase 2: Integration Testing
Test BLOKken samen:
- LIBERY → PLAYLIST: Uploaded tracks in playlist
- PLAYLIST → PLANNER: Playlist in schedule
- PLANNER → EC2: Schedule triggers queue
- EC2 → STREAMING: Queue plays with crossfade
- STREAMING → PLAY: Player shows now playing

### Phase 3: End-to-End Testing
Complete flow van upload tot playback:
1. Upload 5 tracks (LIBERY)
2. Create playlist (PLAYLIST)
3. Schedule playlist (PLANNER)
4. Wait for trigger (PLANNER)
5. Check stream (EC2)
6. Listen to player (PLAY)
7. Verify crossfade (STREAMING)

---

## 📊 Success Criteria

### ✅ System is fully working when:

**BLOK LIBERY:**
- [ ] Upload succeeds
- [ ] Metadata extracted (BPM, Key)
- [ ] Cover art generated
- [ ] Waveform created
- [ ] Track searchable

**BLOK PLAY:**
- [ ] Player loads
- [ ] Current track displays
- [ ] Cover art shows
- [ ] IoT updates received
- [ ] Multi-tab sync works

**BLOK PLAYLIST:**
- [ ] Manual playlist works
- [ ] Smart generation works
- [ ] Filters apply correctly
- [ ] Duration target met
- [ ] Jingles inserted

**BLOK PLANNER:**
- [ ] Schedule created
- [ ] Time slot matches
- [ ] Playlist selected
- [ ] News downloaded
- [ ] Queue filled hourly

**BLOK EC2:**
- [ ] Stream accessible
- [ ] Tracks playing
- [ ] No gaps/silence
- [ ] Metadata updates
- [ ] Health monitor active

**BLOK STREAMING:**
- [ ] Crossfade smooth
- [ ] Loudness consistent
- [ ] No clipping
- [ ] Processing quality good
- [ ] Progressive download works

---

## 🔧 Recovery Priority

**If system is down, fix in this order:**

1. **BLOK EC2** (Critical) - Stream must play
2. **BLOK PLANNER** (High) - Queue must refill
3. **BLOK STREAMING** (High) - Audio quality
4. **BLOK PLAY** (Medium) - User experience
5. **BLOK PLAYLIST** (Medium) - Content management
6. **BLOK LIBERY** (Low) - Can upload later

---

## 📝 Documentation Roadmap

### Completed:
- ✅ BLOK LIBERY (ref/BLOK_LIBERY_END_TO_END.md)
- ✅ System overview (this document)

### Next to Document:
1. BLOK EC2 (most critical)
2. BLOK PLANNER (feeds EC2)
3. BLOK STREAMING (audio quality)
4. BLOK PLAY (user-facing)
5. BLOK PLAYLIST (content creation)

---

## 🎯 Current Focus

**Immediate priority:** Test & document BLOK EC2

Why?
- Stream is down
- Most critical component
- Affects all other blocks
- Needs verification first

**After EC2 working:**
- Test BLOK PLANNER (feeds EC2)
- Test BLOK STREAMING (quality)
- Then user-facing blocks

---

**Last Updated:** 15 November 2025, 17:01 CET  
**Next Steps:** Document BLOK EC2 End-to-End
