# 🎵 Unified Audio Pipeline - Single S3 Bucket

## 🎯 Probleem Opgelost

**Oud systeem:**
- ❌ UI uploads → `public/audio/ui/` (manual DynamoDB entry)
- ❌ Bulk uploads → `public/audio/bulk/` (Lambda processing)
- ❌ Verschillende pipelines = inconsistent
- ❌ Playback errors (URL format mismatch)

**Nieuw systeem:**
- ✅ **ALLES** → `public/audio/bulk/`
- ✅ **ÉÉN** processing pipeline
- ✅ Consistent S3 path format
- ✅ Playback werkt altijd!

---

## 🏗️ Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│  UNIFIED AUDIO PIPELINE (Single S3 Bucket)                  │
└─────────────────────────────────────────────────────────────┘

UI Upload (via browser):
   │
   ├─► Upload to: s3://bucket/public/audio/bulk/timestamp-file.mp3
   │
   └─► Triggers S3 event notification
       │
       ↓

CLI Bulk Upload:
   │
   ├─► Upload to: s3://bucket/public/audio/bulk/Artist-Title.mp3
   │
   └─► Triggers S3 event notification
       │
       ↓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SAME PROCESSING PIPELINE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   S3 Event Notification
         ↓
   SQS Queue (g-forge-radio-bulk-upload-queue)
         ↓
   Lambda: bulk-track-processor
         │
         ├─► Validate file
         ├─► Parse metadata from filename
         ├─► Check for duplicates (GSI query)
         ├─► Create track record in DynamoDB
         │   • fileUrl: "public/audio/bulk/filename.mp3" ✅
         │   • NOT full URL (consistent format!)
         │
         └─► Invoke audio-metadata Lambda (async)
                ↓
              Extract metadata
              Generate cover art
              Generate waveform
              Update DynamoDB
              
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PLAYBACK (consistent voor ALLE tracks):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Player requests track
         ↓
   Read track.fileUrl from DynamoDB
         ↓
   fileUrl = "public/audio/bulk/filename.mp3"
         ↓
   getUrl({ path: fileUrl })
         ↓
   Returns presigned URL (24h expiry)
         ↓
   Audio plays! ✅
```

---

## 📦 S3 Bucket Structure

```
s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-dmnly9ayjibv/
│
├── public/
│   ├── audio/
│   │   ├── bulk/                    ← UNIFIED FOLDER
│   │   │   ├── Artist-Title.mp3     ← CLI bulk upload
│   │   │   ├── 1234567890-song.mp3  ← UI upload
│   │   │   └── ...
│   │   │
│   │   └── ui/                      ← DEPRECATED (not used anymore)
│   │
│   ├── covers/
│   │   └── ...
│   │
│   └── waveforms/
│       └── ...
│
└── backup/
    └── audio/
        └── ...
```

---

## 🔧 Wat Er Is Gewijzigd

### 1. **bulk-track-processor Lambda**

```typescript
// VOOR (fout):
const fileUrl = `https://${STORAGE_BUCKET}.s3.${region}.amazonaws.com/${key}`
// Probleem: Full URL in DynamoDB → playback errors

// NA (correct):
const fileUrl = key // "public/audio/bulk/filename.mp3"
// Player gebruikt getUrl() voor presigned URL → altijd werkend!
```

### 2. **UI Upload Service**

```typescript
// apps/web/src/services/audioUpload.ts

// VOOR:
const key = `audio/ui/${timestamp}-${sanitizedName}`
// Manual DynamoDB entry needed

// NA:
const key = `audio/bulk/${timestamp}-${sanitizedName}`
// S3 trigger → Lambda → automatic processing!
```

### 3. **List Audio Files**

```typescript
// VOOR:
await list({ path: 'audio/ui/' })

// NA:
await list({ path: 'audio/bulk/' })
// Lists all tracks (UI + CLI uploads)
```

---

## ✅ Voordelen

| Aspect | Oud Systeem | Nieuw Systeem |
|--------|-------------|---------------|
| **Upload folders** | 2 separate (`ui/`, `bulk/`) | 1 unified (`bulk/`) |
| **Processing** | Manual + Automatic | Always automatic |
| **Metadata** | Manual entry | Auto-extracted |
| **Deduplication** | No | Yes (GSI query) |
| **Playback** | ❌ URL format errors | ✅ Always works |
| **Cover art** | Manual | Auto-generated |
| **Waveform** | Manual | Auto-generated |
| **Consistency** | ❌ Different formats | ✅ Single format |

---

## 🚀 Gebruik

### UI Upload (Browser)

```typescript
import { uploadAudioFile } from '@/services/audioUpload'

// Upload audio file
const result = await uploadAudioFile(file, (progress) => {
  console.log(`Progress: ${progress.percentage}%`)
})

