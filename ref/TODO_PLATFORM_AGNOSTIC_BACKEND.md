# 🎯 TODO: Platform-Agnostic Backend Architecture

**Datum:** 14 November 2025, 13:26 CET  
**Prioriteit:** HIGH  
**Status:** 📝 TODO - Strategisch belangrijk!

---

## 🎯 **KERNGEDACHTE:**

**De BACKEND is het belangrijkste - de frontend is slechts één van de vele mogelijke clients!**

De backend moet platform-agnostic zijn en gekoppeld kunnen worden aan:
- ✅ Web apps (huidige Splash FM site)
- ✅ Mobile apps (iOS/Android)
- ✅ Andere websites
- ✅ DJ portals (eigen radio station starten)
- ✅ Third-party integrations
- ✅ API consumers

**Focus:** Backend = single source of truth voor alle clients!

---

## 🏗️ **ARCHITECTUUR VISIE:**

```
┌─────────────────────────────────────────────────────────────┐
│                  AMPLIFY GEN2 BACKEND                        │
│                (Single Source of Truth)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📦 Core Services:                                           │
│  ├─ GraphQL API (AppSync)                                   │
│  ├─ REST API (API Gateway)                                  │
│  ├─ Authentication (Cognito)                                │
│  ├─ Storage (S3)                                            │
│  ├─ Database (DynamoDB)                                     │
│  ├─ Real-time (IoT/PubSub)                                  │
│  ├─ Streaming (EC2 + Icecast)                               │
│  └─ Functions (Lambda)                                      │
│                                                              │
│  🎵 Radio Services:                                          │
│  ├─ Track Management                                        │
│  ├─ Playlist Generator                                      │
│  ├─ Schedule Manager                                        │
│  ├─ Stream Management                                       │
│  ├─ Audio Processing                                        │
│  └─ Metadata Service                                        │
│                                                              │
│  👤 User Services:                                           │
│  ├─ Multi-tenant Organizations                              │
│  ├─ User Management                                         │
│  ├─ Roles & Permissions                                     │
│  ├─ Station Management                                      │
│  └─ Content Ownership                                       │
│                                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Expose via:
                   ├─ GraphQL API
                   ├─ REST API
                   ├─ WebSocket (Real-time)
                   └─ Stream URLs
                   │
        ┌──────────┴──────────┬──────────────────┬─────────────────┐
        │                     │                  │                 │
        ↓                     ↓                  ↓                 ↓
┌───────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐
│  Web App      │   │ Mobile Apps  │   │ DJ Portal   │   │ Third-party  │
│  (Current)    │   │ (iOS/Android)│   │ (New!)      │   │ Integrations │
├───────────────┤   ├──────────────┤   ├─────────────┤   ├──────────────┤
│ - Listen      │   │ - Listen     │   │ - Upload    │   │ - API Access │
│ - Browse      │   │ - Browse     │   │ - Manage    │   │ - Webhooks   │
│ - Manage      │   │ - Download   │   │ - Schedule  │   │ - Embed      │
│ - Upload      │   │ - Offline    │   │ - Stream    │   │ - Widgets    │
│ - Admin       │   │ - Push       │   │ - Analytics │   │              │
└───────────────┘   └──────────────┘   └─────────────┘   └──────────────┘
```

---

## 🎯 **USE CASES:**

### **1. WEB APP (Current - Splash FM)**

**URL:** `https://splashfm.nl`

**Functionaliteit:**
- Stream luisteren
- Track library browsing
- Upload tracks
- Playlist management
- Schedule beheer
- Admin panel
- Real-time now playing

**Backend API Calls:**
```graphql
# GraphQL API
- listTracks()
- getTrack(id)
- uploadTrack()
- createPlaylist()
- getSchedule()
- updateOrganization()
```

---

### **2. MOBILE APPS (Toekomstig)**

**Platforms:** iOS + Android

**Functionaliteit:**
- Stream luisteren (background playback)
- Browse tracks
- Download for offline
- Push notifications (new tracks, live shows)
- Car mode (simpele UI)
- Sleep timer
- Chromecast/AirPlay support

