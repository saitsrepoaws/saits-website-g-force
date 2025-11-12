# 🎵 SQS Track Streaming Architecture

## Overzicht

**Nieuwe simpele architectuur**: DynamoDB → Lambda → SQS → Liquidsoap

```
┌─────────────┐
│  DynamoDB   │ Tracks, Playlists, Schedule
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Lambda    │ stream-playlist-updater
│ (Scheduler) │ Runs every 5 minutes
└──────┬──────┘
       │
       │ SendMessage (track details)
       ▼
┌─────────────┐
│  SQS Queue  │ radio-track-stream-queue
│   (Buffer)  │ Visibility: 5 min, Retention: 1 day
└──────┬──────┘
       │
       │ ReceiveMessage + Delete
       ▼
┌─────────────┐
│ Liquidsoap  │ On EC2 instance
│  (Player)   │ Polls queue, plays tracks
└─────────────┘
```

---

## Componenten

### 1. SQS Queue

**Name**: `radio-track-stream-queue`  
**Type**: Standard (FIFO not needed, order maintained by Lambda)

**Configuration**:
- Visibility timeout: 300 seconds (5 min per track)
- Retention period: 1 day
- Receive wait time: 20 seconds (long polling)

**Message Format**:
```json
{
  "trackId": "uuid",
  "title": "Track Title",
  "artist": "Artist Name",
  "fileUrl": "s3://bucket/path/to/track.mp3",
  "duration": 180,
  "coverArtUrl": "s3://bucket/path/to/cover.jpg",
  "genre": "Techno",
  "bpm": 128,
  "scheduledAt": "2025-11-10T22:00:00Z",
  "playlistId": "playlist-uuid",
  "playlistName": "Evening Mix"
}
```

---

### 2. Lambda (stream-playlist-updater)

**Trigger**: EventBridge (every 5 minutes)

**Logic**:
```typescript
1. Load Schedule → Find active slot
2. Load Playlist → Get tracks
3. Calculate which tracks should play in next 5 minutes
4. For each track:
   - Send track details to SQS
   - Include S3 URLs for audio + cover art
5. Done!
```

**Environment Variables**:
- `TRACK_QUEUE_URL` - SQS queue URL
- `SCHEDULE_TABLE` - DynamoDB table
- `PLAYLIST_TABLE` - DynamoDB table
- `TRACK_TABLE` - DynamoDB table
- `STORAGE_BUCKET` - S3 bucket for audio files

**Permissions**:
- DynamoDB Read (Schedule, Playlist, Track)
- SQS SendMessage
- S3 Read (for generating presigned URLs)

---

### 3. Liquidsoap (EC2)

**Script**: `/opt/radio/radio.liq`

**Logic**:
```ruby
# Function to poll SQS and get next track
def get_next_track_from_sqs() =
  queue_url = "https://sqs.eu-west-1.amazonaws.com/..."
  
  # AWS CLI to receive message
  result = get_process_output(
    "aws sqs receive-message \
      --queue-url #{queue_url} \
      --max-number-of-messages 1 \
      --wait-time-seconds 20 \
      --output json"
  )
  
  # Parse JSON, extract fileUrl
  track_s3_url = parse_track_url(result)
  
  # Delete message from queue
  delete_message_from_sqs(receipt_handle)
  
  track_s3_url
end

# Request-based playlist (pulls from SQS)
radio = request.dynamic(get_next_track_from_sqs)

# Crossfade
radio = crossfade(radio)

# Output to Icecast
output.icecast(%mp3, mount="/stream.mp3", radio)
```

**Requirements**:
- AWS CLI installed (`/usr/local/bin/aws`)
- IAM role with SQS ReceiveMessage + DeleteMessage
- IAM role with S3 GetObject (for audio files)

---

## Voordelen vs Oude Systeem

### ❌ Oude Systeem (S3 Playlist)
```
Lambda writes playlist.m3u → S3 → Liquidsoap reloads every 5 min
```

**Problemen**:
- Playlist reload niet real-time
- S3 write/read overhead
- Complex playlist file management
- Moeilijk te debuggen

### ✅ Nieuwe Systeem (SQS Queue)
```
Lambda pushes tracks → SQS → Liquidsoap pulls next track
```

**Voordelen**:
- ✅ Real-time track-by-track streaming
- ✅ Geen playlist reload nodig
- ✅ SQS = natural buffer
- ✅ Simpel te debuggen (inspect queue)
- ✅ Easy retry mechanism
- ✅ Goedkoop (eerste 1M requests gratis)

---

## Deployment

### 1. Backend Update

```bash
# SQS queue + permissions already added to backend.ts
cd /Users/gerard/Desktop/T7/g-forge-iot
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once
```

### 2. Lambda Update

Update `amplify/functions/stream-playlist-updater/handler.ts`:
- Add SQS SendMessage logic
- Remove S3 playlist write logic

### 3. Liquidsoap Update

SSH into EC2:
```bash
ssh -i key.pem ubuntu@46.137.184.91
```

Update `/opt/radio/radio.liq`:
- Replace playlist() with request.dynamic()
- Add SQS polling function
- Add message deletion after play

### 4. Test

**Check Queue**:
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/.../radio-track-stream-queue \
  --attribute-names ApproximateNumberOfMessages
```

**Send Test Message**:
```bash
aws sqs send-message \
  --queue-url https://sqs.eu-west-1.amazonaws.com/.../radio-track-stream-queue \
  --message-body '{"trackId":"test","title":"Test Track","fileUrl":"s3://..."}'
```

**Check Liquidsoap Logs**:
```bash
sudo tail -f /var/log/liquidsoap/radio.log
```

---

## Cost Estimate

**SQS**:
- First 1M requests/month: FREE
- We use: ~8,640 messages/month (1 track per 5 min)
- **Cost: $0**

**Total new cost: $0** (within free tier!)

---

## Migration Steps

1. ✅ Create SQS queue (done in backend.ts)
2. ✅ Add permissions Lambda + EC2 (done)
3. ⏳ Update Lambda to send to SQS
4. ⏳ Update Liquidsoap to read from SQS
5. ⏳ Test new flow
6. ⏳ Remove old S3 playlist system
7. ⏳ Deploy!

---

## Next Steps

1. Update Lambda handler om tracks naar SQS te pushen
2. Create Liquidsoap SQS polling script
3. Test with manual SQS messages
4. Deploy and monitor
5. Remove old playlist S3 code

---

**Status**: 🚧 In Progress  
**Owner**: Gerard  
**Date**: 10 Nov 2025
