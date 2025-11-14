# 🍕 PIZZA SESSION - DEBUGGING STATUS

**Tijd:** 14 Nov 2025, 02:50 CET  
**Sessie Duur:** ~1 uur  
**Status:** 🔧 DEBUGGING LIQUIDSOAP SQS MESSAGE PARSING

---

## ✅ **WAT WE BEREIKT HEBBEN:**

### **1. Stereo Tools Web Interface** 🎚️
```
✅ Poort 9001 geopend in Security Group
✅ License key geïnstalleerd
✅ Proces draait met key
⚠️  Direct access blocked (localhost only)
✅ OPLOSSING: SSH tunnel werkt! 
   ssh -N -L 9001:localhost:9001 radio-ec2
   open http://localhost:9001
```

### **2. Lambda Pre-Signed URLs** 🔐
```
✅ Code aangepast om pre-signed URLs te genereren
✅ Dependencies toegevoegd (@aws-sdk/s3-request-presigner)
⚠️  Deployment failed (ampx sandbox)
💡 ALTERNATIEF: Liquidsoap generate pre-signed URLs
```

### **3. Liquidsoap Config Updates** 📝
```
✅ Syntax errors gefixed (Liquidsoap 2.x)
✅ Variable scope issues opgelost
✅ S3 download support toegevoegd
✅ HTTP/HTTPS download support (wget)
✅ Pre-signed URL generation in Liquidsoap
✅ Simpele S3 download via IAM role (EC2 heeft S3 read permissions!)
```

### **4. System Checks** ✅
```
✅ EC2 heeft S3 read permissions via IAM role
✅ Security Group: poort 9001 open
✅ SQS queue bestaat en heeft messages
✅ Lambda kan tracks toevoegen (2 tracks per call)
✅ Liquidsoap process draait
```

---

## ❌ **CURRENT PROBLEM:**

### **Liquidsoap krijgt GEEN tracks van SQS**

**Symptomen:**
```
📥 Polling SQS for next track...
⚠️  No track in queue, waiting...
2025/11/14 02:49:20 [request:4] Nonexistent file or ill-formed URI ""!

🚨 REQUEST LEAK:
[request:2] There are currently 700 RIDs, possible request leak!
```

**Wat er gebeurt:**
1. `get_next_track()` wordt elke seconde aangeroepen
2. Functie retourneert steeds `""` (lege string)
3. Liquidsoap maakt voor elke lege string een nieuw request object
4. Na ~5 minuten: 700+ requests (memory leak!)

**Queue Status:**
```
Visible: 1
In-flight: 1
Visibility Timeout: 30 seconds
```

**Mogelijke Oorzaken:**
1. ❓ SQS receive message returnt leeg (maar waarom?)
2. ❓ Message parsing faalt (jq output)
3. ❓ Visibility timeout probleem
4. ❓ FIFO queue MessageGroupId blocking

---

## 🔍 **DEBUGGING STAPPEN:**

### **Stap 1: Test SQS Receive Manually**
```bash
ssh radio-ec2
aws sqs receive-message \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --region eu-west-1 \
  --max-number-of-messages 1 \
  --wait-time-seconds 20 \
  --output json
  
# Als empty → queue probleem
# Als message → parse test
```

### **Stap 2: Test Message Parsing**
```bash
# Get message
MSG=$(aws sqs receive-message --queue-url ... --output json)

# Test parsing steps
echo "$MSG" | jq -r '.Messages[0].ReceiptHandle'
echo "$MSG" | jq -r '.Messages[0].Body | fromjson | .trackId'
echo "$MSG" | jq -r '.Messages[0].Body | fromjson | .fileUrl'
echo "$MSG" | jq -r '.Messages[0].Body | fromjson | .title'
```

### **Stap 3: Test in Liquidsoap**
```liquidsoap
# Add debug logging in get_next_track():
print("DEBUG: About to receive from SQS")
msg_result = process.read("aws sqs receive-message ...")
print("DEBUG: Got result: #{msg_result}")
```

### **Stap 4: Simplify for Testing**
```liquidsoap
# Bypass SQS temporarily
def get_next_track() =
  # Hardcoded test track
  "s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/audio/test-track.mp3"
end
```

---

## 💡 **MOGELIJKE OPLOSSINGEN:**

### **Optie 1: Fix Message Parsing**
```
Problem: jq parsing faalt
Solution: Add debug logging, test each jq step
```

### **Optie 2: Increase Visibility Timeout Temporarily**
```
Problem: Messages worden te snel in-flight/visible cycle
Solution: Verhoog naar 120 seconden voor debugging
```

### **Optie 3: Use OLD Working Liquidsoap**
```
Problem: Nieuwe SQS versie werkt niet
Solution: Check /opt/radio/radio.liq (oude versie die werkte)
         Zie wat er anders is
```

### **Optie 4: Bypass FIFO MessageGroupId**
```
Problem: FIFO blocking entire queue
Solution: Gebruik unique MessageGroupId per message
          Verlies ordering maar geen blocking
```

---

## 🎯 **NEXT STEPS:**

1. **SSH Network Stability**
   - SSH timeouts → wachten tot stabiel
   - Of: gebruik AWS Systems Manager Session Manager

2. **Stop Liquidsoap Request Leak**
   - Kill liquidsoap process
   - Add rate limiting or fix get_next_track

3. **Test SQS Manually**
   - Confirm messages exist
   - Test each parsing step
   - Isolate where it fails

4. **Compare with OLD Config**
   - Check `/opt/radio/radio.liq`
   - See what worked before
   - Port logic to new SQS version

---

## 📊 **SYSTEM STATUS:**

```
✅ Lambda:           Working (adds 2 tracks)
✅ SQS Queue:        Has messages (1 visible, 1 in-flight)
✅ EC2 IAM Role:     Has S3 read permissions
✅ Liquidsoap:       Running (maar request leak!)
⚠️  Message Parsing: FAILING (returns empty string)
❌ Stream:           SILENT (no tracks playing)
```

---

## 🍕 **CONCLUSIE NA 1 UUR:**

**Vooruitgang:**
- Stereo Tools toegankelijk (via SSH tunnel)
- Lambda code geüpdatet (not deployed yet)
- Liquidsoap syntax gefixed
- EC2 permissions verified

**Blocker:**
- Liquidsoap `get_next_track()` returnt steeds `""`
- Moet debugging doen op EC2 om te zien waarom
- Mogelijk SQS receive faalt
- Mogelijk jq parsing faalt

**Plan:**
1. Wacht tot SSH stabiel is
2. Stop Liquidsoap (prevent request leak)
3. Manual SQS receive test
4. Debug message parsing
5. Fix en herstart

**ETA tot muziek:** 30-60 min als we root cause vinden

---

**Status:** 🔧 DEBUGGING  
**Mood:** 🍕 PIZZA ENERGY  
**Next:** DEBUG SESSION op EC2

**💪 WE KOMEN ER! 🎵**
