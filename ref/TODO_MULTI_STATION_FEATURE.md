# 📻 TODO: Multi-Station Support via Cognito Groups

**Date:** 14 November 2025, 00:25 CET  
**Priority:** Medium  
**Status:** Planned for Future

---

## 🎯 **Feature Concept:**

**Multi-tenant radio platform** waar elke gebruiker zijn eigen station kan aanmaken en beheren op basis van Cognito groep membership.

---

## 📋 **Current Situation:**

### **Huidige Setup:**
```
User: gerard@krommail.nl
Cognito Group: splashfm
Station: SplashFM (single shared instance)
Access: Full control over ONE station
```

**Beperkingen:**
- Alleen 1 station mogelijk
- Alle gebruikers delen dezelfde setup
- Geen multi-tenant support
- Geen isolatie tussen gebruikers

---

## 🚀 **Gewenste Situatie:**

### **Multi-Station Model:**
```
User: gerard@krommail.nl
├── Cognito Group: splashfm
│   └── Station: SplashFM (ziet alleen deze setup)
├── Cognito Group: wildfm
│   └── Station: WildFM (ziet alleen deze setup)
└── Cognito Group: admin
    └── Stations: ALL (ziet alle stations)
```

### **Use Cases:**

**1. Radio Station Owner:**
```
Gebruiker: radio-owner@splashfm.nl
Groep: splashfm
Ziet:
  - Alleen SplashFM tracks
  - Alleen SplashFM playlists
  - Alleen SplashFM schedules
  - Alleen SplashFM stream status
Kan NIET:
  - Tracks van andere stations zien
  - Settings van andere stations wijzigen
```

**2. Multi-Station Owner:**
```
Gebruiker: gerard@krommail.nl
Groepen: splashfm, wildfm, jazzfm
Ziet:
  - Dashboard met station selector
  - Per station: eigen library
  - Per station: eigen schedules
  - Per station: eigen stream
Kan:
  - Schakelen tussen stations
  - Elk station onafhankelijk beheren
```

**3. Admin User:**
```
Gebruiker: admin@platform.nl
Groep: admin
Ziet:
  - Alle stations
  - Platform-wide analytics
  - User management
  - Billing overview
Kan:
  - Nieuwe stations aanmaken
  - Gebruikers toewijzen aan stations
  - Platform settings beheren
```

---

## 🏗️ **Implementation Plan:**

### **Phase 1: Data Model Update**

#### **1.1 Add Station Entity**
```graphql
type Station @model @auth(rules: [
  { allow: groups, groups: ["admin"] }
  { allow: owner }
]) {
  id: ID!
  name: String!
  slug: String! @index(name: "bySlug")
  cognito_group: String! @index(name: "byGroup")
  
  # Branding
  logo_url: String
  primary_color: String
  stream_url: String
  
  # Settings
  timezone: String
  default_genre: String
  
  # Relationships
  tracks: [Track] @hasMany
  playlists: [Playlist] @hasMany
  schedules: [Schedule] @hasMany
  users: [User] @hasMany
  
  # Metadata
  created_at: AWSDateTime!
  updated_at: AWSDateTime!
  owner: String @auth(rules: [{ allow: owner }])
}
```

#### **1.2 Update Existing Models**
```graphql
type Track @model @auth(rules: [
  { allow: groups, groupsField: "station_group" }
]) {
  id: ID!
  station_id: ID! @index(name: "byStation")
  station_group: String!  # Voor auth: "splashfm"
  # ... rest of fields
}

type Playlist @model @auth(rules: [
  { allow: groups, groupsField: "station_group" }
]) {
  id: ID!
  station_id: ID! @index(name: "byStation")
  station_group: String!  # Voor auth: "splashfm"
  # ... rest of fields
}

type Schedule @model @auth(rules: [
  { allow: groups, groupsField: "station_group" }
]) {
  id: ID!
  station_id: ID! @index(name: "byStation")
  station_group: String!  # Voor auth: "splashfm"
  # ... rest of fields
}
```

---

### **Phase 2: Authentication & Authorization**

