# 🎵 Player Version Management System

**Date:** 14 November 2025  
**Status:** ✅ ACTIVE  
**Purpose:** Veilig versiebeheer voor SplashFM player homepage

---

## 🎯 **OVERZICHT:**

### **Probleem:**
```
❌ Player HTML alleen op EC2 nginx
❌ Geen versiehistorie
❌ Geen rollback mogelijkheid
❌ Risico bij updates
```

### **Oplossing:**
```
✅ Git voor source control (development)
✅ S3 met versioning (production backups)
✅ Automated deploy scripts
✅ Easy rollback functionaliteit
✅ Metadata tracking
```

---

## 🏗️ **ARCHITECTUUR:**

### **Deployment Flow:**
```
Development:
   /web/splashfm-player-with-delay.html
            ↓
   [Git Commit - Source Control]
            ↓
   [./deploy-player.sh v0.0.3]
            ↓
Production:
   ├─→ S3: s3://bucket/web-player/
   │   ├── current/index.html          (latest)
   │   ├── versions/v0.0.3-index.html  (tagged)
   │   ├── backups/backup-timestamp    (auto backup)
   │   └── metadata/v0.0.3-meta.json   (deploy info)
   │
   └─→ EC2: /var/www/splashfm/index.html (live)
```

### **Rollback Flow:**
```
[./rollback-player.sh v0.0.2]
         ↓
S3: versions/v0.0.2-index.html
         ↓
Backup current version
         ↓
EC2: /var/www/splashfm/index.html (restored)
```

---

## 📁 **S3 FOLDER STRUCTURE:**

```
s3://amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt/
  └── web-player/
      ├── current/
      │   └── index.html                    ← Always latest version
      │
      ├── versions/
      │   ├── v0.0.1-index.html            ← Git tagged releases
      │   ├── v0.0.2-index.html
      │   └── v0.0.3-index.html
      │
      ├── backups/
      │   ├── backup-20251114-113000.html  ← Auto backups before deploy
      │   ├── backup-20251114-114500.html
      │   └── pre-rollback-timestamp.html  ← Backup before rollback
      │
      └── metadata/
          ├── v0.0.1-meta.json             ← Deployment metadata
          ├── v0.0.2-meta.json
          └── v0.0.3-meta.json
```

---

## 🛠️ **SCRIPTS:**

### **1. Deploy Script: `./deploy-player.sh`**

```bash
./deploy-player.sh [version]

# Example:
./deploy-player.sh v0.0.3
```

**What it does:**
1. ✅ Backup current production version (EC2 → S3)
2. ✅ Upload new version to S3 (versioned + current)
3. ✅ Create deployment metadata (git info, timestamp, etc.)
4. ✅ Deploy to EC2 nginx
5. ✅ Verify deployment (HTTP check)

**Output:**
```
╔════════════════════════════════════════╗
║   🎵 SplashFM Player Deployment       ║
╚════════════════════════════════════════╝

📋 Deployment Info:
   Version:    v0.0.3
   Timestamp:  20251114-113000
   Source:     web/splashfm-player-with-delay.html
   S3 Bucket:  s3://bucket/web-player
   EC2 Target: radio-ec2:/var/www/splashfm/index.html

📥 Step 1/5: Backing up current production version...
✅ Backup saved: /tmp/player-backup-20251114-113000.html
✅ Backup uploaded to S3

📤 Step 2/5: Uploading new version to S3...
✅ Uploaded to S3:
   s3://bucket/web-player/versions/v0.0.3-index.html
   s3://bucket/web-player/current/index.html

📝 Step 3/5: Creating deployment metadata...
✅ Metadata uploaded

🚀 Step 4/5: Deploying to EC2...
✅ Deployed to EC2: radio-ec2:/var/www/splashfm/index.html

🔍 Step 5/5: Verifying deployment...
✅ Player accessible via HTTP (Status: 200)
✅ Deployed file size: 16K

╔════════════════════════════════════════╗
║   ✅ DEPLOYMENT SUCCESSFUL!            ║
╚════════════════════════════════════════╝

📊 Deployment Summary:
   Version:      v0.0.3
   Live URL:     https://splashfm.nl
   S3 Backup:    s3://bucket/web-player/versions/v0.0.3-index.html

🔄 Rollback:
   ./rollback-player.sh v0.0.3
```

---

### **2. Rollback Script: `./rollback-player.sh`**

```bash
./rollback-player.sh <version>

# Examples:
./rollback-player.sh v0.0.2                    # Rollback to tagged version
./rollback-player.sh backup-20251114-113000    # Rollback to specific backup
```

**What it does:**
1. ✅ Check if version exists in S3
2. ✅ Backup current version before rollback
3. ✅ Download version from S3
4. ✅ Deploy to EC2
5. ✅ Verify rollback

