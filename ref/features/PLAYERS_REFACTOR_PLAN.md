# Players.tsx - Full Refactor Plan

## 📊 Current Situation

**File:** `/apps/web/src/pages/devices/Players.tsx`  
**Size:** 2038 lines  
**Problems:**
- Mixed concerns (UI, state, business logic, side effects)
- Hard to test
- Hard to reuse
- Hard to maintain
- 26+ useState hooks in one component
- 15+ useEffect hooks in one component

---

## 🎯 Target Architecture

```
Players.tsx (~200 lines)
├─ Orchestration only
├─ Compose components
└─ Use custom hooks

Components (~800 lines total)
├─ SeekBar/ (~150 lines)
├─ PlayerControls/ (~150 lines)
├─ TrackDisplay/ (~150 lines)
├─ ScheduleInfo/ (~150 lines)
└─ VolumeControl/ (~100 lines)

Hooks (~700 lines total)
├─ useAudioPlayer.ts (~300 lines)
├─ useSchedule.ts (~200 lines)
├─ usePlayerState.ts (~200 lines)
└─ useTrackLoader.ts (~100 lines)

Services (already exist, may need updates)
├─ playerService.ts
├─ scheduleService.ts
└─ playerState.ts
```

**Target:** Players.tsx from **2038 → ~200 lines** ✅

---

## 📋 Refactor Steps

### **Phase 1: Extract UI Components**

#### **Step 1: SeekBar Component** ⏰ 30 min
**Extract:** Lines ~1640-1750  
**Size:** ~150 lines  
**File:** `/components/SeekBar/index.tsx`

**Props:**
```typescript
interface SeekBarProps {
  currentTime: number
  duration: number
  isDragging: boolean
  onSeek: (time: number) => void
  onDragStart: () => void
  onDragEnd: () => void
}
```

**Benefits:**
- Isolated seekbar logic
- Reusable for multiple players
- Easier to test

---

#### **Step 2: PlayerControls Component** ⏰ 45 min
**Extract:** Lines ~1685-1735  
**Size:** ~150 lines  
**File:** `/components/PlayerControls/index.tsx`

**Props:**
```typescript
interface PlayerControlsProps {
  isPlaying: boolean
  isPaused: boolean
  isLoaded: boolean
  volume: number
  autoPlay: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onLoad: () => void
  onUnload: () => void
  onVolumeChange: (volume: number) => void
  onAutoPlayToggle: () => void
}
```

**Buttons:**
- LOAD / UNLOAD
- PLAY / PAUSE / STOP
- Volume slider
- Auto-play toggle

---

#### **Step 3: TrackDisplay Component** ⏰ 30 min
**Extract:** Lines ~1520-1640  
**Size:** ~150 lines  
**File:** `/components/TrackDisplay/index.tsx`

**Props:**
```typescript
interface TrackDisplayProps {
  track: Track | null
  coverArtUrl: string | null
  waveformUrl: string | null
  isPlaying: boolean
}
```

**Shows:**
- Cover art
- Waveform
- Artist / Title
- BPM, Key, Energy
- Duration

---

#### **Step 4: ScheduleInfo Component** ⏰ 30 min
**Extract:** Lines ~1770-1870  
**Size:** ~150 lines  
**File:** `/components/ScheduleInfo/index.tsx`

**Props:**
```typescript
interface ScheduleInfoProps {
  activeSlot: ScheduleSlot | null
  scheduleSlots: ScheduleSlot[]
  currentTrackInfo: CurrentTrackInfo | null
}
```

**Shows:**
- Current time slot
- Scheduled playlist
- Progress indicator
- Next up info

---

### **Phase 2: Extract Custom Hooks**

#### **Step 5: useAudioPlayer Hook** ⏰ 1 hour
**Extract:** Audio control logic  
**Size:** ~300 lines  
**File:** `/hooks/useAudioPlayer.ts`

**Returns:**
```typescript
interface AudioPlayerState {
  // State
  isPlaying: boolean
  isPaused: boolean
  isLoaded: boolean
  currentTime: number
  duration: number
  volume: number
  autoPlay: boolean
  
  // Controls
  play: () => void
  pause: () => void
  stop: () => void
  load: (track: Track) => Promise<void>
  unload: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setAutoPlay: (enabled: boolean) => void
  
  // Refs
  audioRef: RefObject<HTMLAudioElement>
}
```

**Logic Includes:**
- Audio element management
- Play/Pause/Stop
- Loading tracks
- Time updates
- Volume control
- Auto-play handling

---

#### **Step 6: useSchedule Hook** ⏰ 45 min
**Extract:** Schedule loading & calculation  
**Size:** ~200 lines  
**File:** `/hooks/useSchedule.ts`

**Returns:**
```typescript
interface ScheduleState {
  scheduleSlots: ScheduleSlot[]
  activeSlot: ScheduleSlot | null
  currentTrackInfo: CurrentTrackInfo | null
  scheduledTrackId: string | null
  isLoading: boolean
  error: Error | null
  
  reload: () => Promise<void>
}
```

**Logic Includes:**
- Load schedule from DynamoDB
- Calculate active time slot
- Determine current track
- Auto-refresh every minute
- Handle schedule changes

---

#### **Step 7: usePlayerState Hook** ⏰ 45 min
**Extract:** DynamoDB state persistence  
**Size:** ~200 lines  
**File:** `/hooks/usePlayerState.ts`

**Returns:**
```typescript
interface PlayerStatePersistence {
  playerStateId: string | null
  isRestoring: boolean
  backendState: any | null
  
  saveState: (state: PlayerStateData) => Promise<void>
  restoreState: () => Promise<PlayerStateData | null>
  clearState: () => Promise<void>
}
```