#### **2.1 Cognito Groups Setup**
```bash
# Create groups per station
aws cognito-idp create-group \
  --group-name splashfm \
  --description "SplashFM Radio Station" \
  --user-pool-id [POOL_ID]

aws cognito-idp create-group \
  --group-name wildfm \
  --description "WildFM Radio Station" \
  --user-pool-id [POOL_ID]

aws cognito-idp create-group \
  --group-name admin \
  --description "Platform Administrators" \
  --user-pool-id [POOL_ID]
```

#### **2.2 User Assignment**
```bash
# Add user to station group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id [POOL_ID] \
  --username gerard@krommail.nl \
  --group-name splashfm
```

#### **2.3 AppSync Authorization**
```typescript
// In GraphQL resolvers
const getCurrentUserGroups = async () => {
  const token = await Auth.currentSession()
  const groups = token.getIdToken().payload['cognito:groups'] || []
  return groups
}

const getAccessibleStations = async () => {
  const groups = await getCurrentUserGroups()
  
  if (groups.includes('admin')) {
    // Admin sees all stations
    return await API.graphql(graphqlOperation(listStations))
  }
  
  // Regular user: filter by groups
  const stations = await Promise.all(
    groups.map(group => 
      API.graphql(graphqlOperation(listStationsByGroup, { group }))
    )
  )
  
  return stations.flat()
}
```

---

### **Phase 3: UI Updates**

#### **3.1 Station Selector**
```tsx
// Component: StationSelector.tsx
interface StationSelectorProps {
  currentStation: Station
  onStationChange: (station: Station) => void
}

function StationSelector({ currentStation, onStationChange }: StationSelectorProps) {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadUserStations()
  }, [])
  
  const loadUserStations = async () => {
    const userStations = await getAccessibleStations()
    setStations(userStations)
    setLoading(false)
  }
  
  return (
    <div className="station-selector">
      <label>Radio Station:</label>
      <select 
        value={currentStation.id}
        onChange={(e) => {
          const station = stations.find(s => s.id === e.target.value)
          if (station) onStationChange(station)
        }}
      >
        {stations.map(station => (
          <option key={station.id} value={station.id}>
            {station.name}
          </option>
        ))}
      </select>
    </div>
  )
}
```

#### **3.2 Context Provider**
```tsx
// Context: StationContext.tsx
interface StationContextValue {
  currentStation: Station | null
  stations: Station[]
  switchStation: (stationId: string) => void
  isAdmin: boolean
}

const StationContext = createContext<StationContextValue | null>(null)

export function StationProvider({ children }: { children: React.ReactNode }) {
  const [currentStation, setCurrentStation] = useState<Station | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    initializeStations()
  }, [])
  
  const initializeStations = async () => {
    const userStations = await getAccessibleStations()
    const groups = await getCurrentUserGroups()
    
    setStations(userStations)
    setIsAdmin(groups.includes('admin'))
    
    // Load last selected station from localStorage
    const lastStationId = localStorage.getItem('lastSelectedStation')
    const defaultStation = userStations.find(s => s.id === lastStationId) || userStations[0]
    
    setCurrentStation(defaultStation)
  }
  
  const switchStation = (stationId: string) => {
    const station = stations.find(s => s.id === stationId)
    if (station) {
      setCurrentStation(station)
      localStorage.setItem('lastSelectedStation', stationId)
    }
  }
  
  return (
    <StationContext.Provider value={{ currentStation, stations, switchStation, isAdmin }}>
      {children}
    </StationContext.Provider>
  )
}

export const useStation = () => {
  const context = useContext(StationContext)
  if (!context) throw new Error('useStation must be used within StationProvider')
  return context
}
```

#### **3.3 Update Data Fetching**
```tsx
// Before (huidige situatie):
const { data: tracks } = useQuery(listTracks)

// After (multi-station):
const { currentStation } = useStation()
const { data: tracks } = useQuery(listTracks, {
  variables: { filter: { station_id: { eq: currentStation?.id } } }
})
```

---

### **Phase 4: Backend Updates**

