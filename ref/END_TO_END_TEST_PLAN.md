# 🧪 End-to-End Test Plan - Complete Monitoring System

**Datum:** 14 November 2025, 13:20 CET  
**Doel:** Test complete monitoring + CloudWatch + Backup systeem

---

## 📋 **OVERZICHT:**

**Test Scenario's:**
1. ✅ EC2 Backup systeem
2. ✅ Service manager (start/stop/status)
3. ✅ Health checks → CloudWatch
4. ✅ Watchdog auto-restart
5. ✅ Silence detection
6. ✅ Log aggregation naar CloudWatch
7. ✅ Server restart steekproef
8. ✅ Recovery from backup

---

## 🎯 **TEST 1: EC2 BACKUP SYSTEEM**

### **Setup:**
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
chmod +x setup-ec2-backup.sh
chmod +x ec2-monitoring/ec2-snapshot-backup.sh
```

### **Test A: Manual Backup**
```bash
./ec2-monitoring/ec2-snapshot-backup.sh
```

**Expected:**
```
✅ Volume ID found
✅ Snapshot created
✅ Snapshot completing (5-15 min)
✅ Old snapshots cleaned up
✅ CloudWatch metric sent
```

**Verify:**
```bash
# List snapshots
aws ec2 describe-snapshots \
  --owner-ids self \
  --filters "Name=tag:AutoBackup,Values=true" \
  --region eu-west-1

# Should show: 1 snapshot with today's date
```

**✅ PASS:** Snapshot created successfully

---

### **Test B: Setup Cron (Option 2)**
```bash
./setup-ec2-backup.sh
# Choose: 2 (Local Cron)
# Choose: yes (Add to crontab)
```

**Verify:**
```bash
crontab -l | grep ec2-snapshot-backup
# Should show: 0 0 * * * /path/to/ec2-snapshot-backup.sh
```

**✅ PASS:** Cron job configured (runs daily 00:00)

---

## 🎯 **TEST 2: DEPLOY MONITORING SCRIPTS**

### **Deploy to EC2:**
```bash
cd ec2-monitoring

# Install ffmpeg (required for silence detection)
ssh radio-ec2 "sudo apt-get update && sudo apt-get install -y ffmpeg sox"

# Upload scripts
scp stream-silence-detector.sh radio-ec2:/tmp/
scp cloudwatch-config.json radio-ec2:/tmp/
scp splash-fm-cron radio-ec2:/tmp/
scp logrotate-splash-fm.conf radio-ec2:/tmp/

# Install scripts
ssh radio-ec2 "
  sudo mv /tmp/stream-silence-detector.sh /usr/local/bin/ && \
  sudo chmod +x /usr/local/bin/stream-silence-detector.sh && \
  sudo mv /tmp/cloudwatch-config.json /opt/aws/amazon-cloudwatch-agent/etc/config.json && \
  sudo mv /tmp/splash-fm-cron /etc/cron.d/splash-fm && \
  sudo mv /tmp/logrotate-splash-fm.conf /etc/logrotate.d/splash-fm && \
  sudo touch /var/log/splash-silence.log && \
  sudo chmod 644 /var/log/splash-silence.log
"

# Restart CloudWatch Agent
ssh radio-ec2 "sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json"
```

**✅ PASS:** All scripts deployed

---

## 🎯 **TEST 3: SERVICE MANAGER**

### **Test A: Status Check**
```bash
ssh radio-ec2 '/usr/local/bin/service-manager.sh status'
```

**Expected:**
```
✅ Icecast2: Running
✅ Liquidsoap: Running
✅ Stereo Tool: Running
✅ Nginx: Running
✅ Port 8000: Listening
✅ Port 80: Listening
✅ ALL SERVICES HEALTHY
```

**✅ PASS:** All services healthy

---

### **Test B: Stop Services**
```bash
ssh radio-ec2 '/usr/local/bin/service-manager.sh stop'
```

**Expected:**
```
✅ Nginx stopped
✅ Stereo Tool stopped
✅ Liquidsoap stopped
✅ Icecast2 stopped
```

**Verify:**
```bash
curl -I http://79.125.44.178/
# Should: Connection refused or timeout
```

**✅ PASS:** Services stopped

---

### **Test C: Start Services**
```bash
ssh radio-ec2 '/usr/local/bin/service-manager.sh start'
```

**Expected:**
```
✅ Icecast2 started
✅ Liquidsoap started
✅ Stereo Tool started
✅ Nginx started
✅ ALL SERVICES HEALTHY
```

**Verify:**
```bash
curl -I http://79.125.44.178/
# Should: HTTP/1.1 200 OK
```

**✅ PASS:** Services restarted successfully

---

## 🎯 **TEST 4: HEALTH CHECKS → CLOUDWATCH**

### **Test A: Manual Health Check**
```bash
ssh radio-ec2 '/usr/local/bin/health-check.sh'
```

**Expected:**
```
✅ Liquidsoap running
✅ Icecast2 running
✅ Nginx running
✅ Disk usage: <80%
✅ Stream accessible
📊 Health Score: 75-100
```

**✅ PASS:** Health check working

---

### **Test B: Wait for Cron (1 minute)**
```bash
# Wait 1 minute
sleep 60

