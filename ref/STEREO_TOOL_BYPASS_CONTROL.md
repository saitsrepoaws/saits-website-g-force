# 🎚️ Stereo Tool Bypass Control System

**Datum:** 14 November 2025, 17:15 CET  
**Feature:** Real-time Stereo Tool bypass toggle via web UI  
**Tech:** Lambda + SSM + React + IoT

---

## 🎯 **FEATURE OVERVIEW:**

### **What It Does:**
```
User clicks toggle in web UI
    ↓
React calls Lambda API
    ↓
Lambda executes SSM command on EC2
    ↓
Stereo Tool bypassed/unbypassed
    ↓
Status published to IoT
    ↓
UI updates in real-time!
```

**Result: One-click audio processing on/off!** 🎚️

---

## 🏗️ **ARCHITECTURE:**

```
┌─────────────────────────────────────────────────────┐
│  React UI (Audio Settings Page)                    │
│  Component: <StereoToolBypass />                    │
│  - Toggle switch                                    │
│  - Status display                                   │
│  - Real-time updates                                │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ HTTP POST /stereo-tool/control
                  │ { action: "bypass" }
                  ↓
┌─────────────────────────────────────────────────────┐
│  Lambda: stereo-tool-controller                     │
│  - Receives command                                 │
│  - Executes via SSM                                 │
│  - Saves state to DynamoDB                          │
│  - Publishes to IoT                                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ SSM RunCommand
                  ↓
┌─────────────────────────────────────────────────────┐
│  EC2 Instance (79.125.44.178)                       │
│  - stereo-tool-cmd process                          │
│  - Start/Stop/Bypass commands                       │
│  - Status reporting                                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ Audio Stream
                  ↓
┌─────────────────────────────────────────────────────┐
│  Stream Flow:                                       │
│                                                     │
│  Liquidsoap → /stream-raw.mp3 (8000)               │
│       ↓                                             │
│  Stereo Tool (bypass = skip this!)                 │
│       ↓                                             │
│  /stream-processed.mp3 (8001)                      │
│       ↓                                             │
│  Users hear: Raw OR Processed                       │
└─────────────────────────────────────────────────────┘
```

---

## 🎚️ **STEREO TOOL COMMANDS:**

### **1. Bypass (Disable Processing)**
```bash
# Stop Stereo Tool = Bypass mode
pkill -f stereotool-cmd

Result:
✅ No processing
✅ Raw audio stream
✅ Lower latency
✅ No EQ/compression/loudness
```

### **2. Unbypass (Enable Processing)**
```bash
# Start Stereo Tool = Processing mode
nohup /usr/local/bin/stereotool-cmd \
  -s /opt/radio/preset.sts \
  -q 2 \
  http://localhost:8000/stream-raw.mp3 \
  http://localhost:8001/stream-processed.mp3 \
  > /tmp/stereotool.log 2>&1 &

Result:
✅ Full processing
✅ Professional sound
✅ EQ optimization
✅ Multiband compression
✅ Loudness maximization
✅ Stereo enhancement
```

### **3. Status Check**
```bash
# Check if running
pgrep -f stereotool-cmd

# Get details
ps aux | grep stereotool-cmd

# Check log
tail -f /tmp/stereotool.log
```

### **4. Restart**
```bash
# Full restart with preset
pkill -f stereotool-cmd
sleep 2
nohup /usr/local/bin/stereotool-cmd -s /opt/radio/preset.sts ...
```

---

## 📡 **LAMBDA FUNCTION:**

### **File:** `amplify/functions/stereo-tool-controller/handler.ts`

### **Actions Supported:**
```typescript
interface StereoToolCommand {
  action: 'start' | 'stop' | 'bypass' | 'unbypass' | 'restart' | 'status' | 'load-preset';
  preset?: string; // For load-preset action
}
```

### **API Endpoints:**

