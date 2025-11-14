# 🎨 Genre Merger - Library Management Tool

**Created:** 13 November 2025, 23:45 CET  
**Purpose:** Merge duplicate/similar genres to clean up library  
**Status:** Ready to Deploy

---

## 📋 Overview

**Problem:** Library gets messy with duplicate/similar genres:
- "Techno"
- "Techno (Peak Time)"
- "Peak Time Techno"
- "Techno - Peak Time"
- "techno"

**Solution:** Merge them into one canonical genre.

---

## 🎯 Use Cases

### **1. Consolidate Variations**
```json
{
  "sourceGenres": [
    "Techno (Peak Time)",
    "Peak Time Techno",
    "Techno - Peak Time"
  ],
  "targetGenre": "Techno"
}
```

### **2. Fix Typos**
```json
{
  "sourceGenres": ["techno", "TECHNO", "Tecnho"],
  "targetGenre": "Techno"
}
```

### **3. Standardize Names**
```json
{
  "sourceGenres": [
    "Dance",
    "Dance Music",
    "Dance / Electronic"
  ],
  "targetGenre": "Dance / Electro Pop"
}
```

---

## 🚀 Usage

### **Method 1: Via AWS CLI**

#### **Step 1: Get Genre Statistics**
```bash
aws lambda invoke \
  --function-name [GENRE_MERGER_LAMBDA_NAME] \
  --region eu-west-1 \
  --payload '{
    "sourceGenres": ["__STATS__"]
  }' \
  response.json

cat response.json | jq '.genreStats'
```

**Output:**
```json
{
  "Techno (Raw / Deep / Hypnotic)": 603,
  "Techno (Peak Time / Driving)": 245,
  "Dance / Electro Pop": 89,
  "Blues": 12,
  "Unknown": 5
}
```

#### **Step 2: Preview Merge (Dry Run)**
```bash
aws lambda invoke \
  --function-name [GENRE_MERGER_LAMBDA_NAME] \
  --region eu-west-1 \
  --payload '{
    "sourceGenres": [
      "Techno (Peak Time / Driving)",
      "Peak Time Techno"
    ],
    "targetGenre": "Techno",
    "dryRun": true
  }' \
  response.json

cat response.json | jq '.'
```

**Output:**
```json
{
  "success": true,
  "dryRun": true,
  "tracksAffected": 245,
  "playlistsAffected": 3,
  "preview": [
    {
      "id": "track-123",
      "oldGenre": "Techno (Peak Time / Driving)",
      "newGenre": "Techno",
      "title": "Heat again",
      "artist": "Ackermann"
    },
    ...
  ],
  "message": "Preview: 245 tracks and 3 playlists would be updated"
}
```

#### **Step 3: Execute Merge**
```bash
aws lambda invoke \
  --function-name [GENRE_MERGER_LAMBDA_NAME] \
  --region eu-west-1 \
  --payload '{
    "sourceGenres": [
      "Techno (Peak Time / Driving)",
      "Peak Time Techno"
    ],
    "targetGenre": "Techno",
    "dryRun": false
  }' \
  response.json

cat response.json | jq '.'
```

**Output:**
```json
{
  "success": true,
  "dryRun": false,
  "tracksUpdated": 245,
  "playlistsUpdated": 3,
  "message": "Successfully updated 245 tracks and 3 playlists"
}
```

---

### **Method 2: Via UI (TODO)**

**Simple UI Component for Genre Management:**

```typescript
// /apps/web/src/pages/LibrarySettings.tsx

import { useState } from 'react'

export function GenreMerger() {
  const [sourceGenres, setSourceGenres] = useState<string[]>([])
  const [targetGenre, setTargetGenre] = useState('')
  const [genreStats, setGenreStats] = useState<Record<string, number>>({})
  
  // Load genre stats
  async function loadStats() {
    const response = await fetch('/api/genres/stats')
    const data = await response.json()
    setGenreStats(data.genreStats)
  }
  
  // Preview merge
  async function previewMerge() {
    const response = await fetch('/api/genres/merge', {
      method: 'POST',
      body: JSON.stringify({
        sourceGenres,
        targetGenre,
        dryRun: true
      })
    })
    return response.json()
  }
  
  // Execute merge
  async function executeMerge() {
    const response = await fetch('/api/genres/merge', {
      method: 'POST',
      body: JSON.stringify({
        sourceGenres,
        targetGenre,
        dryRun: false
      })
    })
    return response.json()
  }
  
  return (
    <div>
      <h2>Genre Merger</h2>
      <button onClick={loadStats}>Load Genre Stats</button>
      
      {/* Genre selection UI */}
      <select multiple onChange={...}>
        {Object.entries(genreStats).map(([genre, count]) => (
          <option key={genre} value={genre}>
            {genre} ({count} tracks)
          </option>
        ))}
      </select>
      
      <input 
        placeholder="Target genre name"
        value={targetGenre}
        onChange={(e) => setTargetGenre(e.target.value)}
      />
      
      <button onClick={previewMerge}>Preview</button>
      <button onClick={executeMerge}>Execute Merge</button>
    </div>
  )
}
```

---

## 📊 What Gets Updated

### **1. Track Table**
```
Before:
  genre: "Techno (Peak Time / Driving)"
  
After:
  genre: "Techno"
  updatedAt: "2025-11-13T23:45:00.000Z"
```