# Check log file
ssh radio-ec2 'tail -20 /var/log/splash-health.log'
```

**Expected:**
```
[timestamp] ╔═══ Health Check Starting ═══╗
[timestamp] ✅ Liquidsoap running
[timestamp] ✅ Nginx running
[timestamp] 📊 Final Health Score: XX/100
```

**✅ PASS:** Cron running health checks

---

### **Test C: CloudWatch Metrics**
```bash
# Check metrics (wait 2-3 minutes for data)
aws cloudwatch get-metric-statistics \
  --namespace SplashFM \
  --metric-name HealthScore \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average \
  --region eu-west-1
```

**Expected:**
```json
{
  "Datapoints": [
    {
      "Timestamp": "2025-11-14T12:20:00Z",
      "Average": 85.0,
      "Unit": "None"
    }
  ]
}
```

**✅ PASS:** Metrics in CloudWatch

---

## 🎯 **TEST 5: WATCHDOG AUTO-RESTART**

### **Test A: Kill Liquidsoap**
```bash
# Kill Liquidsoap
ssh radio-ec2 'sudo pkill -9 liquidsoap'

# Verify it's down
ssh radio-ec2 'pgrep -f liquidsoap'
# Should: No output (process not found)

# Wait 5 minutes for watchdog
echo "Waiting 5 minutes for watchdog..."
sleep 300

# Check if restarted
ssh radio-ec2 'pgrep -f liquidsoap'
# Should: Process ID (process running!)
```

**Expected:**
```
✅ Liquidsoap killed
⏳ Wait 5 minutes
✅ Watchdog detected down service
✅ Liquidsoap auto-restarted
```

**Verify logs:**
```bash
ssh radio-ec2 'tail -30 /var/log/splash-watchdog.log | grep liquidsoap'
```

**Expected:**
```
[timestamp] ⚠️  liquidsoap is down! Auto-restarting...
[timestamp] ✅ liquidsoap restarted successfully
```

**✅ PASS:** Watchdog auto-restart working

---

## 🎯 **TEST 6: SILENCE DETECTION**

### **Test A: Normal Stream**
```bash
ssh radio-ec2 '/usr/local/bin/stream-silence-detector.sh'
```

**Expected:**
```
✅ Stream accessible (HTTP 200)
✅ Downloaded 40000-60000 bytes
✅ Audio detected - stream is broadcasting sound
✅ Silence detection complete
```

**✅ PASS:** Silence detector working with audio

---

### **Test B: Create Silence**
```bash
# Stop Liquidsoap to create silence
ssh radio-ec2 'sudo pkill -9 liquidsoap'

# Wait 30 seconds for silence
sleep 30

# Run silence detector
ssh radio-ec2 '/usr/local/bin/stream-silence-detector.sh'
```

**Expected:**
```
✅ Stream accessible (HTTP 200)
✅ Downloaded bytes
🔇 SILENCE DETECTED: X.X seconds of silence
🚨 ALARM: Stream is broadcasting silence
```

**Verify CloudWatch:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace SplashFM \
  --metric-name StreamIsSilent \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 180 \
  --statistics Maximum \
  --region eu-west-1
```

**Expected:**
```json
{
  "Datapoints": [
    {
      "Maximum": 1.0  // 1 = Silence detected
    }
  ]
}
```