**Backend API Calls:**
```graphql
# Same GraphQL API
- listTracks(limit: 50)
- getStream(stationId)
- downloadTrack(id) → S3 presigned URL
- subscribeToNowPlaying() → WebSocket
```

**Voordelen:**
- ✅ Zelfde backend = consistency
- ✅ Zelfde authenticatie (Cognito)
- ✅ Zelfde data (DynamoDB)
- ✅ Real-time sync (PubSub)

---

### **3. DJ PORTAL (Nieuwe Feature!)**

**Concept:** Platform waar DJs hun eigen radio station kunnen starten!

**URL:** `https://dj.splashfm.nl` of `https://portal.splashfm.nl`

**Functionaliteit:**

**A. Station Setup:**
```
- Create your station
- Choose station name
- Upload logo/branding
- Configure stream settings
- Select music genre
```

**B. Content Management:**
```
- Upload eigen tracks
- Upload eigen jingles
- Upload voice-overs
- Organize in playlists
- Schedule programming
```

**C. Stream Management:**
```
- Start/stop stream
- Auto-DJ (playlist based)
- Live broadcasting (via browser)
- Schedule shows
- Crossfade settings
```

**D. Analytics:**
```
- Listener count
- Track plays
- Popular times
- Geographic data
- Listener retention
```

**Backend API Calls:**
```graphql
# Station Management
createStation(input: {
  name: "DJ John's Dance Radio"
  genre: "Dance"
  logo: "logo.png"
  organizationId: "org-123"
})

# Content Upload
uploadTrack(input: {
  file: File
  stationId: "station-456"
  metadata: {...}
})

# Stream Control
startStream(stationId: "station-456")
stopStream(stationId: "station-456")
getStreamUrl(stationId: "station-456")

# Analytics
getStationAnalytics(
  stationId: "station-456"
  timeRange: LAST_7_DAYS
)
```

**Multi-Tenant Model:**
```
Organization
  ├─ Station 1 (DJ John)
  │   ├─ Tracks (private)
  │   ├─ Playlists
  │   ├─ Schedule
  │   └─ Stream URL: station-1.splashfm.nl
  │
  ├─ Station 2 (DJ Sarah)
  │   ├─ Tracks (private)
  │   ├─ Playlists
  │   ├─ Schedule
  │   └─ Stream URL: station-2.splashfm.nl
  │
  └─ Shared Library (organization)
      ├─ Jingles
      ├─ Commercials
      └─ Station IDs
```

---

### **4. VIDEO PLATFORM (Uitbreiding)**

**Concept:** Radio + Video = Multimedia Platform

**Functionaliteit:**
- Upload video clips
- Music videos
- Live video streams
- Video playlists
- Picture-in-picture player

**Backend Aanpassingen:**
```graphql
# Track model uitbreiden
type Track {
  id: ID!
  title: String!
  artist: String!
  audioFileUrl: String!
  videoFileUrl: String  # NEW!
  videoThumbnail: String # NEW!
  mediaType: MediaType! # NEW! (AUDIO | VIDEO | BOTH)
}

# Video specific queries
listVideos()
uploadVideo(file: File, metadata: VideoMetadata)
getVideoStream(id: ID)
```

**Storage:**
```
S3 Buckets:
├─ audio-files/
├─ video-files/     # NEW!
├─ thumbnails/      # NEW!
└─ processed-video/ # NEW!

Lambda Functions:
├─ audio-processor
└─ video-processor  # NEW! (transcoding, thumbnails)
```

---

### **5. THIRD-PARTY INTEGRATIONS**

**API Access voor externe developers:**

**A. Public API:**
```
GET  /api/stations              # List public stations
GET  /api/stations/{id}/stream  # Get stream URL
GET  /api/stations/{id}/nowplaying # Current track
GET  /api/tracks                # Browse tracks (if public)
```

**B. Webhooks:**
```
Events:
- track.started
- track.ended
- listener.joined
- listener.left
- show.started
- show.ended

POST https://your-webhook.com/splash-fm
{
  "event": "track.started",
  "station": "station-123",
  "track": {...},
  "timestamp": "2025-11-14T13:30:00Z"
}
```

