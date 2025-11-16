# IoT Connection Indicator - Visual Status Display
**Date:** 16 November 2025, 00:50 CET  
**Status:** ✅ IMPLEMENTED

## 🎯 Overview

Real-time visual indicator showing AWS IoT Core connection status in the Splash FM player.

## 💡 Visual Design

### Location
- **Position:** Top-right corner of player card
- **Layout:** Horizontal (light + text)
- **Style:** Glass-morphism with backdrop blur
- **Hover:** Scale effect (1.05x)

### Status Indicators

#### 🟢 Connected (Green)
```css
Color: #4caf50
Animation: Smooth pulse (2s cycle)
Glow: 0-20px shadow
Opacity: 1.0 → 0.6 → 1.0
Text: "IoT: Connected"
```

#### 🟠 Connecting (Orange)
```css
Color: #ff9800
Animation: Medium pulse (1.5s cycle)
Glow: 0-20px shadow
Opacity: 1.0 → 0.5 → 1.0
Text: "IoT: Connecting..."
```

#### 🔴 Offline (Red)
```css
Color: #f44336
Animation: Fast pulse (1s cycle)
Glow: 0-20px shadow
Opacity: 1.0 → 0.4 → 1.0
Text: "IoT: Offline"
```

## 🎨 Animation Details

### Smooth Pulse Effect

**CSS Keyframes:**
```css
@keyframes pulse-green {
    0%, 100% {
        opacity: 1;
        box-shadow: 0 0 10px #4caf50, 0 0 20px #4caf50;
    }
    50% {
        opacity: 0.6;
        box-shadow: 0 0 5px #4caf50, 0 0 10px #4caf50;
    }
}

@keyframes pulse-orange {
    0%, 100% {
        opacity: 1;
        box-shadow: 0 0 10px #ff9800, 0 0 20px #ff9800;
    }
    50% {
        opacity: 0.5;
        box-shadow: 0 0 5px #ff9800, 0 0 10px #ff9800;
    }
}

@keyframes pulse-red {
    0%, 100% {
        opacity: 1;
        box-shadow: 0 0 10px #f44336, 0 0 20px #f44336;
    }
    50% {
        opacity: 0.4;
        box-shadow: 0 0 5px #f44336, 0 0 10px #f44336;
    }
}
```

**Characteristics:**
- **Smooth:** `ease-in-out` timing function
- **Continuous:** `infinite` iteration
- **Layered:** Double glow effect (10px + 20px)
- **Adaptive:** Faster pulse = more urgent state

## 📡 IoT Connection Flow

### State Machine

```
[Initial] → Connecting → Connected
             ↓            ↓
             Offline ← ← ←
```

### JavaScript Implementation

```javascript
// Update IoT status indicator
function updateIoTStatus(state) {
    const light = document.getElementById('iotLight');
    const statusText = document.getElementById('iotStatus');
    
    // Remove all status classes
    light.classList.remove(
        'iot-status-connected', 
        'iot-status-connecting', 
        'iot-status-disconnected'
    );
    
    switch(state) {
        case 'connected':
            light.classList.add('iot-status-connected');
            statusText.textContent = 'IoT: Connected';
            console.log('✅ IoT Core: Connected');
            iotConnected = true;
            break;
            
        case 'connecting':
            light.classList.add('iot-status-connecting');
            statusText.textContent = 'IoT: Connecting...';
            console.log('🔄 IoT Core: Connecting...');
            iotConnected = false;
            break;
            
        case 'disconnected':
        default:
            light.classList.add('iot-status-disconnected');
            statusText.textContent = 'IoT: Offline';
            console.log('❌ IoT Core: Offline');
            iotConnected = false;
            break;
    }
}
```

## 🔌 AWS IoT SDK Integration

### Prerequisites

1. **Cognito Identity Pool** (unauthenticated access)
2. **IAM Policies** (public topic subscriptions)
3. **AWS IoT SDK v2** (JavaScript)

### Installation

```bash
npm install aws-iot-device-sdk-v2
npm install @aws-sdk/client-cognito-identity
npm install @aws-sdk/credential-providers
```

### Implementation

