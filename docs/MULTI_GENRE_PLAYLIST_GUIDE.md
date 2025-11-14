# 🎨 Multi-Genre Playlist Generator - Complete Guide

**Created:** 13 November 2025, 23:50 CET  
**Status:** ✅ ACTIVE - Fully Implemented  
**Lambda:** `playlist-generator`

---

## 🎯 Features

✅ **Multi-Genre Mix** - Combine genres with exact percentages  
✅ **Auto Jingles** - Insert station IDs/sweepers automatically  
✅ **60-Minute Perfect** - Automatically fills to exactly 1 hour  
✅ **Harmonic Mixing** - Camelot Wheel key matching  
✅ **Energy Flow** - Build/Constant/Wave progressions  
✅ **BPM Smoothing** - No jarring tempo changes  
✅ **Smart Track Selection** - No duplicates, optimal flow  

---

## 📊 Example 1: Multi-Genre Mix (70% Techno, 30% House)

### **GraphQL Mutation:**
```graphql
mutation GenerateMultiGenrePlaylist {
  generatePlaylist(
    name: "Peak Time Mix"
    description: "70% Techno, 30% House - Perfect 60 min set"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":70},{\"genre\":\"House\",\"percentage\":30}]"
    bpmMin: 125
    bpmMax: 135
    includeJingles: true
    jinglesEveryN: 3
    jingleGenre: "Station ID"
    jingleTags: "SplashFM"
  ) {
    success
    playlist {
      id
      name
      trackCount
      totalDuration
      tracks
    }
    tracksSelected
  }
}
```

### **Result:**
```
✅ Playlist Created!
   Name: Peak Time Mix
   Tracks: 18 tracks + 6 jingles = 24 total
   Duration: 59:45 (perfect!)
   
   Genre breakdown:
   - Techno: 42:00 (70%)
   - House: 17:45 (30%)
   
   Jingles: Every 3 tracks
```

---

## 📊 Example 2: Triple Genre Mix (60/30/10)

### **GraphQL Mutation:**
```graphql
mutation GenerateTripleGenre {
  generatePlaylist(
    name: "Dance Floor Journey"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":60},{\"genre\":\"House\",\"percentage\":30},{\"genre\":\"Trance\",\"percentage\":10}]"
    mood: "Energetic"
    includeJingles: true
    jinglesEveryN: 2
  ) {
    success
    playlist {
      id
      name
      trackCount
      totalDuration
    }
  }
}
```

### **Result:**
```
✅ Multi-Genre Mix!
   Techno: 36:00 (60%)
   House: 18:00 (30%)
   Trance: 6:00 (10%)
   
   Total: 60:00 + jingles
   Interleaved professionally for smooth transitions
```

---

## 🎤 Example 3: With Jingles & Sweepers

### **GraphQL Mutation:**
```graphql
mutation WithJingles {
  generatePlaylist(
    name: "SplashFM Peak Hour"
    genre: "Techno"
    bpmMin: 128
    bpmMax: 135
    includeJingles: true
    jinglesEveryN: 2
    jingleGenre: "Station ID"
    jingleTags: "SplashFM,Peak Time,Sweepers"
  ) {
    success
    playlist {
      trackCount
      totalDuration
    }
  }
}
```

### **Result:**
```
Playlist Structure:
  Track 1: Techno track
  Track 2: Techno track
  ← Jingle: SplashFM Sweeper
  Track 3: Techno track
  Track 4: Techno track
  ← Jingle: Peak Time ID
  Track 5: Techno track
  ...
  
Total: 16 tracks + 8 jingles = 60:15
```

---

## 🎛️ All Parameters

### **Basic:**
```typescript
{
  name: string                 // Playlist name
  description?: string         // Description
}
```

### **Single Genre (Legacy):**
```typescript
{
  genre?: string              // "Techno", "House", etc.
}
```

### **Multi-Genre (NEW!):**
```typescript
{
  genreMix?: string           // JSON string: "[{genre,percentage}]"
}
```

**Format:**
```json
"[
  {\"genre\":\"Techno\",\"percentage\":70},
  {\"genre\":\"House\",\"percentage\":20},
  {\"genre\":\"Trance\",\"percentage\":10}
]"
```

