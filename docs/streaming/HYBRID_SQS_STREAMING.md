# 🎵 Hybrid SQS Streaming Architecture (ACTIVE PLAN)

**Created:** 13 November 2025, 23:34 CET  
**Status:** 🟢 ACTIVE PLAN - Replacing M3U System  
**Priority:** HIGH  
**Current System:** M3U (marked DEPRECATED)

---

## 🎯 Concept: Just-In-Time Track Streaming

**Idee:** Maximale flexibiliteit met minimale buffer

```
┌──────────────────────────────────────────────────────────┐
│  QUEUE STATUS (Real-time)                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Track 1: ▶️  PLAYING NOW (Liquidsoap)                   │
│  Track 2: ⏸️  READY (in queue, next up)                  │
│                                                           │
│  → Track 1 ends → Lambda triggers → Add Track 3          │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Voordelen:**
- ✅ **Maximale flexibiliteit** - Playlist kan real-time worden aangepast
- ✅ **Altijd 1 buffer** - Track 2 staat klaar als Track 1 eindigt
- ✅ **Event-driven** - Lambda reageert op track completion
- ✅ **Geen grote downloads** - Tracks on-demand van S3
- ✅ **Live playlist updates** - Wijzigingen direct actief

---

## 🏗️ Architecture

### **System Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    DynamoDB                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Schedule   │  │   Playlist   │  │    Track     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│  Lambda: track-queue-manager                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Triggers:                                           │  │
│  │  1. EventBridge (initial: top of hour)              │  │
│  │  2. SQS Queue (when queue < 2 messages)             │  │
│  │  3. Manual invoke (playlist change)                 │  │
│  │                                                      │  │
│  │  Logic:                                             │  │
│  │  - Check queue size                                 │  │
│  │  - If < 2: add next track from playlist            │  │
│  │  - Send track details + S3 URL to SQS              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────────────────────────┘
             │
             │ SendMessage (track details)
             ▼
┌────────────────────────────────────────────────────────────┐
│  SQS FIFO Queue: radio-track-stream-queue.fifo            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Target State: ALWAYS 2 tracks                      │  │
│  │  - Track 1: Being played by Liquidsoap              │  │
│  │  - Track 2: Ready for next (in queue)               │  │
│  │                                                      │  │
│  │  Visibility Timeout: 5 minutes (track duration)     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────────────────────────┘
             │
             │ ReceiveMessage (long polling)
             ▼
┌────────────────────────────────────────────────────────────┐
│  Liquidsoap (EC2)                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  def get_next_track():                              │  │
│  │    # Poll SQS (20s long polling)                    │  │
│  │    message = sqs.receive_message()                  │  │
│  │                                                      │  │
│  │    if queue_size < 2:                               │  │
│  │      # Trigger Lambda to add next track            │  │
│  │      invoke_lambda('track-queue-manager')          │  │
│  │                                                      │  │
│  │    return message.s3_url                            │  │
│  │  end                                                │  │
│  │                                                      │  │
│  │  radio = request.dynamic.list(                      │  │
│  │    prefetch=1,  # Always 1 track ahead            │  │
│  │    get_next_track                                   │  │
│  │  )                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
       [Icecast Stream]
```

---

## 🔄 **Lifecycle: Track 1 → Track 2 → Track 3**

### **Initial State (Top of Hour):**
```
EventBridge → Lambda → Add Track 1 + Track 2 to queue

Queue: [Track 1] [Track 2]
Playing: None yet
```

### **Step 1: Start Playing Track 1**
```
Liquidsoap polls SQS → Receives Track 1
Queue: [Track 2]
Playing: Track 1 ▶️
Next: Track 2 ⏸️ (ready in queue)
```

### **Step 2: Track 1 Nearing End**
```
Liquidsoap detects: queue_size = 1 (only Track 2 left)
→ Triggers Lambda
→ Lambda adds Track 3

Queue: [Track 2] [Track 3]
Playing: Track 1 ▶️ (ending soon)
Next: Track 2 ⏸️ → Track 3 ⏸️
```

### **Step 3: Track 1 Ends**
```
Liquidsoap finishes Track 1
→ Deletes Track 1 from SQS
→ Starts Track 2

Queue: [Track 3]
Playing: Track 2 ▶️
Next: Track 3 ⏸️
```

