# 🤖 AWS Step Functions State Machine Architecture

**Project:** G-Forge IoT Radio Player  
**Purpose:** Production-grade state machine for player command orchestration  
**Date:** 2025-10-26

---

## 🎯 **Overview**

AWS Step Functions State Machine die:
- ✅ Alle player commands ontvangt via IoT
- ✅ State transitions valideert
- ✅ Data ophaalt via DynamoDB
- ✅ Responses terugstuurt via IoT
- ✅ Complete error handling
- ✅ CloudWatch monitoring

---

## 🏗️ **Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                      PLAYER (Frontend)                       │
│  - Click button                                              │
│  - Publish IoT command                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓ 📤 IoT Topic: radio/player/{id}/command
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                      AWS IoT Core                            │
│  - Receives command                                          │
│  - Triggers IoT Rule                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓ Trigger
                        │
┌───────────────────────┴─────────────────────────────────────┐
│              AWS Step Functions State Machine                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. ParseCommand                                       │  │
│  │    Extract command details                            │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────┴─────────────────────────────────────┐  │
│  │ 2. RouteCommand (Choice State)                        │  │
│  │    LOAD / PLAY / PAUSE / STOP / UNLOAD               │  │
│  └─┬──────┬──────┬──────┬──────┬─────────────────────────┘  │
│    │      │      │      │      │                             │
│    ↓      ↓      ↓      ↓      ↓                             │
│  LOAD   PLAY  PAUSE  STOP  UNLOAD                           │
│    │      │      │      │      │                             │
│    ↓      ↓      ↓      ↓      ↓                             │
│  Lambda Lambda Lambda Lambda Lambda                         │
│    │      │      │      │      │                             │
│    ↓      ↓      ↓      ↓      ↓                             │
│  Publish Response to IoT                                     │
│                                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓ 📥 IoT Topic: radio/player/{id}/command
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                      PLAYER (Frontend)                       │
│  - Receive command response                                  │
│  - Execute action                                            │
│  - Publish state update                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 **State Machine Flow**

### **1. ParseCommand**
```json
{
  "Type": "Pass",
  "Comment": "Extract command details from IoT message",
  "Parameters": {
    "command.$": "$.command",
    "playerId.$": "$.playerId",
    "params.$": "$.params",
    "timestamp.$": "$.timestamp"
  },
  "Next": "RouteCommand"
}
```

### **2. RouteCommand (Choice State)**
```json
{
  "Type": "Choice",
  "Choices": [
    { "Variable": "$.command", "StringEquals": "LOAD", "Next": "HandleLoadCommand" },
    { "Variable": "$.command", "StringEquals": "PLAY", "Next": "HandlePlayCommand" },
    { "Variable": "$.command", "StringEquals": "PAUSE", "Next": "HandlePauseCommand" },
    { "Variable": "$.command", "StringEquals": "STOP", "Next": "HandleStopCommand" },
    { "Variable": "$.command", "StringEquals": "UNLOAD", "Next": "HandleUnloadCommand" }
  ],
  "Default": "UnknownCommand"
}
```

### **3. Command Handlers (Lambda Tasks)**

#### **LOAD Command Flow:**
```
HandleLoadCommand (Lambda)
  ↓ Fetch playlist from DynamoDB
  ↓ Parse tracks JSON
  ↓ Get first track
  ↓ Fetch track data from DynamoDB
  ↓ Return complete track data
  ↓
ValidateLoadResult (Choice)
  ↓ success = true?
  ↓
PublishLoadResponse (Lambda)
  ↓ Publish to IoT with track data
  ↓
CommandSuccess
```

#### **Simple Commands Flow (PLAY/PAUSE/STOP/UNLOAD):**
```
HandleXCommand (Lambda)
  ↓ Validate command
  ↓ Return success
  ↓
PublishSimpleResponse (Lambda)
  ↓ Publish to IoT
  ↓
CommandSuccess
```

---

## 🔧 **Lambda Functions**

### **1. player-load-handler**
**Purpose:** Process LOAD commands  
**Input:**
```typescript
{
  command: "LOAD",
  playerId: "player-main-001",
  playlistId: "playlist-xyz-123"
}
```

**Output:**
```typescript
{
  success: true,
  playlistId: "playlist-xyz-123",
  track: {
    id: "track-abc-456",
    title: "Amazing Song",
    artist: "Cool Artist",
    // ... complete track data
  }
}
```

**Environment Variables:**
- `PLAYLIST_TABLE_NAME` - DynamoDB table for playlists
- `TRACK_TABLE_NAME` - DynamoDB table for tracks

---

### **2. player-iot-publisher**
**Purpose:** Publish messages to AWS IoT Core  
**Input:**
```typescript
{
  topic: "radio/player/player-main-001/command",
  message: {
    command: "LOAD",
    playerId: "player-main-001",
    timestamp: "2025-10-26T21:00:00Z",
    params: {
      track: { /* complete track data */ }
    }
  }
}
```

**Output:**
```typescript
{
  success: true,
  topic: "radio/player/player-main-001/command"
}
```

**Permissions Required:**
- `iot:Publish` on topic `radio/player/*/command`

