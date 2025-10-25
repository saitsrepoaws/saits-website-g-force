# PlaylistViewer Component

Herbruikbaar component voor playlist viewing met drag-drop reordering, inline audio player en real-time updates.

## 📦 Import

```typescript
import PlaylistViewer from '@/components/PlaylistViewer'
// or
import { PlaylistViewer } from '@/components/PlaylistViewer'
```

## 🎯 Features

- ✅ Drag & drop track reordering
- ✅ Inline audio player met timeline scrubber
- ✅ Track removal from playlist
- ✅ Cover art display
- ✅ BPM & Key display
- ✅ Compact mode voor dashboards
- ✅ Real-time playback controls
- ✅ Configurable via props

## 📋 Props

```typescript
interface PlaylistViewerProps {
  playlistId: string          // Required: Playlist ID to load
  
  // Display options
  showHeader?: boolean        // Show playlist header (default: true)
  showDragHandle?: boolean    // Show drag handles (default: true)
  showDelete?: boolean        // Show delete buttons (default: true)
  compact?: boolean           // Compact mode (default: false)
  maxHeight?: string          // Max height for scrolling
  
  // Feature toggles
  allowReorder?: boolean      // Allow drag-drop reordering (default: true)
  allowRemove?: boolean       // Allow track removal (default: true)
  allowPlay?: boolean         // Show play button (default: true)
  
  // Callbacks
  onTrackSelect?: (track: PlaylistTrackItem) => void
  onTrackRemove?: (trackId: string) => void
  onPlaylistUpdate?: (playlist: Playlist) => void
  
  // Styling
  className?: string          // Inner container classes
  containerClassName?: string // Outer wrapper classes
}
```

## 📖 Usage Examples

### 1. Full Playlist Detail (Default)

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'
import Layout from '@/components/Layout'

export default function PlaylistPage() {
  const { id } = useParams()
  
  return (
    <Layout>
      <PlaylistViewer playlistId={id} />
    </Layout>
  )
}
```

### 2. Dashboard Widget (Compact)

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'

export default function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <PlaylistViewer
        playlistId="playlist-123"
        compact={true}
        maxHeight="400px"
        showHeader={false}
        showDragHandle={false}
        className="col-span-1"
      />
    </div>
  )
}
```

### 3. Read-Only Preview

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'

export default function PlaylistPreview({ playlistId }) {
  return (
    <PlaylistViewer
      playlistId={playlistId}
      allowReorder={false}
      allowRemove={false}
      showDragHandle={false}
      showDelete={false}
      maxHeight="500px"
    />
  )
}
```

### 4. With Callbacks

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'
import { useState } from 'react'

export default function CustomPlaylist() {
  const [playlist, setPlaylist] = useState(null)
  
  return (
    <PlaylistViewer
      playlistId="playlist-123"
      onPlaylistUpdate={(updated) => {
        console.log('Playlist updated:', updated)
        setPlaylist(updated)
      }}
      onTrackRemove={(trackId) => {
        console.log('Track removed:', trackId)
        // Custom logic
      }}
      onTrackSelect={(track) => {
        console.log('Track selected:', track)
      }}
    />
  )
}
```

### 5. Multiple Playlists Side-by-Side

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'

export default function ComparePlayli

sts() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <PlaylistViewer
        playlistId="playlist-1"
        compact={true}
        maxHeight="600px"
      />
      <PlaylistViewer
        playlistId="playlist-2"
        compact={true}
        maxHeight="600px"
      />
    </div>
  )
}
```

### 6. Embedded in Dashboard

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'

export default function DJDashboard() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Current Set */}
      <div className="col-span-2">
        <h2 className="text-xl font-bold mb-4">Current Set</h2>
        <PlaylistViewer
          playlistId="current-set"
          showHeader={false}
          maxHeight="400px"
        />
      </div>
      
      {/* Next Up */}
      <div className="col-span-1">
        <h2 className="text-xl font-bold mb-4">Next Up</h2>
        <PlaylistViewer
          playlistId="next-up"
          compact={true}
          showHeader={false}
          allowReorder={false}
          showDragHandle={false}
          maxHeight="400px"
        />
      </div>
    </div>
  )
}
```

