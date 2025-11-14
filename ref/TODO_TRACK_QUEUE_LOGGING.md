# 🎵 TODO: Track Queue Logging naar CloudWatch

**Datum:** 14 November 2025, 15:45 CET  
**Prioriteit:** HIGH  
**Status:** 📝 TODO

---

## 🎯 **DOEL:**

Alle tracks die:
1. **In de SQS queue staan** (waiting)
2. **Nu draaien** (currently playing)
3. **Gedraaid zijn** (played history)

Loggen naar CloudWatch voor beter inzicht in het queue proces en later een dashboard.

---

## 📊 **HUIDIGE SITUATIE:**

### **Wat Hebben We Al:**

```
✅ SQS Queue (FIFO)
   - URL: radio-track-stream-queue.fifo
   - Messages: Track metadata + S3 URL
   - Zichtbaar via: aws sqs get-queue-attributes

✅ CloudWatch Agent
   - Status: RUNNING
   - Log Group: /splash-fm/liquidsoap
   - Maar: Liquidsoap log is leeg/niet configured

❌ Track Logging
   - Geen "Now Playing" logs
   - Geen "Track Started" events
   - Geen "Track Finished" events
   - Geen SQS queue snapshots
```

### **SQS Queue Status (Nu):**
```json
{
  "ApproximateNumberOfMessages": "2",        // In queue
  "ApproximateNumberOfMessagesNotVisible": "0"  // In-flight
}
```

---

## 🏗️ **ARCHITECTUUR:**

```
┌──────────────────────────────────────────────────────────┐
│                    SQS FIFO QUEUE                         │
│            radio-track-stream-queue.fifo                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Message Format:                                          │
│  {                                                        │
│    "trackId": "uuid",                                     │
│    "title": "Artist - Title",                            │
│    "fileUrl": "s3://...",                                │
│    "duration": 180,                                       │
│    "timestamp": "2025-11-14T15:00:00Z"                   │
│  }                                                        │
│                                                           │
│  Queue Metrics:                                           │
│  ├─ ApproximateNumberOfMessages (waiting)                │
│  ├─ ApproximateNumberOfMessagesNotVisible (in-flight)   │
│  └─ ApproximateAgeOfOldestMessage                         │
│                                                           │
└────────────┬─────────────────────────────────────────────┘
             │
             │ Liquidsoap polls queue
             ↓
┌──────────────────────────────────────────────────────────┐
│                    LIQUIDSOAP (EC2)                       │
│                  /opt/radio/radio.liq                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  NEW: Track Event Logging                                 │
│  ├─ Event: track_fetched_from_sqs                         │
│  │  └─ Log: Queue → Liquidsoap buffer                    │
│  │                                                        │
│  ├─ Event: track_started                                  │
│  │  └─ Log: Now playing {artist} - {title}              │
│  │                                                        │
│  ├─ Event: track_ended                                    │
│  │  └─ Log: Finished {artist} - {title} ({duration}s)   │
│  │                                                        │
│  └─ Event: track_error                                    │
│     └─ Log: Failed to play {trackId}: {error}            │
│                                                           │
│  Output: /var/log/liquidsoap-tracks.log                  │
│                                                           │
└────────────┬─────────────────────────────────────────────┘
             │
             │ CloudWatch Agent collects logs
             ↓
┌──────────────────────────────────────────────────────────┐
│                    CLOUDWATCH LOGS                        │
│             /splash-fm/liquidsoap-tracks                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Log Entries:                                             │
│  [2025-11-14 15:30:00] FETCHED: track-123                │
│  [2025-11-14 15:30:05] STARTED: Artist - Title           │
│  [2025-11-14 15:33:05] ENDED: Artist - Title (180s)      │
│  [2025-11-14 15:33:06] FETCHED: track-124                │
│                                                           │
└────────────┬─────────────────────────────────────────────┘
             │
             │ Lambda parsing (optional)
             ↓
┌──────────────────────────────────────────────────────────┐
│              DYNAMODB: TrackHistory                       │
├──────────────────────────────────────────────────────────┤
│  PK: trackId                                              │
│  SK: timestamp                                            │
│  status: QUEUED | PLAYING | FINISHED | ERROR             │
│  queuedAt: ISO8601                                        │
│  startedAt: ISO8601                                       │
│  endedAt: ISO8601                                         │
│  duration: Number (seconds)                               │
│  listeners: Number (concurrent at start)                  │
└──────────────────────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────────────────────────────┐
│              CLOUDWATCH DASHBOARD                         │
├──────────────────────────────────────────────────────────┤
│  📊 Queue Process Visualization:                          │
│  ├─ Panel 1: SQS Queue Depth (line graph)                │
│  ├─ Panel 2: Currently Playing (text widget)             │
│  ├─ Panel 3: Recently Played (table)                     │
│  ├─ Panel 4: Track Duration Distribution                 │
│  ├─ Panel 5: Tracks Played per Hour                      │
│  └─ Panel 6: Queue Wait Time                             │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 **IMPLEMENTATIE:**

### **FASE 1: Liquidsoap Track Logging**

**Bestand:** `/opt/radio/radio.liq` (update)

```liquidsoap
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK EVENT LOGGING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Log file voor track events
track_log = "/var/log/liquidsoap-tracks.log"

