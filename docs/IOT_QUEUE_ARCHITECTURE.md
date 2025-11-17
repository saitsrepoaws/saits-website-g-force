# 🎵 IoT Queue Architecture

**Date:** 17 November 2025  
**Migration:** SQS FIFO → AWS IoT Core  
**Status:** Ready for Deployment

---

## 🎯 **WHY IoT INSTEAD OF SQS?**

### **SQS FIFO Problems:**
- ❌ Polling overhead (~100k requests/month)
- ❌ Visibility timeout complexity
- ❌ Max 10 messages per poll
- ❌ Not instant (5-10s polling delay)
- ❌ Extra Lambda for refill logic
- 💰 Cost: ~$0.42/month

### **IoT Advantages:**
- ✅ **PUSH** model (instant delivery)
- ✅ Real-time (<100ms latency)
- ✅ Simpler code (no polling)
- ✅ Bi-directional communication
- ✅ Same infrastructure as metadata
- 💰 Cost: ~$0.02/month (**95% cheaper!**)

---

## 🏗️ **ARCHITECTURE**

```
┌─────────────────────────────────────────────────────┐
│ Lambda: track-queue-manager                         │
│   ↓                                                 │
│ Publish tracks → IoT Topic: radio/queue/tracks     │
│                                                     │
│ Payload: {                                          │
│   "action": "add|replace|clear",                   │
│   "tracks": [                                       │
│     {                                               │
│       "trackId": "...",                             │
│       "fileUrl": "https://...",                     │
│       "title": "...",                               │
│       "artist": "...",                              │
│       "duration": 180,                              │
│       ...                                           │
│     }                                               │
│   ]                                                 │
│ }                                                   │
└─────────────────────────────────────────────────────┘
         ↓ PUSH (instant!)
┌─────────────────────────────────────────────────────┐
│ EC2: iot-queue-listener.sh (systemd service)        │
│   ↓                                                 │
│ mosquitto_sub subscribed to topic                  │
│   ↓                                                 │
│ On message received:                                │
│   1. Parse JSON                                     │
│   2. Update /tmp/iot-queue.json                    │
│   3. Signal Liquidsoap (SIGUSR1)                   │
└─────────────────────────────────────────────────────┘
         ↓ Signal
┌─────────────────────────────────────────────────────┐
│ Liquidsoap: radio-iot-queue.liq                    │
│   ↓                                                 │
│ On SIGUSR1 signal:                                  │
│   1. Read /tmp/iot-queue.json                      │
│   2. Parse tracks with jq                          │
│   3. Add to internal queue                         │
│   4. Play tracks!                                   │
└─────────────────────────────────────────────────────┘
```

---

## 📦 **COMPONENTS**

### **1. IoT Queue Listener** (`scripts/iot-queue-listener.sh`)
- Subscribes to `radio/queue/tracks` via `mosquitto_sub`
- Parses incoming JSON messages
- Updates `/tmp/iot-queue.json`
- Signals Liquidsoap to reload

**Features:**
- 3 actions: `add`, `replace`, `clear`
- Automatic Liquidsoap signaling
- Logging to `/var/log/iot-queue.log`

### **2. Systemd Service** (`scripts/systemd/iot-queue-listener.service`)
- Auto-starts on boot
- Restarts on failure
- Managed by systemd

**Commands:**
```bash
systemctl status iot-queue-listener
systemctl start iot-queue-listener
systemctl stop iot-queue-listener
systemctl restart iot-queue-listener
```

### **3. Liquidsoap Config** (`scripts/liquidsoap-config/radio-iot-queue.liq`)
- File-based queue reading
- Signal handler for SIGUSR1
- Dynamic playlist with `request.dynamic.list`
- Crossfading & normalization

### **4. Installation Script** (`scripts/deploy/install-iot-queue-services.sh`)
- Installs dependencies (mosquitto-clients, jq)
- Sets up directories
- Copies scripts and configs
- Enables systemd service

---

## 🔐 **IOT CERTIFICATES**

### **Location:**
```
/opt/radio/certs/
├── certificate.pem.crt    (Device certificate)
├── private.pem.key        (Private key)
└── ca-certificates.crt    (System CA bundle)
```

### **Permissions:**
```bash
chmod 700 /opt/radio/certs
chmod 600 /opt/radio/certs/private.pem.key
chmod 644 /opt/radio/certs/certificate.pem.crt
```

### **How to Create Certificates:**

#### **Option 1: AWS Console**
1. Go to AWS IoT Core → Security → Certificates
2. Create certificate
3. Download all 3 files
4. Upload to EC2 via SCP

#### **Option 2: AWS CLI**
```bash
# Create certificate
aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile certificate.pem.crt \
  --private-key-outfile private.pem.key \
  --public-key-outfile public.pem.key \
  --region eu-west-1

# Note the certificateArn from output
```

### **Attach Policy to Certificate:**
```bash
aws iot attach-policy \
  --policy-name GForgeRadioQueuePolicy \
  --target <certificateArn> \
  --region eu-west-1
```