### **Step 4: Repeat**
```
Liquidsoap detects: queue_size = 1
→ Triggers Lambda
→ Lambda adds Track 4

Queue: [Track 3] [Track 4]
Playing: Track 2 ▶️
Next: Track 3 ⏸️ → Track 4 ⏸️
```

**Cycle continues...**

---

## 📋 **SQS Message Format**

### **Track Message:**
```json
{
  "trackId": "c723582d-f8f1-457c-a07f-f28809890d86",
  "title": "Heat again",
  "artist": "Ackermann",
  "fileUrl": "s3://bucket/public/audio/track.mp3",
  "duration": 320,
  "coverArtUrl": "s3://bucket/public/covers/cover.jpg",
  "genre": "Techno (Raw / Deep / Hypnotic)",
  "bpm": 128,
  "playlistPosition": 3,
  "playlistId": "playlist-xyz",
  "playlistName": "TechnoHouse"
}
```

### **Message Attributes:**
```json
{
  "title": {
    "DataType": "String",
    "StringValue": "Heat again"
  },
  "artist": {
    "DataType": "String",
    "StringValue": "Ackermann"
  },
  "trackId": {
    "DataType": "String",
    "StringValue": "c723582d-f8f1-457c-a07f-f28809890d86"
  }
}
```

---

## ⚙️ **Lambda: track-queue-manager**

### **File:** `/amplify/functions/track-queue-manager/handler.ts`

```typescript
import { SQSClient, SendMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

const sqs = new SQSClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const QUEUE_URL = process.env.QUEUE_URL!
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE!
const TRACK_TABLE = process.env.TRACK_TABLE!
const SCHEDULE_TABLE = process.env.SCHEDULE_TABLE!

interface TrackPosition {
  playlistId: string
  currentPosition: number // Which track we're at (0-indexed)
}

export const handler = async (event: any) => {
  console.log('🎵 Track Queue Manager - Starting...')
  
  // 1. Check current queue size
  const queueSize = await getQueueSize()
  console.log(`📊 Current queue size: ${queueSize}`)
  
  // If queue has 2+ tracks, nothing to do
  if (queueSize >= 2) {
    console.log('✅ Queue is full (2 tracks), nothing to do')
    return { statusCode: 200, body: 'Queue full' }
  }
  
  // 2. Get current playlist and position
  const { playlistId, currentPosition } = await getCurrentPlaylistState()
  
  // 3. Get playlist tracks
  const { Item: playlist } = await dynamodb.send(new GetCommand({
    TableName: PLAYLIST_TABLE,
    Key: { id: playlistId }
  }))
  
  const tracks = JSON.parse(playlist.tracks || '[]')
  
  // 4. Calculate how many tracks to add (to reach 2 total)
  const tracksToAdd = 2 - queueSize
  console.log(`📥 Adding ${tracksToAdd} track(s) to queue`)
  
  // 5. Add next track(s) from playlist
  for (let i = 0; i < tracksToAdd; i++) {
    const nextPosition = (currentPosition + i) % tracks.length // Loop playlist
    const track = tracks[nextPosition]
    
    // Get full track details from Track table
    const { Item: fullTrack } = await dynamodb.send(new GetCommand({
      TableName: TRACK_TABLE,
      Key: { id: track.trackId }
    }))
    
    // Send to SQS
    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageGroupId: 'radio-stream',
      MessageDeduplicationId: `${track.trackId}-${Date.now()}-${nextPosition}`,
      MessageBody: JSON.stringify({
        trackId: fullTrack.id,
        title: fullTrack.title,
        artist: fullTrack.artist,
        fileUrl: fullTrack.fileUrl,
        duration: fullTrack.duration,
        coverArtUrl: fullTrack.coverArtUrl,
        genre: fullTrack.genre,
        bpm: fullTrack.bpm,
        playlistPosition: nextPosition,
        playlistId: playlistId,
        playlistName: playlist.name
      }),
      MessageAttributes: {
        title: { DataType: 'String', StringValue: fullTrack.title },
        artist: { DataType: 'String', StringValue: fullTrack.artist || 'Unknown' },
        trackId: { DataType: 'String', StringValue: fullTrack.id }
      }
    }))
    
    console.log(`✅ Added track ${nextPosition + 1}: ${fullTrack.artist} - ${fullTrack.title}`)
  }
  
  // 6. Update current position
  await updatePlaylistPosition(playlistId, currentPosition + tracksToAdd)
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      tracksAdded: tracksToAdd,
      newQueueSize: queueSize + tracksToAdd
    })
  }
}

async function getQueueSize(): Promise<number> {
  const result = await sqs.send(new GetQueueAttributesCommand({
    QueueUrl: QUEUE_URL,
    AttributeNames: ['ApproximateNumberOfMessages']
  }))
  return parseInt(result.Attributes?.ApproximateNumberOfMessages || '0')
}

async function getCurrentPlaylistState(): Promise<TrackPosition> {
  // Get current schedule slot
  const slot = await getCurrentScheduleSlot()
  
  // Get or create playlist state (stored in DynamoDB or cache)
  // For now, start at position 0
  return {
    playlistId: slot.playlistId,
    currentPosition: 0 // TODO: Track this in DynamoDB
  }
}

async function updatePlaylistPosition(playlistId: string, position: number) {
  // TODO: Store current position in DynamoDB
  // This allows resuming from correct position after Lambda restarts
}
```

