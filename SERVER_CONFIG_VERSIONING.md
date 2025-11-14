# 💾 Server Config Versioning System

**Date:** 14 November 2025, 12:00 CET  
**Status:** ✅ ACTIVE  
**Purpose:** S3-based versioning voor alle server configuraties

---

## 🎯 **OVERZICHT:**

### **Probleem:**
```
❌ Configs alleen op EC2 server
❌ Geen versiehistorie
❌ Geen rollback mogelijkheid
❌ Risico bij config wijzigingen
```

### **Oplossing:**
```
✅ Automatische backup naar S3
✅ Versioned config storage
✅ Easy restore functionaliteit
✅ Complete audit trail
✅ EC2 heeft IAM rol voor S3 toegang
```

---

## 📁 **WAT WORDT GEBACKUPT:**

### **Configs:**
```
Liquidsoap:
  • /opt/radio/radio.liq
  • /opt/radio/advanced-crossfade.liq
  • /opt/radio/cover-support.liq

Nginx:
  • /etc/nginx/sites-available/splashfm

Icecast:
  • /etc/icecast2/icecast.xml

Stereo Tool:
  • /usr/local/bin/stereotool-relay.sh

Metadata:
  • System versions
  • Backup metadata (JSON)
```

---

## 📦 **S3 STRUCTURE:**

```
s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/
  └── server-configs/
      ├── latest/                          ← Always most recent
      │   ├── radio.liq
      │   ├── advanced-crossfade.liq
      │   ├── nginx-splashfm.conf
      │   ├── icecast.xml
      │   ├── stereotool-relay.sh
      │   └── backup-meta.json
      │
      ├── initial-backup-v0.0.3/          ← Tagged backups
      │   └── (same files)
      │
      ├── snapshot-20251114-120000/       ← Timestamped snapshots
      │   └── (same files)
      │
      └── pre-restore-20251114-120500/    ← Auto backup before restore
          └── (same files)
```

---

## 🛠️ **SCRIPTS:**

### **1. Backup Script: `./backup-server-configs.sh`**

```bash
./backup-server-configs.sh [version]

# Examples:
./backup-server-configs.sh                    # Auto timestamp
./backup-server-configs.sh v0.0.4             # Tagged backup
./backup-server-configs.sh before-crossfade-change
```

**What it does:**
1. ✅ Download all configs from EC2
2. ✅ Create metadata file (JSON)
3. ✅ Upload to S3 (versioned + latest)
4. ✅ Verify upload
5. ✅ Cleanup temp files

**Output:**
```
╔════════════════════════════════════════╗
║  💾 Server Config Backup to S3        ║
╚════════════════════════════════════════╝

📋 Backup Info:
   Version:    initial-backup-v0.0.3
   S3 Location: s3://bucket/server-configs/...

📥 Downloading configs from EC2...
✅ Configs downloaded

📝 Creating metadata...
✅ Metadata created

📤 Uploading to S3...
✅ Uploaded to: s3://bucket/server-configs/initial-backup-v0.0.3/
✅ Uploaded to: s3://bucket/server-configs/latest/

🔍 Verifying...
✅ 10 files uploaded

╔════════════════════════════════════════╗
║   ✅ BACKUP SUCCESSFUL!                ║
╚════════════════════════════════════════╝

🔄 Restore:
   ./restore-server-configs.sh initial-backup-v0.0.3
```

---

### **2. Restore Script: `./restore-server-configs.sh`**

```bash
./restore-server-configs.sh <version>

# Examples:
./restore-server-configs.sh latest                    # Restore latest
./restore-server-configs.sh initial-backup-v0.0.3    # Restore specific
./restore-server-configs.sh pre-restore-20251114-120500  # Rollback restore
```

**What it does:**
1. ✅ Check if version exists in S3
2. ✅ Backup current configs (auto!)
3. ✅ Download version from S3
4. ✅ Upload to EC2
5. ✅ Restart services (Liquidsoap, Nginx)
6. ✅ Verify stream

**Output:**
```
╔════════════════════════════════════════╗
║  🔄 Server Config Restore from S3     ║
╚════════════════════════════════════════╝

🔍 Checking version...
✅ Version found

📥 Downloading from S3...
✅ Downloaded

💾 Backing up current configs...
✅ Backed up to: s3://bucket/server-configs/pre-restore-...

📤 Uploading to EC2...
   ✓ radio.liq
   ✓ advanced-crossfade.liq
   ✓ nginx-splashfm.conf
   ✓ icecast.xml
✅ Configs uploaded

🔄 Restarting services...
   ✓ Nginx config valid
   ✓ Nginx reloaded
   ✓ Liquidsoap restarted
✅ Services restarted

🔍 Verifying...
✅ Stream accessible (HTTP 200)

╔════════════════════════════════════════╗
║   ✅ RESTORE SUCCESSFUL!               ║
╚════════════════════════════════════════╝

💡 Rollback this restore:
   ./restore-server-configs.sh pre-restore-20251114-120500
```

---

### **3. List Script: `./list-server-configs.sh`**

```bash
./list-server-configs.sh
```

**What it shows:**
- Latest backup
- All backups with metadata
- Statistics (total backups, size, files)

