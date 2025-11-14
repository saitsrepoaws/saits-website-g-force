# ☁️ CloudFront Track Pre-Cache - Low Latency Startup

**Datum:** 14 November 2025, 17:12 CET  
**Concept:** Pre-cache eerste seconden van tracks via CloudFront edge  
**Doel:** Sub-second track startup (instant play!)

---

## 🎯 **HET IDEE:**

### **Probleem Nu:**
```
User clicks PLAY
    ↓
Browser: Connect to S3 (Ireland)
    ↓
Download starts from S3
    ↓
First bytes arrive (200-500ms)
    ↓
Audio can start playing

Total: 200-500ms latency
```

### **Met CloudFront Pre-Cache:**
```
User clicks PLAY
    ↓
Browser: Connect to CloudFront edge (Amsterdam/London)
    ↓
Edge heeft EERSTE 10 SECONDEN al cached!
    ↓
Instant delivery (10-50ms)
    ↓
Audio starts IMMEDIATELY

Total: 10-50ms latency! 🚀
```

**Result: 5-10x sneller!**

---

## 🏗️ **ARCHITECTUUR:**

### **Components:**

```
┌─────────────────────────────────────────────────┐
│  S3 Bucket (Origin)                             │
│  ├── public/audio/track1.mp3                    │
│  ├── public/audio/track2.wav                    │
│  └── ...                                        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  CloudFront Distribution                        │
│  ├── Edge Locations (Amsterdam, London, Paris)  │
│  ├── Cache: First 10s of each track            │
│  ├── Range request support                      │
│  └── Pre-warming via Lambda@Edge               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Browser/Player                                 │
│  ├── Request: bytes=0-441000 (10s @ 192kbps)   │
│  ├── Receive: From edge (10-50ms)              │
│  └── Start playback instantly!                 │
└─────────────────────────────────────────────────┘
```

---

## 💡 **PRE-CACHE STRATEGIE:**

### **Optie 1: Range Request Pre-Cache**
```
# Browser requests first 10 seconds:
GET /audio/track.mp3
Range: bytes=0-441000

CloudFront:
1. Check edge cache for bytes 0-441000
2. If cached: Instant return (10ms)
3. If not: Fetch from S3, cache, return
```

**Hoe pre-cachen:**
```javascript
// Lambda@Edge Origin Response
// Pre-populate cache for upcoming tracks

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  
  // For track requests, always cache first 10s
  if (request.uri.includes('/audio/')) {
    return {
      status: '200',
      headers: {
        'cache-control': [{ 
          value: 'public, max-age=86400, immutable' 
        }],
        'accept-ranges': [{ value: 'bytes' }]
      }
    };
  }
};
```

### **Optie 2: Pre-Warming via Scheduled Lambda**
```javascript
// Lambda runs every hour (na playlist update)
// Pre-warms CloudFront cache

const tracks = await getUpcomingTracks(); // Next 20 tracks

for (const track of tracks) {
  // Request first 10 seconds to warm cache
  await fetch(`https://cdn.splashfm.nl/${track.fileUrl}`, {
    headers: {
      'Range': 'bytes=0-441000'  // 10s @ 192kbps
    }
  });
}

console.log('✅ Cache warmed for', tracks.length, 'tracks');
```

### **Optie 3: Proactive Cache (Best!)**
```
Wanneer:
1. Track wordt ge-upload
2. Track wordt toegevoegd aan playlist
3. Elk uur (voor upcoming tracks)

Dan:
- Lambda@Edge requests eerste 10s
- Wordt gecached op alle edges
- Instant beschikbaar voor users
```

---

## 🎵 **AUDIO SPECS:**

### **Hoeveel bytes = 10 seconden?**

```
MP3 @ 192 kbps:
192 kbps = 192,000 bits/sec
         = 24,000 bytes/sec
10 seconds = 240,000 bytes (240 KB)

WAV @ 44.1kHz stereo 16-bit:
44,100 Hz × 2 channels × 2 bytes = 176,400 bytes/sec
10 seconds = 1,764,000 bytes (1.7 MB)

