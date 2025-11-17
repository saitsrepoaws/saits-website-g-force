# IoT Shadow/Cache Strategy - Instant Metadata on Page Load
**Date:** 16 November 2025, 00:55 CET  
**Status:** 🎯 RECOMMENDED IMPLEMENTATION

## 🎯 Problem

**Current Flow:**
```
User opens player → Connects to IoT → Waits for next message → Shows metadata
                                        ⏰ Could be 3-5 minutes!
```

**Issue:** User sees "Loading..." or "Unknown Track" until next track change.

**Gerard's Solution:** Cache laatste bericht zodat je direct metadata ziet!

## ✅ Solution Options

### Option 1: AWS IoT Device Shadow (RECOMMENDED!) ⭐

**What is Device Shadow?**
- AWS IoT feature that stores the "last known state" of a device
- Persistent storage (blijft bewaard)
- Instant retrieval (< 50ms)
- Automatic updates when state changes
- Built-in versioning & conflict resolution

**How it works:**
```
EC2 publishes track change
    ↓
IoT Core receives message
    ↓
Updates Device Shadow (automatic!)
    ↓
Shadow stores: {
  "state": {
    "reported": {
      "nowPlaying": {
        "trackId": "uuid",
        "title": "Track Title",
        "artist": "Artist Name",
        "bpm": 128,
        "key": "8A",
        // ... all metadata
      },
      "lastUpdated": "2025-11-16T00:55:00Z"
    }
  }
}
```

**When user opens player:**
```javascript
// 1. Connect to IoT
const client = new IoTDataPlaneClient({ region: "eu-west-1" });

// 2. Get Shadow (instant!)
const shadow = await client.send(new GetThingShadowCommand({
  thingName: "splash-fm-radio"
}));

const state = JSON.parse(new TextDecoder().decode(shadow.payload));
const nowPlaying = state.state.reported.nowPlaying;

// 3. Show immediately!
updateUI(nowPlaying);  // ✅ User sees current track instantly!

// 4. Subscribe to updates
client.on('messageReceived', (data) => {
  // Real-time updates
});
```

**Benefits:**
- ✅ Instant metadata on page load (< 50ms!)
- ✅ No waiting for next track change
- ✅ Persistent (survives restarts)
- ✅ Automatic versioning
- ✅ Built-in conflict resolution
- ✅ Free tier: 225,000 updates/month
- ✅ No extra infrastructure needed

**Cost:**
- Shadow updates: $1.25 per 1M updates
- Shadow retrievals: $1.25 per 1M retrievals
- For radio: ~5000 updates/month = $0.01/month! 💰

---

### Option 2: DynamoDB Cache

**How it works:**
```
Lambda publishes to IoT
    ↓
ALSO writes to DynamoDB:
{
  "id": "nowplaying",
  "data": { ... metadata ... },
  "ttl": timestamp + 3600,
  "updatedAt": "2025-11-16T00:55:00Z"
}
```

**When user opens player:**
```javascript
// 1. Query DynamoDB
const result = await dynamodb.get({
  TableName: "RadioMetadataCache",
  Key: { id: "nowplaying" }
});

// 2. Show immediately
updateUI(result.Item.data);

// 3. Subscribe to IoT for updates
```

**Benefits:**
- ✅ Flexible schema
- ✅ Can cache multiple items
- ✅ GraphQL integration easy
- ✅ Free tier: 25 GB storage

**Drawbacks:**
- ⚠️ Extra code to maintain
- ⚠️ Manual TTL management
- ⚠️ Separate infrastructure
- ⚠️ GraphQL API call (slower)

---

### Option 3: CloudFront Edge Cache

**How it works:**
```
Lambda publishes to IoT
    ↓
ALSO writes to S3:
/cache/nowplaying.json

CloudFront caches this file
```

**When user opens player:**
```javascript
// Fetch from CloudFront edge
const response = await fetch('https://cdn.splashfm.nl/cache/nowplaying.json');
const nowPlaying = await response.json();
```

**Benefits:**
- ✅ Super fast (edge locations)
- ✅ Global distribution
- ✅ Simple HTTP fetch

**Drawbacks:**
- ⚠️ Cache invalidation complexity
- ⚠️ Eventual consistency
- ⚠️ Extra S3 writes
- ⚠️ Not real-time enough

---

## 🏆 Recommendation: AWS IoT Device Shadow

**Why:**
1. **Instant Access** - < 50ms retrieval
2. **Built-in Feature** - No extra infrastructure
3. **Automatic Updates** - Shadow updates when you publish
4. **Super Cheap** - $0.01/month
5. **Best Practice** - Designed for this use case!

## 📋 Implementation Plan

### Step 1: Create IoT Thing & Shadow

