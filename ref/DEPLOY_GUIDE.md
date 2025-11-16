# 🚀 Deploy Guide - Quick Reference

**Date:** 14 November 2025  
**System:** EC2 (79.125.44.178) + S3 + Local Git

---

## ⚡ **QUICK START:**

### **Maak wijziging en deploy:**

```bash
# 1. Bewerk config lokaal
nano server-configs/advanced-crossfade.liq

# 2. Deploy naar EC2 (+ auto S3 backup + Git commit)
./deploy.sh crossfade

# Klaar! ✅
```

---

## 🎯 **DEPLOY COMMANDS:**

### **Individuele Components:**

```bash
./deploy.sh crossfade       # Crossfade preset
./deploy.sh nginx           # Nginx config
./deploy.sh icecast         # Icecast config
./deploy.sh stereotool      # Stereo Tool script
./deploy.sh liquidsoap      # Alle Liquidsoap configs
./deploy.sh all             # Alles (met confirmatie)
```

### **Wat gebeurt er automatisch:**

```
✅ Backup van huidige config (EC2 + S3)
✅ Upload nieuwe config naar EC2
✅ Restart relevante service
✅ Sync naar S3
✅ Git commit met timestamp
✅ Stream verificatie
```

---

## 🔄 **SYNC COMMANDS:**

### **Download configs van EC2:**

```bash
./sync-server-configs.sh pull
```
**Doet:**
- Download alle configs van EC2
- Sla op in `server-configs/`
- Git commit

### **Upload configs naar EC2:**

```bash
./sync-server-configs.sh push
```
**Doet:**
- Upload lokale configs naar EC2
- Backup naar S3
- Git commit
- ⚠️ Met confirmatie (overschrijft EC2!)

### **Full sync:**

```bash
./sync-server-configs.sh sync
```
**Doet:**
- Pull van EC2
- Sync naar S3
- Git commit

---

## 📁 **FOLDER STRUCTURE:**

```
/server-configs/              # 💻 Local Git Backup
├── README.md                 # Documentatie
├── radio.liq                 # Liquidsoap main
├── advanced-crossfade.liq    # Crossfade preset
├── cover-support.liq         # Cover art support
├── nginx-splashfm.conf       # Nginx site
├── icecast.xml               # Icecast server
└── stereotool-relay.sh       # Stereo Tool script

/crossfade-presets/           # 🎛️ Crossfade Presets
├── g-forge-Ultra-Tight.liq
├── g-forge-Quick-Mix.liq
└── g-forge-Quick-Mix-Extreme.liq
```

---

## 🎛️ **CROSSFADE PRESET WORKFLOW:**

### **Optie 1: Via preset switch (RECOMMENDED):**

```bash
# Switch preset (gebruikt bestaande preset van S3)
./switch-crossfade-preset.sh g-forge-Quick-Mix

# Auto backup + deploy + restart
```

### **Optie 2: Via lokale edit + deploy:**

```bash
# 1. Bewerk lokaal
nano server-configs/advanced-crossfade.liq

# 2. Deploy
./deploy.sh crossfade

# Auto backup + upload + restart
```

### **Optie 3: Update preset en deploy:**

```bash
# 1. Bewerk preset
nano crossfade-presets/g-forge-Quick-Mix-Extreme.liq

# 2. Upload naar S3
aws s3 cp crossfade-presets/g-forge-Quick-Mix-Extreme.liq \
  s3://$BUCKET/crossfade-presets/

# 3. Switch preset
./switch-crossfade-preset.sh g-forge-Quick-Mix-Extreme

# Nieuwe versie live!
```

---

## 🔁 **COMMON WORKFLOWS:**

### **1. Tweak crossfade settings:**

```bash
# Bewerk lokaal
nano server-configs/advanced-crossfade.liq

# Deploy
./deploy.sh crossfade

# Test in stream
# Als goed: blijft staan (al gecommit)
# Als slecht: rollback via S3 backup
```

### **2. Update Nginx config:**

```bash
# Bewerk
nano server-configs/nginx-splashfm.conf

# Deploy (auto Nginx reload)
./deploy.sh nginx

# Test: curl http://79.125.44.178/
```

### **3. Change Icecast settings:**

```bash
# Bewerk
nano server-configs/icecast.xml

# Deploy (auto Icecast restart)
./deploy.sh icecast

# Stream blijft draaien via Nginx buffer
```

### **4. Update Stereo Tool license:**

```bash
# Bewerk
nano server-configs/stereotool-relay.sh

# Deploy
./deploy.sh stereotool

# Manual restart Stereo Tool process if running
```

### **5. Full config refresh from EC2:**

```bash
# Pull latest van EC2
./sync-server-configs.sh pull

# Nu heb je exact wat er draait
```

---

## 📦 **TRIPLE BACKUP STRATEGY:**

```
1. 💻 LOCAL GIT
   Location:  ./server-configs/
   Purpose:   Version control, diffs, history
   Tool:      Git

2. ☁️ S3 BUCKET
   Location:  s3://bucket/server-configs/
   Purpose:   Cloud backup, disaster recovery
   Tool:      AWS S3 (versioning enabled)

3. 🖥️ EC2 INSTANCE
   Location:  79.125.44.178
   Purpose:   Live production configs
   Tool:      SSH/SCP
```

**Elke deploy update alle 3! ✅**

---

## 🔄 **SERVICE RESTART LOGIC:**