**✅ PASS:** Silence detection working

---

### **Test C: Restart & Verify**
```bash
# Restart Liquidsoap
ssh radio-ec2 '/usr/local/bin/service-manager.sh start'

# Wait 1 minute
sleep 60

# Check silence detector again
ssh radio-ec2 '/usr/local/bin/stream-silence-detector.sh'
```

**Expected:**
```
✅ Audio detected - stream is broadcasting sound
```

**✅ PASS:** Audio restored

---

## 🎯 **TEST 7: LOG AGGREGATION → CLOUDWATCH**

### **Test A: Check Log Groups**
```bash
aws logs describe-log-groups \
  --log-group-name-prefix "/splash-fm" \
  --region eu-west-1
```

**Expected:** 9 log groups:
```
✅ /splash-fm/liquidsoap
✅ /splash-fm/nginx
✅ /splash-fm/icecast
✅ /splash-fm/stereotool
✅ /splash-fm/silence-detection
✅ /splash-fm/health
✅ /splash-fm/watchdog
✅ /splash-fm/cleanup
✅ /splash-fm/stats
```

**✅ PASS:** All log groups created

---

### **Test B: Verify Log Streams**
```bash
# Check health log stream
aws logs describe-log-streams \
  --log-group-name "/splash-fm/health" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --region eu-west-1
```

**Expected:**
```json
{
  "logStreams": [
    {
      "logStreamName": "i-021451e919d39c898",
      "lastEventTimestamp": <recent timestamp>,
      "storedBytes": >0
    }
  ]
}
```

**✅ PASS:** Log streams active

---

### **Test C: Read Recent Logs**
```bash
# Tail health logs
aws logs tail /splash-fm/health \
  --since 10m \
  --follow \
  --region eu-west-1
```

**Expected:**
```
[timestamp] ✅ Liquidsoap running
[timestamp] ✅ Nginx running
[timestamp] 📊 Health Score: XX/100
```

**✅ PASS:** Logs flowing to CloudWatch

---

## 🎯 **TEST 8: COMPLETE SERVER RESTART (STEEKPROEF)**

### **⚠️ WARNING: This will cause ~2-5 minutes downtime**

### **Pre-Restart Checklist:**
```bash
# 1. Create backup first
./ec2-monitoring/ec2-snapshot-backup.sh

# 2. Verify backup created
aws ec2 describe-snapshots \
  --owner-ids self \
  --filters "Name=tag:AutoBackup,Values=true" \
  --region eu-west-1 \
  --query 'Snapshots[0].[SnapshotId,State,StartTime]'

# Should show: Latest snapshot in "completed" or "pending" state

# 3. Note current metrics
ssh radio-ec2 '/usr/local/bin/service-manager.sh status'
```

**✅ READY:** Backup created, safe to restart

---

### **Step 1: Reboot EC2**
```bash
echo "🔄 Rebooting EC2 instance..."
aws ec2 reboot-instances \
  --instance-ids i-021451e919d39c898 \
  --region eu-west-1

echo "⏳ Waiting 2 minutes for reboot..."
sleep 120
```

---

### **Step 2: Verify SSH Access**
```bash
echo "🔍 Checking SSH access..."
MAX_ATTEMPTS=10
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if ssh -o ConnectTimeout=5 radio-ec2 'echo "SSH OK"' 2>/dev/null; then
        echo "✅ SSH access restored"
        break
    else
        echo "⏳ Waiting for SSH (attempt $ATTEMPT/$MAX_ATTEMPTS)..."
        sleep 10
        ATTEMPT=$((ATTEMPT + 1))
    fi
done
```

**✅ PASS:** SSH accessible

---

### **Step 3: Check Services Auto-Start**
```bash
ssh radio-ec2 '/usr/local/bin/service-manager.sh status'
```

**Expected:**
```
✅ Icecast2: Running
✅ Liquidsoap: Running (or starting)
✅ Stereo Tool: Running (or starting)
✅ Nginx: Running
```

**If services not running:**
```bash
ssh radio-ec2 '/usr/local/bin/service-manager.sh start'
```

**✅ PASS:** Services running after reboot

---

