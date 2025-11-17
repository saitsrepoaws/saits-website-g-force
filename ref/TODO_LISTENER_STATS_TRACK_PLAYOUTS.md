# 📊 TODO: Listener Statistics + Track Playout Tracking

**Datum:** 14 November 2025, 13:39 CET  
**Prioriteit:** MEDIUM  
**Status:** 📝 TODO

---

## 🎯 **DOEL:**

Weten **hoeveel luisteraars** we hebben en **welke tracks er uitgezonden zijn** via Icecast, met koppelingen tussen:
- 📻 Track playouts (wat werd afgespeeld)
- 👥 Listener counts (hoeveel mensen luisterden)
- ⏱️ Timeline (wanneer)
- 🌍 Geografisch (waar vandaan)

**Strategie:**
1. **EERST:** Logs verzamelen (Icecast access logs → CloudWatch)
2. **LATER:** Koppelingen bouwen (Lambda parsing + DynamoDB)
3. **RESULTAAT:** Dashboard met luisteraar stats + track playouts

---

## 📋 **WAT MOET ER KOMEN:**

### **1. Track Playout Logging**

**Doel:** Weten welke track wanneer is uitgezonden

**Data Sources:**

**A. Icecast Logs** (Already available!)
```
Access Log: /var/log/icecast2/access.log
Format: 
79.125.44.178 - - [14/Nov/2025:13:30:00 +0100] "GET /stream.mp3 HTTP/1.1" 200 4567890
```

**B. Liquidsoap Metadata** (Track info)
```
Liquidsoap Log: /tmp/liquidsoap.log
Format:
[2025/11/14 13:30:00] INFO: Now playing: Artist - Title
```

**C. Stream Metadata Events** (Real-time)
```
Icecast Metadata Updates:
- StreamTitle='Artist - Title'
- StreamUrl='https://splashfm.nl'
```

---

### **2. Listener Statistics**

**Doel:** Weten hoeveel mensen er luisteren

**Metrics:**

**A. Concurrent Listeners**
```
Source: Icecast status-json.xsl
Data:
- listeners: 5
- listeners_peak: 12
- server_start_iso8601: "2025-11-14T12:00:00Z"
```

**B. Unique Listeners**
```
Source: Icecast access.log parsing
Count unique IPs per tijdsperiode
```

**C. Geographic Distribution**
```
Source: IP → GeoIP lookup
Data:
- Country
- City
- ISP
```

**D. Connection Duration**
```
Source: Icecast access.log
Calculate: disconnect_time - connect_time
```

---

## 🏗️ **ARCHITECTUUR:**