// File is now in: public/audio/bulk/timestamp-filename.mp3
// S3 trigger → Lambda → auto-processing
// Track appears in DynamoDB after ~20 seconds
```

### CLI Bulk Upload

```bash
# Upload single file
aws s3 cp "Artist-Title.mp3" \
  s3://BUCKET/public/audio/bulk/ \
  --region eu-west-1

# Upload folder
aws s3 cp /path/to/music/ \
  s3://BUCKET/public/audio/bulk/ \
  --recursive \
  --region eu-west-1

# S3 trigger → Lambda → auto-processing
# All tracks processed automatically!
```

### Playback

```typescript
import { getUrl } from 'aws-amplify/storage'

// Get track from DynamoDB
const track = await getTrack(trackId)

// track.fileUrl = "public/audio/bulk/filename.mp3"

// Generate presigned URL
const result = await getUrl({ 
  path: track.fileUrl,
  options: { expiresIn: 86400 } // 24h
})

// Play audio
audioElement.src = result.url.toString()
audioElement.play()
```

---

## 🧪 Testing

### Test 1: UI Upload

```bash
# 1. Open UI in browser
# 2. Upload audio file via upload button
# 3. Wait 20 seconds
# 4. Check DynamoDB:

aws dynamodb scan \
  --table-name Track-uver42v45fdhlkyj2yyuifc2vm-NONE \
  --region eu-west-1 \
  --output json | jq '.Items[] | {
    title: .title.S,
    fileUrl: .fileUrl.S
  }'

# Expected: fileUrl = "public/audio/bulk/timestamp-filename.mp3"
```

### Test 2: CLI Bulk Upload

```bash
# 1. Upload test file
aws s3 cp "Test-Artist-Title.mp3" \
  s3://BUCKET/public/audio/bulk/ \
  --region eu-west-1

# 2. Wait 20 seconds
# 3. Check DynamoDB (same command as above)

# Expected: Track exists with correct fileUrl
```

### Test 3: Playback

```bash
# 1. Get track from DynamoDB
# 2. Use fileUrl in player
# 3. Should play without errors ✅
```

---

## 🔍 Verificatie

### Check S3 Structure

```bash
# List bulk folder
aws s3 ls s3://BUCKET/public/audio/bulk/ \
  --region eu-west-1 \
  --recursive

# Should contain both UI and CLI uploads
```

### Check DynamoDB Format

```bash
# Scan tracks
aws dynamodb scan \
  --table-name Track-uver42v45fdhlkyj2yyuifc2vm-NONE \
  --region eu-west-1 \
  --output json | jq -r '.Items[] | "
Track: \(.title.S)
FileURL: \(.fileUrl.S)
Format: \(if .fileUrl.S | startswith("public/") then "✅ Correct" else "❌ Wrong" end)
"'

# ALL tracks should have fileUrl starting with "public/"
```

### Check Lambda Logs

```bash
# Tail bulk processor logs
aws logs tail /aws/lambda/amplify-gforgeiot-gerard--bulktrackprocessorlambda-M2VF0tTs8MyR \
  --region eu-west-1 \
  --since 10m \
  --follow

# Look for:
# ✅ "Track created with ID: ..."
# ✅ "Successfully queued for processing"
```

---

## 🐛 Troubleshooting

### Playback niet werkend

**Symptom:** Audio files not playing, 404 or access denied

**Oorzaak:** Track has old URL format in DynamoDB

**Fix:**
```typescript
// Check track.fileUrl format
console.log(track.fileUrl)

// Should be: "public/audio/bulk/filename.mp3"
// NOT:      "https://bucket.s3.amazonaws.com/..."

// If wrong format, re-upload file or update DynamoDB
```

### Files not processing

**Symptoom:** File uploaded maar geen track in DynamoDB

**Check:**
1. S3 event notifications configured
2. SQS queue receiving messages
3. Lambda has permissions
4. Lambda logs for errors

```bash
# Check SQS messages
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/.../g-forge-radio-bulk-upload-queue \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1
```

---

## 📊 Migration Plan

### Voor Bestaande Tracks

Als je al tracks hebt met oude URL format:

```typescript
// Script om oude tracks te fixen
import { updateTrack } from './services/tracks'

async function migrateOldTracks() {
  const tracks = await getAllTracks()
  
  for (const track of tracks) {
    if (track.fileUrl.includes('amazonaws.com')) {
      // Extract S3 path from full URL
      const url = new URL(track.fileUrl)
      const s3Path = url.pathname.substring(1) // Remove leading '/'
      
      // Update track with correct format
      await updateTrack(track.id, {
        fileUrl: s3Path
      })
      
      console.log(`✅ Fixed: ${track.title}`)
    }
  }
}
```

---

## 🎊 Resultaat

✅ **ÉÉN S3 bucket voor alles**  
✅ **ÉÉN processing pipeline**  
✅ **Consistent fileUrl format**  
✅ **Playback altijd werkend**  
✅ **Automatic metadata extraction**  
✅ **Deduplication built-in**  
✅ **Simpeler systeem = minder bugs**  

**UNIFIED = BETER! 🚀**