**Output:**
```
╔════════════════════════════════════════╗
║   🔄 SplashFM Player Rollback         ║
╚════════════════════════════════════════╝

🔍 Checking if version exists...
✅ Version found: s3://bucket/web-player/versions/v0.0.2-index.html

📥 Step 1/4: Backing up current version...
✅ Current version backed up

📥 Step 2/4: Downloading version from S3...
✅ Downloaded from S3

🚀 Step 3/4: Deploying to EC2...
✅ Deployed to EC2

🔍 Step 4/4: Verifying rollback...
✅ Player accessible (HTTP 200)

╔════════════════════════════════════════╗
║   ✅ ROLLBACK SUCCESSFUL!              ║
╚════════════════════════════════════════╝

📊 Rollback Summary:
   Restored:     v0.0.2
   Live URL:     https://splashfm.nl
   Pre-rollback: /tmp/player-pre-rollback-20251114-113500.html

💡 To rollback this rollback:
   ./rollback-player.sh pre-rollback-20251114-113500
```

---

### **3. List Versions: `./list-player-versions.sh`**

```bash
./list-player-versions.sh
```

**What it shows:**
- Current live version
- All tagged versions
- Recent backups (last 10)
- Deployment metadata

**Output:**
```
╔════════════════════════════════════════╗
║   📋 Player Versions & Backups         ║
╚════════════════════════════════════════╝

📌 CURRENT VERSION:
   📄 index.html
   📅 2025-11-14 11:30:00
   📦 16K

🏷️  TAGGED VERSIONS:
   v0.0.1
   📅 2025-11-14 10:00:00 | 📦 14K

   v0.0.2
   📅 2025-11-14 11:30:00 | 📦 16K

   v0.0.3
   📅 2025-11-14 12:00:00 | 📦 16K

💾 RECENT BACKUPS (last 10):
   backup-20251114-100000
   📅 2025-11-14 10:00:00 | 📦 14K

   backup-20251114-113000
   📅 2025-11-14 11:30:00 | 📦 16K

📊 DEPLOYMENT METADATA:
   v0.0.3
   📅 Deployed: 2025-11-14T11:30:00Z
   👤 By: gerard
   🔀 Branch: feature/multi-player-state-machine
   📝 Commit: 45c8d44

💡 USAGE:
   Deploy new version:
   ./deploy-player.sh v0.0.3

   Rollback to version:
   ./rollback-player.sh v0.0.2

   Rollback to backup:
   ./rollback-player.sh backup-20251114-113000
```

---

## 📋 **WORKFLOW:**

### **Development Workflow:**

```bash
# 1. Make changes to player
nano web/splashfm-player-with-delay.html

# 2. Test locally
open web/splashfm-player-with-delay.html

# 3. Commit to git
git add web/splashfm-player-with-delay.html
git commit -m "feat: Add new player feature"

# 4. Tag release
git tag v0.0.3

# 5. Deploy to production
./deploy-player.sh v0.0.3

# 6. Verify
open https://splashfm.nl
```

### **Rollback Workflow:**

```bash
# 1. Check available versions
./list-player-versions.sh

# 2. Rollback to previous version
./rollback-player.sh v0.0.2

# 3. Verify
open https://splashfm.nl

# 4. If needed, rollback the rollback
./rollback-player.sh v0.0.3
```

### **Emergency Workflow:**

```bash
# Something broke! Quick rollback!

# Option 1: Rollback to previous tagged version
./rollback-player.sh v0.0.2

# Option 2: Rollback to last backup
./list-player-versions.sh  # Find latest backup
./rollback-player.sh backup-20251114-113000

# Option 3: Manual restore from S3
aws s3 cp s3://bucket/web-player/versions/v0.0.2-index.html /tmp/restore.html
scp /tmp/restore.html radio-ec2:/tmp/
ssh radio-ec2 "sudo cp /tmp/restore.html /var/www/splashfm/index.html"
```

---

## 🔒 **VEILIGHEID:**

### **Automatic Backups:**
```
✅ Before elke deploy: Current version → S3 backup
✅ Before elke rollback: Current version → S3 backup
✅ Git history: Source code versioned in git
✅ S3 versioning: S3 native versioning enabled (optional)
```

### **Multiple Restore Points:**
```
1. Git tagged versions (v0.0.1, v0.0.2, etc.)
2. Timestamped backups (backup-20251114-113000)
3. Pre-rollback backups (pre-rollback-timestamp)
4. Local backups (/tmp/player-backup-*)
```

---

## 📊 **METADATA TRACKING:**