Voor safety: Cache eerste 500 KB (covers both)
```

### **Cache Policy:**
```
Cache eerste 500 KB van elk track:
- bytes=0-512000
- TTL: 24 hours (tracks change niet)
- Immutable: true
```

---

## 🚀 **IMPLEMENTATIE PLAN:**

### **Fase 1: CloudFront Setup**
```bash
# 1. Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config '{
    "Origins": {
      "Items": [{
        "DomainName": "gforgeiot-storage.s3.eu-west-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/..."
        }
      }]
    },
    "CacheBehaviors": {
      "Items": [{
        "PathPattern": "public/audio/*",
        "CachePolicyId": "audio-10s-precache",
        "AllowedMethods": ["GET", "HEAD", "OPTIONS"]
      }]
    }
  }'
```

### **Fase 2: Cache Policy**
```json
{
  "Name": "AudioFirst10SecCache",
  "MinTTL": 86400,
  "MaxTTL": 31536000,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": false,
    "HeadersConfig": {
      "HeaderBehavior": "whitelist",
      "Headers": ["Range"]
    },
    "QueryStringsConfig": {
      "QueryStringBehavior": "none"
    }
  }
}
```

### **Fase 3: Pre-Warming Lambda**
```typescript
// Lambda: cloudfront-cache-warmer

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { S3 } from '@aws-sdk/client-s3';

export const handler = async (event) => {
  console.log('🔥 Warming CloudFront cache...');
  
  // 1. Get upcoming tracks (next 2 hours)
  const tracks = await getUpcomingTracks(2);
  
  console.log(`📋 Found ${tracks.length} upcoming tracks`);
  
  // 2. Pre-warm each track (first 10s)
  const results = await Promise.all(
    tracks.map(track => warmTrack(track))
  );
  
  const warmed = results.filter(r => r.success).length;
  
  console.log(`✅ Warmed ${warmed}/${tracks.length} tracks`);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      tracksWarmed: warmed,
      totalTracks: tracks.length
    })
  };
};

async function warmTrack(track: Track) {
  const cfUrl = `https://cdn.splashfm.nl/${track.fileUrl}`;
  
  try {
    // Request first 500KB (covers 10s for all formats)
    const response = await fetch(cfUrl, {
      headers: {
        'Range': 'bytes=0-512000'
      }
    });
    
    if (response.status === 206) { // Partial Content
      console.log(`✅ Warmed: ${track.title}`);
      return { success: true, track: track.id };
    }
    
    return { success: false, error: 'Invalid response' };
  } catch (error) {
    console.error(`❌ Failed to warm ${track.title}:`, error);
    return { success: false, error };
  }
}
```

### **Fase 4: EventBridge Schedule**
```typescript
// Trigger cache warmer every hour (after playlist update)

new Rule(this, 'CacheWarmerRule', {
  schedule: Schedule.cron({
    minute: '5',  // 5 min after playlist update
    hour: '*'
  }),
  targets: [new LambdaFunction(cacheWarmer)]
});
```

---

## 📊 **PERFORMANCE GAINS:**

### **Voor CloudFront:**
```
Direct S3 request:
- DNS lookup: 50ms
- TCP handshake: 50ms
- TLS handshake: 100ms
- Request/Response: 100ms
- First byte: 200-500ms
───────────────────────────
Total: 500-800ms
```

### **Met CloudFront (cold):**
```
Edge not cached:
- Edge DNS: 10ms
- Edge handshake: 20ms
- Edge → S3: 200ms
- Response: 50ms
───────────────────────────
Total: 280ms (40% faster)
```

### **Met CloudFront (warm/pre-cached):**
```
Edge cached:
- Edge DNS: 10ms
- Edge handshake: 20ms
- Cached response: 5ms
───────────────────────────
Total: 35ms (15x faster!) 🚀
```

**Result: Track start in < 50ms instead of 500ms!**

---

## 💰 **KOSTEN:**

### **CloudFront Pricing:**
```
Data Transfer Out (per GB):
- First 10 TB:  $0.085/GB
- Next 40 TB:   $0.080/GB

Requests:
- HTTP/HTTPS:   $0.0075 per 10,000

Voor 1000 tracks/day × 500KB cached:
- Data: 500 MB/day = 15 GB/month
- Requests: 1000/day = 30,000/month
- Cost: (15 × $0.085) + (3 × $0.0075)
      = $1.27 + $0.02
      = ~$1.30/month
