# 🍕 PIZZA BREAK - CURRENT STATUS

**Time:** 14 Nov 2025, 01:50 CET  
**Status:** 🔧 DEBUGGING IN PROGRESS

---

## ✅ WHAT'S WORKING:

### **1. Liquidsoap SQS Version is RUNNING** 🎉
```
Process: liquidsoap radio-sqs.liq
PID: 415566
Status: ✅ ACTIVE
Uptime: ~2 minutes
```

### **2. SQS Queue Has Tracks**
```
Available Messages: 1
In-Flight Messages: 1  ← MESSAGE IS LOCKED!
Total: 2 tracks in queue
```

### **3. Lambda Working**
```
Function: track-queue-manager
Last Test: ✅ SUCCESS
Added: 2 tracks
```

### **4. Liquidsoap Logic Working**
```
✅ Checking queue size
✅ Detecting queue < 2
✅ Triggering Lambda
✅ Polling SQS
```

---

## ⚠️ CURRENT ISSUE:

### **Problem: Message Visibility Timeout**

```
Symptom: "No track in queue, waiting..."

Root Cause:
1. Liquidsoap receives message from SQS
2. Message becomes "in-flight" (invisible for 300 seconds!)
3. Liquidsoap can't parse or download track
4. Message stays locked for 5 MINUTES
5. Queue appears empty to Liquidsoap
```

**Visibility Timeout:** 300 seconds (5 minutes)  
**Result:** Message locked, can't get next track

---

## 🔍 DEBUGGING DATA:

### **SQS Queue Attributes:**
```json
{
  "ApproximateNumberOfMessages": "1",
  "ApproximateNumberOfMessagesNotVisible": "1",
  "VisibilityTimeout": "300"
}
```

### **Liquidsoap Log:**
```
📥 Polling SQS for next track...
📊 Checking SQS queue size...
   Visible: 1, Processing: 0, Total: 1
⚠️  Queue low (1 tracks) - Triggering Lambda
🔔 Queue < 2, triggering Lambda to add next track...
✅ Lambda invoked asynchronously
🎵 Receiving track from SQS...
⚠️  No track in queue, waiting...
2025/11/14 01:49:42 [request:4] Nonexistent file or ill-formed URI ""!
```

---

## 🎯 LIKELY ROOT CAUSES:

### **1. Message Parsing Issue**
```liquidsoap
# This might be failing:
receipt_handle = process.read("echo '#{msg_result}' | jq -r '.Messages[0].ReceiptHandle // \"\"' 2>/dev/null")

# If empty, returns "" and loop continues
# But message is already locked for 5 minutes!
```

### **2. JSON Parsing in Liquidsoap**
```
The jq command might not work correctly:
'.Messages[0].Body | fromjson | .trackId'

Liquidsoap's process.read() might not handle
multi-line JSON or complex jq pipes properly.
```

### **3. S3 URL Format**
```
Lambda sends: s3://bucket-name/path/to/file.mp3
Liquidsoap expects: Valid S3 URL

Might need different format or pre-signed URL?
```

---

## 🛠️ SOLUTIONS TO TRY:

### **Option 1: Reduce Visibility Timeout** ⭐ QUICK FIX
```bash
# From 300s to 30s
aws sqs set-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attributes VisibilityTimeout=30 \
  --region eu-west-1

# If track fails, only locks for 30 seconds
# Stream recovers faster
```

### **Option 2: Add Debug Logging** ⭐ DIAGNOSTIC
```liquidsoap
# In get_next_track():
print("DEBUG: Full SQS response:")
print(msg_result)
print("DEBUG: Receipt handle:")
print(receipt_handle)
print("DEBUG: Track ID:")
print(track_id)
```

### **Option 3: Simplify Message Parsing** ⭐ ROBUST
```liquidsoap
# Instead of complex jq pipe:
# 1. Save message to file
# 2. Parse with multiple steps
# 3. Validate each step
# 4. Better error handling
```

### **Option 4: Pre-signed URLs** ⭐ BEST LONG-TERM
```typescript
// In Lambda:
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Generate pre-signed URL (valid for 1 hour)
const signedUrl = await getSignedUrl(s3Client, getObjectCommand, {
  expiresIn: 3600
})

// Send HTTP URL instead of s3:// URL
// Liquidsoap can download directly with wget/curl
```

---

## 📊 SYSTEM STATUS:

```
✅ Dev Server:           http://localhost:5173
✅ Liquidsoap:           RUNNING (SQS version)
✅ Lambda:               DEPLOYED & WORKING
✅ SQS Queue:            2 tracks queued
⚠️  Stream:              SILENT (parsing issue)
✅ Stereo Tools:         http://79.125.44.178:9001
✅ Icecast:              http://79.125.44.178:8000
```

---

## 🎯 NEXT STEPS (After Pizza):

1. **Reduce visibility timeout** (quick win)
2. **Add debug logging** to Liquidsoap script
3. **Manually test message parsing** on EC2
4. **Check if S3 download works** with current URL format
5. **Consider pre-signed URLs** in Lambda

---

## 🍕 GENIET VAN JE PIZZA!

Terwijl jij eet, kan ik:
1. ✅ Visibility timeout verlagen (30 sec)
2. ✅ Debug versie maken met logging
3. ✅ Test script maken voor message parsing
4. ⏸️  Wachten op jouw GO voor deployment

**Zeg maar wat je wilt!** 😊

---

**Status:** 🔧 DEBUGGING  
**Urgency:** 🟡 MEDIUM (system running, just not playing)  
**ETA:** 15-30 min to fix  
**Confidence:** 🎯 HIGH (we know the issue!)

**🍕 BON APPETIT! 🍕**
