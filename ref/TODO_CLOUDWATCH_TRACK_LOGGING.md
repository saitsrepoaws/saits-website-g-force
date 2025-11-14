# 📊 TODO: CloudWatch Track Logging & Dashboard

**Datum:** 14 November 2025, 13:10 CET  
**Prioriteit:** Medium  
**Status:** 📝 TODO

---

## 🎯 **DOEL:**

Tracks die gespeeld worden loggen in CloudWatch en visualiseren in een dashboard voor monitoring en analytics.

---

## 📋 **REQUIREMENTS:**

### **1. Track Logging naar CloudWatch:**

**Wat loggen:**
- Track titel
- Artist
- Album (optioneel)
- Genre
- Timestamp (start play)
- Duration
- Track ID
- Label (optioneel)
- BPM (optioneel)
- Source (SQS, fallback, etc.)

**Log Format:**
```json
{
  "event": "track_played",
  "timestamp": "2025-11-14T13:10:45Z",
  "track": {
    "id": "track-123",
    "title": "Song Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "genre": "Dance",
    "duration": 210,
    "bpm": 128,
    "label": "Record Label"
  },
  "metadata": {
    "source": "sqs",
    "queue_size": 5,
    "health_score": 85
  }
}
```

**Log Group:**
- `/splash-fm/tracks-played`
- Retention: 90 days (voor analytics)

---

### **2. Implementation Opties:**

#### **Optie A: Liquidsoap → CloudWatch Logs**

**Voordelen:**
- Real-time logging
- Direct vanuit Liquidsoap
- Accurate play timestamps

**Implementatie:**
```liquidsoap
# In radio.liq, on_track event:
def on_track_change(metadata) =
  # Parse metadata
  title = metadata["title"]
  artist = metadata["artist"]
  
  # Create JSON log entry
  log_entry = json.stringify({
    event: "track_played",
    timestamp: time.string("%Y-%m-%dT%H:%M:%SZ"),
    track: {
      title: title,
      artist: artist,
      # ... more fields
    }
  })
  
  # Send to CloudWatch via AWS CLI or API
  system("aws logs put-log-events ...")
end

# Attach to source
radio = on_track(on_track_change, radio)
```

**Files:**
- `/opt/radio/radio.liq` - Add on_track handler
- EC2 IAM role - Add CloudWatch Logs permissions

---

#### **Optie B: Parse Liquidsoap Logs → CloudWatch**

**Voordelen:**
- Geen Liquidsoap wijzigingen
- Log parsing script
- Flexible

**Implementatie:**
```bash
# Script: /usr/local/bin/parse-track-logs.sh
# Parse /tmp/liquidsoap.log
# Extract "Now playing: ..." entries
# Send to CloudWatch Logs API
```

**Cron:**
```
*/5 * * * * /usr/local/bin/parse-track-logs.sh
```

---

#### **Optie C: Lambda + EventBridge + DynamoDB**

**Voordelen:**
- Complete audit trail
- DynamoDB storage + CloudWatch
- Analytics ready

**Flow:**
```
Lambda (stream-playlist-updater)
  → Queue track to SQS
  → Also log to CloudWatch Logs
  → Store in DynamoDB (optional)
  
EventBridge
  → Schedule hourly
  → Trigger Lambda
  → Lambda logs playlist
```

**Files:**
- `/amplify/functions/stream-playlist-updater/handler.ts`
- Add CloudWatch Logs SDK calls

---

### **3. CloudWatch Dashboard:**

**Dashboard Name:** `SplashFM-Track-Analytics`

**Panels:**

#### **A. Tracks Played (Last 24h)**
```
Query:
fields @timestamp, track.title, track.artist, track.genre
| filter event = "track_played"
| sort @timestamp desc
| limit 100
```

**Visualization:** Table

---

#### **B. Genre Distribution (Last 24h)**
```
Query:
filter event = "track_played"
| stats count() by track.genre
```

**Visualization:** Pie chart

---

#### **C. Tracks per Hour**
```
Query:
filter event = "track_played"
| stats count() by bin(@timestamp, 1h)
```

**Visualization:** Line chart

---

#### **D. Most Played Artists (Last 7 days)**
```
Query:
filter event = "track_played"
| stats count() as play_count by track.artist
| sort play_count desc
| limit 20
```

**Visualization:** Bar chart (horizontal)

---

#### **E. Average Track Duration**
```
Query:
filter event = "track_played"
| stats avg(track.duration) as avg_duration by bin(@timestamp, 1h)
```

**Visualization:** Line chart

---

#### **F. BPM Distribution**
```
Query:
filter event = "track_played"
| filter track.bpm > 0
| stats count() by track.bpm
| sort track.bpm
```

**Visualization:** Bar chart

---

#### **G. Label Distribution**
```
Query:
filter event = "track_played"
| stats count() by track.label
| sort count desc
| limit 10
```

**Visualization:** Pie chart

---

#### **H. Track Play Timeline**
```
Query:
fields @timestamp, track.title, track.artist
| filter event = "track_played"
| sort @timestamp asc
```