```
┌────────────────────────────────────────────────────────┐
│                    EC2 STREAM SERVER                    │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Liquidsoap                                             │
│  ├─ Plays track                                         │
│  ├─ Updates metadata                                    │
│  └─ Logs: [13:30:00] Now playing: Artist - Title       │
│                                                         │
│  Icecast2                                               │
│  ├─ Streams to listeners                                │
│  ├─ Access log: GET /stream.mp3 200                     │
│  ├─ Status JSON: { listeners: 5 }                       │
│  └─ Metadata: StreamTitle='Artist - Title'             │
│                                                         │
└─────────┬──────────────────────────────────────────────┘
          │
          │ CloudWatch Agent
          ↓
┌────────────────────────────────────────────────────────┐
│                   CLOUDWATCH LOGS                       │
├────────────────────────────────────────────────────────┤
│                                                         │
│  /splash-fm/liquidsoap                                  │
│  └─ Now playing events                                  │
│                                                         │
│  /splash-fm/icecast                                     │
│  ├─ Access log (connections)                            │
│  └─ Error log                                           │
│                                                         │
└─────────┬──────────────────────────────────────────────┘
          │
          │ Trigger (new log entry)
          ↓
┌────────────────────────────────────────────────────────┐
│              LAMBDA: Log Parser (FUTURE)                │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Parse Liquidsoap logs:                                 │
│  ├─ Extract: track, artist, title, timestamp           │
│  └─ Write to DynamoDB: TrackPlayouts                    │
│                                                         │
│  Parse Icecast logs:                                    │
│  ├─ Extract: IP, timestamp, bytes, duration             │
│  ├─ GeoIP lookup                                        │
│  └─ Write to DynamoDB: ListenerSessions                 │
│                                                         │
└─────────┬──────────────────────────────────────────────┘
          │
          ↓
┌────────────────────────────────────────────────────────┐
│                  DYNAMODB TABLES                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│  TrackPlayouts                                          │
│  ├─ PK: date#timestamp                                  │
│  ├─ SK: trackId                                         │
│  ├─ artist: String                                      │
│  ├─ title: String                                       │
│  ├─ timestamp: ISO8601                                  │
│  ├─ duration: Number (seconds)                          │
│  └─ listeners: Number (concurrent at time)              │
│                                                         │
│  ListenerSessions                                       │
│  ├─ PK: sessionId                                       │
│  ├─ SK: timestamp                                       │
│  ├─ ip: String                                          │
│  ├─ country: String                                     │
│  ├─ city: String                                        │
│  ├─ connectTime: ISO8601                                │
│  ├─ disconnectTime: ISO8601                             │
│  ├─ duration: Number (seconds)                          │
│  ├─ bytesTransferred: Number                            │
│  └─ userAgent: String                                   │
│                                                         │
│  ListenerStats (Aggregated)                             │
│  ├─ PK: date                                            │
│  ├─ SK: hour                                            │
│  ├─ uniqueListeners: Number                             │
│  ├─ peakListeners: Number                               │
│  ├─ avgDuration: Number                                 │
│  ├─ totalSessions: Number                               │
│  └─ topCountries: [String]                              │
│                                                         │
└─────────┬──────────────────────────────────────────────┘
          │
          ↓
┌────────────────────────────────────────────────────────┐
│              CLOUDWATCH DASHBOARD                       │
├────────────────────────────────────────────────────────┤
│                                                         │
│  📊 Panels:                                             │
│  ├─ Concurrent Listeners (real-time)                    │
│  ├─ Total Listeners (24h)                               │
│  ├─ Unique Listeners (24h)                              │
│  ├─ Track Playouts (timeline)                           │
│  ├─ Geographic Map                                      │
│  ├─ Top Tracks (most played)                            │
│  ├─ Avg Listen Duration                                 │
│  └─ Peak Hours (heatmap)                                │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 📊 **FASE 1: LOGS VERZAMELEN (NU!)**

**Status:** ✅ Al geconfigureerd in cloudwatch-config.json

**CloudWatch Log Groups:**
```
✅ /splash-fm/icecast
   ├─ access.log (listener connections)
   └─ error.log

✅ /splash-fm/liquidsoap
   └─ Track now playing events
```

**Icecast Access Log Format:**
```
IP - - [timestamp] "GET /stream.mp3 HTTP/1.1" status bytes "referer" "user-agent"

Example:
79.125.44.178 - - [14/Nov/2025:13:30:00 +0100] "GET /stream.mp3 HTTP/1.1" 200 4567890 "-" "VLC/3.0.16"
```

**Liquidsoap Log Format:**
```
[timestamp] level: message

Example:
[2025/11/14 13:30:00] INFO: Now playing: Artist - Title (from playlist)
```

---

## 📊 **FASE 2: REAL-TIME METRICS (NU!)**

**Script:** `listener-stats.sh` (NEW!)

**Functie:**
- Query Icecast status JSON
- Parse concurrent listeners
- Send to CloudWatch Metrics

**Metrics:**
```
Namespace: SplashFM

Metrics:
- ConcurrentListeners (Number)
- PeakListeners (Number)
- StreamUptime (Seconds)
```

**Cron:** Every 1 minute (samen met health-check)

---

## 📊 **FASE 3: LOG PARSING + DATABASE (LATER)**

**Lambda Function:** `log-parser`

**Triggers:**
- CloudWatch Logs Subscription Filter
- New log entry in /splash-fm/icecast or /splash-fm/liquidsoap

**Processing:**

**A. Track Playout Parsing:**
```javascript
// Parse Liquidsoap log
const regex = /\[(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})\] INFO: Now playing: (.+) - (.+)/
const match = logLine.match(regex)

