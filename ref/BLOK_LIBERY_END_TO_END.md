# 📚 BLOK LIBERY - End-to-End Testing & Recovery

**Created:** 15 November 2025, 16:59 CET  
**Status:** ✅ DEPLOYED & WORKING  
**Last Tested:** 15 November 2025

---

## 🎯 Wat is BLOK LIBERY?

BLOK LIBERY = Complete track library systeem met:
- Upload interface
- Automatische metadata extractie
- BPM & Key detectie
- Cover art generatie
- Waveform visualisatie
- Track management

---

## 🏗️ ARCHITECTUUR

```
┌─────────────────────────────────────────────────────────────┐
│                      BLOK LIBERY                            │
└─────────────────────────────────────────────────────────────┘

1. FRONTEND (React)
   └─ /apps/web/src/pages/devices/Libery.tsx
   └─ Upload UI + Track Library
   └─ Search & Filter
   └─ Track info modal

2. UPLOAD FLOW
   └─ User selecteert MP3
   └─ Upload naar S3 (public/audio/)
   └─ S3 event trigger

3. LAMBDA CHAIN
   ┌──────────────────────┐
   │ audio-metadata       │ ← S3 Event Trigger
   │ - Extract metadata   │
   │ - Generate cover art │
   │ - Invoke waveform    │
   │ - Invoke analyzer    │
   └──────────────────────┘
            ↓
   ┌──────────────────────┐
   │ waveform-generator   │ ← Invoked by audio-metadata
   │ - Generate waveform  │
   │ - Save to S3         │
   └──────────────────────┘
            ↓
   ┌──────────────────────┐
   │ audio-analyzer       │ ← Invoked by audio-metadata
   │ (Docker + FFmpeg)    │
   │ - Analyze audio      │
   │ - BPM detection      │
   │ - Key detection      │
   └──────────────────────┘

4. DATA STORAGE
   └─ DynamoDB Track table
   └─ S3 public/audio/ (audio files)
   └─ S3 public/covers/ (cover art)
   └─ S3 public/waveforms/ (waveform data)
```

---

## 📋 COMPONENTS CHECKLIST

### ✅ Frontend Components
- [ ] Libery.tsx loaded
- [ ] Upload UI visible
- [ ] Track list displayed
- [ ] Search werkt
- [ ] Filter dropdowns werken
- [ ] Track modal opent

### ✅ Lambda Functions
- [ ] audio-metadata deployed
- [ ] waveform-generator deployed
- [ ] audio-analyzer deployed (Docker)
- [ ] S3 event trigger configured

### ✅ Storage
- [ ] S3 bucket exists
- [ ] public/audio/ folder
- [ ] public/covers/ folder
- [ ] public/waveforms/ folder

### ✅ Database
- [ ] Track table exists
- [ ] Tracks kunnen opgeslagen worden
- [ ] Tracks kunnen uitgelezen worden

---

## 🧪 END-TO-END TEST PROCEDURE

### Test 1: Upload MP3
```bash
# 1. Open Libery UI
http://localhost:5173/devices/libery

# 2. Upload een test MP3
- Click "Upload" sectie
- Drag & drop MP3 file
- Of click "Select files"

# 3. Verwachte resultaat:
- Upload progress bar verschijnt
- "Processing..." indicator
- Na 6 seconden: Track verschijnt in lijst
```

### Test 2: Metadata Extractie
```bash
# Check in DynamoDB:
aws dynamodb scan \
  --table-name Track-yzaolfqzsze37eghvsrj6tfwk4-NONE \
  --limit 1 \
  --region eu-west-1

# Verwachte velden:
- title: "Track naam"
- artist: "Artist naam"
- bpm: 128
- key: "Am"
- duration: 180
- fileUrl: "public/audio/..."
- coverArtUrl: "public/covers/..."
```

### Test 3: Lambda Logs
```bash
# audio-metadata logs
aws logs tail /aws/lambda/audio-metadata-XXXXX \
  --follow \
  --region eu-west-1

# Verwachte output:
[INFO] Processing track: artist - title.mp3
[INFO] Extracted metadata: BPM=128, Key=Am
[INFO] Invoking waveform generator
[INFO] Invoking audio analyzer
[SUCCESS] Track processed
```

### Test 4: S3 Files
```bash
# Check uploaded file
aws s3 ls s3://BUCKET-NAME/public/audio/

# Check cover art
aws s3 ls s3://BUCKET-NAME/public/covers/

# Check waveform
aws s3 ls s3://BUCKET-NAME/public/waveforms/
```

---

## 🔧 TROUBLESHOOTING

### ❌ Upload faalt
**Symptoom:** File upload geeft error

**Check:**
```bash
# 1. Check S3 permissions
aws s3 ls s3://BUCKET-NAME/public/audio/

# 2. Check Amplify config
cat amplify_outputs.json | grep storage

# 3. Check browser console
# Verwacht: No CORS errors
```

