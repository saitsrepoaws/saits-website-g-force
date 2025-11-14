# 🏢 Multi-Tenancy op basis van Cognito Groepen - Status

**Datum:** 14 Nov 2025, 11:00 CET  
**Status:** 📋 GEPLAND - Nog niet geïmplementeerd

---

## ✅ **WAT WE AL HEBBEN:**

### **1. Cognito User Pool**
```typescript
// /amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: { email: true },
  multifactor: { mode: 'OFF' },
})
```

### **2. Basis Authorization**
```typescript
// Huidige setup in /amplify/data/resource.ts
.authorization((allow) => [
  allow.authenticated()  // Alle authenticated users hebben toegang
])
```

### **3. Single Station Model**
```
Current:
- Gebruiker: gerard@krommail.nl
- Cognito Group: splashfm
- Station: SplashFM (single shared instance)
- Alle users delen dezelfde data
```

---

## ❌ **WAT WE NOG NIET HEBBEN:**

### **1. Cognito Groepen**
```bash
# Nog niet aangemaakt:
- splashfm (group voor SplashFM station)
- wildfm (group voor WildFM station)
- admin (group voor platform administrators)
```

### **2. Station Model**
```graphql
# Moet nog toegevoegd worden:
type Station @model {
  id: ID!
  name: String!              # "SplashFM", "WildFM"
  slug: String!              # "splashfm", "wildfm"
  cognito_group: String!     # "splashfm", "wildfm"
  logo_url: String
  stream_url: String
  timezone: String
  created_at: AWSDateTime!
}
```

### **3. Multi-Tenant Fields**
```graphql
# Moet toegevoegd aan Track, Playlist, Schedule:
station_id: ID!        # Relatie naar Station
station_group: String! # Voor authorization: "splashfm"
```

### **4. Group-Based Authorization**
```graphql
# Moet vervangen worden:
.authorization((allow) => [
  allow.authenticated()  # ← Huidige setup (everyone)
])

# Door:
.authorization((allow) => [
  { allow: groups, groupsField: "station_group" }  # ← Per station
  { allow: groups, groups: ["admin"] }             # ← Admin overal
])
```

---

## 🎯 **GEWENSTE SITUATIE:**

### **Multi-Station Setup:**
```
User: gerard@krommail.nl
├── Cognito Group: splashfm
│   └── Ziet: Alleen SplashFM data
│       - Tracks (splashfm only)
│       - Playlists (splashfm only)
│       - Schedules (splashfm only)
│
├── Cognito Group: wildfm
│   └── Ziet: Alleen WildFM data
│       - Tracks (wildfm only)
│       - Playlists (wildfm only)
│       - Schedules (wildfm only)
│
└── Cognito Group: admin
    └── Ziet: ALLE stations
        - Alle tracks van alle stations
        - Alle playlists van alle stations
        - Alle schedules van alle stations
```

---

## 🏗️ **IMPLEMENTATIE PLAN:**

### **Phase 1: Backend Schema (2-3 dagen)**

#### **1.1 Station Model Toevoegen**
```typescript
// In /amplify/data/resource.ts
Station: a
  .model({
    name: a.string().required(),
    slug: a.string().required(),
    cognitoGroup: a.string().required(),
    logoUrl: a.string(),
    streamUrl: a.string(),
    timezone: a.string().default('Europe/Amsterdam'),
    primaryColor: a.string(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow) => [
    allow.groups(['admin']),
    allow.groupsField('cognitoGroup'),
  ])
```

#### **1.2 Bestaande Models Updaten**
```typescript
// Track model:
Track: a.model({
  // Existing fields...
  
  // NEW: Multi-tenant fields
  stationId: a.string().required(),
  stationGroup: a.string().required(),
})
.authorization((allow) => [
  allow.groupsField('stationGroup'),
  allow.groups(['admin']),
])
```

---

### **Phase 2: Cognito Groups (1 dag)**

