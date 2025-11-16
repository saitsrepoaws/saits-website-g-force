# 🎵 G-FORCE UPLOAD ZONE - Drop & Process

**Date:** 16 November 2025, 18:56 CET  
**Gerard's Request:** "s3 bucket maker apart gforce upload-content met lambda trigger"

---

## 🎯 CONCEPT

### **Public Drop Zone voor Audio Files**

```
┌────────────────────────────────────────────────────────┐
│ UPLOAD ZONE WORKFLOW                                   │
└────────────────────────────────────────────────────────┘

1. 📤 User uploads file
   ↓
   s3://gforce-upload-zone/uploads/track.mp3

2. 🔔 S3 Event triggers Lambda
   ↓
   upload-processor Lambda starts

3. 🔍 Lambda analyzes file
   ├─ Extract metadata (artist, title, BPM, genre)
   ├─ Parse filename (Artist - Title (Version) [Label])
   ├─ Get audio features (duration, bitrate, sample rate)
   └─ Prepare track data

4. 💾 Lambda creates Track record
   ↓
   DynamoDB Track table

5. 📦 Lambda moves file
   ↓
   s3://main-storage/public/audio/Artist - Title.mp3

6. 🎨 Auto-trigger processing
   ├─ Metadata extraction (existing Lambda)
   ├─ Waveform generation (existing Lambda)
   └─ Cover art extraction (existing Lambda)

7. 🗑️ Lambda cleanup
   ↓
   Delete from upload zone

8. ✅ DONE!
```

---

## 📦 BUCKET STRUCTURE

### **gforce-upload-zone/**

```
uploads/          ← Public write access
├─ track1.mp3
├─ track2.mp3
└─ track3.mp3

processing/       ← Lambda working area
├─ track1.mp3
└─ metadata.json

errors/           ← Failed uploads
└─ broken-file.mp3
```

---

## 🔐 PERMISSIONS

### **Public Upload Access:**

```typescript
'uploads/*': [
  allow.guest.to(['write']),           // Anyone can upload
  allow.authenticated.to(['read', 'write', 'delete'])
]
```

### **Lambda Access:**

```typescript
'processing/*': [
  allow.resource(uploadProcessor).to(['read', 'write', 'delete'])
]
```

### **Main Storage:**

```typescript
// Lambda can move files to main bucket
uploadProcessor.addToRolePolicy({
  actions: ['s3:PutObject'],
  resources: ['arn:aws:s3:::main-storage/public/audio/*']
})
```

---

## 🎵 FILENAME PARSING

### **Supported Format:**

```
Artist - Title (Version) [Label].mp3
```

**Examples:**
```
Daft Punk - One More Time.mp3
→ Artist: Daft Punk
→ Title: One More Time

Tiësto - Adagio For Strings (Original Mix) [Black Hole].mp3
→ Artist: Tiësto
→ Title: Adagio For Strings
→ Version: Original Mix
→ Label: Black Hole
```

---

## 🔄 SAME WORKFLOW AS UI UPLOAD

### **Huidig (UI Upload):**

```
UI → S3 → Metadata Lambda → Waveform Lambda → Track DB
```

### **Nieuw (Drop Zone):**

```
Drop Zone → Upload Processor → S3 → Metadata Lambda → Waveform Lambda → Track DB
                ↑
          (Same trigger chain!)
```

**Key Insight:** Upload processor MOVES file to main storage, waarna de BESTAANDE Lambda triggers gewoon werken!

---

## 💾 TRACK RECORD STRUCTURE

```typescript
{
  id: "uuid-v4",
  artist: "Daft Punk",
  title: "One More Time",
  genre: "House",
  year: 2000,
  bpm: 123,
  key: "Fm",
  duration: 320,           // seconds
  sampleRate: 44100,
  bitrate: 320000,
  version: "Radio Edit",
  label: "Virgin",
  s3Key: "public/audio/Daft_Punk_-_One_More_Time.mp3",
  uploadedAt: "2025-11-16T18:56:00Z",
  uploadedVia: "drop-zone",
  status: "processing",    // → "ready" after full processing
  processingStage: "uploaded"
}
```

---

## ⚡ LAMBDA HANDLER FEATURES

### **1. Metadata Extraction**

```typescript
// Using music-metadata library
const metadata = await parseFile(buffer)

// Extract:
- Artist, Title, Album
- Genre, Year, BPM
- Duration, Bitrate, Sample Rate
- Key signature
```

### **2. Filename Parsing (Fallback)**

```typescript
// If no metadata in file, parse filename
parseFilename("Artist - Title (Version) [Label].mp3")

// Returns:
{
  artist: "Artist",
  title: "Title",
  version: "Version",
  label: "Label"
}
```

### **3. File Moving**

```typescript
// Copy to main storage
s3.copy(
  from: "gforce-upload-zone/uploads/track.mp3",
  to: "main-storage/public/audio/Artist - Title.mp3"
)

// Delete from upload zone
s3.delete("gforce-upload-zone/uploads/track.mp3")
```

### **4. Error Handling**

```typescript
try {
  // Process upload
} catch (error) {
  // Move to errors/ folder for inspection
  s3.copy(
    from: "uploads/broken.mp3",
    to: "errors/broken.mp3"
  )
}
```