**C. Embed Widgets:**
```html
<!-- Web Player Widget -->
<iframe src="https://player.splashfm.nl/embed/station-123" 
        width="400" height="100"></iframe>

<!-- Now Playing Widget -->
<div id="splashfm-nowplaying" 
     data-station="station-123"></div>
<script src="https://cdn.splashfm.nl/widget.js"></script>
```

---

## 🔑 **BACKEND REQUIREMENTS:**

### **1. API Layer:**

**GraphQL API (Primary):**
```graphql
# Queries
type Query {
  # Stations
  listStations(filter: StationFilter): [Station]
  getStation(id: ID!): Station
  
  # Tracks
  listTracks(stationId: ID, filter: TrackFilter): [Track]
  getTrack(id: ID!): Track
  
  # Playlists
  listPlaylists(stationId: ID): [Playlist]
  getPlaylist(id: ID!): Playlist
  
  # Stream
  getStreamUrl(stationId: ID!): String
  getNowPlaying(stationId: ID!): Track
  
  # Analytics
  getAnalytics(stationId: ID!, timeRange: TimeRange): Analytics
}

# Mutations
type Mutation {
  # Station Management
  createStation(input: CreateStationInput!): Station
  updateStation(id: ID!, input: UpdateStationInput!): Station
  deleteStation(id: ID!): Boolean
  
  # Track Management
  uploadTrack(input: UploadTrackInput!): Track
  updateTrack(id: ID!, input: UpdateTrackInput!): Track
  deleteTrack(id: ID!): Boolean
  
  # Playlist Management
  createPlaylist(input: CreatePlaylistInput!): Playlist
  updatePlaylist(id: ID!, input: UpdatePlaylistInput!): Playlist
  addTrackToPlaylist(playlistId: ID!, trackId: ID!): Playlist
  
  # Stream Control
  startStream(stationId: ID!): StreamStatus
  stopStream(stationId: ID!): StreamStatus
}

# Subscriptions
type Subscription {
  onNowPlayingUpdate(stationId: ID!): Track
  onListenerCountUpdate(stationId: ID!): Int
  onTrackAdded(stationId: ID!): Track
}
```

**REST API (Secondary):**
```
GET    /api/v1/stations
POST   /api/v1/stations
GET    /api/v1/stations/:id
PUT    /api/v1/stations/:id
DELETE /api/v1/stations/:id

GET    /api/v1/stations/:id/stream
GET    /api/v1/stations/:id/nowplaying
GET    /api/v1/stations/:id/analytics

POST   /api/v1/tracks/upload
GET    /api/v1/tracks
GET    /api/v1/tracks/:id
```

---

### **2. Authentication & Authorization:**

**Multi-Tenant Model:**
```
User
  ├─ Email/Password (Cognito)
  ├─ Roles: [ADMIN, DJ, LISTENER]
  └─ Organizations (many-to-many)
      ├─ Organization 1
      │   ├─ Role: ADMIN
      │   └─ Stations: [station-1, station-2]
      └─ Organization 2
          ├─ Role: DJ
          └─ Stations: [station-3]
```

**Permissions:**
```
ADMIN:
- Create/delete stations
- Manage users
- View all analytics
- Configure billing

DJ:
- Upload tracks (own station)
- Create playlists (own station)
- Start/stop stream (own station)
- View analytics (own station)

LISTENER:
- Browse public stations
- Listen to streams
- Save favorites
```

**API Keys (voor third-party):**
```
API Key Levels:
- Public: Read-only access
- Partner: Read + limited write
- Premium: Full access + webhooks
```

---

### **3. Data Isolation:**

**Per Station:**
```
DynamoDB Tables:
├─ Tracks
│   ├─ PK: stationId
│   ├─ SK: trackId
│   └─ GSI: organizationId
│
├─ Playlists
│   ├─ PK: stationId
│   └─ SK: playlistId
│
└─ Analytics
    ├─ PK: stationId#date
    └─ SK: timestamp
```