**Fix:**
- Check storage bucket permissions in backend.ts
- Verify Auth configuration

---

### ❌ Metadata niet geëxtraheerd
**Symptoom:** Track uploaded maar geen BPM/Key

**Check:**
```bash
# Lambda logs
aws logs tail /aws/lambda/audio-metadata-XXX --follow

# Verwachte errors:
- "music-metadata not found" → Dependencies issue
- "FFmpeg error" → audio-analyzer issue
```

**Fix:**
```bash
# 1. Check Lambda heeft external dependencies
cat amplify/functions/audio-metadata/package.json | grep esbuild

# 2. Verify deployment
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox
```

---

### ❌ Cover art niet zichtbaar
**Symptoom:** Track has no cover thumbnail

**Check:**
```bash
# 1. Check S3 covers folder
aws s3 ls s3://BUCKET-NAME/public/covers/

# 2. Check Track table
aws dynamodb get-item \
  --table-name Track-XXX \
  --key '{"id":{"S":"track-id"}}'
```

**Fix:**
- audio-metadata Lambda moet cover art genereren
- Check Lambda heeft write permissions op S3

---

### ❌ Waveform niet gegenereerd
**Symptoom:** Track modal shows no waveform

**Check:**
```bash
# Check waveform Lambda logs
aws logs tail /aws/lambda/waveform-generator-XXX --follow

# Check S3
aws s3 ls s3://BUCKET-NAME/public/waveforms/
```

**Fix:**
- Verify waveform-generator invoked by audio-metadata
- Check Lambda timeout (should be 60s+)

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All Lambda package.json have `esbuild.external` config
- [ ] Docker image for audio-analyzer built and pushed to ECR
- [ ] S3 bucket permissions configured
- [ ] DynamoDB Track table schema correct

### Deployment Commands
```bash
# 1. Clean install
pnpm install

# 2. Deploy sandbox
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --identifier gerard

# 3. Wait for "Watching for file changes..."

# 4. Test upload
# Open: http://localhost:5173/devices/libery
```

### Post-Deployment
- [ ] Upload test MP3
- [ ] Verify metadata extracted
- [ ] Check cover art generated
- [ ] Verify waveform created
- [ ] Test search & filter

---

## 📊 SUCCESS CRITERIA

### ✅ BLOK LIBERY is working when:

1. **Upload succeeds**
   - File uploaded to S3
   - No errors in browser console

2. **Metadata extracted**
   - Title, Artist filled
   - BPM detected
   - Key detected
   - Duration calculated

3. **Cover art generated**
   - Thumbnail visible in track list
   - Full size in modal

4. **Waveform created**
   - SVG visible in track modal
   - Shows audio peaks

5. **UI responsive**
   - Search filters tracks
   - Genre/Label filters work
   - Track modal opens

---

## 🔐 PERMISSIONS NEEDED

### S3 Bucket
```typescript
// In amplify/backend.ts
storageBucket.grantRead(metadataLambda)
storageBucket.grantPut(metadataLambda)
```

### DynamoDB Track Table
```typescript
trackTable.grantReadWriteData(metadataLambda)
trackTable.grantReadWriteData(waveformLambda)
```

### Lambda Invocations
```typescript
waveformLambda.grantInvoke(metadataLambda)
audioAnalyzerLambda.grantInvoke(metadataLambda)
```

---

## 📝 RECOVERY STEPS

### Als BLOK LIBERY kapot is:

1. **Check deployment**
   ```bash
   # Verify Lambdas exist
   aws lambda list-functions --region eu-west-1 | grep audio
   ```

2. **Check external dependencies**
   ```bash
   # Verify esbuild config
   grep -r "esbuild" amplify/functions/*/package.json
   ```

3. **Redeploy**
   ```bash
   pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --identifier gerard
   ```

4. **Test again**
   - Upload MP3
   - Check Lambda logs
   - Verify DynamoDB entry

---

## 🎯 NEXT STEPS

After BLOK LIBERY verified:

1. Test **BLOK STREAM** (Liquidsoap + EC2)
2. Test **BLOK PLAYER** (Real-time player)
3. Test **BLOK SCHEDULER** (Hourly scheduling)

---

## 📞 SUPPORT

**Lambda Functions:**
- audio-metadata: `/amplify/functions/audio-metadata/handler.ts`
- waveform-generator: `/amplify/functions/waveform-generator/handler.ts`
- audio-analyzer: Docker Lambda met FFmpeg

**Frontend:**
- Libery UI: `/apps/web/src/pages/devices/Libery.tsx`

**Infrastructure:**
- Backend config: `/amplify/backend.ts`
- Data schema: `/amplify/data/resource.ts`

---

**Last Updated:** 15 November 2025, 16:59 CET  
**Status:** ✅ Deployment successful with external dependencies fix