---

### **3. player-simple-handler**
**Purpose:** Handle simple commands (PLAY/PAUSE/STOP/UNLOAD)  
**Input:**
```typescript
{
  command: "PLAY",
  playerId: "player-main-001"
}
```

**Output:**
```typescript
{
  success: true,
  command: "PLAY",
  playerId: "player-main-001"
}
```

---

## 🔐 **IAM Permissions**

### **State Machine Execution Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": [
        "arn:aws:lambda:*:*:function:player-load-handler",
        "arn:aws:lambda:*:*:function:player-iot-publisher",
        "arn:aws:lambda:*:*:function:player-simple-handler"
      ]
    }
  ]
}
```

### **Lambda Execution Roles:**

**player-load-handler:**
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/Playlist-*",
    "arn:aws:dynamodb:*:*:table/Track-*"
  ]
}
```

**player-iot-publisher:**
```json
{
  "Effect": "Allow",
  "Action": "iot:Publish",
  "Resource": "arn:aws:iot:*:*:topic/radio/player/*/command"
}
```

---

## 📊 **Monitoring & Logging**

### **CloudWatch Metrics:**
- Execution count
- Success rate
- Failure rate
- Execution duration
- Lambda invocation count

### **CloudWatch Logs:**
- State Machine execution logs
- Lambda function logs
- Error traces
- Command processing details

### **X-Ray Tracing:**
- End-to-end request tracing
- Performance bottlenecks
- Error analysis

---

## 🚀 **Deployment**

### **Via Amplify CDK (backend.ts):**
```typescript
import { defineBackend } from '@aws-amplify/backend'
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions'
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks'

const backend = defineBackend({
  // ... existing resources
})

// Define Lambda functions
const loadHandler = backend.addFunction('player-load-handler', {
  // ...
})

const iotPublisher = backend.addFunction('player-iot-publisher', {
  // ...
})

const simpleHandler = backend.addFunction('player-simple-handler', {
  // ...
})

// Create State Machine
const stateMachine = new StateMachine(backend.stack, 'PlayerStateMachine', {
  definitionBody: DefinitionBody.fromFile('amplify/functions/state-machine/definition.asl.json'),
  definitionSubstitutions: {
    LoadCommandHandlerArn: loadHandler.functionArn,
    PublishIoTCommandArn: iotPublisher.functionArn,
    SimpleCommandHandlerArn: simpleHandler.functionArn
  }
})

// Grant permissions
loadHandler.grantInvoke(stateMachine)
iotPublisher.grantInvoke(stateMachine)
simpleHandler.grantInvoke(stateMachine)
```

### **IoT Rule to trigger State Machine:**
```json
{
  "sql": "SELECT * FROM 'radio/player/+/command'",
  "actions": [
    {
      "stepFunctions": {
        "stateMachineArn": "${PlayerStateMachineArn}",
        "executionNamePrefix": "player-command-",
        "roleArn": "${IoTRuleRoleArn}"
      }
    }
  ]
}
```

---

## 🧪 **Testing**

### **Manual Test:**
```bash
# Publish test command to IoT
aws iot-data publish \
  --topic "radio/player/player-main-001/command" \
  --payload '{"command":"LOAD","playerId":"player-main-001","params":{"playlistId":"playlist-xyz"}}'
```

### **State Machine Test:**
```bash
# Start execution
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-west-1:123456789:stateMachine:PlayerStateMachine \
  --input '{"command":"LOAD","playerId":"player-main-001","params":{"playlistId":"playlist-xyz"}}'
```

---

## 💰 **Cost Estimation**

### **Per 1000 Commands:**
- State Machine transitions: ~4-6 transitions per command
  - Cost: $0.000025 × 5 × 1000 = **$0.125**
- Lambda invocations: ~2-3 per command
  - Cost: $0.0000002 × 3 × 1000 = **$0.0006**
- DynamoDB reads: ~2 per LOAD command
  - Cost: $0.00025 × 2 × 1000 = **$0.50**
- IoT messages: ~2 per command
  - Cost: $0.000001 × 2 × 1000 = **$0.002**

**Total: ~$0.63 per 1000 commands** 💸

---

## 🎯 **Benefits**

✅ **Schaalbaar** - Handles millions of commands  
✅ **Betrouwbaar** - Automatic retries and error handling  
✅ **Observable** - Complete CloudWatch monitoring  
✅ **Maintainable** - Visual workflow in AWS Console  
✅ **Testable** - Easy to test individual steps  
✅ **Cost-effective** - Pay only for what you use  

---

## 🔄 **Migration from Mock**

Mock State Machine → AWS Step Functions:

1. ✅ Deploy Lambda functions
2. ✅ Deploy State Machine
3. ✅ Create IoT Rule
4. ✅ Test with one player
5. ✅ Monitor CloudWatch
6. ✅ Remove mock code
7. ✅ Production ready!

---

## 📝 **Next Steps**

1. Deploy to AWS via Amplify
2. Configure IoT Rules
3. Test complete flow
4. Monitor performance
5. Optimize if needed
6. Scale to multiple players

**We hebben nu de beste oplossing!** 🌟