#### **2.1 Create Groups via AWS Console of CLI**
```bash
# SplashFM station group
aws cognito-idp create-group \
  --group-name splashfm \
  --description "SplashFM Radio Station" \
  --user-pool-id [POOL_ID]

# WildFM station group
aws cognito-idp create-group \
  --group-name wildfm \
  --description "WildFM Radio Station" \
  --user-pool-id [POOL_ID]

# Admin group
aws cognito-idp create-group \
  --group-name admin \
  --description "Platform Administrators" \
  --user-pool-id [POOL_ID]
```

#### **2.2 Assign Users to Groups**
```bash
# Add user to station group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id [POOL_ID] \
  --username gerard@krommail.nl \
  --group-name splashfm

# Add user to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id [POOL_ID] \
  --username gerard@krommail.nl \
  --group-name admin
```

---

### **Phase 3: Frontend Updates (3-4 dagen)**

#### **3.1 Station Context**
```typescript
// /apps/web/src/contexts/StationContext.tsx
interface StationContextValue {
  currentStation: Station | null
  stations: Station[]
  switchStation: (stationId: string) => void
  isAdmin: boolean
}

export const useStation = () => {
  // Get user's Cognito groups
  // Load accessible stations
  // Provide station context to app
}
```

#### **3.2 Station Selector Component**
```tsx
// /apps/web/src/components/StationSelector.tsx
function StationSelector() {
  const { currentStation, stations, switchStation } = useStation()
  
  return (
    <select onChange={(e) => switchStation(e.target.value)}>
      {stations.map(station => (
        <option key={station.id} value={station.id}>
          {station.name}
        </option>
      ))}
    </select>
  )
}
```

#### **3.3 Update Data Fetching**
```typescript
// Before:
const { data: tracks } = useQuery(listTracks)

// After:
const { currentStation } = useStation()
const { data: tracks } = useQuery(listTracks, {
  variables: {
    filter: { stationId: { eq: currentStation?.id } }
  }
})
```

---

### **Phase 4: Data Migration (1 dag)**

#### **4.1 Create Default Station**
```typescript
const splashFmStation = await createStation({
  name: "SplashFM",
  slug: "splashfm",
  cognitoGroup: "splashfm",
  streamUrl: "http://46.137.184.91:8000/stream.mp3",
  timezone: "Europe/Amsterdam",
  primaryColor: "#ff6b35"
})
```

#### **4.2 Migrate Existing Data**
```typescript
// Update all existing tracks
await updateAllTracks({
  stationId: splashFmStation.id,
  stationGroup: "splashfm"
})

// Update all existing playlists
await updateAllPlaylists({
  stationId: splashFmStation.id,
  stationGroup: "splashfm"
})

// Update all existing schedules
await updateAllSchedules({
  stationId: splashFmStation.id,
  stationGroup: "splashfm"
})
```

---

## 🔒 **SECURITY MODEL:**

### **Authorization Rules:**

```typescript
// Track authorization:
Track: a.model({
  // ...fields
  stationGroup: a.string().required()
})
.authorization((allow) => [
  // Users in station group kunnen hun station's tracks zien/bewerken
  allow.groupsField('stationGroup'),
  
  // Admins kunnen alles zien
  allow.groups(['admin'])
])
```

### **How It Works:**

```
User: gerard@krommail.nl
Groups: ['splashfm', 'admin']

Queries Track with stationGroup='splashfm':
✅ ALLOWED (user in 'splashfm' group)

Queries Track with stationGroup='wildfm':
✅ ALLOWED (user in 'admin' group)

---

User: john@splashfm.nl
Groups: ['splashfm']

Queries Track with stationGroup='splashfm':
✅ ALLOWED (user in 'splashfm' group)

Queries Track with stationGroup='wildfm':
❌ DENIED (user not in 'wildfm' or 'admin')
```

---

## 📊 **DATABASE CHANGES:**

### **New Table:**
```
Station
├── id (PK)
├── name
├── slug
├── cognitoGroup
├── logoUrl
├── streamUrl
└── timezone
```