---

## 🚀 DEPLOYMENT

### **Files Created:**

```
amplify/
├─ storage/
│  └─ upload-zone.ts                    ← Storage definition
└─ functions/
   └─ upload-processor/
      ├─ handler.ts                     ← Lambda code
      └─ package.json                   ← Dependencies
```

### **Next Steps:**

1. ✅ Files created
2. ⏳ Waiting for current deployment to finish
3. 🔄 Add to backend.ts
4. 🚀 Deploy upload zone
5. 🧪 Test upload workflow

---

## 📊 USE CASES

### **1. Bulk Upload**

```bash
# Upload entire folder
aws s3 cp ./music/ s3://gforce-upload-zone/uploads/ --recursive
```

### **2. FTP/SFTP Integration**

```bash
# Mount S3 as FTP
# Users upload via FTP → Auto-process
```

### **3. API Upload**

```typescript
// From external app
await s3.putObject({
  Bucket: 'gforce-upload-zone',
  Key: 'uploads/track.mp3',
  Body: fileBuffer
})
// → Auto-triggers processing
```

### **4. DJ Tool Integration**

```bash
# Rekordbox/Serato export script
# Export → Upload → Auto-import
```

---

## 💰 COST

### **Upload Zone Bucket:**

```
Storage:     FREE (files deleted after processing)
Requests:    $0.005 per 1000 uploads
Lambda:      $0.20 per 1M requests
Total:       ~$0.01/month for 1000 uploads
```

**Example (100 uploads/month):**
- S3 PUT: 100 × $0.000005 = $0.0005
- Lambda: 100 × $0.0000002 = $0.00002
- S3 Copy: 100 × $0.000005 = $0.0005
- Total: **~$0.001/month** (basically FREE!)

---

## ⚙️ CONFIGURATION

### **Environment Variables:**

```typescript
UPLOAD_BUCKET=gforce-upload-zone
MAIN_BUCKET=main-storage-bucket-name
TRACKS_TABLE=Track-table-name
AWS_REGION=eu-west-1
```

### **S3 Event Notification:**

```typescript
uploadBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(uploadProcessor),
  { prefix: 'uploads/' }
)
```

---

## 🧪 TESTING

### **1. Upload via AWS CLI:**

```bash
aws s3 cp test-track.mp3 s3://gforce-upload-zone/uploads/
```

### **2. Check Lambda Logs:**

```bash
aws logs tail /aws/lambda/upload-processor --follow
```

### **3. Verify Track Created:**

```bash
# Check DynamoDB
aws dynamodb scan --table-name Track

# Check main storage
aws s3 ls s3://main-storage/public/audio/
```

### **4. Verify Upload Zone Cleaned:**

```bash
# Should be empty
aws s3 ls s3://gforce-upload-zone/uploads/
```

---

## 🔒 SECURITY

### **1. File Type Validation**

```typescript
const allowedTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/flac'
]

if (!allowedTypes.includes(contentType)) {
  throw new Error('Invalid file type')
}
```

### **2. File Size Limits**

```typescript
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

if (fileSize > MAX_FILE_SIZE) {
  throw new Error('File too large')
}
```

### **3. Virus Scanning (Optional)**

```typescript
// ClamAV integration
await scanFile(buffer)
```

---

## 📈 MONITORING

### **CloudWatch Metrics:**

```
- UploadCount (per hour)
- ProcessingTime (avg/max)
- ErrorRate (%)
- FileSize (avg)
```

### **CloudWatch Alarms:**

```typescript
new Alarm(this, 'HighErrorRate', {
  metric: errorRate,
  threshold: 10,
  evaluationPeriods: 2
})
```

---

## 🎉 BENEFITS

### **For Users:**

✅ **Easy Upload** - Just drop files, no UI needed  
✅ **Bulk Upload** - Upload entire folders  
✅ **API Access** - Integrate with external tools  
✅ **Auto Processing** - Metadata extracted automatically

### **For System:**

✅ **Same Pipeline** - Uses existing Lambda triggers  
✅ **Scalable** - S3 + Lambda auto-scale  
✅ **Cheap** - Pay only for what you use  
✅ **Reliable** - S3 durability, Lambda retry logic

### **For Development:**

✅ **Simple** - One bucket, one Lambda  
✅ **Testable** - Easy to test uploads  
✅ **Monitored** - CloudWatch logs & metrics  
✅ **Maintainable** - Clean separation of concerns

---

## 🚧 IMPLEMENTATION STATUS

### **✅ Created:**

- Storage definition (upload-zone.ts)
- Lambda handler (upload-processor/handler.ts)
- Lambda package.json
- Complete documentation

### **⏳ TODO (After Deployment):**

- Add resource definition (resource.ts)
- Add to backend.ts
- Configure S3 event trigger
- Deploy to sandbox
- Test upload workflow
- Update IAM policies

### **🎯 Next Session:**

- Complete integration
- Test with real files
- Document upload methods
- Create upload UI (optional)

---

**Created:** 16 November 2025, 18:56 CET  
**By:** Gerard + Cascade AI  
**Purpose:** Public drop zone for auto-processed audio uploads  
**Status:** 📋 DESIGNED, ready for integration after current deployment