### **2. Playlist Table**
```
Before:
  genre: "Techno (Peak Time / Driving)"  // Genre filter
  
After:
  genre: "Techno"
  updatedAt: "2025-11-13T23:45:00.000Z"
```

---

## ⚠️ Safety Features

### **Dry Run Mode**
- Default: `dryRun: false`
- Set `dryRun: true` to preview without applying changes
- Returns list of affected tracks/playlists

### **Batch Processing**
- Updates max 25 tracks per batch (DynamoDB limit)
- Continues even if some tracks fail
- Returns count of successful updates

### **Validation**
- Source genres must not be empty
- Target genre must not be empty
- Invalid input returns 400 error

---

## 📝 Common Operations

### **Merge All Techno Variations**
```bash
aws lambda invoke \
  --function-name genre-merger \
  --payload '{
    "sourceGenres": [
      "Techno (Raw / Deep / Hypnotic)",
      "Techno (Peak Time / Driving)",
      "Peak Time Techno",
      "Hypnotic Techno",
      "Deep Techno"
    ],
    "targetGenre": "Techno",
    "dryRun": false
  }' \
  response.json
```

### **Standardize House Genres**
```bash
aws lambda invoke \
  --function-name genre-merger \
  --payload '{
    "sourceGenres": [
      "House",
      "Tech House",
      "Deep House",
      "Progressive House"
    ],
    "targetGenre": "House",
    "dryRun": false
  }' \
  response.json
```

### **Fix "Unknown" Genre**
```bash
aws lambda invoke \
  --function-name genre-merger \
  --payload '{
    "sourceGenres": ["Unknown", "unknown", "N/A", ""],
    "targetGenre": "Uncategorized",
    "dryRun": false
  }' \
  response.json
```

---

## 🔧 Deployment

### **Add to backend.ts:**
```typescript
import { genreMerger } from './functions/genre-merger/resource'

export const backend = defineBackend({
  // ... existing functions
  genreMerger
})

// Grant permissions
const genreMergerLambda = backend.genreMerger.resources.lambda
trackTable.grantReadWriteData(genreMergerLambda)
playlistTable.grantReadWriteData(genreMergerLambda)

backend.genreMerger.addEnvironment('TRACK_TABLE', trackTable.tableName)
backend.genreMerger.addEnvironment('PLAYLIST_TABLE', playlistTable.tableName)
```

### **Deploy:**
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
npx ampx sandbox
```

### **Get Lambda Name:**
```bash
aws lambda list-functions --region eu-west-1 | grep genreMerger
```

---

## 📊 Monitoring

### **CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/[GENRE_MERGER_NAME] --follow
```

**Look for:**
```
🎨 Genre Merger - Starting...
🔍 Scanning for tracks with genres: Techno (Peak Time), ...
✅ Found 245 tracks with source genres
🔄 Updating 245 tracks...
✅ Updated 245/245 tracks
🎵 Checking playlists with genre filters...
   Found 3 playlists to update
✅ Genre merge complete!
```

---

## ⚠️ Troubleshooting

### **Problem: "No tracks found"**
```bash
# Check genre stats first
aws lambda invoke \
  --function-name genre-merger \
  --payload '{"sourceGenres":["__STATS__"]}' \
  response.json

cat response.json | jq '.genreStats'
```

### **Problem: Lambda timeout**
```
Increase timeout in resource.ts:
timeoutSeconds: 300  // 5 minutes
memoryMB: 1024
```

### **Problem: Permission denied**
```
Check IAM permissions in backend.ts:
trackTable.grantReadWriteData(genreMergerLambda)
```

---

## 📈 Best Practices

1. **Always dry run first**
   ```json
   { "dryRun": true }
   ```

2. **Check stats before merging**
   ```json
   { "sourceGenres": ["__STATS__"] }
   ```

3. **Merge similar genres together**
   - Don't merge "Techno" with "House"
   - Do merge "Techno (Peak Time)" with "Techno"

4. **Use standardized names**
   - Prefer: "Techno", "House", "Trance"
   - Avoid: "techno", "TECHNO", "Tecnho"

5. **Document major merges**
   - Keep log of what was merged
   - Can help with rollback if needed

---

## 🔄 Rollback

**If merge went wrong:**

Genre merges are NOT reversible automatically. However, you can:

1. **Re-merge back:**
   ```json
   {
     "sourceGenres": ["Techno"],
     "targetGenre": "Techno (Peak Time / Driving)"
   }
   ```

2. **Check DynamoDB backup:**
   - Point-in-time recovery enabled
   - Can restore table to before merge

3. **Manual fix:**
   - Query tracks by `updatedAt`
   - Filter tracks updated during merge
   - Update manually if needed

**Prevention:** ALWAYS use `dryRun: true` first!

---

## 📝 Future Enhancements

- [ ] UI component in Library Settings
- [ ] Suggested merges (AI-powered)
- [ ] Undo/rollback functionality
- [ ] Genre taxonomy/hierarchy
- [ ] Bulk operations (merge multiple at once)
- [ ] Export/import genre mappings
- [ ] Genre usage analytics

---

**Status:** ✅ Built, Ready to Deploy  
**Next:** Add to backend.ts and deploy  
**Owner:** Gerard  
**Date:** 13 November 2025