### **Updated Tables:**
```
Track
├── (existing fields...)
├── stationId        (NEW - FK to Station)
└── stationGroup     (NEW - for auth)

Playlist
├── (existing fields...)
├── stationId        (NEW - FK to Station)
└── stationGroup     (NEW - for auth)

Schedule
├── (existing fields...)
├── stationId        (NEW - FK to Station)
└── stationGroup     (NEW - for auth)
```

---

## 🎨 **UI CHANGES:**

### **Navbar Update:**
```tsx
<header>
  <div className="logo">Radio Platform</div>
  
  {/* NEW: Station Selector */}
  <StationSelector />
  
  <div className="user-menu">
    <span>{user.email}</span>
    <button>Logout</button>
  </div>
</header>
```

### **Filtered Data Display:**
```tsx
// Automatically filtered by currentStation
<Libery />           {/* Shows only current station's tracks */}
<Playlists />        {/* Shows only current station's playlists */}
<Schedule />         {/* Shows only current station's schedule */}
<StreamStatus />     {/* Shows only current station's stream */}
```

---

## 💰 **BUSINESS MODEL (optioneel):**

### **SaaS Tiers:**
```
Free:
- 1 station
- 100 tracks
- Basic analytics

Pro ($29/month):
- 3 stations
- 1,000 tracks
- Advanced analytics

Enterprise ($99/month):
- Unlimited stations
- Unlimited tracks
- White label
- API access
```

---

## 📝 **IMPLEMENTATION CHECKLIST:**

### **Backend:**
- [ ] Create Station model in schema
- [ ] Add stationId/stationGroup to Track model
- [ ] Add stationId/stationGroup to Playlist model
- [ ] Add stationId/stationGroup to Schedule model
- [ ] Update authorization rules with groupsField
- [ ] Create Cognito groups (splashfm, wildfm, admin)
- [ ] Assign users to groups
- [ ] Migration script voor existing data

### **Frontend:**
- [ ] Create StationContext + Provider
- [ ] Build StationSelector component
- [ ] Update Layout with station selector
- [ ] Update all data queries with station filter
- [ ] Add station creation flow (admin only)
- [ ] Test multi-station switching
- [ ] Test authorization (cross-station access blocked)

### **Testing:**
- [ ] Test: User can only see their station's data
- [ ] Test: Admin can see all stations
- [ ] Test: Station switching updates data correctly
- [ ] Test: Cannot access other station's data
- [ ] Test: Migration preserves existing data

---

## 🚀 **ROLLOUT STRATEGY:**

### **Step 1: Internal Testing (Week 1)**
- Deploy backend changes
- Create test stations
- Manual testing

### **Step 2: Beta (Week 2)**
- Add 2-3 beta users
- Each gets own test station
- Gather feedback

### **Step 3: Production (Week 3)**
- Migrate SplashFM to new model
- Enable for all users
- Monitor & support

---

## 📚 **REFERENCE DOCUMENT:**

Complete implementation details in:
```
/TODO_MULTI_STATION_FEATURE.md
```

Dit bevat:
- Detailed code examples
- GraphQL schema updates
- UI mockups
- Security considerations
- Testing strategy

---

## 🎯 **SAMENVATTING:**

### **Huidige Situatie:**
```
❌ Geen multi-tenancy
❌ Geen Cognito groups
❌ Alle users delen data
❌ Geen station isolation
```

### **Na Implementatie:**
```
✅ Multi-station support
✅ Cognito group-based auth
✅ Per-station data isolation
✅ Admin kan alles beheren
✅ Users kunnen multiple stations hebben
```

---

**Effort:** Medium-Large (1-2 weken)  
**Priority:** Medium  
**Impact:** High (enables platform scaling)

**Status:** 📋 GEPLAND - Volledig uitgewerkt, nog niet geïmplementeerd

---

**Laatste update:** 14 Nov 2025, 11:00 CET