### **Create IoT Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:eu-west-1:*:client/${iot:ClientId}"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:eu-west-1:*:topicfilter/radio/queue/*"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Receive",
      "Resource": "arn:aws:iot:eu-west-1:*:topic/radio/queue/*"
    }
  ]
}
```

---

## 📋 **MESSAGE FORMAT**

### **Add Tracks:**
```json
{
  "action": "add",
  "tracks": [
    {
      "trackId": "track-123",
      "fileUrl": "https://s3.amazonaws.com/...",
      "title": "Track Title",
      "artist": "Artist Name",
      "duration": 180,
      "coverArtUrl": "https://...",
      "genre": "Techno",
      "bpm": 128,
      "key": "Am"
    }
  ]
}
```

### **Replace Queue:**
```json
{
  "action": "replace",
  "tracks": [...]
}
```

### **Clear Queue:**
```json
{
  "action": "clear"
}
```

---

## 🚀 **DEPLOYMENT**

### **Via Pipeline (Recommended):**
```bash
# 1. Commit changes
git add .
git commit -m "feat: IoT queue migration"
git push origin development

# 2. Deploy infrastructure
npx ampx sandbox --once

# 3. Deploy code
./deploy_streamserver

# 4. Upload certificates to EC2
scp -i ~/.ssh/ec2-key.pem certificate.pem.crt ubuntu@<EC2-IP>:/opt/radio/certs/
scp -i ~/.ssh/ec2-key.pem private.pem.key ubuntu@<EC2-IP>:/opt/radio/certs/

# 5. Set permissions
ssh -i ~/.ssh/ec2-key.pem ubuntu@<EC2-IP>
sudo chmod 600 /opt/radio/certs/private.pem.key
sudo chmod 644 /opt/radio/certs/certificate.pem.crt

# 6. Start service
sudo systemctl start iot-queue-listener
sudo systemctl status iot-queue-listener
```

---

## ✅ **VERIFICATION**

### **Check Service:**
```bash
# Service status
systemctl status iot-queue-listener

# Service logs
tail -f /var/log/iot-queue.log

# Queue file
cat /tmp/iot-queue.json | jq
```

### **Test Message:**
```bash
# Publish test message
aws iot-data publish \
  --topic "radio/queue/tracks" \
  --payload '{"action":"add","tracks":[{"trackId":"test","fileUrl":"https://example.com/test.mp3","title":"Test","artist":"Test","duration":180}]}' \
  --region eu-west-1

# Check if received
tail -f /var/log/iot-queue.log
```

### **Check Liquidsoap:**
```bash
# Liquidsoap logs
tail -f /var/log/liquidsoap/radio.log

# Check if signal received
grep "SIGUSR1" /var/log/liquidsoap/radio.log
```

---

## 📊 **COST COMPARISON**

| Component | SQS FIFO | IoT | Savings |
|-----------|----------|-----|---------|
| **Queue Polling** | ~100k requests = $0.40 | 0 (push-based) | $0.40 |
| **Messages** | ~20k = $0.01 | ~20k = $0.01 | $0.00 |
| **Delivery** | Included | ~20k = $0.01 | -$0.01 |
| **Refill Lambda** | ~720 invocations = $0.01 | 0 (direct publish) | $0.01 |
| **TOTAL** | **$0.42/month** | **$0.02/month** | **$0.40 (95%)** |

---

## 🔧 **TROUBLESHOOTING**

### **Service won't start:**
```bash
# Check certificates
ls -la /opt/radio/certs/

# Check IoT endpoint
aws iot describe-endpoint --endpoint-type iot:Data-ATS --region eu-west-1

# Test mosquitto_sub manually
mosquitto_sub \
  -h <IOT-ENDPOINT> \
  -p 8883 \
  -t "radio/queue/tracks" \
  --cafile /etc/ssl/certs/ca-certificates.crt \
  --cert /opt/radio/certs/certificate.pem.crt \
  --key /opt/radio/certs/private.pem.key \
  -v
```

### **Messages not received:**
```bash
# Check policy attached
aws iot list-attached-policies --target <certificateArn> --region eu-west-1

# Check certificate active
aws iot describe-certificate --certificate-id <certId> --region eu-west-1

# Publish test message
aws iot-data publish \
  --topic "radio/queue/tracks" \
  --payload '{"action":"clear"}' \
  --region eu-west-1
```

### **Liquidsoap not reloading:**
```bash
# Check PID file
cat /var/run/liquidsoap/liquidsoap.pid

# Check Liquidsoap running
ps aux | grep liquidsoap

# Send signal manually
kill -USR1 $(cat /var/run/liquidsoap/liquidsoap.pid)
```

---

## 📚 **REFERENCES**

- AWS IoT Core: https://aws.amazon.com/iot-core/
- Mosquitto: https://mosquitto.org/
- Liquidsoap: https://www.liquidsoap.info/
- IoT Device SDK: https://github.com/aws/aws-iot-device-sdk-js-v2

---

## ✅ **MIGRATION CHECKLIST**

- [x] Create `iot-queue-listener.sh`
- [x] Create systemd service
- [x] Create Liquidsoap config
- [x] Create installation script
- [ ] Generate IoT certificates
- [ ] Update Lambda to publish to IoT
- [ ] Update Lambda IAM permissions
- [ ] Deploy via pipeline
- [ ] Upload certificates to EC2
- [ ] Start IoT queue service
- [ ] Verify messages received
- [ ] Test track playback
- [ ] Monitor CloudWatch logs
- [ ] Remove SQS FIFO queue
- [ ] Update documentation

---

**Status:** ✅ **SOFTWARE READY - CERTIFICATES NEEDED**  
**Next:** Generate IoT certificates and deploy via pipeline
