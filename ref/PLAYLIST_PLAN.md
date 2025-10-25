# 🎵 Playlist Feature - Implementation Plan

## 🎯 Doel
Complete playlist management systeem met:
- Meerdere playlists aanmaken
- Tracks toevoegen/verwijderen uit playlists
- Track volgorde bepalen (drag & drop)
- Optioneel: Audio playback met state machine

---

## 📊 Data Model

### 1. Playlist
```typescript
interface Playlist {
  id: string
  name: string
  description?: string
  coverImageUrl?: string
  createdAt: string
  updatedAt: string
  trackCount: number
  totalDuration: number
  
  // Relations
  tracks?: PlaylistTrack[]
}
```

### 2. PlaylistTrack (Join Table)
```typescript
interface PlaylistTrack {
  id: string
  playlistId: string
  trackId: string
  order: number  // 0, 1, 2, 3...
  addedAt: string
  
  // Populated from Track table
  track?: Track
}
```

**Waarom join table?**
- Een track kan in meerdere playlists
- Track order per playlist anders
- Metadata per playlist (bijv. notes)

---

## 🏗️ GraphQL Schema Changes

### amplify/data/resource.ts
```typescript
Playlist: a
  .model({
    name: a.string().required(),
    description: a.string(),
    coverImageUrl: a.string(),
    trackCount: a.integer().default(0),
    totalDuration: a.integer().default(0),
    
    // Relation
    tracks: a.hasMany('PlaylistTrack', 'playlistId'),
  })
  .authorization((allow) => [allow.authenticated()]),

PlaylistTrack: a
  .model({
    playlistId: a.id().required(),
    trackId: a.id().required(),
    order: a.integer().required(),
    
    // Relations
    playlist: a.belongsTo('Playlist', 'playlistId'),
    track: a.belongsTo('Track', 'trackId'),
  })
  .authorization((allow) => [allow.authenticated()]),
```

---

## 🎭 State Machine - DO WE NEED IT?

### Option A: Simple State (Recommended for MVP)
**GEEN state machine, alleen component state:**
```typescript
const [playlists, setPlaylists] = useState<Playlist[]>([])
const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
const [isEditing, setIsEditing] = useState(false)
```

**Pro:**
- ✅ Simpel te implementeren
- ✅ Geen extra dependencies
- ✅ Genoeg voor CRUD + reorder

**Con:**
- ❌ Complex voor audio playback
- ❌ Geen strict state transitions

---

### Option B: State Machine (Voor Audio Playback)
**MET state machine (XState of eigen implementation):**

```typescript
type PlaylistState = 
  | { status: 'idle' }
  | { status: 'loading', playlistId: string }
  | { status: 'loaded', playlist: Playlist }
  | { status: 'playing', currentTrackIndex: number }
  | { status: 'paused', currentTrackIndex: number }
  | { status: 'ended' }

type PlaylistEvent = 
  | { type: 'LOAD_PLAYLIST', playlistId: string }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'NEXT_TRACK' }
  | { type: 'PREV_TRACK' }
  | { type: 'SEEK', trackIndex: number }
  | { type: 'TRACK_ENDED' }
```

**Pro:**
- ✅ Perfect voor audio playback
- ✅ Voorkomt invalid states
- ✅ Makkelijk te testen

**Con:**
- ❌ Extra complexity
- ❌ Overkill zonder playback

---

## 🎯 Aanbeveling: 2-FASE AANPAK

### **FASE 1: Playlist Management (GEEN state machine)**
Focus op CRUD + track management:
- ✅ Create/delete playlists
- ✅ Add/remove tracks
- ✅ Reorder tracks (drag & drop)
- ✅ View playlist details

**State:** Simple React useState

---

### **FASE 2: Audio Playback (MET state machine)**
Alleen als je audio playback wilt:
- ✅ Play/pause/skip
- ✅ Auto-advance to next track
- ✅ Progress bar
- ✅ Volume control

**State:** XState of custom reducer

---

## 📱 UI Components - FASE 1

