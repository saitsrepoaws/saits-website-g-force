# Lambda 3: Waveform Generation Guide

## 🌊 What It Does

Generates visual waveform images for audio tracks:
- Downloads audio file from S3
- Extracts 200 peak values
- Creates 800x120px PNG waveform
- Uploads to `public/waveforms/`
- Updates track in DynamoDB

## ⚠️ Important: Manual Trigger Only

**Why not on S3 trigger?**
- Lambda 1 (audio-metadata) already triggers on `public/audio/*`
- S3 doesn't allow multiple Lambdas with overlapping prefixes
- Would cause: `Configuration is ambiguously defined`

**Solutions:**
1. **Manual invoke** (current)
2. **SNS Fanout** (recommended for production)
3. **Lambda invoke Lambda** (Lambda 1 calls Lambda 3)
4. **Combine Lambdas** (merge waveform into Lambda 1)

## 🚀 Usage

### Manual Invocation

```bash
# Get Lambda function name
aws lambda list-functions --query 'Functions[?contains(FunctionName, `waveform`)].FunctionName'

# Invoke for a specific track
aws lambda invoke \
  --function-name amplify-gforgeiot-gerard--waveformgenerator... \
  --payload '{
    "Records": [{
      "s3": {
        "bucket": {"name": "BUCKET_NAME"},
        "object": {"key": "public/audio/track.mp3"}
      }
    }]
  }' \
  response.json

# Check response
cat response.json
```

### Batch Process All Tracks

```bash
# List all audio files
aws s3 ls s3://BUCKET_NAME/public/audio/ --recursive

# Generate waveforms for all
for file in $(aws s3 ls s3://BUCKET_NAME/public/audio/ --recursive | awk '{print $4}'); do
  aws lambda invoke \
    --function-name WAVEFORM_FUNCTION \
    --payload "{\"Records\":[{\"s3\":{\"bucket\":{\"name\":\"BUCKET_NAME\"},\"object\":{\"key\":\"$file\"}}}]}" \
    out.json
  sleep 2 # Rate limiting
done
```

## 📊 Output

### Waveform Image
- **Location**: `public/waveforms/TRACK_NAME.png`
- **Size**: 800x120 pixels
- **Format**: PNG
- **Colors**: Dark background (#1a1a1a), Blue bars (#3b82f6)

### DynamoDB Update
```json
{
  "waveformUrl": "public/waveforms/track-name.png",
  "peaks": "[0.1, 0.5, 0.8, ...]" // JSON string of 200 values
}
```

## 🎨 Frontend Integration

### Display Waveform

```typescript
// Get waveform URL
const waveformUrl = await getUrl({ path: track.waveformUrl })

// Display image
<img src={waveformUrl.url} alt="Waveform" className="w-full h-24" />
```

### Interactive Waveform (with peaks)

```typescript
const peaks = JSON.parse(track.peaks)

<div className="flex items-end h-24 gap-0.5">
  {peaks.map((peak, i) => (
    <div
      key={i}
      className="flex-1 bg-blue-500 opacity-80"
      style={{ height: `${peak * 100}%` }}
    />
  ))}
</div>
```

### Click to Seek

```typescript
const handleWaveformClick = (e: React.MouseEvent) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = x / rect.width
  const seekTime = percentage * track.duration
  
  // Seek audio player
  audioRef.current.currentTime = seekTime
}

<div onClick={handleWaveformClick} className="cursor-pointer">
  {/* Waveform visualization */}
</div>
```

## 🔧 Advanced: SNS Fanout Pattern

### Setup (Recommended for Production)

```typescript
// In backend.ts
import { Topic } from 'aws-cdk-lib/aws-sns'
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions'

// Create SNS topic
const audioUploadTopic = new Topic(stack, 'AudioUploadTopic', {
  displayName: 'Audio File Uploaded',
})

// S3 triggers SNS
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new SnsDestination(audioUploadTopic),
  { prefix: 'public/audio/' }
)

// Both Lambdas subscribe to SNS
audioUploadTopic.addSubscription(new LambdaSubscription(metadataLambda))
audioUploadTopic.addSubscription(new LambdaSubscription(waveformLambda))
```

**Benefits:**
- ✅ Both Lambdas run in parallel
- ✅ No S3 overlap conflicts
- ✅ Easy to add more Lambdas
- ✅ Decoupled architecture

## 🐛 Troubleshooting

### Waveform not generated

**Check Lambda logs:**
```bash
aws logs tail /aws/lambda/WAVEFORM_FUNCTION --since 5m --follow
```

**Common issues:**
- File not found in S3
- Insufficient memory (increase to 2GB+)
- Timeout (increase to 120s+)
- Sharp library issues (check npm install)

### Waveform looks wrong

The current implementation uses **simplified peak extraction** (file chunks).

For production-quality waveforms:
1. Decode audio properly (use ffmpeg layer)
2. Extract real amplitude data
3. Or use external service (waveform.js API)

### DynamoDB not updated

**Check environment variables:**
```bash
aws lambda get-function --function-name WAVEFORM_FUNCTION \
  --query 'Configuration.Environment.Variables'
```

Should have:
- `STORAGE_BUCKET_NAME`
- `TRACK_TABLE_NAME`

## 📝 Performance

- **Memory**: 2048 MB
- **Timeout**: 120 seconds
- **Cold start**: ~800ms
- **Warm execution**: 2-5 seconds
- **Waveform size**: ~50KB PNG

## 🎯 Next Steps

1. **Add SNS fanout** for automatic generation
2. **Improve peak extraction** with real audio decoding
3. **Add waveform preview** in UI
4. **Cache waveforms** (no regeneration needed)
5. **Add zoom levels** (different resolutions)

## 🔗 Related

- Lambda 1: Audio Metadata
- Lambda 2: Advanced Audio Features
- Lambda 4: Track Enrichment (TBD)