```bash
# Create IoT Thing
aws iot create-thing \
  --thing-name "splash-fm-radio" \
  --region eu-west-1

# Thing Shadow is created automatically!
```

### Step 2: Update EC2 Liquidsoap (Publish to Shadow)

```liquidsoap
# In /opt/radio/radio.liq

def publish_nowplaying_with_shadow(track_id, metadata) =
  # Build complete metadata JSON
  json_payload = '...'  # Same as before
  
  # 1. Publish to regular topic (for real-time subscribers)
  ignore(process.run(
    "aws iot-data publish \
      --topic 'radio/stream/nowplaying' \
      --payload '#{json_payload}' \
      --region eu-west-1"
  ))
  
  # 2. Update Device Shadow (for page load retrieval)
  shadow_update = '{
    "state": {
      "reported": {
        "nowPlaying": #{json_payload},
        "lastUpdated": "#{iso_timestamp()}"
      }
    }
  }'
  
  ignore(process.run(
    "aws iot-data update-thing-shadow \
      --thing-name 'splash-fm-radio' \
      --payload '#{shadow_update}' \
      --region eu-west-1 \
      /tmp/shadow-response.json"
  ))
  
  print("✅ Published to topic + shadow")
end
```

### Step 3: Update Player JavaScript

```javascript
// player.js
import { IoTDataPlaneClient, GetThingShadowCommand } from "@aws-sdk/client-iot-data-plane";

const iotClient = new IoTDataPlaneClient({ 
  region: "eu-west-1",
  credentials: cognitoCredentials  // From Cognito Identity Pool
});

async function initializePlayer() {
  try {
    // 1. Get Shadow immediately (< 50ms!)
    console.log("🔍 Fetching last known track from Shadow...");
    
    const shadowResponse = await iotClient.send(
      new GetThingShadowCommand({
        thingName: "splash-fm-radio"
      })
    );
    
    // Parse shadow
    const shadowPayload = JSON.parse(
      new TextDecoder('utf-8').decode(shadowResponse.payload)
    );
    
    const nowPlaying = shadowPayload.state.reported.nowPlaying;
    
    // 2. Show immediately!
    if (nowPlaying) {
      console.log("✅ Got cached track:", nowPlaying.title);
      updateNowPlaying(nowPlaying);
      
      // Show when this was last updated
      const lastUpdated = new Date(shadowPayload.state.reported.lastUpdated);
      const age = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      console.log(`📊 Metadata age: ${age} seconds`);
    } else {
      console.log("⚠️ No cached track in shadow");
    }
    
  } catch (error) {
    console.error("❌ Shadow retrieval failed:", error);
    // Fallback: show "Loading..." and wait for IoT message
  }
  
  // 3. Subscribe to real-time updates (as before)
  await subscribeToIoT();
}

function updateNowPlaying(track) {
  document.getElementById('track-title').textContent = track.title || 'Unknown';
  document.getElementById('track-artist').textContent = track.artist || 'Unknown';
  
  // Update all metadata
  if (track.bpm) document.getElementById('bpm').textContent = track.bpm;
  if (track.key) document.getElementById('key').textContent = track.key;
  if (track.energy) document.getElementById('energy').textContent = 
    (track.energy * 100).toFixed(0) + '%';
  
  // Cover art
  if (track.coverArtUrl) {
    document.getElementById('cover-art').src = track.coverArtUrl;
  }
  
  console.log("🎵 Now playing:", track.artist, "-", track.title);
}
```