### 1. Playlist Overview Page (`/devices/playlist`)
```
┌─────────────────────────────────────┐
│ My Playlists        [+ New Playlist]│
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🎵 Techno Night                 │ │
│ │ 15 tracks · 1h 23min            │ │
│ │ Created: 2 days ago             │ │
│ │ [▶️ Play] [✏️ Edit] [🗑️ Delete]  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🎵 Workout Mix                  │ │
│ │ 23 tracks · 2h 5min             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Features:**
- Grid/List view van playlists
- Create new playlist modal
- Delete confirmation
- Stats (track count, duration)

---

### 2. Playlist Detail Page (`/devices/playlist/:id`)
```
┌─────────────────────────────────────────┐
│ 🎵 Techno Night         [🖼️ Cover]      │
│ 15 tracks · 1h 23min                    │
│ Created: 2 days ago                     │
│                                         │
│ [+ Add Tracks] [↕️ Reorder] [▶️ Play All]│
├─────────────────────────────────────────┤
│ #  | [🖼️] Artist - Title        | BPM   │
├─────────────────────────────────────────┤
│ 1  | [🎵] D/n - Resonant Shift  | 128  │
│ 2  | [🎵] Artist - Track 2      | 132  │
│ 3  | [🎵] Artist - Track 3      | 130  │
└─────────────────────────────────────────┘
```

**Features:**
- Track list (ordered)
- Drag & drop reordering
- Add tracks modal (uses Libery component!)
- Remove track button
- BPM/energy/genre display

---

### 3. Add Tracks Modal
```
┌─────────────────────────────────────┐
│ Add Tracks to Playlist         [✕]  │
├─────────────────────────────────────┤
│ 🔍 Search tracks...                 │
│ [Genre: All] [Label: All]           │
├─────────────────────────────────────┤
│ ☐ D/n - Resonant Shift      [+]    │
│ ☐ Artist - Track 2          [+]    │
│ ☑ Artist - Track 3 (already in)    │
├─────────────────────────────────────┤
│          [Cancel] [Add Selected]    │
└─────────────────────────────────────┘
```

**Features:**
- Reuse Track Library component!
- Checkbox selection
- Highlight already-in-playlist tracks
- Bulk add

---

## 🔧 Implementation Steps - FASE 1

### Step 1: GraphQL Schema
```bash
1. Update amplify/data/resource.ts
   - Add Playlist model
   - Add PlaylistTrack model
   - Define relations

2. Deploy schema
   pnpm dlx ampx sandbox

3. Test GraphQL queries
   - createPlaylist
   - listPlaylists
   - createPlaylistTrack
```

---

### Step 2: Services Layer
```typescript
// apps/web/src/services/playlists.ts

export async function listPlaylists()
export async function getPlaylist(id: string)
export async function createPlaylist(input: CreatePlaylistInput)
export async function updatePlaylist(input: UpdatePlaylistInput)
export async function deletePlaylist(id: string)

export async function addTracksToPlaylist(playlistId: string, trackIds: string[])
export async function removeTrackFromPlaylist(playlistTrackId: string)
export async function reorderPlaylistTracks(playlistId: string, newOrder: string[])
```

---

### Step 3: Playlist Overview Page
```typescript
// apps/web/src/pages/devices/Playlist.tsx

function PlaylistOverview() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Load playlists
  // Create playlist
  // Delete playlist
  // Navigate to detail
}
```

---

### Step 4: Playlist Detail Page
```typescript
// apps/web/src/pages/devices/PlaylistDetail.tsx

function PlaylistDetail() {
  const { id } = useParams()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<PlaylistTrack[]>([])
  const [showAddTracks, setShowAddTracks] = useState(false)
  
  // Load playlist + tracks
  // Add tracks
  // Remove track
  // Reorder tracks (drag & drop)
}
```

---

### Step 5: Drag & Drop Reordering
```typescript
// Use @dnd-kit or react-beautiful-dnd

import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

function handleDragEnd(event) {
  const { active, over } = event
  if (active.id !== over.id) {
    // Reorder tracks
    await reorderPlaylistTracks(playlistId, newOrder)
  }
}
```

---

### Step 6: Add Tracks Modal
```typescript
// Reuse TrackLibrary component!

