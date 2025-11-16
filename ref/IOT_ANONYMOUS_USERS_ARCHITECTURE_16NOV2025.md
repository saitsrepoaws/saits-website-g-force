# IoT Anonymous Users Architecture - Real-time Player Messaging
**Date:** 16 November 2025, 00:40 CET  
**Status:** 📋 DESIGN PHASE

## 🎯 Objective

Enable **anonymous visitors** to:
- ✅ Receive real-time track metadata via IoT
- ✅ Receive real-time chat messages
- ✅ Receive advertising/announcements
- ✅ Send messages (optional, with rate limiting)
- ❌ **NO LOGIN REQUIRED** for basic functionality

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANONYMOUS USER FLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. User opens https://splashfm.nl/
   ↓
2. Player HTML loads
   ↓
3. JavaScript requests temporary credentials
   ↓
4. AWS Cognito Identity Pool (unauthenticated)
   ↓
5. Temporary AWS credentials (15-60 min)
   ↓
6. Connect to AWS IoT Core (MQTT over WebSocket)
   ↓
7. Subscribe to public topics:
   - radio/stream/nowplaying
   - radio/chat/public
   - radio/ads/public
   ↓
8. Receive real-time messages!
```

## 🔑 Cognito Identity Pool (Unauthenticated Access)

### What is Cognito Identity Pool?

AWS Cognito Identity Pools provide **temporary AWS credentials** for:
- **Authenticated users** (logged in via Cognito User Pool, Google, etc.)
- **Unauthenticated users** (anonymous, no login!)

### How It Works

```javascript
// In browser (no login!)
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const credentials = fromCognitoIdentityPool({
  identityPoolId: "eu-west-1:xxxxx-xxxx-xxxx-xxxx-xxxx",
  clientConfig: { region: "eu-west-1" }
});

// These credentials allow IoT access!
```

### Security Model

**Unauthenticated Role (Anonymous):**
- ✅ Can connect to IoT Core
- ✅ Can subscribe to public topics (radio/*)
- ✅ Can publish to limited topics (chat, with rate limiting)
- ❌ Cannot access DynamoDB
- ❌ Cannot access S3
- ❌ Cannot invoke Lambdas

**Authenticated Role (Logged in):**
- ✅ All unauthenticated permissions PLUS:
- ✅ Can access user's playlists
- ✅ Can vote on tracks
- ✅ Can request tracks
- ✅ Can see listening history

## 📡 IoT Topic Structure

### Public Topics (Anonymous Access)

#### 1. Now Playing (Real-time Track Metadata)
```
Topic: radio/stream/nowplaying
Access: Subscribe only
Rate: Every track change (~3-5 min)

Message:
{
  "trackId": "uuid",
  "title": "Song Name",
  "artist": "Artist Name",
  "bpm": 128,
  "key": "8A",
  "energy": 0.85,
  "coverArtUrl": "https://...",
  "waveformUrl": "https://...",
  "timestamp": 1731708900
}
```

#### 2. Public Chat
```
Topic: radio/chat/public
Access: Subscribe + Publish (rate limited)
Rate: 
  - Subscribe: Unlimited
  - Publish: 1 message per 10 seconds per user

Message:
{
  "messageId": "uuid",
  "userId": "anonymous-xxx" or "user-xxx",
  "username": "Guest123" or "RealName",
  "message": "Great track!",
  "timestamp": 1731708900,
  "type": "user" | "system"
}
```

#### 3. Advertising/Announcements
```
Topic: radio/ads/public
Access: Subscribe only (admin publish)
Rate: As needed

Message:
{
  "adId": "uuid",
  "type": "announcement" | "ad" | "event",
  "title": "Special Event Tonight!",
  "message": "Join us at 8pm...",
  "imageUrl": "https://...",
  "actionUrl": "https://...",
  "duration": 10, // seconds to display
  "timestamp": 1731708900
}
```

#### 4. Listener Stats (Real-time)
```
Topic: radio/stats/listeners
Access: Subscribe only
Rate: Every 30 seconds