# Helper function voor structured logging
def log_track_event(event_type, metadata) =
  timestamp = time.string()
  trackId = metadata["trackId"] ?? "unknown"
  title = metadata["title"] ?? "Unknown"
  artist = metadata["artist"] ?? "Unknown"
  
  message = "#{timestamp} | #{event_type} | #{trackId} | #{artist} - #{title}"
  
  # Log to file
  system("echo '#{message}' >> #{track_log}")
  
  # Also log to Liquidsoap log
  log.info("TRACK_EVENT: #{message}")
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 SQS TRACK FETCHING (Enhanced)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_next_track() =
  # Get track from SQS
  result = get_sqs_message()
  
  if result != "" then
    # Parse JSON
    json = json.parse(result)
    trackId = json["trackId"]
    path = json["fileUrl"]
    
    # Log: Track fetched from queue
    log_track_event("FETCHED", json)
    
    # Log queue status
    queue_depth = get_sqs_queue_depth()
    log.info("QUEUE_DEPTH: #{queue_depth} messages waiting")
    
    # Create request with metadata
    request = request.create(path)
    request.set_metadata(request, "trackId", trackId)
    request.set_metadata(request, "title", json["title"])
    
    [request]
  else
    log.warning("QUEUE_EMPTY: No tracks in SQS queue")
    []
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK LIFECYCLE HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# On track start
def on_track_start(metadata) =
  log_track_event("STARTED", metadata)
  
  # Send to CloudWatch Metrics (optional)
  trackId = metadata["trackId"] ?? "unknown"
  system("aws cloudwatch put-metric-data --namespace SplashFM --metric-name TrackStarted --value 1 --dimensions TrackId=#{trackId}")
end

# On track end
def on_track_end(metadata, duration) =
  log_track_event("ENDED", metadata)
  log.info("TRACK_DURATION: #{duration}s")
  
  # Log to structured log
  timestamp = time.string()
  trackId = metadata["trackId"] ?? "unknown"
  message = "#{timestamp} | DURATION | #{trackId} | #{duration}s"
  system("echo '#{message}' >> #{track_log}")
end

# On track error
def on_track_error(metadata, error) =
  metadata_with_error = metadata
  metadata_with_error["error"] = error
  log_track_event("ERROR", metadata_with_error)
  log.error("TRACK_ERROR: #{error}")
end

# Apply hooks to radio source
radio = on_track(on_track_start, radio)
radio = on_end(delay=1.0, on_track_end, radio)
```

---

### **FASE 2: CloudWatch Agent Update**

**Bestand:** `ec2-monitoring/cloudwatch-config.json` (update)

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/liquidsoap-tracks.log",
            "log_group_name": "/splash-fm/liquidsoap-tracks",
            "log_stream_name": "{instance_id}",
            "retention_in_days": 30,
            "timezone": "Local"
          }
        ]
      }
    }
  }
}
```

---

### **FASE 3: SQS Queue Metrics Script**

**Nieuw Bestand:** `ec2-monitoring/queue-stats.sh`