### **Automatisch restart bij deploy:**

```
crossfade   → Liquidsoap restart ✅
liquidsoap  → Liquidsoap restart ✅
nginx       → Nginx reload ✅
icecast     → Icecast restart ✅
stereotool  → Geen auto restart (manual) ⚠️
```

### **Manual restarts:**

```bash
# Liquidsoap
./restart-liquidsoap.sh

# Nginx
ssh radio-ec2 "sudo systemctl reload nginx"

# Icecast
ssh radio-ec2 "sudo systemctl restart icecast2"

# Alle services status
ssh radio-ec2 "systemctl status liquidsoap nginx icecast2"
```

---

## 🔍 **VERIFICATION:**

### **Na elke deploy:**

```bash
# Stream check (auto bij deploy)
curl -I http://79.125.44.178/

# Liquidsoap logs
ssh radio-ec2 "tail -20 /tmp/liquidsoap.log"

# Nginx logs
ssh radio-ec2 "sudo tail /var/log/nginx/error.log"

# Icecast logs
ssh radio-ec2 "sudo tail /var/log/icecast2/error.log"
```

---

## ⚠️ **ROLLBACK:**

### **Via S3 backup:**

```bash
# 1. List backups
aws s3 ls s3://$BUCKET/server-configs/ --recursive | grep backup

# 2. Download specific backup
aws s3 cp s3://$BUCKET/server-configs/backup-TIMESTAMP/advanced-crossfade.liq \
  server-configs/

# 3. Deploy
./deploy.sh crossfade
```

### **Via Git history:**

```bash
# 1. Check history
git log --oneline server-configs/

# 2. Restore previous version
git checkout HEAD~1 server-configs/advanced-crossfade.liq

# 3. Deploy
./deploy.sh crossfade
```

### **Via crossfade preset backup:**

```bash
# 1. List preset backups
aws s3 ls s3://$BUCKET/crossfade-presets/backups/

# 2. Download
aws s3 cp s3://$BUCKET/crossfade-presets/backups/crossfade-backup-TIMESTAMP.liq \
  server-configs/advanced-crossfade.liq

# 3. Deploy
./deploy.sh crossfade
```

---

## 🎯 **BEST PRACTICES:**

### **DO:**

```
✅ Altijd eerst pull voor je edit: ./sync-server-configs.sh pull
✅ Test syntax voor deploy: liquidsoap --check file.liq
✅ Kleine changes tegelijk (niet alles in één keer)
✅ Deploy in rustige uren (weinig luisteraars)
✅ Monitor logs na deploy
✅ Commit messages duidelijk
```

### **DON'T:**

```
❌ Direct editen op EC2 zonder backup
❌ Multiple configs tegelijk pushen (test 1 voor 1)
❌ Vergeten te pullen (werk altijd met latest)
❌ Deploy tijdens peak hours
❌ Credentials in git (zijn private, maar toch voorzichtig)
```

---

## 📊 **FILE MAPPING:**

### **Local → EC2:**

```
server-configs/radio.liq              → /opt/radio/radio.liq
server-configs/advanced-crossfade.liq → /opt/radio/advanced-crossfade.liq
server-configs/cover-support.liq      → /opt/radio/cover-support.liq
server-configs/nginx-splashfm.conf    → /etc/nginx/sites-available/radio
server-configs/icecast.xml            → /etc/icecast2/icecast.xml
server-configs/stereotool-relay.sh    → /usr/local/bin/stereotool-relay.sh
```

---

## ⚡ **QUICK REFERENCE:**

```bash
# Deploy crossfade
./deploy.sh crossfade

# Deploy all Liquidsoap
./deploy.sh liquidsoap

# Deploy Nginx
./deploy.sh nginx

# Pull latest from EC2
./sync-server-configs.sh pull

# Push local to EC2
./sync-server-configs.sh push

# Full sync
./sync-server-configs.sh sync

# Switch preset
./switch-crossfade-preset.sh g-forge-Quick-Mix-Extreme

# Restart Liquidsoap
./restart-liquidsoap.sh

# Check stream
curl http://79.125.44.178/
```

---

## 🎊 **EXAMPLES:**

### **Example 1: Quick crossfade tweak**

```bash
# Pull latest
./sync-server-configs.sh pull

# Edit jingle threshold
nano server-configs/advanced-crossfade.liq
# Change: jingle_threshold = 90.0

# Deploy
./deploy.sh crossfade

# Check logs
ssh radio-ec2 "tail -20 /tmp/liquidsoap.log"

# If good: done! (auto committed)
# If bad: git checkout HEAD~1 server-configs/advanced-crossfade.liq
#         ./deploy.sh crossfade
```

### **Example 2: Add CORS header to Nginx**

```bash
./sync-server-configs.sh pull
nano server-configs/nginx-splashfm.conf
# Add: add_header Access-Control-Allow-Origin "*";
./deploy.sh nginx
curl -I http://79.125.44.178/stream.mp3
```

### **Example 3: New Icecast mount point**

```bash
./sync-server-configs.sh pull
nano server-configs/icecast.xml
# Add new <mount> section
./deploy.sh icecast
# Test new mount
```

---

**Status:** ✅ READY  
**Tools:** deploy.sh, sync-server-configs.sh, switch-crossfade-preset.sh  
**Backups:** Local Git + S3 + EC2

🚀 **DEPLOY = 1 COMMAND - WE DO THE REST!**
