# TODO: WatchCat Loudness Normalization Integration

**Date:** 13 November 2025  
**Status:** Planning Phase  
**Priority:** High (Production Audio Quality)

---

## 🎯 Goal

Integrate **Thimeo WatchCat** into the track upload pipeline to automatically analyze and normalize loudness levels for all uploaded tracks, ensuring consistent professional broadcast quality.

**WatchCat:** https://www.thimeo.com/watchcat/

---

## 📊 What is WatchCat?

WatchCat is a professional loudness analyzer and normalizer by Thimeo (makers of Stereo Tool):

### Features:
- ✅ **LUFS Measurement** (Loudness Units Full Scale)
- ✅ **True Peak Detection** (prevents clipping)
- ✅ **EBU R128 Compliance** (broadcast standard)
- ✅ **Loudness Range** (LRA)
- ✅ **File Normalization** (adjust to target loudness)
- ✅ **Batch Processing**
- ✅ **Command-line interface** (perfect for Lambda!)

### Target Standards:
- **Radio/Streaming:** -14 LUFS (Spotify, YouTube)
- **Broadcast:** -23 LUFS (EBU R128)
- **Club/DJ:** -9 to -11 LUFS (loud & punchy)

---

## 🏗️ Current Pipeline

```
User Upload → S3
  ↓
S3 Event → Lambda 1 (audio-metadata)
  ├─ Extract metadata (artist, title, BPM, key)
  ├─ Upload cover art
  ├─ Update DynamoDB
  ├─ Invoke Lambda 3 (waveform) - async
  └─ Invoke Lambda 5 (audio-analyzer) - async
```

**Files:**
- `amplify/functions/audio-metadata/handler.ts` - Main Lambda
- `amplify/backend.ts` - S3 trigger configuration

---

## 🎛️ Proposed Integration Options

### **Option A: New Lambda (Recommended)** ⭐

Create dedicated `watchcat-normalizer` Lambda:

```
User Upload → S3 (public/audio/)
  ↓
Lambda 1 (audio-metadata)
  ├─ Extract metadata
  ├─ Invoke Lambda 6 (watchcat) - async
  └─ Update DynamoDB
  
Lambda 6 (watchcat-normalizer)
  ├─ Download audio from S3
  ├─ Run WatchCat analysis
  ├─ Measure LUFS, True Peak, LRA
  ├─ Normalize to target (-14 LUFS)
  ├─ Upload normalized version
  └─ Update Track record with loudness data
```

**Pros:**
- ✅ Isolated, dedicated processing
- ✅ Easy to enable/disable
- ✅ Can process in parallel
- ✅ Separate timeout & memory config

**Cons:**
- ⚠️ Extra Lambda to maintain
- ⚠️ Need to download file again

---

### **Option B: Integrated in audio-metadata**

Add WatchCat to existing `audio-metadata` Lambda:

```typescript
async function extractMetadata(filePath: string) {
  // ... existing metadata extraction
  
  // Add WatchCat analysis
  const loudnessData = await analyzeWithWatchCat(filePath)
  
  return {
    ...metadata,
    loudnessLUFS: loudnessData.lufs,
    truePeak: loudnessData.truePeak,
    loudnessRange: loudnessData.lra
  }
}
```

**Pros:**
- ✅ Single Lambda (simpler)
- ✅ File already downloaded
- ✅ One-shot processing

**Cons:**
- ⚠️ Increases Lambda timeout requirement
- ⚠️ WatchCat binary adds to package size
- ⚠️ Longer cold starts

---

### **Option C: Post-Processing Lambda**

Separate normalization step (optional):

```
User enables "Auto-Normalize" in settings
  ↓
Lambda 6 processes track
  ├─ Analyze loudness
  ├─ If below target: normalize
  ├─ Upload normalized version to S3
  └─ Update track with normalized URL
```

**Pros:**
- ✅ Optional processing
- ✅ Can batch process existing tracks
- ✅ User control

