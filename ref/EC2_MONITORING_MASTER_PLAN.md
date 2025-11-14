# 🎯 EC2 Monitoring & Management - Master Plan

**Datum:** 14 November 2025, 13:01 CET  
**Status:** 🟡 IN UITVOERING

---

## 📋 **OVERZICHT:**

Complete monitoring, health checks, service management, en CloudWatch integratie voor Splash FM EC2 instance.

---

## 🎯 **DOELEN:**

```
✅ Service management (stop/start/restart/status)
✅ Process watchdog (auto-restart crashed services)
✅ Health checks (processen, S3, playlist, disk)
✅ CloudWatch metrics (voor dashboards)
✅ Log rotation (geen vol filesystem)
✅ Cron monitoring (elke minuut)
✅ Alerting bij problemen
```

---

## 🏗️ **ARCHITECTUUR:**

```
┌─────────────────────────────────────────────────────┐
│              EC2 Instance (46.137.184.91)          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📦 Services:                                       │
│     ├─ Liquidsoap (playlist streaming)             │
│     ├─ Icecast2 (stream server)                    │
│     ├─ Nginx (reverse proxy)                       │
│     └─ Stereo Tool (audio processing)              │
│                                                     │
│  🔧 Management Scripts:                             │
│     ├─ service-manager.sh (stop/start/restart)     │
│     ├─ watchdog.sh (process monitoring)            │
│     └─ health-check.sh (comprehensive checks)      │
│                                                     │
│  ⏰ Cron Jobs:                                      │
│     ├─ */1 * * * * → health-check.sh               │
│     └─ */5 * * * * → watchdog.sh                   │
│                                                     │
│  📊 CloudWatch Agent:                               │
│     ├─ Custom metrics                              │
│     ├─ Log streaming                               │
│     └─ Disk/CPU/Memory metrics                     │
│                                                     │
│  🔄 Log Rotation:                                   │
│     ├─ Liquidsoap logs                             │
│     ├─ Nginx logs                                  │
│     ├─ Icecast logs                                │
│     └─ Custom script logs                          │
│                                                     │
└─────────────────────────────────────────────────────┘
         │
         │ Metrics & Logs
         ↓
┌─────────────────────────────────────────────────────┐
│              AWS CloudWatch                         │
├─────────────────────────────────────────────────────┤
│  📊 Dashboards                                      │
│  🚨 Alarms                                          │
│  📝 Logs                                            │
│  📈 Metrics                                         │
└─────────────────────────────────────────────────────┘
```

---

## 📝 **COMPONENTEN:**

### **1. Service Manager (`service-manager.sh`)**

**Functies:**
- Start alle services in juiste volgorde
- Stop alle services gracefully
- Restart services zonder downtime
- Status check van alle services

**Services:**
1. Icecast2 (basis)
2. Liquidsoap (playlist)
3. Stereo Tool (processing)
4. Nginx (proxy)

**Commands:**
```bash
./service-manager.sh start    # Start all
./service-manager.sh stop     # Stop all
./service-manager.sh restart  # Restart all
./service-manager.sh status   # Status check
```

---

### **2. Watchdog (`watchdog.sh`)**

**Functies:**
- Check of kritieke processen draaien
- Auto-restart bij crash
- Logging van incidents
- CloudWatch notificaties

**Checks:**
- Liquidsoap process running?
- Icecast2 process running?
- Nginx process running?
- Stereo Tool process running?
- Port 8000 (Icecast) luisterend?
- Port 80 (Nginx) luisterend?

**Action:**
- Als down → auto restart
- Log incident
- Send CloudWatch metric

**Cron:** Elke 5 minuten

---

### **3. Health Check (`health-check.sh`)**

**Checks:**

**A. Processen:**
- Liquidsoap: running + CPU < 90%
- Icecast2: running + connections
- Nginx: running + active connections
- Stereo Tool: running + processing

**B. Disk Space:**
- / (root) < 80% used
- /tmp < 80% used
- /var/log < 80% used
- /opt/radio < 80% used

**C. S3 Files:**
- Count files in /tmp/radio-cache/
- Waarschuwing als > 1000 files
- Auto cleanup als > 5000 files

**D. Playlist:**
- Check /tmp/current-playlist.txt exists
- Check file size > 0
- Check last modified < 10 min
- Count entries > 0

**E. Stream:**
- HTTP check op http://localhost/
- HTTP check op http://localhost:8000/
- Verify content-type audio/mpeg

**F. Logs:**
- Check log file sizes
- Check disk space logs
- Verify log rotation working

**Output:**
- JSON format naar stdout
- Send naar CloudWatch
- Local log: /var/log/splash-health.log

**Cron:** Elke minuut

---

### **4. CloudWatch Agent**

**Metrics:**

**System:**
- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- Network in/out (bytes)

**Custom:**
- liquidsoap_running (0/1)
- icecast_running (0/1)
- nginx_running (0/1)
- stereotool_running (0/1)
- playlist_entries (count)
- s3_cache_files (count)
- stream_listeners (count)
- health_score (0-100)

**Logs:**
- /tmp/liquidsoap.log
- /var/log/nginx/error.log
- /var/log/icecast2/error.log
- /var/log/splash-health.log
- /var/log/splash-watchdog.log

**Config:** `/opt/aws/amazon-cloudwatch-agent/etc/config.json`

---

### **5. Log Rotation**

**Files:**

