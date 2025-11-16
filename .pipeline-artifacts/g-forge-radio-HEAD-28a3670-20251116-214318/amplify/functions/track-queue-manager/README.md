# 🎵 Track Queue Manager Lambda

**Created:** 13 November 2025  
**Purpose:** Maintains SQS queue of exactly 2 tracks for just-in-time streaming  
**Type:** Event-driven queue management

---

## 📋 Overview

This Lambda function is the core of the **Hybrid SQS Streaming** architecture. It ensures that the SQS queue always has exactly 2 tracks:
- **Track 1:** Currently being played by Liquidsoap
- **Track 2:** Next track, buffered and ready

---

## 🔄 How It Works

### **State Machine:**
```
Queue Size = 0  → Add Track 1 + Track 2
Queue Size = 1  → Add Track 2 (or Track 3)
Queue Size = 2  → Do nothing (optimal state)
```

### **Triggers:**

1. **EventBridge (Hourly)**
   - Runs every hour at :00
   - Initializes queue with first 2 tracks
   - Ensures fresh start each hour

2. **Liquidsoap Invoke (On-Demand)**
   - Liquidsoap detects: `queue_size < 2`
   - Invokes Lambda asynchronously
   - Lambda adds next track to reach 2 total

3. **Manual/API (Playlist Change)**
   - User changes playlist in UI
   - API calls Lambda with `action: 'purge'`
   - Lambda purges queue and adds 2 new tracks

---

## 📊 Logic Flow

```
1. Check queue size
   ↓
2. If queue >= 2 → Exit (nothing to do)
   ↓
3. If queue < 2:
   a. Get current schedule slot
   b. Get playlist for current hour
   c. Get playlist state (current position)
   d. Calculate tracks needed: (2 - queue_size)
   e. For each track needed:
      - Get next position (loop if end)
      - Fetch full track details from Track table
      - Send to SQS with metadata
      - Increment position
   f. Save new playlist position
   ↓
4. Return success with stats
```

---

## 🔑 Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `QUEUE_URL` | SQS Queue | FIFO queue URL for tracks |
| `SCHEDULE_TABLE` | DynamoDB | Schedule slots (day/hour) |
| `PLAYLIST_TABLE` | DynamoDB | Playlists with tracks |
| `TRACK_TABLE` | DynamoDB | Full track details |
| `SETTINGS_TABLE` | DynamoDB | Playlist state (position) |
| `STORAGE_BUCKET` | S3 | Audio file bucket |

---

## 📦 SQS Message Format

```json
{
  "trackId": "uuid",
  "title": "Track Title",
  "artist": "Artist Name",
  "fileUrl": "s3://bucket/path/to/track.mp3",
  "duration": 320,
  "coverArtUrl": "s3://bucket/path/to/cover.jpg",
  "genre": "Techno",
  "bpm": 128,
  "playlistPosition": 5,
  "playlistName": "TechnoHouse"
}
```

**Message Attributes:**
- `title` (String)
- `artist` (String)
- `trackId` (String)

---

## 🔐 IAM Permissions

**Required:**
- `dynamodb:GetItem` (Schedule, Playlist, Track, Settings)
- `dynamodb:UpdateItem` (Settings - for playlist state)
- `sqs:SendMessage` (Track queue)
- `sqs:GetQueueAttributes` (Queue size check)

**Granted in backend.ts:**
```typescript
trackTable.grantReadData(trackQueueManagerLambda)
playlistTable.grantReadData(trackQueueManagerLambda)
scheduleTable.grantReadData(trackQueueManagerLambda)
streamSettingsTable.grantReadWriteData(trackQueueManagerLambda)
trackStreamQueue.grantSendMessages(trackQueueManagerLambda)
```

---

## 🧪 Testing

### **Test 1: Manual Invoke**
```bash
aws lambda invoke \
  --function-name amplify-gforgeiot-gerard-s-trackQueueManagerlambda-XXX \
  --region eu-west-1 \
  --payload '{}' \
  response.json

cat response.json | jq '.'
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "tracksAdded": 2,
    "currentPosition": 2,
    "queueSize": 2,
    "playlistName": "TechnoHouse",
    "slot": {
      "name": "Thursday 22:00",
      "day": "Thu",
      "time": "22:00-next hour"
    }
  }
}
```

### **Test 2: Check Queue**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1
```

**Expected:** `"ApproximateNumberOfMessages": "2"`

### **Test 3: Purge & Reload**
```bash
aws lambda invoke \
  --function-name [LAMBDA_NAME] \
  --region eu-west-1 \
  --payload '{"action":"purge"}' \
  response.json
```

**Expected:** Queue purged, then 2 new tracks added

---

## 📝 Playlist State Tracking

**Stored in DynamoDB (StreamSettings table):**
```json
{
  "settingKey": "playlist_state_playlist-xyz",
  "playlistId": "playlist-xyz",
  "currentPosition": 5,
  "lastUpdated": "2025-11-13T22:45:00.000Z"
}
```

**Purpose:**
- Track which track is "next" in playlist
- Loop back to position 0 when end reached
- Resume from correct position on Lambda restart

---

## 🔄 Playlist Looping

```typescript
// Calculate next position with looping
const position = (currentPosition + i) % tracks.length

// Example: Playlist with 16 tracks
// Position 15 → Next = 0 (loop back to start)
// Position 5 → Next = 6 (continue)
```

---

## ⚠️ Error Handling

### **No Active Schedule:**
```json
{
  "success": false,
  "message": "No active schedule slot"
}
```
**Result:** Queue not modified

### **Playlist Empty:**
```json
{
  "success": false,
  "message": "Playlist empty"
}
```
**Result:** Queue not modified

### **Track Not Found:**
- Track skipped
- Next track used instead
- Warning logged

---

## 📊 CloudWatch Metrics

**Key Metrics to Monitor:**
- Lambda invocation count (should be ~1/hour + on-demand)
- Lambda duration (should be < 5s)
- Lambda errors (should be 0)
- SQS queue depth (should stay at 1-2)

**Logs to Watch:**
```
✅ Successfully added X track(s)
📊 Final queue size: 2
⚠️  Queue low (1 tracks) - Triggering Lambda
❌ No active schedule slot
```

---

## 🚀 Deployment

See: [HYBRID_SQS_DEPLOYMENT.md](../../../HYBRID_SQS_DEPLOYMENT.md)

**Quick Deploy:**
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
npx ampx sandbox
# Lambda will be created automatically
```

---

## 🔗 Related Files

- **Handler:** `handler.ts` (this Lambda)
- **Resource:** `resource.ts` (Lambda definition)
- **Backend:** `../../backend.ts` (SQS queue + permissions)
- **Liquidsoap:** `/liquidsoap-sqs-hybrid.liq` (SQS polling)
- **Docs:** `/docs/streaming/HYBRID_SQS_STREAMING.md`

---

## 📝 Notes

- Lambda runs in `us-east-1` by default via Amplify
- Timeout: 60 seconds (enough for adding 2 tracks)
- Memory: 512 MB (sufficient for DynamoDB queries)
- Cold start: ~1-2 seconds (acceptable)

---

**Last Updated:** 13 November 2025  
**Owner:** Gerard  
**Status:** ✅ Built, Ready to Deploy