**Cons:**
- ⚠️ More complex workflow
- ⚠️ Need UI toggle

---

## 🚀 Recommended Implementation: Option A

**Why:**
- Clean separation of concerns
- Can be toggled on/off easily
- Won't slow down initial metadata extraction
- Can be optimized independently

---

## 📋 Implementation Steps

### **Phase 1: Setup WatchCat Binary**

1. **Download WatchCat Linux x64:**
   ```bash
   wget https://download.thimeo.com/watchcat_linux_64
   chmod +x watchcat_linux_64
   ```

2. **Test locally:**
   ```bash
   ./watchcat_linux_64 --analyze input.mp3
   ./watchcat_linux_64 --normalize -14 input.mp3 output.mp3
   ```

3. **Create Lambda Layer:**
   ```bash
   mkdir -p watchcat-layer/bin
   cp watchcat_linux_64 watchcat-layer/bin/watchcat
   cd watchcat-layer
   zip -r watchcat-layer.zip .
   ```

4. **Upload to Lambda Layer**

---

### **Phase 2: Create Lambda Function**

**File:** `amplify/functions/watchcat-normalizer/handler.ts`

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface LoudnessData {
  lufs: number          // Integrated loudness
  truePeak: number      // True peak level
  lra: number           // Loudness range
  normalized: boolean   // Was file normalized?
  normalizedUrl?: string
}

export const handler = async (event: any) => {
  const { trackId, s3Key, bucket } = event
  
  // 1. Download audio file
  const localPath = await downloadFromS3(s3Key, bucket)
  
  // 2. Run WatchCat analysis
  const loudnessData = await analyzeWithWatchCat(localPath)
  
  // 3. Normalize if needed (target: -14 LUFS)
  let normalizedUrl: string | undefined
  if (Math.abs(loudnessData.lufs - (-14)) > 1.0) {
    const normalizedPath = await normalizeAudio(localPath, -14)
    normalizedUrl = await uploadToS3(normalizedPath, bucket, s3Key)
    fs.unlinkSync(normalizedPath)
  }
  
  // 4. Update Track record
  await updateTrackLoudness(trackId, {
    ...loudnessData,
    normalizedUrl
  })
  
  // Cleanup
  fs.unlinkSync(localPath)
  
  return { status: 'success', loudnessData }
}

async function analyzeWithWatchCat(filePath: string): Promise<LoudnessData> {
  const output = execSync(
    `/opt/bin/watchcat --analyze "${filePath}"`,
    { encoding: 'utf-8' }
  )
  
  // Parse WatchCat output
  const lufsMatch = output.match(/Integrated:\s+(-?\d+\.?\d*)\s+LUFS/)
  const peakMatch = output.match(/True Peak:\s+(-?\d+\.?\d*)\s+dBTP/)
  const lraMatch = output.match(/LRA:\s+(\d+\.?\d*)\s+LU/)
  
  return {
    lufs: lufsMatch ? parseFloat(lufsMatch[1]) : 0,
    truePeak: peakMatch ? parseFloat(peakMatch[1]) : 0,
    lra: lraMatch ? parseFloat(lraMatch[1]) : 0,
    normalized: false
  }
}

async function normalizeAudio(
  inputPath: string,
  targetLUFS: number
): Promise<string> {
  const outputPath = inputPath.replace('.mp3', '-normalized.mp3')
  
  execSync(
    `/opt/bin/watchcat --normalize ${targetLUFS} "${inputPath}" "${outputPath}"`,
    { encoding: 'utf-8' }
  )
  
  return outputPath
}
```

**Resource Config:** `amplify/functions/watchcat-normalizer/resource.ts`

```typescript
import { defineFunction } from '@aws-amplify/backend'

export const watchcatNormalizer = defineFunction({
  name: 'watchcat-normalizer',
  entry: './handler.ts',
  timeoutSeconds: 300,  // 5 min for large files
  memoryMB: 2048,       // 2 GB for audio processing
  resourceGroupName: 'storage',
  environment: {
    PATH: '/opt/bin:/usr/local/bin:/usr/bin:/bin'
  }
})
```

---

### **Phase 3: Update Backend Configuration**

**File:** `amplify/backend.ts`

```typescript
import { watchcatNormalizer } from './functions/watchcat-normalizer/resource'