```javascript
import { mqtt5, iot } from 'aws-iot-device-sdk-v2';
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

// Configuration
const IOT_ENDPOINT = 'acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com';
const IDENTITY_POOL_ID = 'eu-west-1:xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const REGION = 'eu-west-1';

// Initialize IoT connection
async function initializeIoT() {
    console.log('📡 Initializing IoT connection...');
    updateIoTStatus('connecting');
    
    try {
        // 1. Get Cognito credentials (anonymous)
        const credentials = fromCognitoIdentityPool({
            identityPoolId: IDENTITY_POOL_ID,
            clientConfig: { region: REGION }
        });
        
        // 2. Create IoT connection config
        const config = iot.AwsIotMqttConnectionConfigBuilder
            .new_with_websockets()
            .with_clean_session(true)
            .with_client_id(`player-${Date.now()}`)
            .with_endpoint(IOT_ENDPOINT)
            .with_credentials(REGION, await credentials())
            .build();
        
        // 3. Create MQTT5 client
        const client = new mqtt5.Mqtt5Client(config);
        
        // 4. Event handlers
        client.on('connectionSuccess', () => {
            console.log('✅ IoT Core: Connected!');
            updateIoTStatus('connected');
            subscribeToTopics(client);
        });
        
        client.on('connectionFailure', (error) => {
            console.error('❌ IoT Core: Connection failed', error);
            updateIoTStatus('disconnected');
        });
        
        client.on('disconnection', () => {
            console.log('🔌 IoT Core: Disconnected');
            updateIoTStatus('disconnected');
        });
        
        client.on('error', (error) => {
            console.error('❌ IoT Core: Error', error);
            updateIoTStatus('disconnected');
        });
        
        // 5. Connect
        await client.start();
        
    } catch (error) {
        console.error('❌ IoT initialization failed:', error);
        updateIoTStatus('disconnected');
    }
}

// Subscribe to topics
function subscribeToTopics(client) {
    const subscriptions = [
        {
            topicFilter: 'radio/stream/nowplaying',
            qos: mqtt5.QoS.AtMostOnce
        },
        {
            topicFilter: 'radio/chat/public',
            qos: mqtt5.QoS.AtMostOnce
        },
        {
            topicFilter: 'radio/ads/public',
            qos: mqtt5.QoS.AtMostOnce
        }
    ];
    
    client.subscribe({ subscriptions })
        .then(() => {
            console.log('✅ Subscribed to public topics');
        })
        .catch(error => {
            console.error('❌ Subscription failed:', error);
        });
    
    // Message handler
    client.on('messageReceived', (eventData) => {
        const topic = eventData.message.topicName;
        const payload = JSON.parse(
            new TextDecoder('utf8').decode(eventData.message.payload)
        );
        
        console.log(`📨 Message received on ${topic}:`, payload);
        
        // Route to handlers
        if (topic === 'radio/stream/nowplaying') {
            handleNowPlaying(payload);
        } else if (topic === 'radio/chat/public') {
            handleChatMessage(payload);
        } else if (topic === 'radio/ads/public') {
            handleAdvertising(payload);
        }
    });
}

// Message handlers
function handleNowPlaying(data) {
    console.log('🎵 Now Playing:', data.title, '-', data.artist);
    
    // Update UI
    document.getElementById('track-title').textContent = data.title || 'Unknown Track';
    document.getElementById('track-artist').textContent = data.artist || 'Unknown Artist';
    
    // Update extended metadata
    document.getElementById('bpm').textContent = data.bpm || '-';
    document.getElementById('key').textContent = data.key || '-';
    document.getElementById('energy').textContent = data.energy ? 
        (data.energy * 100).toFixed(0) + '%' : '-';
    document.getElementById('genre').textContent = data.genre || '-';
    document.getElementById('year').textContent = data.year || '-';
    document.getElementById('label').textContent = data.label || '-';
}

function handleChatMessage(data) {
    console.log('💬 Chat:', data.username + ':', data.message);
    // Add to chat UI (future feature)
}

function handleAdvertising(data) {
    console.log('📢 Ad:', data.title);
    // Show ad in UI (future feature)
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeIoT();
});
```

## 🔒 Security & Permissions