Message:
{
  "currentListeners": 42,
  "peakToday": 156,
  "country": "NL",
  "city": "Amsterdam" // optional, from IP
}
```

### Private Topics (Authenticated Users Only)

#### 5. Personal Notifications
```
Topic: radio/user/{userId}/notifications
Access: Subscribe only (own user)

Message:
{
  "type": "track-request-accepted" | "vote-counted" | "mention",
  "title": "Your request was accepted!",
  "message": "Your track will play next...",
  "timestamp": 1731708900
}
```

#### 6. Track Requests
```
Topic: radio/requests/submit
Access: Publish only (authenticated)

Message:
{
  "userId": "user-xxx",
  "trackId": "uuid",
  "message": "Please play this!",
  "timestamp": 1731708900
}
```

#### 7. Voting
```
Topic: radio/voting/submit
Access: Publish only (authenticated)

Message:
{
  "userId": "user-xxx",
  "trackId": "uuid",
  "vote": "up" | "down",
  "timestamp": 1731708900
}
```

## 🔐 IAM Policies

### Unauthenticated Role Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect"
      ],
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT_ID:client/${cognito-identity.amazonaws.com:sub}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/radio/stream/nowplaying",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/radio/chat/public",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/radio/ads/public",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/radio/stats/listeners"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Receive"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/stream/nowplaying",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/chat/public",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/ads/public",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/stats/listeners"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/chat/public"
      ]
    }
  ]
}
```

**Key Points:**
- ✅ Connect with Cognito identity as client ID
- ✅ Subscribe to public topics
- ✅ Receive messages on public topics
- ✅ Publish to chat (rate limited by IoT rules)