// ... existing code ...

const watchcatLambda = backend.watchcatNormalizer.resources.lambda

// Grant S3 permissions
storageBucket.grantRead(watchcatLambda)
storageBucket.grantPut(watchcatLambda)

// Grant DynamoDB permissions
trackTable.grantReadWriteData(watchcatLambda)

// Add environment variables
backend.watchcatNormalizer.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.watchcatNormalizer.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)

// Update audio-metadata to invoke WatchCat
backend.audioMetadata.addEnvironment('WATCHCAT_LAMBDA_NAME', watchcatLambda.functionName)
watchcatLambda.grantInvoke(metadataLambda)
```

---

### **Phase 4: Update Audio Metadata Lambda**

**File:** `amplify/functions/audio-metadata/handler.ts`

Add invocation after line 109:

```typescript
// Invoke Lambda 6 (WatchCat normalizer)
if (trackId) {
  try {
    await invokeLambda6(trackId, s3Key, bucketName)
    console.log('Lambda 6 (WatchCat) invoked successfully')
  } catch (error) {
    console.error('Failed to invoke Lambda 6:', error)
  }
}

// ... add at end of file ...

async function invokeLambda6(trackId: string, s3Key: string, bucket: string) {
  const watchcatFunctionName = process.env.WATCHCAT_LAMBDA_NAME
  
  if (!watchcatFunctionName) {
    console.log('WATCHCAT_LAMBDA_NAME not set, skipping normalization')
    return
  }
  
  console.log(`Invoking Lambda 6: ${watchcatFunctionName}`)
  
  const payload = {
    trackId,
    s3Key,
    bucket,
  }
  
  const command = new InvokeCommand({
    FunctionName: watchcatFunctionName,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify(payload),
  })
  
  await lambdaClient.send(command)
  console.log('Lambda 6 invocation request sent (async)')
}
```

---

### **Phase 5: Update GraphQL Schema**

**File:** `amplify/data/resource.ts`

Add loudness fields to Track model:

```typescript
Track: a.model({
  // ... existing fields ...
  
  // Loudness normalization (WatchCat)
  loudnessLUFS: a.float(),
  truePeak: a.float(),
  loudnessRange: a.float(),
  normalizedUrl: a.string(),
  normalizedAt: a.datetime(),
}).authorization(allow => [allow.authenticated()]),
```

---

## 🎚️ Target Loudness Standards

### Recommended Targets:

| Use Case | Target LUFS | True Peak | Notes |
|----------|-------------|-----------|-------|
| **Streaming** | -14 LUFS | -1 dBTP | Spotify, Apple Music standard |
| **Radio FM** | -9 LUFS | -1 dBTP | Commercial radio (loud!) |
| **Podcast** | -16 LUFS | -1 dBTP | Spoken word |
| **Club/DJ** | -11 LUFS | -0.5 dBTP | Maximum energy |
| **Broadcast** | -23 LUFS | -1 dBTP | EBU R128 (Europe) |

**For Splash FM:** Recommend **-14 LUFS** (streaming standard, versatile)

---

## 📊 UI Integration

### Track Upload Page

Add indicator showing loudness status:

```typescript
// apps/web/src/pages/devices/Libery.tsx

{track.loudnessLUFS && (
  <div className="loudness-indicator">
    <span className={getLoudnessColor(track.loudnessLUFS)}>
      {track.loudnessLUFS.toFixed(1)} LUFS
    </span>
    {track.normalizedUrl && (
      <span className="badge">Normalized</span>
    )}
  </div>
)}
```

### Settings Page

Add loudness target configuration:

```typescript
// apps/web/src/pages/devices/StreamSettings.tsx