```bash
#!/bin/bash

# 📊 SQS Queue Statistics Logger

QUEUE_URL="https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
NAMESPACE="SplashFM"
REGION="eu-west-1"
LOG_FILE="/var/log/splash-queue-stats.log"

# Get queue attributes
QUEUE_ATTRS=$(aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names All \
  --region "$REGION" \
  --output json)

# Parse attributes
MESSAGES=$(echo $QUEUE_ATTRS | jq -r '.Attributes.ApproximateNumberOfMessages')
IN_FLIGHT=$(echo $QUEUE_ATTRS | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible')
OLDEST_MSG_AGE=$(echo $QUEUE_ATTRS | jq -r '.Attributes.ApproximateAgeOfOldestMessage // 0')

# Calculate total
TOTAL_QUEUE=$((MESSAGES + IN_FLIGHT))

# Log to file
echo "[$(date '+%Y-%m-%d %H:%M:%S')] QUEUE_STATUS | Messages: $MESSAGES | InFlight: $IN_FLIGHT | Total: $TOTAL_QUEUE | OldestAge: ${OLDEST_MSG_AGE}s" >> $LOG_FILE

# Send to CloudWatch Metrics
aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueDepth \
  --value "$MESSAGES" \
  --region "$REGION"

aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueInFlight \
  --value "$IN_FLIGHT" \
  --region "$REGION"

aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-name QueueTotal \
  --value "$TOTAL_QUEUE" \
  --region "$REGION"

if [ "$OLDEST_MSG_AGE" -gt 0 ]; then
  aws cloudwatch put-metric-data \
    --namespace "$NAMESPACE" \
    --metric-name QueueOldestMessageAge \
    --value "$OLDEST_MSG_AGE" \
    --unit Seconds \
    --region "$REGION"
fi

echo "✅ Queue stats sent to CloudWatch"
```

**Cron:** Every 1 minute
```bash
# In /etc/cron.d/splash-fm
*/1 * * * * root /usr/local/bin/queue-stats.sh >> /var/log/splash-queue-stats.log 2>&1
```

---

## 📊 **CLOUDWATCH DASHBOARD QUERIES:**

### **Panel 1: Currently Playing**

**CloudWatch Logs Insights:**
```
fields @timestamp, @message
| filter @logGroup = "/splash-fm/liquidsoap-tracks"
| filter @message like /STARTED/
| sort @timestamp desc
| limit 1
| parse @message /STARTED \| (?<trackId>\S+) \| (?<track>.*)/
| display @timestamp as Time, track as "Now Playing"
```

---

### **Panel 2: Recently Played (Last 10)**

```
fields @timestamp, @message
| filter @logGroup = "/splash-fm/liquidsoap-tracks"
| filter @message like /STARTED/
| sort @timestamp desc
| limit 10
| parse @message /\| STARTED \| (?<trackId>\S+) \| (?<track>.*)/
| display @timestamp as Time, track as Track
```

---

### **Panel 3: Queue Depth Over Time**

**Metric Query:**
```
SELECT AVG(QueueDepth) 
FROM "SplashFM" 
WHERE MetricName = 'QueueDepth'
GROUP BY time(1m)
```

**Visualization:** Line Graph

---

### **Panel 4: Tracks Played per Hour**

```
fields @timestamp
| filter @logGroup = "/splash-fm/liquidsoap-tracks"
| filter @message like /STARTED/
| stats count() as TracksPlayed by bin(@timestamp, 1h)
```

**Visualization:** Bar Chart

---

### **Panel 5: Track Duration Distribution**

```
fields @timestamp, @message
| filter @logGroup = "/splash-fm/liquidsoap-tracks"
| filter @message like /DURATION/
| parse @message /DURATION \| \S+ \| (?<duration>\d+)s/
| stats count() as Count by duration
| sort duration
```

**Visualization:** Histogram

---

### **Panel 6: Queue Wait Time**

**Metric Query:**
```
SELECT AVG(QueueOldestMessageAge) / 60 as WaitMinutes
FROM "SplashFM"
```

---

## 📝 **LOG FORMAT SPECIFICATIE:**

### **Liquidsoap Track Events:**

```
[2025-11-14 15:30:00] | FETCHED | track-abc123 | Artist - Title
[2025-11-14 15:30:05] | STARTED | track-abc123 | Artist - Title
[2025-11-14 15:33:05] | ENDED | track-abc123 | Artist - Title
[2025-11-14 15:33:05] | DURATION | track-abc123 | 180s
[2025-11-14 15:33:06] | FETCHED | track-def456 | NextArtist - NextTitle
```

**Format:**
```
[timestamp] | EVENT_TYPE | trackId | metadata
```

**Event Types:**
- `FETCHED` - Track opgehaald uit SQS queue
- `STARTED` - Track begint met afspelen
- `ENDED` - Track is afgelopen
- `DURATION` - Totale afspeelduur
- `ERROR` - Fout tijdens afspelen

---

### **Queue Stats Log:**

```
[2025-11-14 15:30:00] QUEUE_STATUS | Messages: 5 | InFlight: 1 | Total: 6 | OldestAge: 45s
[2025-11-14 15:31:00] QUEUE_STATUS | Messages: 4 | InFlight: 1 | Total: 5 | OldestAge: 105s
```

---

## 🎯 **USE CASES:**