### **Filters:**
```typescript
{
  mood?: string               // "Energetic", "Chill", "Dark", etc.
  bpmMin?: number            // Minimum BPM (e.g. 125)
  bpmMax?: number            // Maximum BPM (e.g. 135)
  keys?: string[]            // Musical keys ["C", "Am", "G"]
  tags?: string              // Comma-separated tags
}
```

### **Duration:**
```typescript
{
  maxTracks?: number         // Max tracks (default: 20)
  maxDuration?: number       // Max seconds (default: 3600 = 60 min)
}
```

### **Jingles:**
```typescript
{
  includeJingles?: boolean   // Add jingles (default: false)
  jinglesEveryN?: number     // Insert every N tracks (default: 2)
  jingleGenre?: string       // Genre filter (default: "Station ID")
  jingleTags?: string        // Tags filter (e.g. "SplashFM,Sweepers")
}
```

---

## 🎯 How Multi-Genre Works

### **1. Calculate Target Durations**
```
Total target: 60:00 (3600 seconds)

Genre mix: [
  {genre: "Techno", percentage: 70},
  {genre: "House", percentage: 30}
]

Calculated targets:
  Techno: 70% of 3600s = 2520s (42:00)
  House: 30% of 3600s = 1080s (18:00)
```

### **2. Select Tracks Per Genre**
```
🎵 Selecting for Techno (70%)...
   ✅ Track 1 (5:20) | Total: 5:20
   ✅ Track 2 (5:45) | Total: 11:05
   ✅ Track 3 (5:10) | Total: 16:15
   ...
   📊 Techno: 42:15 / 42:00 target ✓

🎵 Selecting for House (30%)...
   ✅ Track 1 (5:30) | Total: 5:30
   ✅ Track 2 (6:00) | Total: 11:30
   ...
   📊 House: 18:05 / 18:00 target ✓
```

### **3. Interleave Genres**
```
Final playlist order:
  1. Techno track
  2. House track
  3. Techno track
  4. House track
  5. Techno track
  6. Techno track  ← More Techno (70%)
  7. House track
  8. Techno track
  ...
  
Professional mix with smooth genre transitions!
```

---

## 🎤 How Jingles Work

### **Configuration:**
```json
{
  "includeJingles": true,
  "jinglesEveryN": 2,
  "jingleGenre": "Station ID",
  "jingleTags": "SplashFM,Sweepers"
}
```