function AddTracksModal({ playlistId, onClose }) {
  const [selectedTracks, setSelectedTracks] = useState<string[]>([])
  
  return (
    <Modal>
      <TrackLibrary 
        showUpload={false}
        showFilters={true}
        compact={true}
        onTrackSelect={(track) => toggleTrackSelection(track.id)}
      />
      <Button onClick={() => addTracksToPlaylist(playlistId, selectedTracks)}>
        Add Selected
      </Button>
    </Modal>
  )
}
```

---

## 📦 Dependencies

### Nieuwe packages (optioneel)
```bash
# Drag & drop
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# State machine (alleen voor FASE 2)
pnpm add xstate @xstate/react
```

---

## 🎵 FASE 2: Audio Playback (Later)

### State Machine
```typescript
import { createMachine } from 'xstate'

const playlistMachine = createMachine({
  id: 'playlist',
  initial: 'idle',
  states: {
    idle: {
      on: { LOAD: 'loading' }
    },
    loading: {
      invoke: {
        src: 'loadPlaylist',
        onDone: { target: 'loaded' },
        onError: { target: 'error' }
      }
    },
    loaded: {
      on: {
        PLAY: 'playing',
      }
    },
    playing: {
      on: {
        PAUSE: 'paused',
        NEXT: { actions: 'nextTrack' },
        PREV: { actions: 'prevTrack' },
        TRACK_ENDED: [
          { target: 'playing', cond: 'hasNextTrack', actions: 'nextTrack' },
          { target: 'ended' }
        ]
      }
    },
    paused: {
      on: { PLAY: 'playing' }
    },
    ended: {
      on: { PLAY: 'playing' }
    },
    error: {}
  }
})
```

### Audio Player Component
```typescript
function AudioPlayer({ playlist, currentTrackIndex }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  
  // Use Web Audio API
  // Handle play/pause/skip
  // Auto-advance on track end
}
```

---

## ✅ MVP Features (FASE 1)

### Must Have
- [x] Create playlist
- [x] Delete playlist
- [x] View playlists
- [x] Add tracks to playlist
- [x] Remove tracks from playlist
- [x] Reorder tracks (drag & drop)
- [x] View playlist details (name, track count, duration)

### Nice to Have
- [ ] Playlist cover image
- [ ] Duplicate playlist
- [ ] Share playlist
- [ ] Import/export M3U
- [ ] Collaborative playlists

---

## ✅ Advanced Features (FASE 2)

### Must Have
- [ ] Audio playback
- [ ] Play/pause/skip
- [ ] Progress bar
- [ ] Auto-advance

### Nice to Have
- [ ] Volume control
- [ ] Shuffle mode
- [ ] Repeat mode
- [ ] Crossfade
- [ ] Queue management
- [ ] Keyboard shortcuts

---

## 🎯 AANBEVELING

### **START MET FASE 1 - GEEN STATE MACHINE**

**Waarom?**
1. ✅ Simpeler te implementeren
2. ✅ Alle core features (CRUD, reorder)
3. ✅ Herbruikbaar (Libery component)
4. ✅ Test & iterate snel

**State machine pas nodig als:**
- Je audio playback wilt
- Je complexe transitions hebt
- Je strict state management wilt

---

## 📝 Next Steps

1. **GraphQL Schema** toevoegen (Playlist + PlaylistTrack)
2. **Services layer** bouwen (playlists.ts)
3. **Playlist Overview** page maken
4. **Playlist Detail** page maken
5. **Add Tracks Modal** (reuse Libery!)
6. **Drag & Drop** implementeren
7. **Test** met echte data

---

## ⏱️ Schatting

- **FASE 1**: 4-6 uur development
  - Schema: 30 min
  - Services: 1 uur
  - Overview page: 1 uur
  - Detail page: 2 uur
  - Drag & drop: 1 uur
  - Polish: 30 min

- **FASE 2** (optioneel): 6-8 uur
  - State machine: 2 uur
  - Audio player: 3 uur
  - Controls: 2 uur
  - Polish: 1 uur

---

## 🚀 Conclusie

**MIJN ADVIES: Start met FASE 1 zonder state machine!**

Dit geeft je:
- ✅ Volledige playlist management
- ✅ Track organizing
- ✅ Herbruikbare componenten
- ✅ Snelle time-to-market

**State machine toevoegen LATER als je audio playback wilt!**

---

**Ready to start?** 🎵
