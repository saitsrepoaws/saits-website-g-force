# 🧱 BLOK Testing Strategy

**Bouw Logische Ontwikkel Klassen - Smart Test Execution**

---

## 🎯 Concept

BLOK strategy is een **modulaire test aanpak** waarbij we de codebase opdelen in logische bouwblokken (BLOKs). Elke BLOK heeft:

- **Eigen verantwoordelijkheid** (separation of concerns)
- **Eigen test suite** (geïsoleerde tests)
- **Eigen deployment flow** (kan apart deployen)

**Voordeel:** Als je alleen BLOK PLAY wijzigt, hoef je niet ALLE tests te draaien. Alleen BLOK PLAY tests! ⚡

---

## 📦 De 6 BLOKs

### 🎮 BLOK PLAY - Player Frontend

**Verantwoordelijkheid:**
- Radio player UI/UX
- Audio playback controls
- Metadata display (now playing)
- User interactions

**Paths:**
```
apps/web/src/components/Player/
apps/web/src/hooks/useAudioPlayer.ts
tests/smoke/player.smoke.test.ts
tests/regression/player.regression.test.ts
```

**Tests:**
- Smoke tests: Basis functionaliteit (play, pause, volume)
- Regression tests: Bug fixes blijven fixed
- E2E tests: Volledige player flow

**Tech Stack:**
- React, TypeScript
- Howler.js (audio playback)
- Vitest + Testing Library

---

### 📚 BLOK LIBERY - Track Library

**Verantwoordelijkheid:**
- Track metadata extraction
- Audio file analysis
- Waveform generation
- Cover art processing
- S3 storage management

**Paths:**
```
amplify/data/resource.ts (Track model)
amplify/storage/resource.ts
amplify/functions/audio-metadata/
amplify/functions/waveform-generator/
```

**Tests:**
- Unit tests: Metadata extraction logic
- Integration tests: S3 upload → metadata extraction flow
- Performance tests: Large file handling

**Tech Stack:**
- AWS Lambda (Node.js)
- music-metadata library
- FFmpeg (waveform generation)
- DynamoDB (metadata storage)

---

### 📋 BLOK PLAYLIST - Playlist Management

**Verantwoordelijkheid:**
- Playlist creation & editing
- Genre-based playlist generation
- Track selection algorithms
- Playlist optimization

**Paths:**
```
amplify/functions/playlist-generator/
amplify/functions/genre-merger/
amplify/data/resource.ts (Playlist model)
```

**Tests:**
- Unit tests: Playlist algorithms
- Integration tests: Generate → save → retrieve flow
- Edge cases: Empty playlists, duplicate tracks

**Tech Stack:**
- AWS Lambda (TypeScript)
- DynamoDB (playlist storage)
- SQS (async processing)

---

### 📅 BLOK PLANNER - Scheduler

**Verantwoordelijkheid:**
- Schedule management (day/time based)
- Automated playlist switching
- EventBridge triggers
- Queue management

**Paths:**
```
amplify/functions/stream-playlist-updater/
amplify/functions/radio-scheduler/
amplify/functions/track-queue-manager/
```

**Tests:**
- Unit tests: Schedule logic
- Integration tests: EventBridge → Lambda flow
- Time-based tests: Timezone handling

**Tech Stack:**
- AWS Lambda (TypeScript)
- EventBridge (scheduling)
- SQS FIFO (track queue)

---

### 🖥️ BLOK EC2 - Stream Server

**Verantwoordelijkheid:**
- Icecast server configuration
- Liquidsoap scripting
- Nginx reverse proxy
- CloudFront integration
- System monitoring

**Paths:**
```
scripts/ec2-setup.sh
ec2-monitoring/
amplify/backend.ts (EC2 construct)
```

**Tests:**
- Smoke tests: Server reachability
- Integration tests: Stream URL accessibility
- Load tests: Concurrent listener handling
- Config validation: Liquidsoap syntax check

**Tech Stack:**
- EC2 (Ubuntu)
- Icecast2
- Liquidsoap
- Nginx
- CloudFront

---

### 📡 BLOK STREAMING - Audio Processing

**Verantwoordelijkheid:**
- Audio format conversion
- Crossfade processing
- Normalization & loudness
- Real-time stream encoding

**Paths:**
```
amplify/functions/crossfade/
amplify/functions/audio-analyzer/
scripts/liquidsoap/
```

**Tests:**
- Unit tests: Audio processing logic
- Integration tests: File → process → output flow
- Quality tests: Audio quality validation (no distortion)

**Tech Stack:**
- AWS Lambda (Node.js + FFmpeg)
- Liquidsoap (stream processing)
- Docker (FFmpeg layer)

---

## 🔍 Change Detection Algorithm

### How It Works

