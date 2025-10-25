# Libery Track Library - Herbruikbaar Component

## 📍 Locatie
`/apps/web/src/pages/devices/Libery.tsx`

## 🎯 Functionaliteit
Complete track library management met volledige automation!

### ✅ Features
- **Upload**: Multi-file drag & drop met progress
- **Search**: Real-time zoeken over alle velden
- **Filters**: Genre en Label dropdowns (met counts)
- **Track List**: 12-column grid met cover art thumbnails
- **Track Modal**: Alle metadata + waveform + audio features
- **Auto-processing**: Lambda 1 → Lambda 3 chain (6 sec)

---

## 📊 Component Structuur

### State Management
```typescript
// Tracks
const [tracks, setTracks] = useState<Track[]>([])
const [isLoadingTracks, setIsLoadingTracks] = useState(false)

// Upload
const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([])
const [isUploading, setIsUploading] = useState(false)
const [isProcessing, setIsProcessing] = useState(false)

// Search & Filter
const [searchQuery, setSearchQuery] = useState('')
const [genreFilter, setGenreFilter] = useState<string>('all')
const [labelFilter, setLabelFilter] = useState<string>('all')

// Modal
const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
const [showTrackInfo, setShowTrackInfo] = useState(false)
const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
const [coverArtUrls, setCoverArtUrls] = useState<Record<string, string>>({})
```

---

## 🎨 UI Layout

### Track List Grid (12 columns)
```
[🖼️] | Artist | Title | Genre | Year | Ver | Label | [⚙️]
  1   |   2   |   2   |   2   |  1   |  1  |   2   |  1
```

### Secties
1. **Upload Section** (collapsible)
2. **Search & Filter Bar** (gray background)
3. **Track List** (grid rows)
4. **Track Info Modal** (overlay)

---

## 🔄 Herbruikbaar Maken

### Optie 1: Page Component (huidige setup)
```typescript
// Al werkend in: /devices/libery
import Libery from '@/pages/devices/Libery'
```

### Optie 2: Embedded Component
Extract naar: `/components/TrackLibrary/`

```typescript
import TrackLibrary from '@/components/TrackLibrary'

function Dashboard() {
  return (
    <Layout>
      <TrackLibrary 
        showUpload={true}
        showFilters={true}
        initialFilter={{ genre: 'Techno' }}
      />
    </Layout>
  )
}
```

### Optie 3: Compact Widget
```typescript
<TrackLibraryWidget 
  maxTracks={5}
  readonly={true}
  onTrackSelect={(track) => handlePlay(track)}
/>
```

---

## 🔌 Props Interface (voor herbruikbaar maken)

```typescript
interface TrackLibraryProps {
  // Display options
  showUpload?: boolean      // Toon upload sectie
  showFilters?: boolean     // Toon search/filter bar
  compact?: boolean         // Compacte weergave
  maxTracks?: number        // Limit aantal tracks
  
  // Initial state
  initialFilter?: {
    genre?: string
    label?: string
    search?: string
  }
  
  // Callbacks
  onTrackSelect?: (track: Track) => void
  onTrackDelete?: (trackId: string) => void
  onTrackPlay?: (track: Track) => void
  
  // Styling
  className?: string
  height?: string
}
```

---

## 📦 Dependencies

### NPM Packages
- `aws-amplify/data` - GraphQL client
- `aws-amplify/storage` - S3 file operations
- `music-metadata` (in Lambda)

### Services
- `/services/tracks.ts` - CRUD operations
- `/services/audioUpload.ts` - Upload handling
- `/services/filenameParser.ts` - Filename parsing

### Components
- `Layout` - Page wrapper
- Modal (inline)

---

## ⚡ Auto-processing Flow

```
1. User uploads track
   ↓
2. S3 (trigger)
   ↓
3. Lambda 1: audio-metadata
   - Extract metadata
   - BPM, Energy, Danceability, Valence
   - Upload cover art
   - Update DynamoDB
   ↓
4. Lambda 1 invokes Lambda 3 (async)
   ↓
5. Lambda 3: waveform-generator
   - Extract 200 peaks
   - Detect silence (trimStart/End)
   - Generate SVG waveform
   - Upload to S3
   - Update DynamoDB
   ↓
6. UI: 6 sec wait → Reload
   ↓
7. Track appears with ALL data!
```

