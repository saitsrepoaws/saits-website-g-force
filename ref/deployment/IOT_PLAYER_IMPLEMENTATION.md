# 📡 IoT-Driven Radio Player - Complete Implementation

**Date:** 2025-10-27  
**Status:** ✅ Implemented, ⏳ Deploying

---

## 🎯 Overview

Complete IoT-driven radio player system where **ALL control happens via AWS IoT Core**. The frontend only publishes commands and receives responses - no client-side logic for track selection or playback control.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Player UI)                     │
│  - Publishes commands to IoT                                    │
│  - Subscribes to commands from IoT                              │
│  - Executes received commands                                   │
│  - Publishes state changes to IoT                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS IoT Core (PubSub)                       │
│  Topics:                                                         │
│  - radio/player/{playerId}/command  (bidirectional)             │
│  - radio/player/{playerId}/state    (player → cloud)            │
│  - radio/player/{playerId}/track    (player → cloud)            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         IoT Rule                                 │
│  SQL: SELECT * FROM 'radio/player/+/command'                    │
│  Action: Trigger State Machine                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Step Functions State Machine                   │
│  - Parses command                                                │
│  - Routes to appropriate Lambda                                  │
│  - Publishes response back to IoT                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Lambda Functions                          │
│  1. player-load-handler     - Determines track from schedule    │
│  2. player-iot-publisher    - Publishes to IoT Core             │
│  3. player-simple-handler   - Handles PLAY/PAUSE/STOP           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DynamoDB                                │
│  - Playlists table (with tracks array)                          │
│  - Tracks table (full track metadata)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Flow: LOAD Command

### **1. User Action**
```typescript
// User clicks LOAD button
handleLoad() {
  publishCommand({
    command: 'LOAD',
    params: { playlistId: 'playlist-xxx' }
  })
}
```

### **2. IoT Publish**
```
Topic: radio/player/player-main-001/command
Message: {
  "command": "LOAD",
  "playerId": "player-main-001",
  "params": { "playlistId": "playlist-xxx" },
  "timestamp": "2025-10-27T10:00:00Z"
}
```

### **3. IoT Rule Triggers**
```sql
SELECT * FROM 'radio/player/+/command'
→ Triggers State Machine
```

### **4. State Machine Execution**
```
ParseCommand
  ↓
RouteCommand (Choice: LOAD)
  ↓
HandleLoadCommand (Lambda: player-load-handler)
  ↓
ValidateLoadResult (Check success)
  ↓
PublishLoadResponse (Lambda: player-iot-publisher)
  ↓
CommandSuccess
```

### **5. Lambda: player-load-handler**
```typescript
// Input
{
  "playerId": "player-main-001",
  "playlistId": "playlist-xxx"
}

// Processing
1. Fetch playlist from DynamoDB
2. Get current time (HH:MM:SS → seconds)
3. Calculate cumulative track durations
4. Determine which track should be playing NOW
5. Fetch full track data from DynamoDB

// Output
{
  "success": true,
  "playlistId": "playlist-xxx",
  "trackIndex": 3,
  "track": {
    "id": "track-123",
    "title": "Urban Pressure",
    "artist": "Hollen",
    "fileUrl": "public/audio/...",
    "coverArtUrl": "public/covers/...",
    "waveformUrl": "public/waveforms/...",
    "duration": 345,
    "bpm": 143,
    "key": "G# minor"
  }
}
```

### **6. Lambda: player-iot-publisher**
```typescript
// Input from State Machine
{
  "topic": "radio/player/player-main-001/command",
  "message": {
    "command": "LOAD",
    "playerId": "player-main-001",
    "params": {
      "track": { /* full track data */ }
    }
  }
}

// Action
await iotClient.send(new PublishCommand({
  topic: "radio/player/player-main-001/command",
  payload: Buffer.from(JSON.stringify(message)),
  qos: 1
}))
```

### **7. Player Receives Command**
```typescript
subscribeToCommands((command) => {
  if (command.command === 'LOAD') {
    executeLoad(command.params.track)
  }
})
```

### **8. Player Executes**
```typescript
async function executeLoad(track) {
  // Publish LOADING state
  await publishState('LOADING', {
    trackId: track.id,
    playlistId: track.playlistId
  })
  
  // Load track assets
  await loadTrackIntoPlayer(track)
  
  // Publish LOADED state
  await publishState('LOADED', {
    trackId: track.id,
    duration: track.duration
  })
}
```

---

## 📊 IoT Topics

### **1. Commands (Bidirectional)**
```
Topic: radio/player/{playerId}/command
Direction: Frontend ↔ Backend
QoS: 1 (At least once)

Messages:
- LOAD   (with track data from backend)
- PLAY
- PAUSE
- STOP
- UNLOAD
```

### **2. State Changes**
```
Topic: radio/player/{playerId}/state
Direction: Frontend → Backend
QoS: 1

States:
- IDLE
- LOADING
- LOADED
- PLAYING
- PAUSED
- STOPPED
- BUFFERING
- ERROR
```

### **3. Track Info**
```
Topic: radio/player/{playerId}/track
Direction: Frontend → Backend
QoS: 1

Published when: Track starts playing
Contains: Full track metadata
```

---

## 🎨 Frontend Components

### **1. Players.tsx**
Main player page with:
- Player controls (LOAD, PLAY, PAUSE, STOP, UNLOAD)
- Progress bar with seek
- Volume control
- Cover art display
- Waveform visualization
- IoT log panel

### **2. PlaylistViewer**
Schedule-aware playlist viewer:
- 🟣 Purple = Scheduled (next to play)
- 🟠 Orange = Loaded in player
- 🟢 Green = Future tracks
- ⚪ Gray = Past tracks