---

## 🎚️ **Liquidsoap Configuration**

### **File:** `/opt/radio/radio.liq`

```liquidsoap
#!/usr/bin/liquidsoap

set("init.allow_root", true)
log.level.set(4)

# SQS Queue URL
queue_url = "https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
lambda_name = "track-queue-manager"

# Track queue state
current_track_id = ref("")
queue_checked_recently = ref(false)

# Function to get queue size
def get_queue_size() =
  result = get_process_output(
    "aws sqs get-queue-attributes \
      --queue-url #{queue_url} \
      --attribute-names ApproximateNumberOfMessages \
      --region eu-west-1 \
      --output json"
  )
  
  # Parse JSON and extract count
  # TODO: Proper JSON parsing
  count = 0 # Placeholder
  count
end

# Function to trigger Lambda
def trigger_lambda_add_track() =
  print("🔔 Queue low, triggering Lambda to add next track...")
  
  ignore(get_process_output(
    "aws lambda invoke \
      --function-name #{lambda_name} \
      --invocation-type Event \
      --region eu-west-1 \
      /tmp/lambda-response.json"
  ))
end

# Function to get next track from SQS
def get_next_track() =
  print("📥 Polling SQS for next track...")
  
  # Check queue size before receiving
  queue_size = get_queue_size()
  
  if queue_size < 2 then
    print("⚠️ Queue size: #{queue_size} (< 2) - Triggering Lambda")
    trigger_lambda_add_track()
  end
  
  # Receive message from SQS (long polling 20s)
  result = get_process_output(
    "aws sqs receive-message \
      --queue-url #{queue_url} \
      --max-number-of-messages 1 \
      --wait-time-seconds 20 \
      --message-attribute-names All \
      --region eu-west-1 \
      --output json"
  )
  
  # Parse JSON
  # TODO: Proper JSON parsing with jq
  message_body = "" # Extract MessageBody
  receipt_handle = "" # Extract ReceiptHandle
  
  if message_body != "" then
    # Parse track details
    file_url = "" # Extract fileUrl from message_body
    track_id = "" # Extract trackId
    title = "" # Extract title
    artist = "" # Extract artist
    
    print("🎵 Got track: #{artist} - #{title}")
    current_track_id := track_id
    
    # Delete message after receiving (immediate)
    ignore(get_process_output(
      "aws sqs delete-message \
        --queue-url #{queue_url} \
        --receipt-handle #{process.quote(receipt_handle)} \
        --region eu-west-1"
    ))
    
    # Return S3 URL for Liquidsoap to play
    file_url
  else
    print("❌ No track in queue")
    "" # Return empty (fallback/silence)
  end
end

# Request-based source with prefetch
radio = request.dynamic.list(
  prefetch=1,  # Always fetch 1 track ahead
  get_next_track
)

# Crossfade
radio = cross(duration=5.0, radio)

# Make safe (fallback to silence if needed)
radio = mksafe(radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream-raw.mp3",
  name="Splash FM - Raw",
  radio
)

print("✅ SQS-based radio started!")
```