```bash
# 1. Get changed files since last commit
CHANGED_FILES=$(git diff --name-only HEAD^ HEAD)

# 2. Check each BLOK's paths
if echo "$CHANGED_FILES" | grep -q "apps/web/"; then
  BLOK_PLAY_CHANGED=true
fi

# 3. Run tests only for affected BLOKs
if [ "$BLOK_PLAY_CHANGED" = true ]; then
  npm test -- tests/smoke/player
  npm test -- tests/regression/player
fi
```

### Example Scenarios

**Scenario 1: Fix player bug**
```
Changed files: apps/web/src/components/Player/PlayButton.tsx
Affected BLOKs: BLOK PLAY
Tests run: player.smoke.test.ts, player.regression.test.ts
Duration: 30 seconds ⚡
```

**Scenario 2: Update metadata extraction**
```
Changed files: amplify/functions/audio-metadata/handler.ts
Affected BLOKs: BLOK LIBERY
Tests run: audio-metadata.test.ts, s3-integration.test.ts
Duration: 2 minutes
```

**Scenario 3: Major refactor**
```
Changed files: amplify/backend.ts, apps/web/src/*, multiple
Affected BLOKs: ALL
Tests run: Full test suite
Duration: 10 minutes (maar nodig!)
```

---

## 📊 Test Execution Flow

```
┌─────────────────────────────────────┐
│   Git Push to main                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Pipeline Triggered                │
│   (CodePipeline / Amplify)          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Change Detection                  │
│   - Git diff analysis               │
│   - Identify affected BLOKs         │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         │           │
    ┌────▼────┐ ┌───▼────┐
    │ BLOK 1  │ │ BLOK 2 │  ... (parallel)
    │ Tests   │ │ Tests  │
    └────┬────┘ └───┬────┘
         │           │
         └─────┬─────┘
               │
┌──────────────▼──────────────────────┐
│   All Tests Passed?                 │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         │ YES       │ NO
    ┌────▼────┐ ┌───▼────┐
    │ Deploy  │ │ Fail   │
    │         │ │ Build  │
    └─────────┘ └────────┘
```

---

## 🚀 Performance Benefits

### Before BLOK Strategy (All Tests Always)

```
Total tests: 150+
Duration: 12 minutes
Cost: $0.06 per build (12 min × $0.005/min)
Builds per day: 20
Daily cost: $1.20
Monthly cost: ~$36
```

### After BLOK Strategy (Smart Selection)

```
Average affected BLOKs: 1-2
Average tests: 20-40
Average duration: 2-3 minutes
Cost: $0.01-0.015 per build
Builds per day: 20
Daily cost: $0.20-0.30
Monthly cost: ~$6-9

Savings: 75% faster, 75% cheaper! 🎉
```

---

## 🧪 Test Types per BLOK

### Level 1: Unit Tests
- Fast (< 1s per test)
- Isolated (no dependencies)
- Mock external services
- Run on every change

### Level 2: Integration Tests
- Medium speed (1-5s per test)
- Test interactions between components
- Use test databases
- Run on affected BLOKs

### Level 3: E2E Tests
- Slow (10-30s per test)
- Test complete user flows
- Real browser, real backend
- Run on BLOK PLAY changes only

### Level 4: Smoke Tests
- Fast (< 5s total)
- Critical path validation
- Run after deployment
- Fail = rollback

---

## 📝 Adding a New BLOK

### Step 1: Define BLOK

```bash
# In buildspec.yml, add new BLOK check
if echo "$CHANGED_FILES" | grep -q "new-feature/"; then
  BLOK_NEWFEATURE_CHANGED=true
  echo "✅ BLOK NEWFEATURE: Changes detected"
fi
```

### Step 2: Create Tests

```typescript
// tests/blok-newfeature.test.ts
describe('BLOK NEWFEATURE', () => {
  test('core functionality', () => {
    // Your tests
  });
});
```

### Step 3: Add Test Execution

```bash
# In buildspec.yml
if [ "$BLOK_NEWFEATURE_CHANGED" = true ]; then
  echo "🧪 Testing BLOK NEWFEATURE..."
  npm test -- tests/blok-newfeature
fi
```

### Step 4: Document

Update this file with new BLOK details!

---

## 🎯 Best Practices

### ✅ DO:
- Keep BLOKs independent (loose coupling)
- Write tests for your BLOK
- Update change detection when adding files
- Document BLOK responsibilities

### ❌ DON'T:
- Create circular dependencies between BLOKs
- Skip tests (defeats the purpose!)
- Make BLOKs too granular (overhead)
- Ignore failed tests ("it works on my machine")

---

## 🔮 Future Enhancements

- [ ] **Dependency Graph**: Auto-detect BLOK dependencies
- [ ] **Smart Caching**: Cache test results per BLOK
- [ ] **Parallel Execution**: Run BLOKs in parallel (faster!)
- [ ] **Visual Dashboard**: BLOK health monitoring
- [ ] **Auto-rollback**: Failed BLOK = auto rollback
- [ ] **Cost Tracking**: Per-BLOK build cost analysis

---

**Gerard's Vision:** "Smart testing = snellere development = meer features = betere radio!" 🎵🚀