## 🎨 Layouts

### Compact Mode
```
[⋮⋮ 1] Title | [▶️] [🗑️]
```

### Full Mode (Default)
```
[⋮⋮ 1] [🎵] Title | Artist | Genre | Key | BPM | Duration | [▶️] [🗑️]
```

## 🎛️ Inline Player

When a track is playing, an inline player expands below:

```
┌────────────────────────────────────────────────────┐
│ [⏸️] [⏹️]  Artist - Title        0:42 / 5:14      │
│                                                     │
│ ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○ │
│                                                     │
│                                       140 BPM      │
│                                       D minor      │
└────────────────────────────────────────────────────┘
```

## 🔀 Drag & Drop

Track reordering using `@dnd-kit`:

```tsx
// Enabled by default
<PlaylistViewer playlistId="123" />

// Disabled for read-only
<PlaylistViewer 
  playlistId="123" 
  allowReorder={false}
  showDragHandle={false}
/>
```

Features:
- 8px activation distance (prevents accidental drags)
- Visual feedback (blue background when dragging)
- Persistent order (saves to database)
- Rollback on error

## 🎯 Use Cases

### DJ Setlist Builder
```tsx
<PlaylistViewer
  playlistId="tonight-set"
  showHeader={true}
  allowReorder={true}
  onPlaylistUpdate={(playlist) => {
    console.log('Set updated:', playlist.tracks.length, 'tracks')
  }}
/>
```

### Radio Show Planner
```tsx
<div className="space-y-4">
  <PlaylistViewer playlistId="block-1" maxHeight="300px" />
  <PlaylistViewer playlistId="block-2" maxHeight="300px" />
  <PlaylistViewer playlistId="block-3" maxHeight="300px" />
</div>
```

### Live Dashboard
```tsx
<div className="grid grid-cols-4 gap-2">
  <PlaylistViewer 
    playlistId="now-playing"
    compact={true}
    showHeader={false}
    allowReorder={false}
    className="col-span-1"
  />
  {/* Other dashboard widgets */}
</div>
```

## 🔧 Customization

### Styling

```tsx
<PlaylistViewer
  playlistId="123"
  containerClassName="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-2xl"
  className="shadow-2xl"
/>
```

### Height Control

```tsx
<PlaylistViewer
  playlistId="123"
  maxHeight="600px"  // Scrollable at 600px
/>
```

### Minimal View

```tsx
<PlaylistViewer
  playlistId="123"
  compact={true}
  showHeader={false}
  showDragHandle={false}
  showDelete={false}
  allowReorder={false}
/>
```

## 📊 State Management

Component manages its own state:
- Playlist data
- Track list
- Audio player state
- Drag-drop state
- Cover art URLs

## 🔌 Dependencies

- `aws-amplify/storage` - S3 operations
- `services/playlists` - Playlist CRUD
- `services/tracks` - Track data
- `@dnd-kit/core` - Drag & drop
- `@dnd-kit/sortable` - Sortable items

## 🚀 Performance

- Cover art URLs are cached
- Drag handles use pointer sensors (optimized)
- Audio element is properly cleaned up
- Reorder updates are batched
- Handles legacy S3 URLs automatically

## 📝 Notes

- Component handles legacy S3 URLs automatically
- Drag-drop has 8px activation distance
- Player doesn't interfere with drag-drop
- Compact mode ideal for dashboards (4 columns)
- Full mode shows all metadata (10 columns)
- Real-time updates via subscriptions (if parent implements)

## 🎪 Header Display

When `showHeader={true}`:
```
┌──────────────────────────────────┐
│ Playlist Name                     │
│ Description here...               │
│ 12 tracks                         │
└──────────────────────────────────┘
```

Can be hidden for embedded views:
```tsx
<PlaylistViewer playlistId="123" showHeader={false} />
```
