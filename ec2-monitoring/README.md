# 🎯 EC2 Monitoring System

Complete monitoring, health checks, en service management voor Splash FM EC2 instance.

---

## 🚀 QUICK START:

```bash
# Install complete monitoring systeem op EC2
./install-monitoring.sh

# Check service status
ssh radio-ec2 '/usr/local/bin/service-manager.sh status'

# View health
ssh radio-ec2 'tail -f /var/log/splash-health.log'
```

---

## 📦 COMPONENTS:

### **1. service-manager.sh**
Service management voor alle radio services

**Commands:**
```bash
service-manager.sh start    # Start all services
service-manager.sh stop     # Stop all services  
service-manager.sh restart  # Restart all services
service-manager.sh status   # Check status
```

**Manages:**
- Icecast2 (stream server)
- Liquidsoap (playlist)
- Stereo Tool (processing)
- Nginx (proxy)

---

### **2. watchdog.sh**
Auto-restart crashed services

**Functie:**
- Check elke 5 minuten of services draaien
- Auto-restart bij crash
- Log incidents
- Send CloudWatch metrics

**Monitored Services:**
- Liquidsoap
- Icecast2
- Nginx
- Port 8000 (Icecast)
- Port 80 (Nginx)

---

### **3. health-check.sh**
Comprehensive health monitoring

**Checks:**

**Processen:**
- Running status
- CPU usage
- Connection counts

**Disk:**
- Root (/) usage
- /tmp usage
- /var/log usage

**S3 Cache:**
- File count
- Auto cleanup > 5000 files

**Playlist:**
- File exists
- Not empty
- Recently updated
- Entry count

**Stream:**
- HTTP endpoints
- Content delivery
- Response codes

**Logs:**
- File sizes
- Error counts
- Rotation working

**Output:**
- Health score (0-100)
- CloudWatch metrics
- Log file

---

### **4. disk-cleanup.sh**
Automated disk space management

**Cleans:**
- S3 cache files > 7 days
- Old compressed logs > 30 days
- /tmp files > 3 days
- Core dumps
- Old backups > 30 days
- Large Liquidsoap logs

**Runs:** Daily at 03:00 CET

---

### **5. log-stats.sh**
Log statistics reporting

**Reports:**
- Error counts
- Log file sizes
- Send to CloudWatch

**Runs:** Every hour

---

## ⏰ CRON SCHEDULE:

```
Every 1 min:  health-check.sh
Every 5 min:  watchdog.sh
Daily 03:00:  disk-cleanup.sh
Every hour:   log-stats.sh
```

---

## ☁️ CLOUDWATCH:

### **Namespace:** `SplashFM`

### **Metrics:**

**System:**
- CPU_IDLE, CPU_IOWAIT
- MEM_USED
- DISK_USED, DISK_INODES_FREE
- TCP_CONNECTIONS
- SWAP_USED

**Services:**
- LiquidsoapRunning (0/1)
- IcecastRunning (0/1)
- NginxRunning (0/1)
- StereoToolRunning (0/1)

**Application:**
- HealthScore (0-100)
- PlaylistEntries (count)
- S3CacheFiles (count)
- IcecastConnections (count)
- StreamAccessible (0/1)

**Events:**
- ServiceRestart (count)
- WatchdogAlive (heartbeat)
- DiskCleanupRan (count)
- LiquidsoapErrors (count)
- NginxErrors (count)

### **Log Groups:**
- `/splash-fm/liquidsoap`
- `/splash-fm/nginx`
- `/splash-fm/icecast`
- `/splash-fm/health`
- `/splash-fm/watchdog`

---

## 🔄 LOG ROTATION:

### **Files:**

**Liquidsoap:**
- File: `/tmp/liquidsoap.log`
- Rotate: Daily
- Keep: 7 days

**Nginx:**
- Files: `/var/log/nginx/*.log`
- Rotate: Daily
- Keep: 14 days

**Icecast:**
- Files: `/var/log/icecast2/*.log`
- Rotate: Daily
- Keep: 7 days

**Monitoring:**
- Files: `/var/log/splash-*.log`
- Rotate: Daily
- Keep: 30 days

---

## 📊 HEALTH SCORE SYSTEM:

**Starting Score:** 100

