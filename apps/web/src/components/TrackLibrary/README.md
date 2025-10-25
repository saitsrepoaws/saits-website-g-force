# TrackLibrary Component

Herbruikbaar component voor track library management met upload, search, filters en inline audio player.

## 📦 Import

```typescript
import TrackLibrary from '@/components/TrackLibrary'
// or
import { TrackLibrary } from '@/components/TrackLibrary'
```

## 🎯 Features

- ✅ Multi-file drag & drop upload
- ✅ Real-time search (artist, title, genre, label, version)
- ✅ Genre & Label filters with counts
- ✅ Inline audio player met timeline scrubber
- ✅ Cover art display
- ✅ Track info modal
- ✅ Delete functionaliteit
- ✅ Compact mode voor dashboards
- ✅ Configurable via props

## 📋 Props

```typescript
interface TrackLibraryProps {
  // Display options
  showUpload?: boolean        // Show upload section (default: true)
  showFilters?: boolean       // Show genre/label filters (default: true)
  showSearch?: boolean        // Show search input (default: true)
  compact?: boolean           // Compact mode (default: false)
  maxHeight?: string          // Max height for scrolling (e.g. '600px')
  
  // Initial filters
  initialGenre?: string       // Initial genre filter (default: 'all')
  initialLabel?: string       // Initial label filter (default: 'all')
  initialSearch?: string      // Initial search query (default: '')
  
  // Feature toggles
  allowDelete?: boolean       // Allow track deletion (default: true)
  allowPlay?: boolean         // Show play button (default: true)
  showTrackInfo?: boolean     // Show info button (default: true)
  
  // Callbacks
  onTrackSelect?: (track: Track) => void      // Called when info clicked
  onTrackDelete?: (trackId: string) => void   // Called when delete clicked
  onTrackPlay?: (track: Track) => void        // Called when play clicked
  
  // Styling
  className?: string          // Inner container classes
  containerClassName?: string // Outer wrapper classes
}
```

## 📖 Usage Examples

### 1. Full Page (Default)

```tsx
import TrackLibrary from '@/components/TrackLibrary'
import Layout from '@/components/Layout'

export default function LibraryPage() {
  return (
    <Layout>
      <TrackLibrary />
    </Layout>
  )
}
```

### 2. Dashboard Widget (Compact)

```tsx
import TrackLibrary from '@/components/TrackLibrary'

export default function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <TrackLibrary
        compact={true}
        maxHeight="400px"
        showUpload={false}
        showFilters={false}
        className="col-span-1"
      />
    </div>
  )
}
```

### 3. Read-Only Preview

```tsx
import TrackLibrary from '@/components/TrackLibrary'

export default function TrackPreview() {
  return (
    <TrackLibrary
      showUpload={false}
      allowDelete={false}
      showTrackInfo={false}
      initialGenre="Techno"
      maxHeight="500px"
    />
  )
}
```

### 4. With Callbacks

```tsx
import TrackLibrary from '@/components/TrackLibrary'
import { useState } from 'react'

export default function CustomLibrary() {
  const [selectedTrack, setSelectedTrack] = useState(null)
  
  return (
    <>
      <TrackLibrary
        onTrackSelect={(track) => {
          console.log('Track selected:', track)
          setSelectedTrack(track)
        }}
        onTrackDelete={(trackId) => {
          console.log('Track deleted:', trackId)
          // Custom delete logic
        }}
        onTrackPlay={(track) => {
          console.log('Playing:', track.title)
          // Custom player logic
        }}
      />
      
      {selectedTrack && (
        <div>Selected: {selectedTrack.title}</div>
      )}
    </>
  )
}
```

### 5. Pre-filtered View

```tsx
import TrackLibrary from '@/components/TrackLibrary'

// Show only Techno tracks
export default function TechnoLibrary() {
  return (
    <TrackLibrary
      initialGenre="Techno"
      initialLabel="all"
      showFilters={false}
      containerClassName="max-w-6xl mx-auto"
    />
  )
}
```

## 🎨 Layouts

### Compact Mode
```
[🎵] Artist - Title | [▶️][ℹ️][🗑️]
```

### Full Mode (Default)
```
[🎵] Artist | Title | Genre | Year | Ver | Label | BPM | Duration | Format | [▶️][ℹ️][🗑️]
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
└────────────────────────────────────────────────────┘
```

## 🔧 Customization

### Styling

```tsx
<TrackLibrary
  containerClassName="bg-gray-50 p-4 rounded-xl"
  className="shadow-2xl"
/>
```

### Height Control

```tsx
<TrackLibrary
  maxHeight="600px"  // Scrollable at 600px
/>
```

### Dashboard Grid

```tsx
<div className="grid grid-cols-3 gap-4">
  <TrackLibrary
    compact={true}
    maxHeight="400px"
    showUpload={false}
    className="col-span-2"
  />
  <OtherWidget className="col-span-1" />
</div>
```

## 📊 State Management

Component manages its own state:
- Track list
- Search query
- Filters (genre, label)
- Audio player state
- Upload queue
- Cover art URLs

## 🔌 Dependencies

- `aws-amplify/storage` - S3 operations
- `services/tracks` - Track CRUD
- `services/audioUpload` - File upload
- `services/filenameParser` - Parse metadata from filenames

## 🚀 Performance

- Cover art URLs are cached
- Filters use memoized arrays
- Audio element is properly cleaned up
- Upload queue handles multiple files efficiently

## 📝 Notes

- Component handles legacy S3 URLs automatically
- Upload triggers Lambda processing (6s wait)
- Inline player doesn't interfere with list interaction
- Compact mode ideal for dashboards (2-4 columns per track)
- Full mode shows all metadata (10 columns per track)