### **Monitoring:**
```
✅ Hoeveel tracks in queue? (real-time)
✅ Welke track speelt nu?
✅ Hoelang staan tracks in de queue?
✅ Hoe vaak lopen we leeg?
```

### **Analytics:**
```
✅ Gemiddelde track duration
✅ Tracks per uur
✅ Peak uren
✅ Queue efficiency
```

### **Troubleshooting:**
```
✅ Waarom is de queue leeg?
✅ Welke tracks faalden?
✅ Queue processing latency
✅ Track fetch errors
```

### **Optimization:**
```
✅ Hoeveel tracks vooraf klaarzetten?
✅ Wanneer Lambda triggeren?
✅ Queue refill timing
```

---

## 🚀 **IMPLEMENTATIE PLAN:**

### **Stap 1: Liquidsoap Update (1-2 uur)**
```bash
1. Update /opt/radio/radio.liq met track logging
2. Test logging locally
3. Deploy to EC2
4. Restart Liquidsoap
5. Verify logs in /var/log/liquidsoap-tracks.log
```

### **Stap 2: CloudWatch Agent (30 min)**
```bash
1. Update cloudwatch-config.json
2. Deploy to EC2
3. Restart CloudWatch Agent
4. Verify log group created
5. Check logs flowing
```

### **Stap 3: Queue Stats Script (30 min)**
```bash
1. Create queue-stats.sh
2. Deploy to EC2
3. Add to cron
4. Test metrics in CloudWatch
```

### **Stap 4: Dashboard (1 uur)**
```bash
1. Create CloudWatch Dashboard
2. Add 6 panels
3. Configure queries
4. Test visualization
5. Share dashboard URL
```

**Total Time:** 3-4 uur

---

## 💰 **COST ESTIMATE:**

```
CloudWatch Logs:
- 1 extra log group (/splash-fm/liquidsoap-tracks)
- ~100 MB/dag (~1 track event per 3 min)
- Cost: ~$0.50/maand

CloudWatch Metrics:
- 4 new metrics (QueueDepth, InFlight, Total, OldestAge)
- Cost: ~$1.20/maand

CloudWatch Dashboard:
- First 3 dashboards: FREE
- Cost: $0/maand

Total: ~$2/maand
```

---

## ✅ **SUCCESS CRITERIA:**

```
✅ Track events logged (FETCHED, STARTED, ENDED)
✅ Logs flowing to CloudWatch
✅ Queue metrics updated every minute
✅ Dashboard shows:
   - Currently playing
   - Queue depth
   - Recently played
   - Tracks per hour
✅ Queries return data
✅ < 5 second latency
✅ Geen performance impact op stream
```

---

## 📊 **DASHBOARD LAYOUT:**

```
┌────────────────────────────────────────────────────────┐
│  📊 SplashFM - Track Queue Dashboard                   │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐│
│  │ Now Playing     │  │ Queue Depth (Line Graph)     ││
│  │                 │  │                              ││
│  │ 🎵 Artist       │  │  Messages ────────           ││
│  │    Title        │  │  In-Flight ········          ││
│  │                 │  │  Total ━━━━━━━━              ││
│  │ Duration: 3:42  │  │                              ││
│  └─────────────────┘  └──────────────────────────────┘│
│                                                         │
│  ┌────────────────────────────────────────────────────┐│
│  │ Recently Played (Last 10)                          ││
│  ├────────────┬───────────────────────┬───────────────┤│
│  │ Time       │ Track                 │ Duration      ││
│  ├────────────┼───────────────────────┼───────────────┤│
│  │ 15:30:05   │ Artist 1 - Title 1   │ 3:42          ││
│  │ 15:26:23   │ Artist 2 - Title 2   │ 4:15          ││
│  │ ...        │ ...                   │ ...           ││
│  └────────────┴───────────────────────┴───────────────┘│
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐│
│  │ Tracks/Hour     │  │ Queue Wait Time              ││
│  │ (Bar Chart)     │  │ (Gauge)                      ││
│  │                 │  │                              ││
│  │ █ █ █ █ █ █     │  │      2.5 min                 ││
│  └─────────────────┘  └──────────────────────────────┘│
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 📚 **KEYWORDS:**

`track-queue` `cloudwatch-logs` `liquidsoap-logging` `sqs-metrics` `dashboard` `queue-monitoring` `track-events` `now-playing` `track-history` `queue-depth`

---

**Status:** 📝 TODO - HIGH PRIORITY  
**Priority:** HIGH (voor dashboard visibility)  
**Effort:** 3-4 uur  
**Cost:** ~$2/maand  
**Next:** Update Liquidsoap met track event logging
