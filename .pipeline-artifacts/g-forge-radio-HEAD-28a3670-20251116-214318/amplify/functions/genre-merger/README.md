# 🎨 Genre Merger Lambda

**Purpose:** Consolidate duplicate/similar genres in track library  
**Use Case:** Clean up genre variations and typos

---

## Quick Reference

### **Get Genre Statistics:**
```bash
aws lambda invoke \
  --function-name [NAME] \
  --region eu-west-1 \
  --payload '{"sourceGenres":["__STATS__"]}' \
  response.json && cat response.json | jq '.genreStats'
```

### **Preview Merge (Dry Run):**
```bash
aws lambda invoke \
  --function-name [NAME] \
  --region eu-west-1 \
  --payload '{
    "sourceGenres": ["Techno (Peak Time)", "Peak Time Techno"],
    "targetGenre": "Techno",
    "dryRun": true
  }' \
  response.json && cat response.json | jq '.'
```

### **Execute Merge:**
```bash
aws lambda invoke \
  --function-name [NAME] \
  --region eu-west-1 \
  --payload '{
    "sourceGenres": ["Techno (Peak Time)", "Peak Time Techno"],
    "targetGenre": "Techno",
    "dryRun": false
  }' \
  response.json && cat response.json | jq '.'
```

---

## Input Format

```typescript
{
  sourceGenres: string[]  // Genres to merge (will be replaced)
  targetGenre: string     // New genre name
  dryRun?: boolean       // true = preview, false = execute (default: false)
}
```

---

## Output Format

```typescript
{
  success: boolean
  dryRun: boolean
  tracksUpdated: number       // Actual updates (0 if dry run)
  tracksAffected: number      // Total tracks that will be updated
  playlistsUpdated: number    // Actual playlist updates
  playlistsAffected: number   // Total playlists affected
  sourceGenres: string[]
  targetGenre: string
  preview?: TrackUpdate[]     // First 10 tracks (dry run only)
  message: string
}
```

---

## Examples

### **Consolidate Techno Variations:**
```json
{
  "sourceGenres": [
    "Techno (Peak Time / Driving)",
    "Techno (Raw / Deep / Hypnotic)",
    "Peak Time Techno",
    "Deep Techno"
  ],
  "targetGenre": "Techno"
}
```

### **Fix Typos:**
```json
{
  "sourceGenres": ["techno", "TECHNO", "Tecnho"],
  "targetGenre": "Techno"
}
```

### **Remove "Unknown":**
```json
{
  "sourceGenres": ["Unknown", "unknown", "N/A", ""],
  "targetGenre": "Uncategorized"
}
```

---

## Safety Features

✅ **Dry Run Mode** - Preview changes before applying  
✅ **Batch Processing** - Handles large libraries (25 tracks/batch)  
✅ **Error Handling** - Continues even if some tracks fail  
✅ **Validation** - Checks input before processing  
✅ **Logging** - Full CloudWatch logging  

---

## IAM Permissions Required

```typescript
// In backend.ts
trackTable.grantReadWriteData(genreMergerLambda)
playlistTable.grantReadWriteData(genreMergerLambda)
```

---

## Environment Variables

- `TRACK_TABLE` - DynamoDB Track table name
- `PLAYLIST_TABLE` - DynamoDB Playlist table name

---

## Performance

- **Timeout:** 300 seconds (5 minutes)
- **Memory:** 1024 MB
- **Typical Runtime:** 10-30 seconds for 100 tracks
- **Max Capacity:** Handles thousands of tracks

---

## Monitoring

```bash
# Watch logs
aws logs tail /aws/lambda/[NAME] --follow

# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=[NAME] \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

**Full Documentation:** [/docs/GENRE_MERGER_GUIDE.md](../../../docs/GENRE_MERGER_GUIDE.md)

**Status:** ✅ Ready to Deploy  
**Created:** 13 November 2025