**Logic Includes:**
- Save state on unload
- Restore state on load
- 5-minute checkpoints
- Position tracking
- Playlist persistence

---

#### **Step 8: useTrackLoader Hook** ⏰ 30 min
**Extract:** Track asset loading  
**Size:** ~100 lines  
**File:** `/hooks/useTrackLoader.ts`

**Returns:**
```typescript
interface TrackLoader {
  coverArtUrl: string | null
  waveformUrl: string | null
  isLoadingAssets: boolean
  
  loadTrackAssets: (track: Track) => Promise<void>
  clearAssets: () => void
}
```

**Logic Includes:**
- Load cover art from S3
- Load waveform from S3
- Cache URLs
- Handle errors

---

### **Phase 3: Final Cleanup**

#### **Step 9: Refactor Players.tsx** ⏰ 1 hour
**Target:** ~200 lines  
**Role:** Orchestrator only

**Structure:**
```typescript
function Players() {
  // Custom Hooks
  const audioPlayer = useAudioPlayer()
  const schedule = useSchedule()
  const playerState = usePlayerState()
  const trackAssets = useTrackLoader()
  
  // Orchestration Effects
  useEffect(() => {
    // Auto-load from schedule
  }, [schedule.activeSlot])
  
  useEffect(() => {
    // Load track assets when track changes
  }, [audioPlayer.currentTrack])
  
  // Render
  return (
    <Layout>
      <TrackDisplay {...trackDisplayProps} />
      <SeekBar {...seekBarProps} />
      <PlayerControls {...controlProps} />
      <ScheduleInfo {...scheduleProps} />
    </Layout>
  )
}
```

---

#### **Step 10: Documentation** ⏰ 30 min

**Create:**
- `/components/SeekBar/README.md`
- `/components/PlayerControls/README.md`
- `/components/TrackDisplay/README.md`
- `/hooks/README.md`
- Update `/docs/architecture/PLAYER_ARCHITECTURE.md`

---

## 🧪 Testing Strategy

### **Component Tests**
- SeekBar: Click, drag, hover behavior
- PlayerControls: Button clicks, volume change
- TrackDisplay: Display with/without track

### **Hook Tests**
- useAudioPlayer: Play/pause/seek functionality
- useSchedule: Schedule loading & calculations
- usePlayerState: Save/restore state

### **Integration Tests**
- Full player flow: Load → Play → Seek → Stop
- Schedule-driven playback
- State persistence across reloads

---

## 📊 Progress Metrics

| Step | Component/Hook | Lines | Status |
|------|---------------|-------|--------|
| 1 | SeekBar | 150 | ⏳ Pending |
| 2 | PlayerControls | 150 | ⏳ Pending |
| 3 | TrackDisplay | 150 | ⏳ Pending |
| 4 | ScheduleInfo | 150 | ⏳ Pending |
| 5 | useAudioPlayer | 300 | ⏳ Pending |
| 6 | useSchedule | 200 | ⏳ Pending |
| 7 | usePlayerState | 200 | ⏳ Pending |
| 8 | useTrackLoader | 100 | ⏳ Pending |
| 9 | Players.tsx cleanup | -1838 | ⏳ Pending |
| 10 | Documentation | - | ⏳ Pending |
| **TOTAL** | **Reduction** | **~1838 lines** | ⏳ 0% |

**Current:** 2038 lines  
**Target:** 200 lines  
**To Extract:** 1838 lines

---

## 🎯 Benefits

### **Maintainability**
- ✅ Single Responsibility Principle
- ✅ Easy to find code
- ✅ Clear separation of concerns

### **Testability**
- ✅ Components can be tested in isolation
- ✅ Hooks can be tested without UI
- ✅ Mock dependencies easily

### **Reusability**
- ✅ SeekBar → Use in multiple players
- ✅ PlayerControls → Reuse for other audio
- ✅ Hooks → Share logic across features

### **Scalability**
- ✅ Easy to add new features
- ✅ Multi-player support ready
- ✅ Can add features without touching Players.tsx

---

## ⚠️ Risks & Mitigation

### **Risk 1: Breaking Existing Functionality**
**Mitigation:**
- Extract & test one component at a time
- Keep Players.tsx working after each step
- Test thoroughly after each extraction

### **Risk 2: Regression in Audio Playback**
**Mitigation:**
- Manual testing after each hook extraction
- Keep audio logic minimal and focused
- Test edge cases (seek, pause, stop)

### **Risk 3: State Synchronization Issues**
**Mitigation:**
- Careful with state lifting
- Use proper React patterns (controlled components)
- Test state updates thoroughly

---

## 🚀 Execution Order

1. ✅ **Phase 1:** Extract UI components (low risk, immediate benefit)
2. ✅ **Phase 2:** Extract hooks (medium risk, major cleanup)
3. ✅ **Phase 3:** Final cleanup & docs (low risk, polish)

**Estimated Total Time:** 6-8 hours  
**Can be done incrementally:** Yes!  
**Breaking changes:** None (backward compatible)

---

## 📝 Commit Strategy

Each step = 1 commit with:
- Clear commit message
- What was extracted
- Lines reduced
- Tests passing

Example:
```
refactor: Extract SeekBar component from Players.tsx

- Created /components/SeekBar/index.tsx
- Extracted seekbar logic & UI (150 lines)
- Players.tsx: 2038 → 1888 lines (-150)
- Tests: ✅ SeekBar renders correctly
```

---

## ✅ Definition of Done

- [ ] All components extracted
- [ ] All hooks created
- [ ] Players.tsx < 250 lines
- [ ] All tests passing
- [ ] Documentation updated
- [ ] No regression in functionality
- [ ] Code review approved
- [ ] Ready for multi-player feature

---

**LET'S GO! 🚀**