<div className="loudness-settings">
  <label>Target Loudness</label>
  <select value={targetLUFS} onChange={...}>
    <option value="-14">-14 LUFS (Streaming)</option>
    <option value="-11">-11 LUFS (Club/Radio)</option>
    <option value="-16">-16 LUFS (Podcast)</option>
    <option value="-23">-23 LUFS (Broadcast)</option>
  </select>
  
  <label>
    <input type="checkbox" checked={autoNormalize} />
    Auto-normalize uploads
  </label>
</div>
```

---

## 🧪 Testing Plan

### 1. Local Testing
```bash
# Test WatchCat binary
./watchcat_linux_64 --analyze test-track.mp3

# Expected output:
# Integrated: -12.3 LUFS
# True Peak: -0.5 dBTP
# LRA: 8.2 LU
```

### 2. Lambda Testing
```bash
# Invoke Lambda with test event
aws lambda invoke \
  --function-name watchcat-normalizer \
  --payload '{"trackId":"123","s3Key":"public/audio/test.mp3","bucket":"..."}' \
  response.json
```

### 3. End-to-End Testing
- Upload track with known loudness
- Verify analysis results in DynamoDB
- Check normalized file in S3
- Confirm UI displays loudness data

---

## 📈 Benefits

### For Users:
- ✅ **Consistent Volume** across all tracks
- ✅ **Professional Sound** (broadcast quality)
- ✅ **No Manual Work** (automatic)
- ✅ **Transparency** (see actual loudness values)

### For Radio:
- ✅ **Smooth Transitions** between tracks
- ✅ **No Volume Jumps** (listener fatigue)
- ✅ **Broadcast Compliance** (EBU R128)
- ✅ **Competitive Loudness** with other stations

### Technical:
- ✅ **Scalable** (Lambda auto-scales)
- ✅ **Reliable** (async processing)
- ✅ **Measurable** (loudness data stored)
- ✅ **Flexible** (configurable targets)

---

## 💰 Cost Estimate

### Lambda Costs:
- Processing time: ~10-30 seconds per track
- Memory: 2 GB
- Cost: ~$0.001 per track

### S3 Costs:
- Normalized file storage: Same as original
- Transfer: Minimal (internal AWS)

**Total:** ~$0.001 - $0.002 per track (negligible!)

---

## 🚦 Implementation Timeline

- **Week 1:** Setup WatchCat binary, test locally
- **Week 2:** Create Lambda function, test in AWS
- **Week 3:** Integrate with audio-metadata pipeline
- **Week 4:** Update UI, end-to-end testing
- **Week 5:** Deploy to production, monitor

**Total:** ~5 weeks for complete implementation

---

## 📝 Notes

- WatchCat is FREE for non-commercial use
- For commercial: License required (~€199/year)
- Alternative: `ffmpeg-normalize` (open source)
- Can batch-process existing tracks later

---

## ✅ Checklist

- [ ] Download WatchCat Linux binary
- [ ] Test locally with sample tracks
- [ ] Create Lambda Layer with WatchCat
- [ ] Create `watchcat-normalizer` Lambda function
- [ ] Update `audio-metadata` to invoke WatchCat
- [ ] Add loudness fields to GraphQL schema
- [ ] Update backend.ts configuration
- [ ] Deploy to AWS
- [ ] Test end-to-end
- [ ] Add UI indicators for loudness
- [ ] Add settings for target loudness
- [ ] Document for team
- [ ] Batch-process existing tracks (optional)

---

## 🔗 Resources

- **WatchCat:** https://www.thimeo.com/watchcat/
- **EBU R128 Standard:** https://tech.ebu.ch/docs/r/r128.pdf
- **LUFS Explained:** https://www.izotope.com/en/learn/what-are-lufs.html
- **Loudness Standards:** https://www.masteringthemix.com/blogs/learn/76296773-what-are-lufs-and-why-you-should-care

---

**Status:** Ready for implementation  
**Owner:** Backend Team  
**Estimated Effort:** 5 weeks  
**Priority:** High (improves production quality)
