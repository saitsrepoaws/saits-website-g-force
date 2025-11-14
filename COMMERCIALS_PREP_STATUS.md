# 📺 Commercials Voorbereiding - Status Report

**Datum:** 14 Nov 2025, 11:00 CET  
**Status:** 🟡 IN PROGRESS - Voorbereid voor toekomstige commercials functionaliteit

---

## ✅ **WAT IS KLAAR:**

### **1. Database Schema Uitgebreid**
```typescript
// Track model in /amplify/data/resource.ts
Track: a.model({
  // Track Type Classification
  trackType: a.string().default('music'), // "music", "jingle", "commercial"
  
  // Category fields (used based on trackType)
  genre: a.string(), // Genre voor music tracks
  jingleCategory: a.string(), // Station ID, Sweeper, Promo, etc.
  commercialCategory: a.string(), // Product, Service, PSA, Promotion, etc.
  
  tags: a.string(), // Tags voor categorisatie
})
```

### **2. TypeScript Types Aangemaakt**
Bestand: `/apps/web/src/types/commercials.ts`

**Track Types:**
- `TrackType`: 'music' | 'jingle' | 'commercial'
- `CommercialCategory`: Product, Service, PSA, Promotion, Sponsorship, Contest, Event, Other
- `JingleCategory`: Station ID, Sweeper, Promo, Time Check, Weather, Contest, DJ Drop, Other

**Helper Functions:**
```typescript
detectTrackType(filename: string): TrackType
detectCommercialCategory(filename: string): CommercialCategory
detectJingleCategory(filename: string): JingleCategory
isCommercial(track: Track): boolean
isJingle(track: Track): boolean
isMusic(track: Track): boolean
```

### **3. Upload Interface Geüpdatet**
```typescript
// /apps/web/src/pages/devices/Libery.tsx
interface FileUploadItem {
  trackType: TrackType
  jingleCategory?: JingleCategory
  commercialCategory?: CommercialCategory
  tags: string // Sponsor names, categories, etc.
}
```

### **4. Auto-detectie Ingebouwd**
```typescript
// Detecteert automatisch type aan filename:
// - "commercial_coca_cola.mp3" → commercial
// - "spot_nike.mp3" → commercial
// - "jingle_station_id.mp3" → jingle
// - "normal_song.mp3" → music
```

---

## 🚧 **NOG TE DOEN (voor volledige functionaliteit):**

### **A. Upload UI Volledig Maken**
```
☐ Checkbox voor "Commercial" toggle (naast Jingle checkbox)
☐ Commercial Category dropdown (Product, Service, PSA, etc.)
☐ Tags veld voor sponsor names / adverteerders
☐ Visual indicator (rood icon?) voor commercials in lijst
☐ Filter optie: Toon alleen commercials
```

### **B. Commercial Blocks (toekomstig)**
```
☐ Create Commercial Block entity in schema
☐ UI om commercial blocks samen te stellen
☐ Sleep/drop interface voor blok samenstelling
☐ Preview functie voor commercial blocks
☐ Totale duur berekening per blok
```

### **C. Planner Integratie (toekomstig)**
```
☐ Schedule commercial blocks in playlists
☐ "Insert commercial every N tracks" optie
☐ "Insert commercial at specific time" optie
☐ Commercial rotation logic (avoid repeats)
☐ Sponsor-based scheduling (McDonalds elke uur)
```

### **D. Backend Support**
```
☐ Playlist generator updaten voor commercials
☐ Lambda function voor commercial scheduling
☐ SQS queue support voor commercial insertion
☐ Liquidsoap config voor commercial detection
```

---

## 📊 **HUIDIGE CAPABILITIES:**

### **Upload Flow:**
```
1. User uploads file met "commercial" in naam
   ↓
2. Auto-detectie: trackType = "commercial"
   ↓
3. Auto-detect category (Product/Service/PSA)
   ↓
4. Save in database met commercialCategory
   ↓
5. Klaar voor gebruik in planner (later)
```