### **Deployment Metadata (JSON):**
```json
{
  "version": "v0.0.3",
  "timestamp": "20251114-113000",
  "deployed_at": "2025-11-14T11:30:00Z",
  "deployed_by": "gerard",
  "git_commit": "45c8d44",
  "git_branch": "feature/multi-player-state-machine",
  "source_file": "web/splashfm-player-with-delay.html",
  "s3_path": "s3://bucket/web-player/versions/v0.0.3-index.html",
  "ec2_path": "radio-ec2:/var/www/splashfm/index.html"
}
```

**Stored at:** `s3://bucket/web-player/metadata/v0.0.3-meta.json`

---

## 🧪 **TESTING:**

### **Test Deploy:**
```bash
# Deploy with current git tag
./deploy-player.sh

# Or specify version
./deploy-player.sh v0.0.3-test
```

### **Test Rollback:**
```bash
# Rollback to previous version
./rollback-player.sh v0.0.2

# Then rollback forward again
./rollback-player.sh v0.0.3
```

### **Verify Scripts:**
```bash
# List all versions
./list-player-versions.sh

# Check S3 directly
aws s3 ls s3://amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt/web-player/ --recursive

# Check EC2
ssh radio-ec2 "ls -lah /var/www/splashfm/"
```

---

## 🚀 **EERSTE SETUP:**

### **Step 1: Enable S3 Versioning (optioneel)**
```bash
# Get bucket name
BUCKET=$(aws s3 ls | grep amplify-gforgeiot | awk '{print $3}')

# Enable versioning (extra layer of safety)
aws s3api put-bucket-versioning \
  --bucket $BUCKET \
  --versioning-configuration Status=Enabled

# Verify
aws s3api get-bucket-versioning --bucket $BUCKET
```

### **Step 2: First Backup**
```bash
# Backup current production version
ssh radio-ec2 "cat /var/www/splashfm/index.html" > web/splashfm-player-current-backup.html

# Upload to S3 as v0.0.1
./deploy-player.sh v0.0.1
```

### **Step 3: Test Rollback**
```bash
# List versions
./list-player-versions.sh

# Test rollback
./rollback-player.sh v0.0.1

# Verify
curl -I https://splashfm.nl
```

---

## 📝 **BEST PRACTICES:**

### **Versioning:**
```
✅ Use semantic versioning: v0.0.1, v0.1.0, v1.0.0
✅ Tag in git before deploy
✅ Include version in commit message
✅ Update CHANGELOG.md
```

### **Testing:**
```
✅ Test locally before deploy
✅ Deploy to staging first (if available)
✅ Verify after deploy (HTTP check)
✅ Monitor console for errors
```

### **Rollback:**
```
✅ Always check ./list-player-versions.sh first
✅ Understand which version you're rolling back to
✅ Verify after rollback
✅ Document rollback reason
```

---

## 🐛 **TROUBLESHOOTING:**

### **Deploy Failed:**
```bash
# Check EC2 SSH access
ssh radio-ec2 "echo 'SSH works'"

# Check S3 permissions
aws s3 ls s3://amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt/

# Check file permissions on EC2
ssh radio-ec2 "ls -la /var/www/splashfm/"

# Manual deploy
scp web/splashfm-player-with-delay.html radio-ec2:/tmp/
ssh radio-ec2 "sudo cp /tmp/splashfm-player-with-delay.html /var/www/splashfm/index.html"
```

### **Rollback Failed:**
```bash
# Check if version exists
aws s3 ls s3://amplify-gforgeiot-gerard-s-storage6a0ed596-rkofllhqqrkt/web-player/versions/

# Manual rollback
aws s3 cp s3://bucket/web-player/versions/v0.0.2-index.html /tmp/manual-rollback.html
scp /tmp/manual-rollback.html radio-ec2:/tmp/
ssh radio-ec2 "sudo cp /tmp/manual-rollback.html /var/www/splashfm/index.html"
```

---

## 📚 **FILES:**

```
deploy-player.sh              - Main deployment script
rollback-player.sh            - Rollback script
list-player-versions.sh       - Version list script
PLAYER_VERSION_MANAGEMENT.md  - This documentation
```

---

## 🎯 **SAMENVATTING:**

**Veilig Version Management voor Player:**
```
✅ Git source control (development)
✅ S3 versioned backups (production)
✅ Automated deploy scripts
✅ Easy rollback (1 command)
✅ Metadata tracking
✅ Multiple restore points
✅ No data loss risk
```

**Usage:**
```bash
./deploy-player.sh v0.0.3      # Deploy new version
./rollback-player.sh v0.0.2    # Rollback to previous
./list-player-versions.sh       # View all versions
```

---

**🎉 Safe & Reliable Player Updates! 🎉**