### Step 4: Update IAM Policy (Shadow Access)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:GetThingShadow"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT:thing/splash-fm-radio"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe",
        "iot:Receive",
        "iot:Connect"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT:topicfilter/radio/*",
        "arn:aws:iot:eu-west-1:ACCOUNT:topic/radio/*",
        "arn:aws:iot:eu-west-1:ACCOUNT:client/*"
      ]
    }
  ]
}
```

### Step 5: EC2 IAM Policy (Shadow Update)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:UpdateThingShadow",
        "iot:GetThingShadow"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT:thing/splash-fm-radio"
      ]
    }
  ]
}
```

## 🎯 User Experience Flow

### Without Shadow (Current):
```
User opens page
  ↓
Player loads
  ↓
Shows "Loading..."
  ↓
Connects to IoT
  ↓
Waits...
  ↓
⏰ Next track change (3-5 minutes!)
  ↓
Shows metadata
```

**Time to metadata: 3-5 minutes! ❌**

### With Shadow (Proposed):
```
User opens page
  ↓
Player loads
  ↓
Fetches Shadow (< 50ms)
  ↓
Shows current track! ✅
  ↓
Connects to IoT (background)
  ↓
Receives real-time updates
```

**Time to metadata: < 50ms! ✅**

## 📊 Performance Comparison

| Metric | Without Shadow | With Shadow | Improvement |
|--------|----------------|-------------|-------------|
| **Time to first metadata** | 3-5 minutes | < 50ms | **3600x faster!** |
| **User sees "Loading"** | 3-5 minutes | 0 seconds | **Instant!** |
| **API calls on page load** | 0 (then wait) | 1 (Shadow GET) | **Better UX** |
| **Bandwidth** | Same | +1KB per load | **Negligible** |
| **Cost** | $0 | $0.01/month | **Basically free** |

## 💡 Advanced Features with Shadow

### 1. Delta Updates

Shadow tracks what changed:
```javascript
const delta = shadowPayload.state.delta;
// Shows what changed since last sync
```

### 2. Desired State

```javascript
// User requests skip track
await iotClient.send(new UpdateThingShadowCommand({
  thingName: "splash-fm-radio",
  payload: JSON.stringify({
    state: {
      desired: {
        action: "skip"
      }
    }
  })
}));

// EC2 reads desired state and acts on it
```

### 3. Metadata History

Shadow keeps versions:
```javascript
{
  "state": {
    "reported": {
      "nowPlaying": { /* current */ },
      "previousTrack": { /* last track */ }
    }
  },
  "metadata": {
    "reported": {
      "nowPlaying": {
        "timestamp": 1700094567
      }
    }
  }
}
```

### 4. Multiple Shadows (Named Shadows)

```javascript
// Different shadows for different data
await iotClient.send(new GetThingShadowCommand({
  thingName: "splash-fm-radio",
  shadowName: "nowplaying"  // Named shadow
}));

await iotClient.send(new GetThingShadowCommand({
  thingName: "splash-fm-radio",
  shadowName: "stats"  // Separate shadow for stats
}));
```

## 🔐 Security

**Shadow Access Control:**
- Unauthenticated users: `GetThingShadow` only (read)
- Authenticated users: `GetThingShadow` + optional write
- EC2: `UpdateThingShadow` (write only)

**IAM Policy Example:**
```json
{
  "Effect": "Allow",
  "Action": ["iot:GetThingShadow"],
  "Resource": "arn:aws:iot:*:*:thing/splash-fm-radio",
  "Condition": {
    "Bool": {
      "iot:Connection.Thing.IsAttached": "true"
    }
  }
}
```

## 📈 Scalability

**Shadow Limits:**
- Max size: 8 KB (perfect for metadata!)
- Max update rate: 20 updates/sec (we do ~1 per 3-5 min!)
- Max requests/sec: 100 (we do ~10 on page loads!)

**Our Usage:**
- Metadata size: ~1 KB ✅
- Update rate: 1 per 3-5 min ✅
- Request rate: ~10/min peak ✅

**Conclusion:** Perfect fit! 🎯

## 💰 Cost Breakdown

**Monthly Estimate (1000 page loads):**
```
Shadow Updates:
  - Track changes: 8640/month (every 5 min)
  - Cost: 8640 / 1M * $1.25 = $0.01

Shadow Retrievals:
  - Page loads: 1000/month
  - Cost: 1000 / 1M * $1.25 = $0.001

Total: $0.01/month
```

**Compared to DynamoDB:**
```
DynamoDB:
  - Writes: 8640 * $1.25/M = $0.01
  - Reads: 1000 * $0.25/M = $0.0003
  - Storage: Free tier
  
Total: $0.01/month (similar!)
```

**Winner:** Shadow! (Less code, better UX)

## ✅ Implementation Checklist

- [ ] Create IoT Thing: `splash-fm-radio`
- [ ] Update EC2 IAM role (UpdateThingShadow)
- [ ] Update Liquidsoap (publish to Shadow)
- [ ] Update Cognito IAM role (GetThingShadow)
- [ ] Update player JavaScript (fetch Shadow on load)
- [ ] Test Shadow retrieval
- [ ] Test real-time updates still work
- [ ] Monitor Shadow updates in CloudWatch
- [ ] Document for team

## 🎓 Resources

- [AWS IoT Device Shadow](https://docs.aws.amazon.com/iot/latest/developerguide/iot-device-shadows.html)
- [Shadow Service API](https://docs.aws.amazon.com/iot/latest/developerguide/device-shadow-rest-api.html)
- [Best Practices](https://docs.aws.amazon.com/iot/latest/developerguide/device-shadow-comms-app.html)

---

**Recommendation:** ✅ **Implement AWS IoT Device Shadow!**

**Why:**
- Instant metadata on page load (< 50ms!)
- No extra infrastructure
- Super cheap ($0.01/month)
- Best practice for IoT
- Better UX for users

**Gerard's idea is PERFECT! 🎯🚀**