if (match) {
  const [_, timestamp, artist, title] = match
  
  // Write to DynamoDB
  await dynamodb.put({
    TableName: 'TrackPlayouts',
    Item: {
      pk: `${date}#${timestamp}`,
      sk: trackId,
      artist,
      title,
      timestamp,
      listeners: await getCurrentListeners()
    }
  })
}
```

**B. Listener Session Parsing:**
```javascript
// Parse Icecast access log
const regex = /^(\S+) - - \[([^\]]+)\] "GET \/stream\.mp3 HTTP\/1\.1" (\d+) (\d+)/
const match = logLine.match(regex)

if (match) {
  const [_, ip, timestamp, status, bytes] = match
  
  // GeoIP lookup
  const geo = await geoip.lookup(ip)
  
  // Write to DynamoDB
  await dynamodb.put({
    TableName: 'ListenerSessions',
    Item: {
      pk: sessionId,
      sk: timestamp,
      ip,
      country: geo.country,
      city: geo.city,
      bytesTransferred: parseInt(bytes),
      timestamp
    }
  })
}
```

---

## 📊 **FASE 4: DASHBOARD (LATER)**

**CloudWatch Dashboard Queries:**

**Panel 1: Concurrent Listeners (Real-time)**
```
Metric: SplashFM.ConcurrentListeners
Period: 1 minute
Stat: Average
```

**Panel 2: Track Playouts Timeline**
```
Source: CloudWatch Logs Insights
Query:
fields timestamp, artist, title
| filter @message like /Now playing/
| parse @message /Now playing: (?<artist>.+) - (?<title>.+)/
| sort @timestamp desc
| limit 20
```

**Panel 3: Unique Listeners per Hour**
```
Source: CloudWatch Logs Insights
Query:
fields @timestamp
| filter @message like /GET \/stream.mp3/
| parse @message /^(?<ip>\S+) /
| stats count_distinct(ip) as unique_listeners by bin(@timestamp, 1h)
```

**Panel 4: Geographic Distribution**
```
Source: DynamoDB (after Lambda parsing)
Query: Count sessions per country
Visualization: Map
```

**Panel 5: Top Played Tracks**
```
Source: CloudWatch Logs Insights
Query:
fields artist, title
| filter @message like /Now playing/
| parse @message /Now playing: (?<artist>.+) - (?<title>.+)/
| stats count() as plays by artist, title
| sort plays desc
| limit 10
```

---

## 🔧 **IMPLEMENTATION PLAN:**

### **FASE 1: Logs Verzamelen (DONE!)**
```
✅ CloudWatch Agent configured
✅ Icecast logs → /splash-fm/icecast
✅ Liquidsoap logs → /splash-fm/liquidsoap
✅ Retention: 7-30 days
```

### **FASE 2: Real-time Metrics (TODO - HIGH)**
```
⏳ Create listener-stats.sh
⏳ Query Icecast status JSON
⏳ Send CloudWatch metrics
⏳ Add to cron (every 1 min)
⏳ Test metrics in CloudWatch
```

### **FASE 3: Basic Dashboard (TODO - MEDIUM)**
```
⏳ Create CloudWatch Dashboard
⏳ Add concurrent listeners panel
⏳ Add track playouts panel (Logs Insights)
⏳ Add unique listeners panel
⏳ Test queries
```

### **FASE 4: Advanced Parsing (TODO - LOW)**
```
⏳ Create Lambda log-parser
⏳ Create DynamoDB tables
⏳ Subscription filters
⏳ GeoIP integration
⏳ Test parsing
```

### **FASE 5: Advanced Dashboard (TODO - LOW)**
```
⏳ Add geographic map
⏳ Add top tracks widget
⏳ Add listener trends
⏳ Add heatmap (peak hours)
```

---

## 📝 **LISTENER-STATS.SH (NEW SCRIPT):**

```bash
#!/bin/bash
# Real-time listener statistics from Icecast

ICECAST_STATUS="http://localhost:8000/status-json.xsl"
NAMESPACE="SplashFM"

# Get Icecast status
STATUS=$(curl -s $ICECAST_STATUS)

# Parse JSON
LISTENERS=$(echo $STATUS | jq -r '.icestats.source.listeners // 0')
PEAK=$(echo $STATUS | jq -r '.icestats.source.listener_peak // 0')