```

**Super betaalbaar!**

---

## 🎯 **USE CASES:**

### **1. Player Startup (Main Use)**
```javascript
// In React player component
const playTrack = async (trackId) => {
  const track = await fetchTrack(trackId);
  
  // Use CloudFront URL (instant first 10s!)
  const audioUrl = `https://cdn.splashfm.nl/${track.fileUrl}`;
  
  audio.src = audioUrl;
  await audio.play(); // Starts INSTANTLY! ⚡
};
```

### **2. Stream Transitions**
```
Liquidsoap track change:
1. New track starts
2. First 10s served from edge (instant)
3. No gap, no buffering
4. Smooth transition
```

### **3. Preview/Scrubbing**
```javascript
// User scrubs to start of track
audio.currentTime = 0;
// Instant seek because first 10s cached!
```

---

## 🔧 **AMPLIFY INTEGRATION:**

### **Update Backend:**
```typescript
// amplify/backend.ts

import { CloudFrontDistribution } from '@aws-cdk/aws-cloudfront';

// Add CloudFront
const cdn = new CloudFrontDistribution(stack, 'TracksCDN', {
  defaultBehavior: {
    origin: new S3Origin(storage.bucket),
    cachePolicy: CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
  },
  additionalBehaviors: {
    'public/audio/*': {
      origin: new S3Origin(storage.bucket),
      cachePolicy: audioCachePolicy,  // Custom: cache Range requests
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    }
  },
  comment: 'Splash FM Tracks CDN - Pre-cache first 10s'
});

// Export CDN URL
export const cdnUrl = cdn.distributionDomainName;
```

### **Update Media URLs Helper:**
```typescript
// apps/web/src/utils/mediaUrl.ts

const CDN_BASE = 'https://cdn.splashfm.nl';

export function getAudioUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Use CloudFront for faster delivery!
  return `${CDN_BASE}/${path}`;
}
```

---

## 📈 **MONITORING:**

### **CloudWatch Metrics:**
```
- CacheHitRate (target: >80%)
- OriginLatency (CloudFront → S3)
- EdgeLatency (User → CloudFront)
- BytesDownloaded
- Requests
- 4xxErrorRate
- 5xxErrorRate
```

### **Dashboard Widget:**
```typescript
new GraphWidget({
  title: 'CDN Performance',
  left: [
    new Metric({
      namespace: 'AWS/CloudFront',
      metricName: 'CacheHitRate',
      statistic: 'Average'
    })
  ],
  right: [
    new Metric({
      namespace: 'AWS/CloudFront', 
      metricName: 'OriginLatency',
      statistic: 'Average'
    })
  ]
});
```

---

## ✅ **BENEFITS:**

```
✅ 10-15x sneller track startup
✅ Sub-50ms first byte delivery
✅ Betere user experience
✅ Lagere S3 costs (minder direct requests)
✅ Globale performance (edge locations)
✅ Betere stream transitions
✅ Support voor seek/scrub (cached ranges)
✅ Schaalbaar (handles traffic spikes)
```

---

## 🎯 **IMPLEMENTATION PRIORITY:**

### **MVP (Minimum Viable Product):**
```
Phase 1 (Week 1):
✅ CloudFront distribution setup
✅ S3 origin configuration
✅ Cache policy voor audio
✅ Update mediaUrl helper
✅ Test with single track

Phase 2 (Week 2):
✅ Pre-warming Lambda
✅ EventBridge schedule
✅ Integration met playlist updates
✅ Monitoring dashboard

Phase 3 (Week 3):
✅ Range request optimization
✅ Multi-region edges
✅ Performance testing
✅ Production rollout
```

---

## 🚀 **NEXT STEPS:**

```bash
# 1. Setup CloudFront (today!)
./setup-cloudfront-cdn.sh

# 2. Update media URLs (5 min)
# Edit apps/web/src/utils/mediaUrl.ts

# 3. Deploy cache warmer (30 min)
# Create Lambda function

# 4. Test & Monitor (ongoing)
# Watch cache hit rates
```

---

## 🎉 **RESULT:**

```
╔════════════════════════════════════════════════════╗
║                                                    ║
║   TRACK STARTUP: 500ms → 35ms                     ║
║                                                    ║
║   IMPROVEMENT: 15x FASTER! 🚀                     ║
║                                                    ║
║   User Experience: INSTANT PLAY!                  ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

**CloudFront pre-cache = game changer voor player performance! 🎵⚡**