**Deductions:**
- Liquidsoap down: -30
- Icecast down: -30
- Nginx down: -20
- Liquidsoap CPU > 90%: -10
- Disk > 80%: -15
- Disk > 90%: -20 (additional)
- S3 cache > 1000: -5
- S3 cache > 5000: -10
- Playlist not found: -25
- Playlist empty: -20
- Playlist old: -10
- Playlist < 5 entries: -5
- Stream not accessible: -20
- Icecast endpoint down: -15
- Stream no data: -25
- Errors in logs: -5

**Health Levels:**
- 80-100: ✅ GOOD
- 50-79:  ⚠️  WARNING
- 0-49:   🚨 CRITICAL

---

## 🛠️ INSTALLATION:

### **Prerequisites:**
- SSH access to EC2 (radio-ec2)
- AWS CLI configured
- EC2 IAM role with CloudWatch permissions

### **Deploy:**
```bash
cd ec2-monitoring
chmod +x install-monitoring.sh
./install-monitoring.sh
```

### **What Gets Installed:**
1. Scripts → `/usr/local/bin/`
2. Logrotate config → `/etc/logrotate.d/splash-fm`
3. Cron jobs → `/etc/cron.d/splash-fm`
4. CloudWatch Agent config
5. Log files → `/var/log/splash-*.log`

---

## 🔍 MONITORING:

### **Check Health:**
```bash
ssh radio-ec2 '/usr/local/bin/health-check.sh'
```

### **View Real-time Logs:**
```bash
# Health checks
ssh radio-ec2 'tail -f /var/log/splash-health.log'

# Watchdog
ssh radio-ec2 'tail -f /var/log/splash-watchdog.log'

# Cleanup
ssh radio-ec2 'tail -f /var/log/splash-cleanup.log'
```

### **CloudWatch Console:**
1. Go to CloudWatch
2. Metrics → SplashFM namespace
3. Logs → /splash-fm/* log groups
4. Create dashboard (optional)
5. Setup alarms (optional)

---

## 🚨 ALARMS (Optional Setup):

### **Critical:**
```bash
# Service down > 5 min
aws cloudwatch put-metric-alarm \
  --alarm-name "SplashFM-Liquidsoap-Down" \
  --metric-name LiquidsoapRunning \
  --namespace SplashFM \
  --statistic Minimum \
  --period 300 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1

# Disk usage > 90%
aws cloudwatch put-metric-alarm \
  --alarm-name "SplashFM-Disk-Critical" \
  --metric-name DISK_USED \
  --namespace SplashFM \
  --statistic Maximum \
  --period 300 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1

# Health score < 50
aws cloudwatch put-metric-alarm \
  --alarm-name "SplashFM-Health-Critical" \
  --metric-name HealthScore \
  --namespace SplashFM \
  --statistic Minimum \
  --period 300 \
  --threshold 50 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 2
```

---

## 🧪 TESTING:

### **Test Service Manager:**
```bash
ssh radio-ec2 '/usr/local/bin/service-manager.sh status'
```

### **Test Health Check:**
```bash
ssh radio-ec2 '/usr/local/bin/health-check.sh'
cat /var/log/splash-health.log
```

### **Test Watchdog:**
```bash
# Kill Liquidsoap
ssh radio-ec2 'sudo pkill -9 liquidsoap'

# Wait 5 minutes, check if auto-restarted
ssh radio-ec2 'pgrep -f liquidsoap'
```

### **Test Log Rotation:**
```bash
ssh radio-ec2 'sudo logrotate -f /etc/logrotate.d/splash-fm'
```

### **Test Disk Cleanup:**
```bash
ssh radio-ec2 '/usr/local/bin/disk-cleanup.sh'
```

---

## 📁 FILES:

```
ec2-monitoring/
├── README.md                      # This file
├── install-monitoring.sh          # Installation script
├── service-manager.sh             # Service management
├── watchdog.sh                    # Auto-restart
├── health-check.sh                # Health monitoring
├── disk-cleanup.sh                # Disk cleanup
├── log-stats.sh                   # Log statistics
├── logrotate-splash-fm.conf       # Log rotation config
├── cloudwatch-config.json         # CloudWatch config
└── splash-fm-cron                 # Cron configuration
```

---

## 📚 KEYWORDS:

`monitoring` `health-check` `watchdog` `auto-restart` `cloudwatch` `metrics` `log-rotation` `disk-cleanup` `cron` `service-management` `ec2` `production` `observability` `alerting` `reliability` `automation`

---

**Status:** ✅ PRODUCTION READY  
**Version:** 1.0  
**Last Updated:** 14 November 2025