# Send to CloudWatch
aws cloudwatch put-metric-data \
  --namespace $NAMESPACE \
  --metric-name ConcurrentListeners \
  --value $LISTENERS \
  --region eu-west-1

aws cloudwatch put-metric-data \
  --namespace $NAMESPACE \
  --metric-name PeakListeners \
  --value $PEAK \
  --region eu-west-1

echo "[$(date)] Listeners: $LISTENERS, Peak: $PEAK"
```

---

## 📊 **EXAMPLE QUERIES:**

### **CloudWatch Logs Insights - Track Playouts:**
```
fields @timestamp, @message
| filter @logGroup = "/splash-fm/liquidsoap"
| filter @message like /Now playing/
| parse @message /Now playing: (?<artist>.+) - (?<title>.+)/
| sort @timestamp desc
| limit 50
```

### **CloudWatch Logs Insights - Unique IPs:**
```
fields @timestamp
| filter @logGroup = "/splash-fm/icecast"
| filter @message like /GET \/stream.mp3/
| parse @message /^(?<ip>\S+) /
| stats count_distinct(ip) as unique_listeners
```

### **CloudWatch Logs Insights - Connection Duration:**
```
fields @timestamp, @message
| filter @logGroup = "/splash-fm/icecast"
| parse @message /^(?<ip>\S+) .+ (?<bytes>\d+)$/
| stats avg(bytes / 128000) as avg_duration_seconds by bin(@timestamp, 1h)
```

---

## 🎯 **USE CASES:**

**Analytics:**
- ✅ Hoeveel luisteraars op elk moment
- ✅ Welke tracks zijn populair
- ✅ Waar komen luisteraars vandaan
- ✅ Hoe lang luisteren mensen gemiddeld
- ✅ Peak uren identificeren

**Content Optimization:**
- ✅ Tracks met meeste listeners → meer spelen
- ✅ Tijden met weinig listeners → experimenteren
- ✅ Genre analyse per tijdstip

**Business Intelligence:**
- ✅ Growth tracking (week over week)
- ✅ Listener retention
- ✅ Geographic expansion opportunities

**Troubleshooting:**
- ✅ Sudden listener drop → check logs
- ✅ High churn → content issues?
- ✅ Geographic issues → CDN problems?

---

## 💰 **COST ESTIMATE:**

```
CloudWatch Logs (FASE 1):
- Already included (~$15-30/mo)

CloudWatch Metrics (FASE 2):
- 2 new metrics (ConcurrentListeners, PeakListeners)
- Cost: ~$0.60/mo

CloudWatch Dashboard (FASE 3):
- First 3 dashboards: FREE
- Cost: $0/mo

Lambda + DynamoDB (FASE 4):
- Lambda: 1M invocations = $0.20
- DynamoDB: On-demand, ~$5-10/mo
- Total: ~$5-11/mo

GeoIP (FASE 4):
- MaxMind GeoLite2: FREE
- Or AWS GeoIP: ~$1-2/mo

Total (all phases): ~$7-13/mo extra
```

---

## ✅ **SUCCESS CRITERIA:**

```
FASE 1 (Logs):
✅ Icecast logs in CloudWatch
✅ Liquidsoap logs in CloudWatch
✅ Retention configured

FASE 2 (Metrics):
✅ Concurrent listeners metric updating
✅ Peak listeners tracked
✅ Cron running every minute

FASE 3 (Dashboard):
✅ Track playouts visible
✅ Listener count visible
✅ Queries working

FASE 4 (Advanced):
✅ Lambda parsing logs
✅ DynamoDB populated
✅ Geographic data available
✅ Advanced dashboard live
```

---

## 📚 **KEYWORDS:**

`listener-statistics` `track-playouts` `icecast-logs` `analytics` `cloudwatch-logs-insights` `concurrent-listeners` `unique-listeners` `geographic-distribution` `track-popularity` `stream-analytics` `real-time-metrics` `log-parsing` `dynamodb-tracking`

---

**Status:** 📝 TODO  
**Priority:** MEDIUM  
**Effort:** 
- Fase 1: ✅ DONE
- Fase 2: 1-2 uur
- Fase 3: 2-3 uur  
- Fase 4: 8-12 uur

**Next:** Create listener-stats.sh + test E2E