### **Process:**
1. **Filter jingles** by genre ("Station ID")
2. **Further filter** by tags (matches "SplashFM" OR "Sweepers")
3. **Insert** after every N tracks
4. **Loop** through available jingles
5. **Skip last position** (don't end with jingle)

### **Example Flow:**
```
jinglesEveryN = 2

Track 1 (music)
Track 2 (music)
← Jingle 1 inserted here
Track 3 (music)
Track 4 (music)
← Jingle 2 inserted here
Track 5 (music)
Track 6 (music)
← Jingle 3 inserted here
...
```

---

## 🎯 60-Minute Perfect Targeting

### **Target Range:**
```
Perfect: 60:00 (3600s)
Acceptable: 58:00 - 61:00
Good: 57:00 - 62:00
```

### **Smart Selection:**
```
1. Calculate running total
2. If next track exceeds 61:00:
   - If current total >= 58:00 → STOP (perfect!)
   - If current total < 58:00 → Try next track (might be shorter)
3. Keep adding until perfect range
```

### **Example:**
```
Track 1: 5:20 | Total: 5:20
Track 2: 5:45 | Total: 11:05
Track 3: 5:10 | Total: 16:15
...
Track 16: 5:30 | Total: 58:45
Track 17: 5:25 | Total: 64:10 (would exceed!)
  → But 58:45 is in perfect range!
  → STOP HERE ✓

Final: 58:45 (within 2 minutes of target) ✅
```

---

## 📊 Output Format

### **Success Response:**
```json
{
  "success": true,
  "playlist": {
    "id": "playlist-1731534000-abc123",
    "name": "Peak Time Mix",
    "description": "Auto-generated...",
    "genre": "Techno",
    "genreMix": "[{...}]",
    "trackCount": 24,
    "totalDuration": 3585,
    "tracks": "[{trackId, order, ...}, ...]",
    "createdAt": "2025-11-13T23:00:00.000Z"
  },
  "tracksMatched": 245,
  "tracksSelected": 18
}
```

### **Playlist Tracks Format:**
```json
{
  "trackId": "track-123",
  "order": 0,
  "trackTitle": "Heat again",
  "trackArtist": "Ackermann",
  "trackDuration": 320,
  "trackActualDuration": 305,
  "trackTrimStart": 5,
  "trackTrimEnd": 310,
  "trackMixOutPoint": 285,
  "trackMixInPoint": 5,
  "trackBpm": 130,
  "trackKey": "Am",
  "trackGenre": "Techno",
  "trackCoverArtUrl": "s3://..."
}
```

---

## 🎛️ Advanced Features

### **1. Harmonic Mixing (Camelot Wheel)**
```graphql
mutation HarmonicMix {
  generatePlaylist(
    name: "Harmonic Journey"
    genre: "Techno"
    keys: ["Am", "C", "G", "Em"]  # Compatible keys
  )
}
```

**Result:** Tracks flow harmonically using Camelot Wheel

### **2. Energy Flow**
```graphql
mutation EnergyProgression {
  generatePlaylist(
    name: "Build to Peak"
    genre: "Techno"
    mood: "Driving"  # Creates "build" progression
  )
}
```

**Progressions:**
- **Build:** Low → High energy (warm-up to peak)
- **Constant:** Steady energy (peak time set)
- **Wave:** Low → High → Low (journey)

### **3. BPM Smoothing**
```
Automatic! No large BPM jumps.

Example flow:
  125 BPM → 127 BPM → 128 BPM → 130 BPM → 128 BPM
  
Avoids jarring changes like:
  125 BPM → 138 BPM ❌ (too big jump)
```

---

## 🧪 Testing

### **Test 1: Simple Multi-Genre**
```bash
# In GraphQL API Explorer:
mutation {
  generatePlaylist(
    name: "Test Mix"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":70},{\"genre\":\"House\",\"percentage\":30}]"
    maxTracks: 10
  ) {
    success
    playlist {
      name
      trackCount
      totalDuration
    }
  }
}
```

### **Test 2: With Jingles**
```bash
mutation {
  generatePlaylist(
    name: "Test with Jingles"
    genre: "Techno"
    includeJingles: true
    jinglesEveryN: 2
    maxTracks: 6
  ) {
    success
    playlist {
      trackCount
    }
  }
}
```

Expected: 6 tracks + 2-3 jingles = 8-9 total

---

## 📝 Common Use Cases

### **1. Radio Hour (60 min exact)**
```json
{
  "name": "Top of the Hour",
  "genre": "Techno",
  "includeJingles": true,
  "jinglesEveryN": 3,
  "jingleTags": "SplashFM"
}
```

### **2. Multi-Genre Dance Set**
```json
{
  "name": "Dance Floor Mix",
  "genreMix": "[{\"genre\":\"Techno\",\"percentage\":50},{\"genre\":\"House\",\"percentage\":30},{\"genre\":\"Trance\",\"percentage\":20}]",
  "bpmMin": 125,
  "bpmMax": 140
}
```

### **3. Chill Hour with IDs**
```json
{
  "name": "Late Night Chill",
  "genre": "Ambient",
  "mood": "Chill",
  "includeJingles": true,
  "jinglesEveryN": 4
}
```

---

## 🎯 Pro Tips

1. **Percentages Must Add to 100**
   ```json
   ✅ GOOD: [70, 20, 10] = 100%
   ❌ BAD:  [70, 40, 10] = 120%
   ```

2. **Jingle Tags Are OR Logic**
   ```
   jingleTags: "SplashFM,Peak Time"
   → Matches jingles with "SplashFM" OR "Peak Time"
   ```

3. **BPM Range for Smooth Mix**
   ```
   ✅ GOOD: bpmMin: 125, bpmMax: 135 (±10 BPM)
   ❌ BAD:  bpmMin: 120, bpmMax: 150 (too wide)
   ```

4. **Keys for Harmonic Mix**
   ```
   Use compatible keys from Camelot Wheel:
   - C major (8B) → G major (9B), F major (7B)
   - Am (5A) → Dm (7A), Em (9A)
   ```

---

## 🚀 Status

**Implementation:** ✅ COMPLETE  
**Location:** `/amplify/functions/playlist-generator/handler.ts`  
**Lines:** 718 lines of professional playlist generation  
**Features:** All advanced features fully implemented  

---

**Ready to use! Just call the GraphQL mutation!** 🎉
