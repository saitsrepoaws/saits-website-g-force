# Dashboard Components

Herbruikbare components voor DJ/Music library management die gebruikt kunnen worden in dashboards.

## 📦 Beschikbare Components

### 1. **TrackLibrary** - Track Bibliotheek
Complete track management met upload, search, filters en inline player.

📁 Locatie: `/components/TrackLibrary/`  
📖 [Volledige documentatie](./TrackLibrary/README.md)

```tsx
import TrackLibrary from '@/components/TrackLibrary'

<TrackLibrary 
  compact={true}
  maxHeight="400px"
  showUpload={false}
/>
```

### 2. **PlaylistViewer** - Playlist Viewer
Playlist viewing met drag-drop reordering en inline player.

📁 Locatie: `/components/PlaylistViewer/`  
📖 [Volledige documentatie](./PlaylistViewer/README.md)

```tsx
import PlaylistViewer from '@/components/PlaylistViewer'

<PlaylistViewer 
  playlistId="playlist-123"
  compact={true}
  maxHeight="400px"
/>
```

## 🎯 Dashboard Layouts

### DJ Dashboard (Grid 4x2)

```tsx
import TrackLibrary from '@/components/TrackLibrary'
import PlaylistViewer from '@/components/PlaylistViewer'

export default function DJDashboard() {
  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {/* Track Library - Large */}
      <div className="col-span-2 row-span-2">
        <h2 className="text-xl font-bold mb-4">Track Library</h2>
        <TrackLibrary 
          compact={false}
          maxHeight="800px"
          showUpload={true}
        />
      </div>
      
      {/* Current Set */}
      <div className="col-span-2">
        <h2 className="text-xl font-bold mb-4">Current Set</h2>
        <PlaylistViewer 
          playlistId="current-set"
          showHeader={false}
          maxHeight="380px"
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
          maxHeight="380px"
        />
      </div>
      
      {/* Recently Added */}
      <div className="col-span-1">
        <h2 className="text-xl font-bold mb-4">Recent</h2>
        <TrackLibrary 
          compact={true}
          showUpload={false}
          showFilters={false}
          maxHeight="380px"
        />
      </div>
    </div>
  )
}
```

### Radio Dashboard (3 Columns)

```tsx
export default function RadioDashboard() {
  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {/* Block 1 */}
      <div>
        <h3 className="font-bold mb-2">Block 1 (12:00-13:00)</h3>
        <PlaylistViewer 
          playlistId="block-1"
          compact={true}
          maxHeight="400px"
        />
      </div>
      
      {/* Block 2 */}
      <div>
        <h3 className="font-bold mb-2">Block 2 (13:00-14:00)</h3>
        <PlaylistViewer 
          playlistId="block-2"
          compact={true}
          maxHeight="400px"
        />
      </div>
      
      {/* Block 3 */}
      <div>
        <h3 className="font-bold mb-2">Block 3 (14:00-15:00)</h3>
        <PlaylistViewer 
          playlistId="block-3"
          compact={true}
          maxHeight="400px"
        />
      </div>
    </div>
  )
}
```

### Compact Dashboard (2x2 Widget Grid)

```tsx
export default function CompactDashboard() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 max-w-6xl mx-auto">
      {/* My Tracks */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-bold mb-3">My Tracks</h3>
        <TrackLibrary 
          compact={true}
          showUpload={false}
          showFilters={false}
          maxHeight="300px"
          containerClassName=""
        />
      </div>
      
      {/* Tonight's Set */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-bold mb-3">Tonight's Set</h3>
        <PlaylistViewer 
          playlistId="tonight"
          compact={true}
          showHeader={false}
          maxHeight="300px"
        />
      </div>
      
      {/* Techno */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-bold mb-3">Techno</h3>
        <TrackLibrary 
          compact={true}
          initialGenre="Techno"
          showUpload={false}
          showFilters={false}
          maxHeight="300px"
        />
      </div>
      
      {/* Warm-up Set */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-bold mb-3">Warm-up</h3>
        <PlaylistViewer 
          playlistId="warmup"
          compact={true}
          showHeader={false}
          allowReorder={false}
          maxHeight="300px"
        />
      </div>
    </div>
  )
}
```

### Full-Width Dashboard