**S3 Storage:**
```
Bucket Structure:
s3://splashfm-media/
  ├─ organizations/
  │   └─ {orgId}/
  │       ├─ stations/
  │       │   └─ {stationId}/
  │       │       ├─ tracks/
  │       │       ├─ jingles/
  │       │       └─ images/
  │       └─ shared/
  └─ public/
```

---

### **4. Streaming Infrastructure:**

**Multi-Station Support:**
```
EC2 Fleet (Auto-scaling):
├─ Stream Server 1
│   ├─ Station A: port 8001
│   ├─ Station B: port 8002
│   └─ Station C: port 8003
│
├─ Stream Server 2
│   ├─ Station D: port 8001
│   └─ Station E: port 8002
│
└─ Load Balancer
    └─ Route by subdomain:
        - station-a.splashfm.nl → Server 1:8001
        - station-b.splashfm.nl → Server 1:8002
```

**Alternative: CloudFront + Icecast:**
```
CloudFront CDN
  ↓
Origin: Icecast Cluster
  ├─ Master (Active)
  └─ Replica (Standby)
```

---

## 🚀 **IMPLEMENTATION ROADMAP:**

### **Fase 1: Backend Consolidation (HIGH)**
```
✅ Centralize all business logic in backend
✅ GraphQL API complete
✅ Multi-tenant data model
✅ Station isolation
✅ API documentation
```

### **Fase 2: DJ Portal (MEDIUM)**
```
⏳ Station creation flow
⏳ Content upload interface
⏳ Stream management
⏳ Analytics dashboard
⏳ Billing integration
```

### **Fase 3: Mobile Apps (MEDIUM)**
```
⏳ iOS app (React Native / Swift)
⏳ Android app (React Native / Kotlin)
⏳ Offline mode
⏳ Push notifications
⏳ App Store submission
```

### **Fase 4: Video Platform (LOW)**
```
⏳ Video upload
⏳ Video transcoding
⏳ Video player
⏳ Video playlists
```

### **Fase 5: Public API (MEDIUM)**
```
⏳ API documentation (Swagger)
⏳ API keys management
⏳ Rate limiting
⏳ Webhooks
⏳ Developer portal
```

---

## 💡 **BUSINESS MODEL:**

### **Pricing Tiers:**

**Free Tier:**
```
- 1 station
- 100 tracks max
- 10 concurrent listeners
- Basic analytics
- Community support
```

**DJ Tier ($19/month):**
```
- 3 stations
- 1000 tracks
- 100 concurrent listeners
- Advanced analytics
- Email support
- Custom branding
```

**Professional ($99/month):**
```
- 10 stations
- Unlimited tracks
- 1000 concurrent listeners
- Full analytics + export
- Priority support
- API access
- White-label option
```

**Enterprise (Custom):**
```
- Unlimited stations
- Unlimited tracks
- Unlimited listeners
- Dedicated infrastructure
- SLA guarantee
- Custom integrations
```

---

## 📊 **METRICS TO TRACK:**

```
Backend Performance:
- API response time
- GraphQL query performance
- Lambda cold starts
- DynamoDB capacity
- S3 bandwidth

Business Metrics:
- Active stations
- Total users
- Tracks uploaded/day
- Stream hours/day
- Revenue/month
- Churn rate
```

---

## ✅ **SUCCESS CRITERIA:**

```
✅ Backend API handles multiple frontends
✅ Same data across all clients
✅ Multi-tenant isolation working
✅ Station creation < 2 minutes
✅ API response time < 500ms
✅ 99.9% uptime
✅ Scalable to 1000+ stations
✅ Clear API documentation
✅ Developer-friendly
```

---

## 📚 **KEYWORDS:**

`backend-first` `platform-agnostic` `multi-tenant` `api-first` `graphql` `mobile-apps` `dj-portal` `video-platform` `third-party-api` `multi-station` `scalability` `white-label` `saas-platform` `radio-as-a-service`

---

**Status:** 📝 TODO - STRATEGISCH  
**Priority:** HIGH (Backend = Foundation!)  
**Impact:** MASSIVE (Enables all future features)  
**Next:** Backend consolidation + API documentation