#### **POST /stereo-tool/control**
```json
{
  "action": "bypass"
}

Response:
{
  "success": true,
  "command": "bypass",
  "status": {
    "isRunning": false,
    "isBypassed": true,
    "currentPreset": "/opt/radio/preset.sts",
    "lastUpdate": "2025-11-14T16:15:00Z"
  },
  "result": {
    "commandId": "abc-123",
    "status": "Success",
    "output": "✅ Bypass enabled"
  }
}
```

#### **GET /stereo-tool/status**
```json
Response:
{
  "success": true,
  "status": {
    "isRunning": true,
    "isBypassed": false,
    "currentPreset": "/opt/radio/preset.sts",
    "uptime": 3600,
    "lastUpdate": "2025-11-14T16:15:00Z"
  }
}
```

---

## 🎨 **REACT UI COMPONENT:**

### **File:** `apps/web/src/components/StereoToolBypass.tsx`

### **Features:**
```
✅ Toggle switch (ON/OFF)
✅ Real-time status (via IoT)
✅ Visual indicators
✅ Uptime display
✅ Preset info
✅ Restart button
✅ Refresh button
✅ Error handling
✅ Loading states
```

### **Integration:**
```tsx
// In AudioSettings page
import StereoToolBypass from '../components/StereoToolBypass';

export default function AudioSettings() {
  return (
    <Layout>
      <h1>Audio Settings</h1>
      
      {/* Stereo Tool Bypass Control */}
      <StereoToolBypass />
      
      {/* Other audio settings... */}
    </Layout>
  );
}
```

---

## 📊 **STATE MANAGEMENT:**

### **DynamoDB Table:**
```
Table: StereoToolState
PK: id = "stereo-tool-status"

Attributes:
- isRunning: boolean
- isBypassed: boolean
- currentPreset: string
- uptime: number
- lastUpdate: ISO string
- ttl: number (24h expiry)
```

### **IoT Topic:**
```
Topic: stereo-tool/status

Message:
{
  "type": "status-update",
  "status": {
    "isRunning": true,
    "isBypassed": false,
    ...
  },
  "timestamp": "2025-11-14T16:15:00Z"
}
```

---

## 🔐 **PERMISSIONS:**

### **Lambda IAM Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": [
        "arn:aws:ec2:*:*:instance/i-021451e919d39c898",
        "arn:aws:ssm:*:*:document/AWS-RunShellScript"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/StereoToolState"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": "arn:aws:iot:*:*:topic/stereo-tool/status"
    }
  ]
}
```

### **EC2 SSM Access:**
```
EC2 moet SSM Agent hebben!
✅ Amazon Linux 2: Pre-installed
✅ Ubuntu: sudo snap install amazon-ssm-agent

Check:
sudo systemctl status amazon-ssm-agent
```

---

## 🧪 **TESTING:**

### **Manual Test via CLI:**
```bash
# Test Lambda locally
aws lambda invoke \
  --function-name stereo-tool-controller \
  --payload '{"body": "{\"action\":\"status\"}"}' \
  /tmp/response.json

cat /tmp/response.json | jq .
```

### **Test SSM Directly:**
```bash
# Send command to EC2
aws ssm send-command \
  --instance-ids i-021451e919d39c898 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["pgrep -f stereotool-cmd && echo RUNNING || echo STOPPED"]' \
  --region eu-west-1
```

### **Test UI:**
```
1. Open: http://localhost:5173/devices/audio-settings
2. Toggle bypass switch
3. Observe:
   - Loading state
   - Status update
   - Visual change
4. Listen to stream:
   - Bypassed: Raw audio (flatter sound)
   - Active: Processed audio (louder, punchier)
```

---

## 🎵 **AUDIO COMPARISON:**

### **Bypass ON (Raw Audio):**
```
Characteristics:
✅ Natural dynamic range
✅ Lower latency (~50ms less)
✅ Original mix balance
❌ Quieter overall
❌ Less punch
❌ Uncompressed
```

### **Bypass OFF (Processed Audio):**
```
Characteristics:
✅ Louder (competitive loudness)
✅ Punchy (compression)
✅ Balanced EQ (optimized frequencies)
✅ Wide stereo (enhancement)
✅ Consistent levels (AGC)
❌ Slightly higher latency (+50ms)
❌ More processed sound
```

---

## 🔧 **TROUBLESHOOTING:**

### **Issue: Toggle doesn't work**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/stereo-tool-controller \
  --follow \
  --region eu-west-1

# Check SSM agent on EC2
ssh radio-ec2 "sudo systemctl status amazon-ssm-agent"

# Check IAM permissions
aws iam get-role-policy \
  --role-name stereo-tool-controller-role \
  --policy-name SSMAccess
```