#### **4.1 Lambda Functions**
```typescript
// Add station filtering to all Lambda functions
interface StationAwareEvent {
  station_id: string
  station_group: string
}

export const handler = async (event: StationAwareEvent) => {
  const { station_id, station_group } = event
  
  // Verify user has access to this station
  const userGroups = event.requestContext.authorizer.claims['cognito:groups']
  if (!userGroups.includes(station_group) && !userGroups.includes('admin')) {
    throw new Error('Unauthorized: User not in station group')
  }
  
  // Continue with station-filtered logic
  const tracks = await getTracksByStation(station_id)
  // ...
}
```

#### **4.2 Stream Management**
```typescript
// Per-station stream URLs
const getStreamUrlForStation = (station: Station) => {
  return `https://stream.platform.com/${station.slug}/live.mp3`
}

// Per-station EC2 instance (optional, for scale)
const getStreamServerForStation = (station: Station) => {
  if (station.has_dedicated_server) {
    return station.server_url
  }
  // Shared server with station-specific mount point
  return `http://shared-server.platform.com:8000/${station.slug}.mp3`
}
```

---

## 🎨 **UI Mockup:**

### **Dashboard Header:**
```
┌─────────────────────────────────────────────────────────┐
│  🎵 Radio Platform                                       │
│                                                          │
│  Station: [SplashFM ▼]  👤 gerard@krommail.nl  [Logout] │
└─────────────────────────────────────────────────────────┘
```

### **Station Dropdown:**
```
┌─────────────────────┐
│ Select Station:     │
├─────────────────────┤
│ ✓ SplashFM         │  ← Current
│   WildFM           │
│   JazzFM           │
├─────────────────────┤
│ + Create New...    │  ← If admin
└─────────────────────┘
```

### **Station-Filtered Data:**
```
Current Station: SplashFM
├── Tracks (245 items)     ← Only SplashFM tracks
├── Playlists (12 items)   ← Only SplashFM playlists  
├── Schedule (7 days)      ← Only SplashFM schedule
└── Stream Status          ← Only SplashFM stream
```

---

## 📊 **Database Schema Changes:**

### **Migration Steps:**

**1. Add station_id to all tables:**
```sql
ALTER TABLE Track ADD COLUMN station_id VARCHAR(255);
ALTER TABLE Track ADD COLUMN station_group VARCHAR(255);
ALTER TABLE Playlist ADD COLUMN station_id VARCHAR(255);
ALTER TABLE Playlist ADD COLUMN station_group VARCHAR(255);
ALTER TABLE Schedule ADD COLUMN station_id VARCHAR(255);
ALTER TABLE Schedule ADD COLUMN station_group VARCHAR(255);
```

**2. Create default station:**
```typescript
const defaultStation = await createStation({
  name: "SplashFM",
  slug: "splashfm",
  cognito_group: "splashfm",
  stream_url: "http://79.125.44.178:8000/stream.mp3"
})
```

**3. Migrate existing data:**
```typescript
const defaultStationId = "station-splashfm-001"

// Update all tracks
await updateAllTracks({
  station_id: defaultStationId,
  station_group: "splashfm"
})

// Update all playlists
await updateAllPlaylists({
  station_id: defaultStationId,
  station_group: "splashfm"
})

// Update all schedules
await updateAllSchedules({
  station_id: defaultStationId,
  station_group: "splashfm"
})
```

---

## 🔒 **Security Considerations:**

### **1. Row-Level Security**
```graphql
# Each model has station_group for auth
@auth(rules: [
  { allow: groups, groupsField: "station_group" }
  { allow: groups, groups: ["admin"] }
])
```

### **2. API Authorization**
```typescript
// Verify station access in resolvers
const verifyStationAccess = (userId: string, stationId: string) => {
  const userGroups = getUserGroups(userId)
  const station = getStation(stationId)
  
  return userGroups.includes(station.cognito_group) || 
         userGroups.includes('admin')
}
```

### **3. S3 Bucket Isolation**
```
s3://radio-platform/
  ├── splashfm/
  │   ├── tracks/
  │   ├── covers/
  │   └── waveforms/
  ├── wildfm/
  │   ├── tracks/
  │   ├── covers/
  │   └── waveforms/
  └── shared/
      └── news/