### **Step 4: Verify Stream**
```bash
# HTTP check
curl -I http://79.125.44.178/

# Stream check
curl -s --max-time 5 http://79.125.44.178/stream.mp3 | head -c 1000 | wc -c
# Should: 1000 bytes
```

**✅ PASS:** Stream operational

---

### **Step 5: Check Monitoring Systems**
```bash
# Health check log
ssh radio-ec2 'tail -20 /var/log/splash-health.log'

# Cron running?
ssh radio-ec2 'systemctl status cron'

# CloudWatch Agent running?
ssh radio-ec2 'sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a query -m ec2 -c default -s'
```

**Expected:**
```
✅ Health checks running
✅ Cron active
✅ CloudWatch Agent running
```

**✅ PASS:** Monitoring active after reboot

---

### **Step 6: Wait & Verify CloudWatch**
```bash
echo "⏳ Waiting 5 minutes for metrics..."
sleep 300

# Check metrics after reboot
aws cloudwatch get-metric-statistics \
  --namespace SplashFM \
  --metric-name HealthScore \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average \
  --region eu-west-1
```

**Expected:**
```
✅ Metrics after reboot timestamp
✅ Health score 75-100
```

**✅ PASS:** CloudWatch metrics flowing after reboot

---

## 📊 **TEST SUMMARY CHECKLIST:**

```
✅ TEST 1: EC2 Backup
   ✅ Manual backup working
   ✅ Cron scheduled (00:00 daily)
   ✅ Snapshots visible in AWS
   
✅ TEST 2: Scripts Deployed
   ✅ All scripts on EC2
   ✅ CloudWatch Agent configured
   ✅ Cron jobs active
   
✅ TEST 3: Service Manager
   ✅ Status check working
   ✅ Stop/start working
   ✅ All services controlled
   
✅ TEST 4: Health Checks
   ✅ Manual check working
   ✅ Cron running checks
   ✅ Metrics in CloudWatch
   
✅ TEST 5: Watchdog
   ✅ Detects crashed services
   ✅ Auto-restart working
   ✅ Logs incidents
   
✅ TEST 6: Silence Detection
   ✅ Detects normal audio
   ✅ Detects silence
   ✅ Metrics to CloudWatch
   
✅ TEST 7: Log Aggregation
   ✅ All 9 log groups created
   ✅ Log streams active
   ✅ Logs flowing to CloudWatch
   
✅ TEST 8: Server Restart
   ✅ Reboot successful
   ✅ Services auto-start
   ✅ Stream restored
   ✅ Monitoring active
   ✅ CloudWatch working
```

---

## 🎯 **SUCCESS CRITERIA:**

```
✅ EC2 backup running daily (00:00)
✅ All monitoring scripts deployed
✅ Services auto-start after reboot
✅ Health checks running every minute
✅ Watchdog auto-restart working (< 5 min)
✅ Silence detection every 3 minutes
✅ All logs flowing to CloudWatch (9 groups)
✅ CloudWatch metrics updating
✅ Stream operational after reboot
✅ < 5 minutes downtime during reboot
✅ No manual intervention needed
```

---

## 🎊 **FINAL VERIFICATION:**

After all tests, verify system health:

```bash
# Complete status
ssh radio-ec2 '/usr/local/bin/service-manager.sh status'

# Recent health score
ssh radio-ec2 'tail -5 /var/log/splash-health.log | grep "Health Score"'

# Cron jobs
ssh radio-ec2 'cat /etc/cron.d/splash-fm'

# CloudWatch Agent
ssh radio-ec2 'sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a query -m ec2 -c default -s'

# Backup count
aws ec2 describe-snapshots \
  --owner-ids self \
  --filters "Name=tag:AutoBackup,Values=true" \
  --region eu-west-1 \
  --query 'Snapshots | length(@)'

# CloudWatch logs
aws logs describe-log-groups \
  --log-group-name-prefix "/splash-fm" \
  --region eu-west-1 \
  --query 'logGroups | length(@)'
```

**Expected:**
```
✅ All services: Running
✅ Health score: 75-100
✅ Cron: 5 jobs configured
✅ CloudWatch Agent: Running
✅ Backups: >= 1 snapshot
✅ Log groups: 9 groups
```

---

**Status:** 📝 READY TO EXECUTE  
**Duration:** ~45-60 minuten  
**Risk:** Low (backup created first)