**Visualization:** Timeline

---

### **4. Metrics (Optional):**

**Custom Metrics:**
- `TracksPlayed` (count per hour)
- `UniqueArtists` (count per day)
- `GenreCount` (count by genre)
- `AverageBPM` (avg per hour)

**Alarms:**
- No tracks played > 10 min → ALARM
- Same track repeated > 3 times → WARNING
- BPM variance too high → INFO

---

## 🔧 **IMPLEMENTATION PLAN:**

### **Fase 1: Logging Setup**
1. Kies optie (A, B, of C)
2. Implementeer logging logic
3. Test log entries
4. Verify CloudWatch Logs

**Effort:** 2-3 uur

---

### **Fase 2: CloudWatch Dashboard**
1. Create log group
2. Define log insights queries
3. Build dashboard panels
4. Test visualizations

**Effort:** 1-2 uur

---

### **Fase 3: Metrics & Alarms (Optional)**
1. Create custom metrics
2. Define alarms
3. Setup SNS notifications
4. Test alerting

**Effort:** 1 uur

---

## 📊 **USE CASES:**

**Analytics:**
- Welke genres worden het meest gespeeld?
- Welke artists zijn populair?
- Wat is de gemiddelde BPM per uur?
- Hoeveel tracks per dag?

**Monitoring:**
- Is de stream actief? (tracks playing)
- Loopt playlist niet vast? (geen repeats)
- Is er variatie in genres?

**Reporting:**
- Maandelijks rapport: top 100 tracks
- Artist play counts (voor royalties)
- Genre distribution trends
- Peak listening times

**Debugging:**
- Welke track speelde toen stream crashed?
- Hoeveel tracks in queue op tijdstip X?
- Was er een gap tussen tracks?

---

## 🎯 **DELIVERABLES:**

```
✅ Track logging naar CloudWatch Logs
✅ CloudWatch Dashboard met 8 panels
✅ Log Insights queries (saved)
✅ Documentation
✅ Metrics (optional)
✅ Alarms (optional)
```

---

## 📁 **FILES TO MODIFY:**

### **Optie A (Liquidsoap):**
```
/opt/radio/radio.liq              - Add on_track logging
/opt/radio/cloudwatch-logger.sh   - Helper script (optional)
EC2 IAM Role                      - Add CloudWatch Logs permissions
```

### **Optie B (Log Parsing):**
```
/usr/local/bin/parse-track-logs.sh   - Parse & send logs
/etc/cron.d/splash-fm                - Add cron job
EC2 IAM Role                         - Add CloudWatch Logs permissions
```

### **Optie C (Lambda):**
```
/amplify/functions/stream-playlist-updater/handler.ts  - Add logging
/amplify/backend.ts                                    - Add CloudWatch permissions
```

---

## 🔐 **PERMISSIONS NEEDED:**

**EC2 IAM Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/splash-fm/tracks-played",
        "arn:aws:logs:*:*:log-group:/splash-fm/tracks-played:*"
      ]
    }
  ]
}
```

---

## 📝 **EXAMPLE QUERIES:**

### **Tracks played vandaag:**
```
fields @timestamp, track.title, track.artist, track.genre
| filter event = "track_played"
| filter @timestamp > ago(24h)
| sort @timestamp desc
```

### **Top 10 artists deze week:**
```
filter event = "track_played"
| filter @timestamp > ago(7d)
| stats count() as plays by track.artist
| sort plays desc
| limit 10
```

### **Genre breakdown per dag:**
```
filter event = "track_played"
| stats count() as tracks by track.genre, bin(@timestamp, 1d)
```

### **BPM trends:**
```
filter event = "track_played"
| filter track.bpm > 0
| stats avg(track.bpm) as avg_bpm, min(track.bpm) as min_bpm, max(track.bpm) as max_bpm by bin(@timestamp, 1h)
```

---

## 💡 **NICE TO HAVE:**

- Export naar S3 voor long-term analytics
- BigQuery/Athena voor SQL queries
- Grafana dashboard (als alternatief)
- Real-time listener count correlation
- Track popularity score calculation
- Duplicate detection (same track < 1 hour)
- Cross-reference met Spotify API (track popularity)

---

## 🎯 **SUCCESS CRITERIA:**

```
✅ Elke gespeelde track gelogd in CloudWatch
✅ Dashboard toont real-time track info
✅ Queries werken binnen 5 seconden
✅ Logs retention 90 dagen
✅ Kosten < $5/maand
✅ No performance impact op Liquidsoap
```

---

## 📚 **KEYWORDS:**

`cloudwatch` `logs` `dashboard` `tracks` `analytics` `monitoring` `reporting` `metrics` `liquidsoap` `played-tracks` `genre-distribution` `artist-stats` `bpm-analysis` `log-insights` `visualization`

---

**Status:** 📝 TODO  
**Priority:** Medium  
**Effort:** 4-6 uur (complete implementation)  
**Next:** Kies implementatie optie (A, B, of C)