```tsx
export default function FullWidthDashboard() {
  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Main Library */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Track Library</h2>
        <TrackLibrary maxHeight="500px" />
      </div>
      
      {/* Playlists */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <PlaylistViewer 
            playlistId="favorites"
            maxHeight="400px"
          />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <PlaylistViewer 
            playlistId="new-releases"
            maxHeight="400px"
          />
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <PlaylistViewer 
            playlistId="classics"
            maxHeight="400px"
          />
        </div>
      </div>
    </div>
  )
}
```

## 🎨 Component Vergelijking

| Feature | TrackLibrary | PlaylistViewer |
|---------|-------------|----------------|
| **Upload** | ✅ Yes | ❌ No |
| **Search** | ✅ Yes | ❌ No |
| **Filters** | ✅ Genre, Label | ❌ No |
| **Drag-Drop** | ❌ No | ✅ Yes |
| **Reorder** | ❌ No | ✅ Yes |
| **Delete** | ✅ Track deletion | ✅ Remove from playlist |
| **Audio Player** | ✅ Inline | ✅ Inline |
| **Compact Mode** | ✅ Yes | ✅ Yes |
| **Cover Art** | ✅ Yes | ✅ Yes |

## 🎯 Wanneer Welk Component?

### Gebruik **TrackLibrary** voor:
- ✅ Volledige track bibliotheek management
- ✅ Upload nieuwe tracks
- ✅ Zoeken door alle tracks
- ✅ Filteren op genre/label
- ✅ Track metadata bekijken
- ✅ Tracks permanent verwijderen

### Gebruik **PlaylistViewer** voor:
- ✅ Specifieke playlist bekijken
- ✅ Tracks herschikken (drag-drop)
- ✅ Set planning
- ✅ Playlist editing
- ✅ Show/broadcast planning
- ✅ Tracks uit playlist verwijderen (niet permanent)

## 🔧 Props Overzicht

### Gemeenschappelijke Props

Beide components ondersteunen:

```typescript
// Display
compact?: boolean
maxHeight?: string
className?: string
containerClassName?: string

// Features
allowPlay?: boolean

// Callbacks
onTrackSelect?: (track) => void
```

### TrackLibrary Specifiek

```typescript
showUpload?: boolean
showFilters?: boolean
showSearch?: boolean
initialGenre?: string
initialLabel?: string
allowDelete?: boolean
showTrackInfo?: boolean
```

### PlaylistViewer Specifiek

```typescript
playlistId: string        // Required!
showHeader?: boolean
showDragHandle?: boolean
showDelete?: boolean
allowReorder?: boolean
allowRemove?: boolean
onPlaylistUpdate?: (playlist) => void
```

## 📱 Responsive Design

Beide components zijn responsive:

```tsx
// Desktop (3 columns)
<div className="hidden lg:grid lg:grid-cols-3 gap-4">
  <TrackLibrary compact={true} />
  <PlaylistViewer playlistId="1" compact={true} />
  <PlaylistViewer playlistId="2" compact={true} />
</div>

// Mobile (1 column)
<div className="lg:hidden space-y-4">
  <TrackLibrary compact={true} maxHeight="300px" />
  <PlaylistViewer playlistId="1" compact={true} maxHeight="300px" />
</div>
```

## 🚀 Performance Tips

1. **Gebruik `compact={true}`** in dashboards voor betere performance
2. **Stel `maxHeight`** in om scrolling te forceren
3. **Disable features** die je niet nodig hebt:
   ```tsx
   <TrackLibrary 
     showUpload={false}  // Geen upload section
     showFilters={false} // Geen filter dropdowns
   />
   ```
4. **Gebruik callbacks** voor custom logic ipv default behavior

## 📊 State Management

Components managen hun eigen state intern:
- ✅ Track/playlist data
- ✅ Audio player state
- ✅ Upload queue
- ✅ Cover art URLs
- ✅ Filters & search

Externe state management niet nodig!

## 🎵 Audio Player

Beide components hebben dezelfde inline audio player:
- Timeline scrubber (clickable)
- Play/pause/stop controls
- BPM & Key display
- Real-time progress
- Smooth animations

## 📝 Notes

- Components zijn volledig standalone
- Geen externe state management nodig
- Legacy S3 URL support included
- Cover art caching built-in
- Responsive & mobile-friendly
- TailwindCSS styling
- TypeScript typed props

## 🔗 Links

- [TrackLibrary Docs](./TrackLibrary/README.md)
- [PlaylistViewer Docs](./PlaylistViewer/README.md)