```

---

## 💰 **Pricing Model Ideas:**

### **Tiers:**
```
Free Tier:
  - 1 station
  - 100 tracks
  - Basic analytics
  
Starter ($29/month):
  - 1 station
  - 1,000 tracks
  - Advanced analytics
  - Custom branding
  
Pro ($99/month):
  - 3 stations
  - 10,000 tracks
  - Priority support
  - API access
  
Enterprise ($299/month):
  - Unlimited stations
  - Unlimited tracks
  - Dedicated server
  - White label
```

---

## 🧪 **Testing Strategy:**

### **1. Unit Tests:**
```typescript
describe('Station Access', () => {
  it('should allow user to access their station', async () => {
    const user = createTestUser(['splashfm'])
    const tracks = await getTracks(user, 'splashfm')
    expect(tracks.length).toBeGreaterThan(0)
  })
  
  it('should deny access to other stations', async () => {
    const user = createTestUser(['splashfm'])
    await expect(getTracks(user, 'wildfm')).rejects.toThrow('Unauthorized')
  })
  
  it('should allow admin to access all stations', async () => {
    const admin = createTestUser(['admin'])
    const splashTracks = await getTracks(admin, 'splashfm')
    const wildTracks = await getTracks(admin, 'wildfm')
    expect(splashTracks).toBeDefined()
    expect(wildTracks).toBeDefined()
  })
})
```

---

## 📝 **Implementation Checklist:**

### **Backend:**
- [ ] Create Station model in GraphQL schema
- [ ] Add station_id & station_group to Track, Playlist, Schedule
- [ ] Update all Lambda functions for station filtering
- [ ] Create Cognito groups per station
- [ ] Implement row-level security with @auth
- [ ] Add station context to all resolvers
- [ ] Create migration script for existing data
- [ ] Update S3 structure for station isolation

### **Frontend:**
- [ ] Create StationContext & Provider
- [ ] Build Station Selector component
- [ ] Update all data fetching with station filter
- [ ] Add station switcher to navbar
- [ ] Update UI to show current station
- [ ] Add station creation flow (admin only)
- [ ] Test authorization edge cases

### **Infrastructure:**
- [ ] Plan multi-station streaming setup
- [ ] Decide: shared vs dedicated servers
- [ ] Update Liquidsoap for multi-station
- [ ] Configure per-station mount points
- [ ] Setup per-station analytics

### **Documentation:**
- [ ] User guide: Creating stations
- [ ] User guide: Managing multi-station
- [ ] Admin guide: User management
- [ ] API docs: Station endpoints
- [ ] Migration guide: Existing to multi-station

---

## 🎯 **Success Metrics:**

- ✅ Users can create and manage multiple stations
- ✅ Complete data isolation between stations
- ✅ Zero cross-station data leaks
- ✅ Admins can see all stations
- ✅ Performance: < 200ms station switching
- ✅ Users can only see their assigned stations

---

## 🚀 **Rollout Plan:**

### **Phase 1: Internal (Week 1-2)**
- Implement backend changes
- Create test stations
- Manual testing with dev team

### **Phase 2: Beta (Week 3-4)**
- Release to 5 beta users
- Each gets 1 test station
- Gather feedback

### **Phase 3: Production (Week 5)**
- Migrate existing SplashFM to new model
- Enable station creation for admins
- Document & train users

---

## 📚 **Reference:**

**Current Implementation:**
- Single station: SplashFM
- Shared by all users
- No multi-tenant support

**Target Implementation:**
- Multi-station platform
- Cognito group-based isolation
- Per-station branding & settings
- Admin station management

---

**Priority:** Medium (after current features deployed)  
**Effort:** Large (2-4 weeks)  
**Impact:** High (enables platform scaling)

**Status:** 📋 TODO - Planned

---

**Last Updated:** 14 November 2025, 00:25 CET