### **Issue: Status not updating**
```bash
# Check IoT connection in browser console
# Should see: "📡 IoT Connected"

# Test IoT publish
aws iot-data publish \
  --topic stereo-tool/status \
  --payload '{"test":true}' \
  --region eu-west-1
```

### **Issue: Stereo Tool won't start**
```bash
# Check if binary exists
ssh radio-ec2 "ls -la /usr/local/bin/stereotool-cmd"

# Check preset
ssh radio-ec2 "ls -la /opt/radio/preset.sts"

# Check ports
ssh radio-ec2 "netstat -tulpn | grep -E '8000|8001'"

# Manual start test
ssh radio-ec2 "/usr/local/bin/stereotool-cmd --help"
```

---

## 📈 **MONITORING:**

### **CloudWatch Metrics:**
```
- Lambda Invocations
- Lambda Duration
- Lambda Errors
- SSM Command Success/Failure
- DynamoDB Read/Write Units
- IoT Messages Published
```

### **Custom Metrics:**
```typescript
// In Lambda
await cloudwatch.putMetricData({
  Namespace: 'StereoTool',
  MetricData: [{
    MetricName: 'BypassToggle',
    Value: 1,
    Unit: 'Count',
    Dimensions: [{
      Name: 'Action',
      Value: command.action
    }]
  }]
});
```

---

## 💡 **USE CASES:**

### **1. Troubleshooting**
```
Stream sounds bad?
→ Enable bypass to hear raw audio
→ Isolate issue to processing or source
```

### **2. A/B Testing**
```
Compare processed vs raw:
→ Toggle bypass during playback
→ Hear difference immediately
→ Adjust preset if needed
```

### **3. Performance Optimization**
```
Lower latency needed?
→ Enable bypass
→ Save ~50ms processing time
```

### **4. Broadcast Compliance**
```
Different requirements?
→ Use presets for different shows
→ Load preset via API
→ Instant audio profile change
```

---

## 🚀 **DEPLOYMENT:**

### **Step 1: Deploy Lambda**
```bash
cd amplify/functions/stereo-tool-controller
npm install
cd ../../..
amplify push
```

### **Step 2: Setup SSM on EC2**
```bash
# Verify SSM agent
ssh radio-ec2 "sudo systemctl status amazon-ssm-agent"

# If not installed (Ubuntu):
sudo snap install amazon-ssm-agent --classic
sudo systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service
```

### **Step 3: Create DynamoDB Table**
```bash
aws dynamodb create-table \
  --table-name StereoToolState \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1
```

### **Step 4: Deploy React UI**
```bash
cd apps/web
npm run build
# Deploy to nginx or test locally
npm run dev
```

---

## ✅ **SUCCESS CRITERIA:**

```
✅ UI toggle responsive (< 1s)
✅ Status updates in real-time
✅ Audio changes audible
✅ No stream interruption
✅ State persists across refreshes
✅ Error handling works
✅ Mobile friendly
✅ IoT updates instant
```

---

## 🎯 **RESULT:**

```
╔════════════════════════════════════════════════════╗
║                                                    ║
║   STEREO TOOL BYPASS CONTROL: ✅ COMPLETE         ║
║                                                    ║
║   Features:                                        ║
║   ✅ One-click toggle                             ║
║   ✅ Real-time status                              ║
║   ✅ Lambda + SSM control                          ║
║   ✅ IoT updates                                   ║
║   ✅ Professional UI                               ║
║                                                    ║
║   URL: /devices/audio-settings                    ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

**Lambda die helemaal overweg kan met Stereo Tool command line! 🎚️⚡**