```
/tmp/liquidsoap.log
  - Rotate daily
  - Keep 7 days
  - Compress old

/var/log/nginx/access.log
  - Rotate daily
  - Keep 14 days
  - Compress old

/var/log/nginx/error.log
  - Rotate daily
  - Keep 14 days
  - Compress old

/var/log/icecast2/access.log
  - Rotate daily
  - Keep 7 days
  - Compress old

/var/log/icecast2/error.log
  - Rotate daily
  - Keep 7 days
  - Compress old

/var/log/splash-*.log
  - Rotate daily
  - Keep 30 days
  - Compress old
```

**Config:** `/etc/logrotate.d/splash-fm`

---

### **6. Disk Cleanup (`disk-cleanup.sh`)**

**Actions:**
- Clean S3 cache files > 7 days
- Clean old logs (beyond retention)
- Clean /tmp files > 3 days
- Clean core dumps
- Clean old backups > 30 days

**Cron:** Daily at 03:00

---

## 🔄 **DEPLOYMENT PLAN:**

### **Fase 1: Scripts maken (lokaal)**
```
✅ service-manager.sh
✅ watchdog.sh
✅ health-check.sh
✅ disk-cleanup.sh
✅ install-monitoring.sh
```

### **Fase 2: CloudWatch config**
```
✅ CloudWatch agent config JSON
✅ IAM policy voor CloudWatch
✅ Metric definitions
```

### **Fase 3: Log rotation config**
```
✅ Logrotate config bestand
✅ Test rotation
```

### **Fase 4: Deploy naar EC2**
```
✅ Upload scripts naar /usr/local/bin/
✅ Maak executable
✅ Install CloudWatch agent
✅ Setup logrotate
✅ Configure cron jobs
```

### **Fase 5: Testing**
```
✅ Test service manager
✅ Test watchdog (kill process)
✅ Test health check
✅ Verify CloudWatch metrics
✅ Verify log rotation
```

### **Fase 6: Monitoring setup**
```
✅ CloudWatch dashboard
✅ CloudWatch alarms
✅ SNS notifications (optional)
```

---

## 📊 **CRON SCHEDULE:**

```cron
# Health check - elke minuut
*/1 * * * * /usr/local/bin/health-check.sh >> /var/log/splash-health.log 2>&1

# Watchdog - elke 5 minuten
*/5 * * * * /usr/local/bin/watchdog.sh >> /var/log/splash-watchdog.log 2>&1

# Disk cleanup - dagelijks 03:00
0 3 * * * /usr/local/bin/disk-cleanup.sh >> /var/log/splash-cleanup.log 2>&1

# Log stats - elk uur
0 * * * * /usr/local/bin/log-stats.sh >> /var/log/splash-stats.log 2>&1
```

---

## 🎯 **DELIVERABLES:**

```
📁 /usr/local/bin/
  ├── service-manager.sh       # Service management
  ├── watchdog.sh              # Process monitor
  ├── health-check.sh          # Health checks
  ├── disk-cleanup.sh          # Disk cleanup
  └── log-stats.sh             # Log statistics

📁 /etc/
  ├── logrotate.d/splash-fm    # Log rotation
  └── cron.d/splash-fm         # Cron jobs

📁 /opt/aws/amazon-cloudwatch-agent/etc/
  └── config.json              # CloudWatch config

📁 /var/log/
  ├── splash-health.log        # Health check logs
  ├── splash-watchdog.log      # Watchdog logs
  ├── splash-cleanup.log       # Cleanup logs
  └── splash-stats.log         # Stats logs
```

---

## 📈 **METRICS DASHBOARD:**

**Panels:**

**1. Service Health**
- Liquidsoap: Running (yes/no)
- Icecast: Running (yes/no)
- Nginx: Running (yes/no)
- Stereo Tool: Running (yes/no)

**2. System Resources**
- CPU Usage (%)
- Memory Usage (%)
- Disk Usage (/)
- Network I/O

**3. Application Metrics**
- Playlist entries (count)
- S3 cache files (count)
- Stream listeners (count)
- Health score (0-100)

**4. Logs & Errors**
- Error count (last hour)
- Warning count (last hour)
- Service restarts (last 24h)

---

## 🚨 **ALARMS:**

**Critical:**
- Service down > 5 min → Restart + Alert
- Disk usage > 90% → Alert
- Health score < 50 → Alert

**Warning:**
- CPU > 80% for 10 min → Alert
- Memory > 85% for 10 min → Alert
- Playlist empty → Alert
- S3 cache > 5000 files → Cleanup + Alert

---

## ✅ **SUCCESS CRITERIA:**

```
✅ Alle services auto-restart bij crash
✅ Health metrics elke minuut in CloudWatch
✅ Logs geroteerd, geen vol filesystem
✅ Dashboard toont realtime status
✅ Alarms werkend
✅ Disk cleanup automatisch
✅ < 5 minuten downtime bij crash
```

---

## 🔧 **INSTALLATIE COMMANDO:**

```bash
# Deploy complete monitoring systeem
./deploy-monitoring.sh

# Check status
./service-manager.sh status

# View health
./health-check.sh

# View logs
tail -f /var/log/splash-health.log
```

---

## 📚 **KEYWORDS:**

`monitoring` `health-check` `watchdog` `service-management` `cloudwatch` `metrics` `log-rotation` `disk-cleanup` `cron` `auto-restart` `alerting` `dashboard` `ec2` `production` `reliability` `observability`

---

**Status:** 🟡 READY FOR IMPLEMENTATION  
**Next:** Build scripts + Deploy
