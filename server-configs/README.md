# 🖥️ Server Configs - Local Git Backup

**Location:** EC2 Instance (46.137.184.91)  
**Last Synced:** 14 November 2025, 12:50 CET  
**Status:** ✅ SYNCED

---

## 📁 **FILES IN THIS FOLDER:**

### **Liquidsoap Configs:**

**1. radio.liq**
```
Main Liquidsoap configuration
- SQS queue integration
- Cross function with advanced_crossfade
- Output to Icecast
- Request.dynamic.list source
```
**Location on EC2:** `/opt/radio/radio.liq`

**2. advanced-crossfade.liq**
```
Current active crossfade preset
- Currently: g-forge-Quick-Mix-Extreme
- Jingle detection: 60s threshold
- Fade settings: 0.2s out / 0s in
```
**Location on EC2:** `/opt/radio/advanced-crossfade.liq`

**3. cover-support.liq**
```
Cover art metadata support
- Album art handling
- Metadata passthrough
```
**Location on EC2:** `/opt/radio/cover-support.liq`

### **Nginx Config:**

**4. nginx-splashfm.conf**
```
Nginx site configuration for SplashFM
- Port 80 HTTP
- Stream proxy to Icecast
- Static file serving
- CORS headers
```
**Location on EC2:** `/etc/nginx/sites-available/radio`

### **Icecast Config:**

**5. icecast.xml**
```
Icecast streaming server config
- Port 8000
- Mount point: /stream.mp3
- Credentials stored
```
**Location on EC2:** `/etc/icecast2/icecast.xml`

### **Stereo Tool:**

**6. stereotool-relay.sh**
```
Stereo Tool relay script
- License key included
- Audio processing pipeline
- Relay to Icecast
```
**Location on EC2:** `/usr/local/bin/stereotool-relay.sh`

---

## 🔄 **SYNC WORKFLOW:**

### **Download from EC2 (Pull):**
```bash
./sync-server-configs.sh pull
```

### **Upload to EC2 (Push):**
```bash
./sync-server-configs.sh push
```

### **Full Sync (Pull + S3 + Git):**
```bash
./sync-server-configs.sh sync
```

---

## 📦 **TRIPLE BACKUP STRATEGY:**

```
1. 💻 LOCAL GIT (This folder)
   - Version controlled
   - Git history
   - Easy diff/compare

2. ☁️ S3 BUCKET
   - Cloud backup
   - S3 versioning
   - Disaster recovery

3. 🖥️ EC2 INSTANCE (Live)
   - Running configs
   - Production server
```

---

## 🎯 **GEBRUIK:**

### **Wijzigingen maken:**

```bash
# 1. Bewerk lokaal bestand
nano server-configs/advanced-crossfade.liq

# 2. Test lokaal (optioneel)
liquidsoap --check server-configs/advanced-crossfade.liq

# 3. Deploy naar EC2 + S3
./deploy.sh crossfade

# 4. Git commit
git add server-configs/
git commit -m "Update crossfade config"
```

### **Quick deploy commands:**

```bash
./deploy.sh crossfade       # Deploy crossfade preset
./deploy.sh nginx           # Deploy nginx config
./deploy.sh icecast         # Deploy icecast config
./deploy.sh stereotool      # Deploy stereo tool
./deploy.sh all             # Deploy all configs
```

---

## ⚠️ **IMPORTANT:**

```
⚠️  Always sync before making changes:
    ./sync-server-configs.sh pull

⚠️  Always test changes before deploying

⚠️  Backups are automatic (S3 + Git)

⚠️  Credentials in icecast.xml and stereotool-relay.sh
    (not public in git, but in private repo)
```

---

## 📊 **FILE SIZES:**

```
radio.liq              ~2.5 KB
advanced-crossfade.liq ~3.4 KB
cover-support.liq      ~400 B
nginx-splashfm.conf    ~2.7 KB
icecast.xml            ~700 B
stereotool-relay.sh    ~1.3 KB

Total:                 ~11 KB
```

---

**Status:** ✅ SYNCED WITH EC2 + S3  
**Git Tracked:** ✅ YES  
**S3 Backed Up:** ✅ YES