### **3. IoTLogPanel**
Real-time IoT message log:
- 📤 OUT / 📥 IN badges
- 🎛️ CMD / 📊 STATE / 🎵 TRACK labels
- Color-coded by type
- Timestamp display

---

## 🔧 Backend Components

### **Lambda: player-load-handler**
```
Location: amplify/functions/player-load-handler/
Purpose: Determines which track to load based on schedule
Dependencies:
  - @aws-sdk/client-dynamodb
  - @aws-sdk/lib-dynamodb
Environment:
  - TRACK_TABLE_NAME
  - PLAYLIST_TABLE_NAME
```

### **Lambda: player-iot-publisher**
```
Location: amplify/functions/player-iot-publisher/
Purpose: Publishes messages to IoT Core
Dependencies:
  - @aws-sdk/client-iot-data-plane
```

### **Lambda: player-simple-handler**
```
Location: amplify/functions/player-simple-handler/
Purpose: Handles simple commands (PLAY, PAUSE, STOP, UNLOAD)
```

### **State Machine**
```
Location: amplify/functions/state-machine/definition.asl.json
Purpose: Orchestrates command processing
States:
  - ParseCommand
  - RouteCommand (Choice)
  - HandleLoadCommand
  - HandlePlayCommand
  - HandlePauseCommand
  - HandleStopCommand
  - HandleUnloadCommand
  - PublishLoadResponse
  - PublishPlayResponse
  - PublishSimpleResponse
  - HandleError
  - CommandSuccess/Failed
```

---

## 🧪 Testing

### **Manual Test via AWS CLI**
```bash
# Publish LOAD command
aws iot-data publish \
  --topic "radio/player/player-main-001/command" \
  --payload '{"command":"LOAD","playerId":"player-main-001","params":{"playlistId":"playlist-xxx"}}' \
  --qos 1

# Check State Machine executions
aws stepfunctions list-executions \
  --state-machine-arn <arn> \
  --max-results 5

# View Lambda logs
aws logs tail /aws/lambda/<function-name> --since 5m
```

### **Frontend Test**
1. Open Players page
2. Click LOAD button
3. Check IoT Log panel for:
   - 📤 OUT 🎛️ CMD (LOAD command sent)
   - 📥 IN 🎛️ CMD (LOAD response received)
   - 📤 OUT 📊 STATE (LOADING)
   - 📤 OUT 📊 STATE (LOADED)
4. Track should appear in player
5. Click PLAY to start playback

---

## 🎯 Benefits

### **1. Centralized Control**
- Backend determines what plays
- All players stay in sync
- Schedule-driven playback

### **2. Scalability**
- Multiple players can subscribe
- Backend broadcasts to all
- No client-side coordination needed

### **3. Automation**
- Schedule changes automatically
- No manual intervention
- Time-based track selection

### **4. Monitoring**
- All state changes logged
- Full audit trail via IoT
- Easy debugging

---

## 🚀 Deployment

### **Sandbox (Development)**
```bash
# Start sandbox
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox

# Sandbox auto-rebuilds on file changes
# Wait ~30 seconds after code changes
```

### **Production**
```bash
# Deploy to production
pnpm --package=@aws-amplify/backend-cli dlx ampx pipeline-deploy \
  --branch main \
  --app-id <app-id>
```

---

## 📝 Configuration

### **IoT Permissions (backend.ts)**
```typescript
authenticatedRole.attachInlinePolicy(
  new Policy(stack, 'IotPubSubPolicy', {
    statements: [
      // Connect
      new PolicyStatement({
        actions: ['iot:Connect'],
        resources: ['arn:aws:iot:*:*:client/*']
      }),
      // Subscribe
      new PolicyStatement({
        actions: ['iot:Subscribe'],
        resources: ['arn:aws:iot:*:*:topicfilter/*']
      }),
      // Publish & Receive
      new PolicyStatement({
        actions: ['iot:Publish', 'iot:Receive'],
        resources: ['arn:aws:iot:*:*:topic/*']
      })
    ]
  })
)
```

### **IoT Rule**
```typescript
new CfnTopicRule(stack, 'PlayerCommandRule', {
  ruleName: 'RadioPlayerCommandRule',
  topicRulePayload: {
    sql: "SELECT * FROM 'radio/player/+/command'",
    actions: [{
      stepFunctions: {
        stateMachineName: 'RadioPlayerStateMachine',
        executionNamePrefix: 'player-cmd-',
        roleArn: iotRuleRole.roleArn
      }
    }]
  }
})
```

---

## 🐛 Troubleshooting

### **State Machine not triggering**
- Check IoT Rule is enabled
- Verify topic name matches
- Check IAM role permissions
- View CloudWatch logs

### **Lambda errors**
```bash
# View logs
aws logs tail /aws/lambda/<function-name> --since 10m --follow

# Check function configuration
aws lambda get-function --function-name <name>
```

### **Player not receiving commands**
- Check subscription is active (console logs)
- Verify topic name matches
- Check IoT permissions
- Test with AWS CLI publish

---

## 📚 Related Documentation

- `/docs/IOT_TOPICS_SPECIFICATION.md` - Complete topic reference
- `/ref/iot-setup.md` - IoT setup guide
- `/ref/pubsub-js.md` - PubSub API reference
- `/FEATURE_MULTI_PLAYER.md` - Multi-player architecture

---

## ✅ Status

- ✅ Frontend implementation complete
- ✅ Backend Lambdas implemented
- ✅ State Machine configured
- ✅ IoT Rule active
- ⏳ Lambda deployment in progress
- 🧪 End-to-end testing pending

**Next:** Wait for Lambda deployment, then test complete flow!