### Authenticated Role Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect"
      ],
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT_ID:client/${cognito-identity.amazonaws.com:sub}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/radio/*",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topicfilter/radio/user/${cognito-identity.amazonaws.com:sub}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Receive"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/*",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/user/${cognito-identity.amazonaws.com:sub}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish"
      ],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/chat/public",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/requests/submit",
        "arn:aws:iot:eu-west-1:ACCOUNT_ID:topic/radio/voting/submit"
      ]
    }
  ]
}
```

**Key Points:**
- ✅ All unauthenticated permissions
- ✅ PLUS personal notifications
- ✅ PLUS submit requests/votes
- ✅ User-scoped topics

## 🚦 Rate Limiting (IoT Rules)

### Chat Rate Limiting

**Problem:** Anonymous users could spam chat

**Solution:** IoT Rule with DynamoDB rate limiting

```sql
-- IoT SQL Rule
SELECT 
  messageId,
  userId,
  username,
  message,
  timestamp,
  clientId() as clientId
FROM 'radio/chat/public'
WHERE 
  length(message) <= 500
```

**Rule Actions:**
1. **DynamoDB Action** - Check rate limit
   - Table: `chat-rate-limits`
   - Key: `clientId`
   - TTL: 10 seconds
   
2. **Republish Action** - If rate limit OK
   - Topic: `radio/chat/public/approved`
   
3. **Lambda Action** - If rate limit exceeded
   - Send error to user

### Implementation

```javascript
// Lambda function for rate limiting
export const handler = async (event) => {
  const { clientId, message } = event;
  
  // Check DynamoDB for last message time
  const lastMessage = await getLastMessage(clientId);
  const now = Date.now();
  
  if (lastMessage && (now - lastMessage.timestamp) < 10000) {
    // Rate limit exceeded
    await publishToIoT(`radio/user/${clientId}/error`, {
      error: "Rate limit exceeded. Wait 10 seconds."
    });
    return { statusCode: 429 };
  }
  
  // Rate limit OK - save and approve
  await saveMessage(clientId, now);
  await publishToIoT('radio/chat/public/approved', message);
  
  return { statusCode: 200 };
};
```

## 💻 Player Implementation (JavaScript)

### 1. Initialize Cognito Credentials

```javascript
// player.js
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { mqtt5, iot } from "aws-iot-device-sdk-v2";

// Step 1: Get credentials (anonymous)
const credentials = fromCognitoIdentityPool({
  identityPoolId: "eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  clientConfig: { region: "eu-west-1" }
});

// Step 2: Create IoT connection config
const config = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets()
  .with_clean_session(true)
  .with_client_id(`player-${Date.now()}`)
  .with_endpoint("acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com")
  .with_credentials(
    "eu-west-1",
    await credentials()
  )
  .build();

// Step 3: Connect
const connection = new mqtt5.Mqtt5Client(config);
await connection.start();

console.log("✅ Connected to IoT Core (anonymous)!");
```

### 2. Subscribe to Topics

```javascript
// Subscribe to now playing
connection.subscribe({
  subscriptions: [
    {
      topicFilter: "radio/stream/nowplaying",
      qos: mqtt5.QoS.AtMostOnce
    },
    {
      topicFilter: "radio/chat/public",
      qos: mqtt5.QoS.AtMostOnce
    },
    {
      topicFilter: "radio/ads/public",
      qos: mqtt5.QoS.AtMostOnce
    }
  ]
});

// Handle messages
connection.on('messageReceived', (eventData) => {
  const topic = eventData.message.topicName;
  const payload = JSON.parse(new TextDecoder('utf8').decode(eventData.message.payload));
  
  if (topic === 'radio/stream/nowplaying') {
    updateNowPlaying(payload);
  } else if (topic === 'radio/chat/public') {
    addChatMessage(payload);
  } else if (topic === 'radio/ads/public') {
    showAdvertising(payload);
  }
});
```

### 3. Publish Messages (Chat)

```javascript
// Send chat message
async function sendChatMessage(message) {
  const payload = {
    messageId: crypto.randomUUID(),
    userId: "anonymous-" + sessionId,
    username: "Guest" + Math.floor(Math.random() * 1000),
    message: message,
    timestamp: Date.now(),
    type: "user"
  };
  
  await connection.publish({
    topicName: "radio/chat/public",
    payload: JSON.stringify(payload),
    qos: mqtt5.QoS.AtMostOnce
  });
}
```

### 4. UI Integration

```javascript
// Update now playing display
function updateNowPlaying(track) {
  document.querySelector('.track-title').textContent = track.title;
  document.querySelector('.track-artist').textContent = track.artist;
  document.querySelector('.track-cover').src = track.coverArtUrl;
  document.querySelector('.track-bpm').textContent = `${track.bpm} BPM`;
  document.querySelector('.track-key').textContent = track.key;
}

// Add chat message to UI
function addChatMessage(msg) {
  const chatBox = document.querySelector('.chat-messages');
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message';
  messageEl.innerHTML = `
    <span class="username">${msg.username}:</span>
    <span class="message">${escapeHtml(msg.message)}</span>
  `;
  chatBox.appendChild(messageEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Show advertising
function showAdvertising(ad) {
  const adEl = document.querySelector('.advertising');
  adEl.innerHTML = `
    <div class="ad-content">
      <h3>${ad.title}</h3>
      <p>${ad.message}</p>
      ${ad.imageUrl ? `<img src="${ad.imageUrl}" />` : ''}
      ${ad.actionUrl ? `<a href="${ad.actionUrl}">Learn More</a>` : ''}
    </div>
  `;
  adEl.style.display = 'block';
  
  // Auto-hide after duration
  setTimeout(() => {
    adEl.style.display = 'none';
  }, ad.duration * 1000);
}
```

## 🎨 Use Cases

### 1. Real-time Track Metadata
- ✅ User opens player
- ✅ Connects to IoT (anonymous)
- ✅ Subscribes to `radio/stream/nowplaying`
- ✅ Receives track info every 3-5 minutes
- ✅ UI updates automatically (cover, title, artist, BPM, key)

### 2. Live Chat
- ✅ Anonymous users can read chat
- ✅ Can send messages (rate limited: 1 per 10 sec)
- ✅ Real-time updates for all listeners
- ✅ Moderation possible via Lambda

### 3. Advertising/Announcements
- ✅ Admin publishes to `radio/ads/public`
- ✅ All connected players show ad
- ✅ Auto-hide after duration
- ✅ Click-through tracking possible

### 4. Listener Stats
- ✅ Real-time listener count
- ✅ Peak stats
- ✅ Geographic data (optional)
- ✅ Updates every 30 seconds

### 5. Track Requests (Authenticated)
- ✅ User logs in
- ✅ Gets authenticated credentials
- ✅ Can publish to `radio/requests/submit`
- ✅ Receives confirmation via personal topic

## 🔒 Security Considerations

### Anonymous Users
- ✅ Limited to public topics only
- ✅ Cannot access user data
- ✅ Rate limited on publishing
- ✅ No persistent identity

### Authenticated Users
- ✅ All anonymous permissions
- ✅ PLUS personal topics
- ✅ Higher rate limits
- ✅ Persistent identity

### Rate Limiting Strategy
1. **Anonymous Chat:** 1 message per 10 seconds
2. **Authenticated Chat:** 5 messages per 10 seconds
3. **Requests:** 1 per minute (authenticated only)
4. **Voting:** 1 per track (authenticated only)

### Content Moderation
- **Profanity filter** in Lambda
- **Length limits** (500 chars)
- **Spam detection** via ML (future)
- **Ban list** in DynamoDB

## 📊 Cost Analysis

### IoT Core Pricing (EU-West-1)
- **Connectivity:** $0.08 per million minutes
- **Messaging:** $1.00 per million messages
- **Device Shadow:** Not needed for this use case

### Example Calculation

**Assumptions:**
- 100 concurrent listeners
- Each connected for 60 minutes
- 20 track changes per hour = 2000 messages/hour
- 50 chat messages per hour = 5000 messages/hour

**Monthly Cost:**
```
Connectivity:
  100 users × 60 min × 30 days × 24 hours = 4,320,000 minutes
  4,320,000 / 1,000,000 × $0.08 = $0.35

Messaging (now playing):
  2000 messages/hour × 24 hours × 30 days = 1,440,000 messages
  1,440,000 / 1,000,000 × $1.00 = $1.44

Messaging (chat):
  5000 messages/hour × 24 hours × 30 days = 3,600,000 messages
  3,600,000 / 1,000,000 × $1.00 = $3.60

Total: $0.35 + $1.44 + $3.60 = $5.39/month
```

**Very affordable!** 🎯

## 🚀 Implementation Steps

### Phase 1: Infrastructure (CDK/Amplify)
1. Create Cognito Identity Pool
   - Enable unauthenticated access
   - Configure IAM roles
   
2. Create IAM policies
   - Unauthenticated role
   - Authenticated role
   
3. Update IoT policies
   - Add topic permissions
   - Configure rate limits

### Phase 2: Player Integration
1. Add AWS SDK dependencies
2. Implement Cognito credentials
3. Implement IoT connection
4. Add UI for chat/metadata

### Phase 3: Backend Services
1. Lambda for rate limiting
2. Lambda for content moderation
3. Lambda for advertising
4. DynamoDB tables for rate limits

### Phase 4: Testing & Monitoring
1. Test anonymous access
2. Test authenticated access
3. Test rate limiting
4. Monitor costs
5. Monitor abuse

## 📝 Next Steps

1. ✅ Review this architecture (YOU ARE HERE!)
2. [ ] Approve architecture
3. [ ] Implement Cognito Identity Pool
4. [ ] Implement IAM policies
5. [ ] Update player HTML/JavaScript
6. [ ] Test anonymous access
7. [ ] Deploy to production

## 🎓 References

- [AWS Cognito Identity Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
- [IoT Core with Cognito](https://docs.aws.amazon.com/iot/latest/developerguide/cognito-identities.html)
- [IoT Device SDK v2 (JavaScript)](https://github.com/aws/aws-iot-device-sdk-js-v2)
- [MQTT over WebSockets](https://docs.aws.amazon.com/iot/latest/developerguide/mqtt.html#mqtt-ws)

---

**Status:** 📋 DESIGN COMPLETE - Ready for implementation!  
**Complexity:** HIGH (but we have a working example!)  
**Impact:** VERY HIGH (real-time player experience!)  
**Gerard's vision:** "We zijn samen slimmer dan de rest!" 🧠🚀