---

## 🎨 Styling

- **Framework**: TailwindCSS
- **Grid**: 12 columns responsive
- **Colors**: Gray scale + Blue accents
- **States**: Hover, Focus, Loading, Error
- **Animations**: Spinner, Transitions

---

## 📝 Track Data Structure

```typescript
interface Track {
  // Basic
  id: string
  title: string
  artist?: string
  album?: string
  version?: string
  label?: string
  genre?: string
  year?: number
  
  // File
  fileUrl: string
  fileSize: number
  format: string
  duration: number
  addedAt: string
  
  // Audio Features
  bpm?: number
  key?: string
  energy?: number
  danceability?: number
  valence?: number
  
  // Visual
  coverArtUrl?: string
  waveformUrl?: string
  peaks?: number[]
  trimStart?: number
  trimEnd?: number
}
```

---

## 🔍 Filter Logic

```typescript
const filteredTracks = tracks.filter(track => {
  // Search
  const searchLower = searchQuery.toLowerCase()
  const matchesSearch = !searchQuery || 
    track.artist?.toLowerCase().includes(searchLower) ||
    track.title?.toLowerCase().includes(searchLower) ||
    track.genre?.toLowerCase().includes(searchLower) ||
    track.label?.toLowerCase().includes(searchLower) ||
    track.version?.toLowerCase().includes(searchLower)
  
  // Genre filter
  const matchesGenre = genreFilter === 'all' || 
    track.genre === genreFilter
  
  // Label filter
  const matchesLabel = labelFilter === 'all' || 
    track.label === labelFilter
  
  // Combine (AND logic)
  return matchesSearch && matchesGenre && matchesLabel
})
```

---

## 🚀 Gebruik in Andere Pagina's

### Voorbeeld 1: DJ Dashboard
```typescript
function DJDashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h2>Track Library</h2>
        <TrackLibrary 
          showUpload={false}
          compact={true}
          onTrackSelect={(track) => loadToDeck(track)}
        />
      </div>
      <div>
        <h2>Now Playing</h2>
        <DeckComponent />
      </div>
    </div>
  )
}
```

### Voorbeeld 2: Playlist Builder
```typescript
function PlaylistBuilder() {
  const [selectedTracks, setSelectedTracks] = useState([])
  
  return (
    <TrackLibrary 
      showFilters={true}
      onTrackSelect={(track) => addToPlaylist(track)}
      initialFilter={{ genre: 'Techno' }}
    />
  )
}
```

### Voorbeeld 3: Readonly Widget
```typescript
function RecentTracks() {
  return (
    <TrackLibraryWidget 
      maxTracks={10}
      readonly={true}
      compact={true}
    />
  )
}
```

---

## 📚 Gerelateerde Documentatie

- `/ref/LAMBDA_DEPLOYMENT_CHEATSHEET.md` - Lambda deployment
- `/ref/LAMBDA_TROUBLESHOOTING.md` - Debugging
- `/ref/LAMBDA3_WAVEFORM_GUIDE.md` - Waveform generation

---

## ✅ Complete Feature List

- [x] Multi-file upload (drag & drop)
- [x] Filename parsing (Artist - Title (Version) [Label])
- [x] Auto metadata extraction (Lambda 1)
- [x] BPM detection
- [x] Audio feature analysis
- [x] Cover art extraction & upload
- [x] Waveform generation (Lambda 3)
- [x] Silence detection (trim points)
- [x] Real-time search
- [x] Genre filter
- [x] Label filter
- [x] Track count display
- [x] Processing indicator
- [x] Cover art thumbnails
- [x] Track info modal
- [x] Waveform visualization (SVG)
- [x] Delete functionality
- [x] Error handling
- [x] Loading states

---

**Ready to use as reusable component!** 🎵