**Output:**
```
╔════════════════════════════════════════╗
║   📋 Server Config Backups (S3)       ║
╚════════════════════════════════════════╝

📌 LATEST BACKUP:
   📄 latest/
   📅 2025-11-14 11:59:01
   📦 10 files
   🔖 Version: initial-backup-v0.0.3

📦 ALL BACKUPS:
   initial-backup-v0.0.3
   📅 2025-11-14 11:59:00 | 📦 10 files
   👤 gerard on 2025-11-14T10:58:58Z

📊 STATISTICS:
   Total backups: 2
   Total files:   20
   Total size:    43KB
```

---

## 🔄 **WORKFLOW:**

### **Voor Config Wijzigingen:**
```bash
# 1. Backup huidige staat
./backup-server-configs.sh before-crossfade-tweaks

# 2. SSH naar server en maak wijzigingen
ssh radio-ec2
sudo nano /opt/radio/advanced-crossfade.liq
# ... maak wijzigingen ...
sudo pkill -9 liquidsoap
cd /opt/radio && nohup sudo liquidsoap radio.liq &

# 3. Test
# Luister naar stream, check logs

# 4. Als het goed is: Backup nieuwe versie
./backup-server-configs.sh after-crossfade-tweaks

# 5. Als het NIET goed is: Restore oude versie
./restore-server-configs.sh before-crossfade-tweaks
```

---

## 📊 **METADATA FORMAT:**

### **backup-meta.json:**
```json
{
  "version": "initial-backup-v0.0.3",
  "timestamp": "20251114-115845",
  "backup_date": "2025-11-14T10:58:58Z",
  "backed_up_by": "gerard",
  "ec2_host": "radio-ec2",
  "configs": [
    "radio.liq",
    "advanced-crossfade.liq",
    "cover-support.liq",
    "nginx-splashfm.conf",
    "icecast.xml",
    "stereotool-relay.sh"
  ],
  "s3_bucket": "amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr",
  "s3_path": "s3://bucket/server-configs/initial-backup-v0.0.3/"
}
```

---

## 🔒 **VEILIGHEID:**

### **Automatische Backups:**
```
✅ Voor elke restore: Current config → S3 backup
✅ Manual backups: Op commando
✅ Versioned storage: Alle versies bewaard
✅ Metadata tracking: Wie, wanneer, wat
```

### **IAM Permissions:**
```
EC2 heeft IAM rol met S3 toegang
→ Kan configs direct naar/van S3 halen
→ Geen credentials in scripts nodig
→ Veilig en schaalbaar
```

---

## 💡 **USE CASES:**

### **1. Config Experiment:**
```bash
# Backup
./backup-server-configs.sh before-experiment

# Experiment op server
ssh radio-ec2
# ... maak wijzigingen ...

# Test
# ... test de wijzigingen ...

# Rollback als nodig
./restore-server-configs.sh before-experiment
```

### **2. Nieuwe Server Setup:**
```bash
# Op nieuwe server:
./restore-server-configs.sh latest

# Alle configs automatisch ingesteld!
```

### **3. Disaster Recovery:**
```bash
# Server crashed? Nieuwe EC2 instance?
./restore-server-configs.sh latest

# Alles terug in < 5 minuten!
```

### **4. Config Audit:**
```bash
# Bekijk wat er veranderd is
./list-server-configs.sh

# Download oude versie
aws s3 cp s3://bucket/server-configs/v0.0.1/radio.liq old-radio.liq

# Compare
diff old-radio.liq current-radio.liq
```

---

## 🧪 **TESTING:**

### **Test Backup:**
```bash
./backup-server-configs.sh test-backup-1
./list-server-configs.sh
```

### **Test Restore:**
```bash
# Restore test backup
./restore-server-configs.sh test-backup-1

# Verify stream works
curl -I http://46.137.184.91/

# Rollback
./restore-server-configs.sh latest
```

---

## 📋 **FILES:**

```
backup-server-configs.sh       - Create backup to S3
restore-server-configs.sh      - Restore from S3
list-server-configs.sh         - List all backups
SERVER_CONFIG_VERSIONING.md    - This documentation
```

---

## 🎯 **BENEFITS:**

```
✅ Veilige config wijzigingen (altijd rollback)
✅ Complete versiehistorie
✅ Disaster recovery ready
✅ Easy nieuwe server setup
✅ Audit trail (wie, wanneer, wat)
✅ Automatische backups voor restore
✅ S3 durable storage (99.999999999%)
```

---

## ⚙️ **TECHNISCH:**

### **S3 Bucket:**
```
amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr
```

### **IAM Permissions (EC2 rol):**
```
✅ s3:ListBucket
✅ s3:GetObject
✅ s3:PutObject
✅ s3:DeleteObject
```

### **Scripts Location:**
```
/Users/gerard/Desktop/T7/g-forge-iot/
  ├── backup-server-configs.sh
  ├── restore-server-configs.sh
  └── list-server-configs.sh
```

---

## 🚀 **EERSTE BACKUP:**

```bash
Status: ✅ GEDAAN

Versie:  initial-backup-v0.0.3
Datum:   14 Nov 2025, 11:58 CET
Files:   10 configs
S3:      s3://bucket/server-configs/initial-backup-v0.0.3/
```

---

**💾 Complete server config versioning via S3! 💾**

**Alle configs veilig opgeslagen met easy rollback! ✅**
