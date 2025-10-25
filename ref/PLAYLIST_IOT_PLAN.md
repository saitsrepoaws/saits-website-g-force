# 🎵 Playlist - IoT/WebSocket Plan

## Waarom IoT i.p.v. GraphQL?
- ✅ Real-time sync tussen devices
- ✅ Instant updates (geen polling)
- ✅ Perfect voor DJ setup
- ✅ Low latency bi-directional

## Architectuur

```
Device 1 ←→ IoT Core (MQTT) ←→ Device 2
    ↓            ↓              ↓
         DynamoDB (State)
```

## Data Model (Simple!)

```typescript
interface Playlist {
  id: string
  name: string
  tracks: string // JSON array (NO join table!)
  trackCount: number
  totalDuration: number
}

// Embedded in tracks JSON:
interface PlaylistTrackItem {
  trackId: string
  order: number
  trackTitle: string
  trackArtist: string
  trackDuration: number
}
```

## IoT Topics

```
playlist/{playlistId}/events
```

## Event Types

```typescript
TRACK_ADDED
TRACK_REMOVED
TRACKS_REORDERED
PLAYLIST_UPDATED
```

## Implementation

### 1. GraphQL Schema (Simple)
```typescript
Playlist: a.model({
  name: a.string(),
  tracks: a.string(), // JSON array
  trackCount: a.integer()
})
```

### 2. IoT Service
```typescript
import { PubSub } from '@aws-amplify/pubsub'

playlistIoT.subscribeToPlaylist(id, (event) => {
  // Update UI instantly!
})

playlistIoT.addTrack(playlistId, track)
```

### 3. Component
```typescript
useEffect(() => {
  const unsubscribe = playlistIoT.subscribeToPlaylist(id, handleEvent)
  return () => unsubscribe()
}, [id])
```

## Voordelen
- ✅ 1 DynamoDB query (geen joins)
- ✅ Instant updates
- ✅ Multi-device sync
- ✅ Simpel model