---

## 🔧 **Triggers & Events**

### **1. Initial Trigger (EventBridge):**
```
Cron: 0 * * * ? * (top of every hour)
→ Lambda: track-queue-manager
→ Action: Check schedule, add Track 1 + Track 2
```

### **2. Queue Low Trigger (Liquidsoap):**
```
Liquidsoap checks: queue_size < 2
→ Invoke Lambda (async)
→ Lambda adds next track
```

### **3. Manual Trigger (Playlist Change):**
```
User changes playlist in UI
→ API call to Lambda
→ Lambda purges queue + adds new tracks
```

---

## 📊 **Comparison: M3U vs Hybrid SQS**

| Feature | M3U (Current) | Hybrid SQS (Planned) |
|---------|---------------|----------------------|
| **Update frequency** | Hourly | Real-time (per track) |
| **Flexibility** | Low (1 hour locked) | High (change anytime) |
| **Buffer size** | 16 tracks (full playlist) | 2 tracks (minimal) |
| **Disk usage** | 360 MB | ~0 MB (S3 streaming) |
| **Network usage** | Low (1x per hour) | Medium (per track) |
| **Playlist changes** | Wait up to 1 hour | Immediate |
| **Track skipping** | Restart Liquidsoap | Just purge queue |
| **Live DJ mode** | ❌ Not possible | ✅ Possible! |
| **Failover** | Excellent (local files) | Good (S3 dependency) |

---

## ✅ **Benefits of Hybrid SQS**

1. **Real-time Playlist Updates**
   - Change playlist → New tracks start immediately
   - Skip track → Next track plays
   - Insert jingle → Plays after current track

2. **Live DJ Mode**
   - Queue up tracks on the fly
   - React to listener requests
   - Emergency overrides

3. **Resource Efficient**
   - No 360 MB disk storage needed
   - Tracks stream from S3
   - Auto-cleanup built-in

4. **Monitoring**
   - See exactly what's in queue
   - Track playback history
   - SQS metrics in CloudWatch

---

## 🚀 **Implementation Steps**

### **Phase 1: Lambda Development**
- [ ] Create `track-queue-manager` Lambda function
- [ ] Implement queue size checking
- [ ] Implement track fetching from DynamoDB
- [ ] Implement SQS SendMessage
- [ ] Add playlist position tracking

### **Phase 2: Liquidsoap Update**
- [ ] Update `/opt/radio/radio.liq` with SQS polling
- [ ] Implement queue size check logic
- [ ] Implement Lambda trigger from Liquidsoap
- [ ] Add error handling & fallbacks
- [ ] Test SQS message parsing

### **Phase 3: Testing**
- [ ] Test with 2 tracks manually in queue
- [ ] Test track transition (Track 1 → Track 2)
- [ ] Test Lambda auto-trigger
- [ ] Test playlist looping
- [ ] Test error scenarios

### **Phase 4: Migration**
- [ ] Deploy Lambda to production
- [ ] Update Liquidsoap on EC2
- [ ] Initial queue population (2 tracks)
- [ ] Monitor for 1 hour
- [ ] Deprecate M3U system

---

## ⚠️ **Considerations**

### **Network Dependency:**
- Liquidsoap streams from S3 → Requires stable internet
- Mitigation: Cache last N tracks locally as backup

### **S3 Streaming Performance:**
- S3 → EC2 in same region = fast
- Use S3 Transfer Acceleration if needed

### **Queue State Management:**
- Track current playlist position in DynamoDB
- Persist across Lambda restarts

### **Cost:**
- SQS: $0 (first 1M requests free)
- Lambda invocations: ~720/month (every 5 min avg) = $0
- S3 GET requests: ~720/month = $0
- **Total: $0** (within free tier)

---

## 📝 **Status Updates**

### **13 Nov 2025, 23:34:**
- 📋 Documentation created
- 🟡 M3U system marked for deprecation
- 🔴 Hybrid SQS implementation: TODO

---

**Next:** Implement Lambda + Liquidsoap updates! 🚀