### IAM Policy (Unauthenticated Role)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["iot:Connect"],
      "Resource": "arn:aws:iot:eu-west-1:ACCOUNT:client/${cognito-identity.amazonaws.com:sub}"
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Subscribe"],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT:topicfilter/radio/stream/nowplaying",
        "arn:aws:iot:eu-west-1:ACCOUNT:topicfilter/radio/chat/public",
        "arn:aws:iot:eu-west-1:ACCOUNT:topicfilter/radio/ads/public"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Receive"],
      "Resource": [
        "arn:aws:iot:eu-west-1:ACCOUNT:topic/radio/stream/nowplaying",
        "arn:aws:iot:eu-west-1:ACCOUNT:topic/radio/chat/public",
        "arn:aws:iot:eu-west-1:ACCOUNT:topic/radio/ads/public"
      ]
    }
  ]
}
```

## 📊 User Experience

### Connection States

**On Page Load:**
```
[Offline 🔴] → Page loads
[Connecting 🟠] → Initializing IoT SDK
[Connected 🟢] → Subscribed to topics
```

**On Connection Loss:**
```
[Connected 🟢] → Network issue
[Disconnected 🔴] → Auto-reconnect attempt
[Connecting 🟠] → Reconnecting...
[Connected 🟢] → Reconnected!
```

### Visual Feedback

| State | Light | Text | Animation Speed | User Action |
|-------|-------|------|----------------|-------------|
| **Connected** | 🟢 Green | "IoT: Connected" | Slow (2s) | None - all good |
| **Connecting** | 🟠 Orange | "IoT: Connecting..." | Medium (1.5s) | Wait |
| **Offline** | 🔴 Red | "IoT: Offline" | Fast (1s) | Refresh page |

## 📱 Responsive Design

### Desktop
```css
.iot-indicator {
    top: 20px;
    right: 20px;
    font-size: 0.85em;
}

.iot-status-light {
    width: 12px;
    height: 12px;
}
```

### Mobile (< 600px)
```css
.iot-indicator {
    top: 10px;
    right: 10px;
    font-size: 0.75em;
}

.iot-status-light {
    width: 10px;
    height: 10px;
}
```

## 🧪 Testing

### Manual Tests

**Test 1: Initial Connection**
1. Open `https://splashfm.nl/`
2. Expect: 🔴 Red "Offline" (SDK not yet integrated)
3. Check console: "⚠️ IoT SDK not yet integrated"

**Test 2: Connection State Changes**
```javascript
// In browser console
updateIoTStatus('connecting');  // → 🟠 Orange
updateIoTStatus('connected');   // → 🟢 Green
updateIoTStatus('disconnected'); // → 🔴 Red
```

**Test 3: Animation Smoothness**
1. Observe pulse animation
2. Should be smooth, no jitter
3. Color transitions should be instant
4. Glow effect should be visible

### Automated Tests

```javascript
describe('IoT Connection Indicator', () => {
  it('should show red offline state initially', () => {
    expect(iotLight).toHaveClass('iot-status-disconnected');
    expect(iotStatus).toHaveText('IoT: Offline');
  });
  
  it('should transition to connecting state', () => {
    updateIoTStatus('connecting');
    expect(iotLight).toHaveClass('iot-status-connecting');
    expect(iotStatus).toHaveText('IoT: Connecting...');
  });
  
  it('should transition to connected state', () => {
    updateIoTStatus('connected');
    expect(iotLight).toHaveClass('iot-status-connected');
    expect(iotStatus).toHaveText('IoT: Connected');
  });
  
  it('should have smooth pulse animation', () => {
    const animation = window.getComputedStyle(iotLight).animation;
    expect(animation).toContain('ease-in-out');
    expect(animation).toContain('infinite');
  });
});
```

## 🚀 Deployment Checklist

- [x] Visual indicator HTML/CSS
- [x] Status update JavaScript function
- [x] Smooth pulse animations
- [x] Responsive design
- [ ] Cognito Identity Pool creation
- [ ] IAM policies configuration
- [ ] AWS IoT SDK integration
- [ ] Topic subscriptions
- [ ] Message handlers
- [ ] Error handling
- [ ] Reconnection logic
- [ ] Production testing

## 📚 Related Documentation

- [IoT Anonymous Users Architecture](IOT_ANONYMOUS_USERS_ARCHITECTURE_16NOV2025.md)
- [Professional DJ Platform](PROFESSIONAL_DJ_PLATFORM_16NOV2025.md)
- [Player Performance Optimization](PLAYER_PERFORMANCE_OPTIMIZATION_16NOV2025.md)

## ✨ Future Enhancements

1. **Connection Quality Indicator**
   - Add latency to IoT messages
   - Show connection quality (Excellent/Good/Poor)
   
2. **Reconnection Counter**
   - Show number of reconnect attempts
   - Exponential backoff visualization

3. **Message Statistics**
   - Messages received counter
   - Last message timestamp
   - Topic activity indicators

4. **Advanced Debugging**
   - Click indicator for detailed info
   - Connection logs modal
   - Network diagnostics

---

**Status:** ✅ Visual indicator implemented  
**Next:** Cognito + IoT SDK integration  
**ETA:** Ready for credentials configuration!

**Gerard: "We zijn slimmer dan de experts!"** 🧠🚀