### **Categorieën Ready:**
```
✅ Product        → Product advertisements
✅ Service        → Service advertisements  
✅ PSA            → Public Service Announcements
✅ Promotion      → Station promotions/events
✅ Sponsorship    → Sponsor messages
✅ Contest        → Contest announcements
✅ Event          → Event announcements
✅ Other          → Other commercial content
```

---

## 🎯 **USE CASES (toekomst):**

### **1. Automated Commercial Blocks**
```javascript
// Voorbeeld: Maak blok van 2 minuten commercials
const block = {
  name: "12:00 Commercial Break",
  duration: 120, // 2 minutes
  tracks: [
    "commercial_mcdonalds_30s.mp3",
    "commercial_nike_45s.mp3", 
    "psa_traffic_30s.mp3",
    "promo_contest_15s.mp3"
  ]
}
```

### **2. Smart Scheduling**
```javascript
// In playlist generator:
{
  includeCommercials: true,
  commercialsEveryN: 5, // Elke 5 tracks
  commercialCategory: "Product", // Filter op category
  commercialTags: "McDonalds, Nike" // Filter op tags
}
```

### **3. Sponsor Management**
```javascript
// Track commercials per sponsor:
{
  title: "McDonalds Summer Special",
  trackType: "commercial",
  commercialCategory: "Product",
  tags: "McDonalds, Summer, Food"
}
```

---

## 🔄 **MIGRATION NOTES:**

**Bestaande tracks blijven werken:**
```
- trackType default: "music"
- Bestaande jingles: blijven detecteerbaar
- Geen breaking changes
```

**Nieuwe uploads:**
```
- Auto-detect tussen music/jingle/commercial
- Manual override mogelijk in UI
- Tags voor extra categorisatie
```

---

## 📁 **AANGEPASTE BESTANDEN:**

```
✅ /amplify/data/resource.ts
   - Track model uitgebreid met trackType, commercialCategory
   - Playlist generator voorbereid voor commercials

✅ /apps/web/src/types/commercials.ts
   - NEW: Complete type definitions voor commercials

✅ /apps/web/src/pages/devices/Libery.tsx  
   - FileUploadItem interface updated
   - handleFilesSelected: auto-detect trackType
   - createTrack: commercialCategory support

⏳ TODO:
   - Upload UI: commercial checkbox + category selector
   - Filter UI: filter op trackType
   - Track list: visual indicator voor commercials
```

---

## 🎨 **UI SUGGESTIES (toekomst):**

### **Commercial Badge:**
```tsx
{track.trackType === 'commercial' && (
  <span className="badge badge-red">
    📺 Commercial
  </span>
)}
```

### **Category Icon:**
```tsx
{track.commercialCategory === 'Product' && '🛍️'}
{track.commercialCategory === 'Service' && '🔧'}
{track.commercialCategory === 'PSA' && '📢'}
{track.commercialCategory === 'Sponsorship' && '🤝'}
```

---

## 🔧 **DEPLOYMENT:**

```bash
# 1. Push backend changes:
npx amplify sandbox

# 2. Database migratie:
# Auto-migration: bestaande tracks krijgen trackType = "music"

# 3. Deploy frontend:
npm run build
```

---

## ✅ **SAMENVATTING:**

```
Database:       ✅ KLAAR - commercialCategory field added
Types:          ✅ KLAAR - Complete type system
Auto-detect:    ✅ KLAAR - Filename-based detection
Upload logic:   ✅ KLAAR - Save commercialCategory in DB
UI:             🚧 TODO - Checkbox + category dropdown
Planner:        📅 FUTURE - Commercial block scheduling
```

**Status:** Volledig voorbereid voor commercial uploads!  
**Volgende stap:** UI aanpassingen voor manual commercial selection

---

**Laatste update:** 14 Nov 2025, 11:00 CET
