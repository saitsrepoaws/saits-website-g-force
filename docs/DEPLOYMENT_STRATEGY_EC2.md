# 🚀 EC2 Deployment Strategie - CodeDeploy + Parameter Store

**Datum:** 17 November 2025, 22:35 CET  
**Status:** Planning & Implementation

---

## 🎯 **HUIDIGE SITUATIE:**

### **Wat we HEBBEN:**
```
✅ EC2 Instance: i-0924372740ff587ca (development)
✅ CloudWatch Monitoring: Operational
✅ IAM Permissions: Fixed
✅ CodeDeploy Application: g-forge-radio-stream-server
✅ Parameter Store: /g-forge-radio/development/*
✅ Docker Images: Downloaded op EC2
```

### **Wat NIET werkt:**
```
❌ Ramdisk Docker containers: Crashloop
❌ Config files: /mnt/ramdisk/configs/ niet gevuld
❌ Container logs: Niet streaming naar CloudWatch
```

**Root Cause:** Config files ontbreken in ramdisk setup

---

## 📋 **DEPLOYMENT STRATEGIE:**

### **FASE 1: System-Level Tuning (NU)**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Configs EERST op het systeem tunen                     │
│     └─> Direct op EC2 via SSH                              │
│     └─> Testen tot alles werkt                             │
│                                                             │
│  2. Werkende configs documenteren                          │
│     └─> /opt/radio/radio.liq (Liquidsoap)                  │
│     └─> /etc/icecast2/icecast.xml (Icecast)                │
│     └─> /etc/nginx/sites-available/splashfm (Nginx)        │
│                                                             │
│  3. Configs blijven in Docker voor nu                      │
│     └─> Niet verplaatsen tijdens tuning                    │
│     └─> Focus op werkende setup                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **FASE 2: Parameter Store Migratie (LATER)**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Werkende configs → Parameter Store                     │
│     └─> /g-forge-radio/development/liquidsoap/config       │
│     └─> /g-forge-radio/development/icecast/config          │
│     └─> /g-forge-radio/development/nginx/config            │
│                                                             │
│  2. CodeDeploy lifecycle hooks                             │
│     └─> BeforeInstall: Pull configs uit Parameter Store    │
│     └─> ApplicationStart: Inject configs in Docker         │
│                                                             │
│  3. Docker containers met injected configs                 │
│     └─> Configs komen van Parameter Store                  │
│     └─> Bij deployment: fresh configs                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 **WAT WE NU UITROLLEN MET CODEDEPLOY:**

### **Current Deployment (v1 - Basic):**
```yaml
CodeDeploy Deployment:
  ├── Source: GitHub development branch
  ├── Target: EC2 i-0924372740ff587ca
  ├── Lifecycle Hooks:
  │   ├── BeforeInstall:
  │   │   └── install-dependencies.sh (system packages)
  │   ├── ApplicationStart:
  │   │   └── start-services.sh (systemd services)
  │   └── ValidateService:
  │       └── validate-deployment.sh (health checks)
  │
  └── Deployed Files:
      ├── scripts/
      ├── configs/ (templates)
      └── appspec.yml
```

**Wat dit NIET doet:**
- ❌ Docker containers starten
- ❌ Configs injecteren
- ❌ Ramdisk setup

---

## 🎯 **NEXT DEPLOYMENT (v2 - Met Docker + Configs):**

### **Deployment Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. CodeDeploy Trigger                                      │
│     └─> GitHub push naar development                        │
│     └─> ./deploy_streamserver                              │
│                                                             │
│  2. BeforeInstall Hook                                      │
│     ├─> Pull configs uit Parameter Store                   │
│     ├─> Create /mnt/ramdisk/configs/*                      │
│     └─> Populate config files                              │
│                                                             │
│  3. Install Phase                                           │
│     ├─> Copy application files                             │
│     └─> Update docker-compose.yml                          │
│                                                             │
│  4. ApplicationStart Hook                                   │
│     ├─> Stop oude containers                               │
│     ├─> Start containers met fresh configs                 │
│     └─> Verify containers running                          │
│                                                             │
│  5. ValidateService Hook                                    │
│     ├─> Check container health                             │
│     ├─> Verify CloudWatch logs streaming                   │
│     └─> Health check endpoints                             │
│                                                             │
│  6. Post-Deployment Verification ⭐                         │
│     └─> bash scripts/verify-deployment.sh                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 **IMPLEMENTATIE PLAN:**

### **STAP 1: Fix Ramdisk Container Setup (NU)**

**Doel:** Containers werkend krijgen zonder Parameter Store

**Script:** `scripts/setup-ramdisk-configs.sh`
```bash
#!/bin/bash
# Create ramdisk config structure
mkdir -p /mnt/ramdisk/configs/{liquidsoap,icecast,nginx/sites-enabled}

# Copy working configs
cp /opt/radio/radio.liq /mnt/ramdisk/configs/liquidsoap/
cp /etc/icecast2/icecast.xml /mnt/ramdisk/configs/icecast/
cp /etc/nginx/nginx.conf /mnt/ramdisk/configs/nginx/
cp -r /etc/nginx/sites-enabled/* /mnt/ramdisk/configs/nginx/sites-enabled/

# Copy silent stream to accessible location
cp /opt/radio/silent-stream.mp3 /data/media/silent-stream.mp3

# Update docker-compose.yml paths
# (configs already point to /mnt/ramdisk/configs)

# Restart containers
cd /mnt/ramdisk
docker-compose down
docker-compose up -d
```

**Result:** Containers draaien, logs streamen naar CloudWatch

---

### **STAP 2: Tune Configs on System (HANDMATIG)**

**Locaties:**
```
/opt/radio/radio.liq              → Liquidsoap config
/etc/icecast2/icecast.xml         → Icecast config
/etc/nginx/sites-available/splashfm → Nginx config
/mnt/ramdisk/configs/*            → Docker mounted configs (sync!)
```

**Workflow:**
1. Edit config op system level
2. Test met `systemctl restart service` OF `docker-compose restart`
3. Verify werkt (CloudWatch logs, health checks)
4. Commit working version
5. Sync naar /mnt/ramdisk/configs/ als je Docker gebruikt

**Tuning Checklist:**
- [ ] Liquidsoap: Silent fallback werkt
- [ ] Liquidsoap: SQS queue polling werkt
- [ ] Liquidsoap: IoT metadata publishing werkt
- [ ] Icecast: Ultra-low latency settings
- [ ] Nginx: Proxy + CORS headers correct
- [ ] All: CloudWatch logging verbose mode

---

### **STAP 3: Configs → Parameter Store (NA TUNING)**

**Script:** `scripts/upload-configs-to-parameter-store.sh`
```bash
#!/bin/bash
ENV="development"

# Upload Liquidsoap config
aws ssm put-parameter \
  --name "/g-forge-radio/$ENV/liquidsoap/config" \
  --type "String" \
  --value "$(cat /opt/radio/radio.liq)" \
  --overwrite \
  --region eu-west-1

# Upload Icecast config
aws ssm put-parameter \
  --name "/g-forge-radio/$ENV/icecast/config" \
  --type "String" \
  --value "$(cat /etc/icecast2/icecast.xml)" \
  --overwrite \
  --region eu-west-1

# Upload Nginx config
aws ssm put-parameter \
  --name "/g-forge-radio/$ENV/nginx/config" \
  --type "String" \
  --value "$(cat /etc/nginx/sites-available/splashfm)" \
  --overwrite \
  --region eu-west-1

echo "✅ Configs uploaded to Parameter Store!"
```

---

### **STAP 4: CodeDeploy Lifecycle Hooks Update**

**File:** `appspec.yml`
```yaml
version: 0.0
os: linux
files:
  - source: /
    destination: /opt/g-forge

hooks:
  BeforeInstall:
    - location: scripts/deploy/pull-configs-from-parameter-store.sh
      timeout: 300
      runas: root
    - location: scripts/deploy/install-dependencies.sh
      timeout: 600
      runas: root
      
  ApplicationStart:
    - location: scripts/deploy/inject-configs-to-docker.sh
      timeout: 300
      runas: root
    - location: scripts/deploy/start-docker-containers.sh
      timeout: 180
      runas: root
      
  ValidateService:
    - location: scripts/deploy/validate-deployment.sh
      timeout: 300
      runas: root
```

**New Script:** `scripts/deploy/pull-configs-from-parameter-store.sh`
```bash
#!/bin/bash
set -e

ENV="development"
REGION="eu-west-1"
CONFIG_DIR="/mnt/ramdisk/configs"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 PULLING CONFIGS FROM PARAMETER STORE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create config directories
mkdir -p $CONFIG_DIR/{liquidsoap,icecast,nginx/sites-enabled}

# Pull Liquidsoap config
echo "Pulling Liquidsoap config..."
aws ssm get-parameter \
  --name "/g-forge-radio/$ENV/liquidsoap/config" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text > $CONFIG_DIR/liquidsoap/radio.liq

# Pull Icecast config
echo "Pulling Icecast config..."
aws ssm get-parameter \
  --name "/g-forge-radio/$ENV/icecast/config" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text > $CONFIG_DIR/icecast/icecast.xml

# Pull Nginx config
echo "Pulling Nginx config..."
aws ssm get-parameter \
  --name "/g-forge-radio/$ENV/nginx/config" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text > $CONFIG_DIR/nginx/sites-enabled/splashfm

# Set permissions
chmod 644 $CONFIG_DIR/liquidsoap/radio.liq
chmod 644 $CONFIG_DIR/icecast/icecast.xml
chmod 644 $CONFIG_DIR/nginx/sites-enabled/splashfm

echo "✅ Configs pulled and ready for Docker!"
```

**New Script:** `scripts/deploy/inject-configs-to-docker.sh`
```bash
#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 INJECTING CONFIGS INTO DOCKER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Update docker-compose.yml with latest version
cp /opt/g-forge/docker/docker-compose-simple.yml /mnt/ramdisk/docker-compose.yml

# Verify config files exist
if [ ! -f /mnt/ramdisk/configs/liquidsoap/radio.liq ]; then
  echo "❌ Liquidsoap config missing!"
  exit 1
fi

if [ ! -f /mnt/ramdisk/configs/icecast/icecast.xml ]; then
  echo "❌ Icecast config missing!"
  exit 1
fi

echo "✅ Configs ready for container mounting!"
```

---

## 🔄 **DEPLOYMENT FLOW (Complete):**

```
Developer → git push development
     ↓
GitHub → Webhook
     ↓
./deploy_streamserver (local)
     ↓
CodeDeploy Deployment
     ↓
┌─────────────────────────────────────────────────────────┐
│ EC2 Instance: i-0924372740ff587ca                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ BeforeInstall:                                          │
│ ✓ Pull configs from Parameter Store                    │
│ ✓ Create /mnt/ramdisk/configs/*                       │
│ ✓ Install dependencies                                 │
│                                                         │
│ Install:                                                │
│ ✓ Copy application files to /opt/g-forge              │
│                                                         │
│ ApplicationStart:                                       │
│ ✓ Inject configs to Docker                            │
│ ✓ Stop old containers                                  │
│ ✓ Start new containers (docker-compose up -d)         │
│                                                         │
│ ValidateService:                                        │
│ ✓ Check containers running                            │
│ ✓ Verify CloudWatch logs streaming                    │
│ ✓ Health check endpoints                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
     ↓
Post-Deployment Verification (verify-deployment.sh)
     ↓
✅ Deployment Success!
```

---

## 📊 **WAT WE NU UITROLLEN:**

### **Phase 1 (IMMEDIATE - Deze week):**
```
✅ Fix ramdisk container setup
✅ Get containers running with CloudWatch logging
✅ Tune configs on system level
✅ Document working configurations
```

### **Phase 2 (NEXT - Volgende week):**
```
⏳ Upload tuned configs to Parameter Store
⏳ Update CodeDeploy lifecycle hooks
⏳ Test deployment with config injection
⏳ Verify containers restart with fresh configs
```

### **Phase 3 (FUTURE - Later):**
```
⏳ Setup monitoring alarms + dashboard
⏳ Cost budget + SNS notifications
⏳ Auto-scaling (if needed)
⏳ Blue/green deployments
```

---

## 🎯 **ACTIONABLE NEXT STEPS:**

### **NU (Vanavond):**
1. Create `scripts/setup-ramdisk-configs.sh`
2. Run op EC2: Populate /mnt/ramdisk/configs/
3. Restart containers: `docker-compose up -d`
4. Verify: CloudWatch logs streaming
5. Check: `bash scripts/verify-deployment.sh`

### **Morgen:**
1. Tune Liquidsoap config (silent fallback, SQS polling)
2. Tune Icecast config (verify ultra-low latency settings)
3. Tune Nginx config (verify CORS + proxy settings)
4. Test alles werkt end-to-end

### **Deze Week:**
1. Document working configs
2. Upload to Parameter Store
3. Create CodeDeploy lifecycle hook scripts
4. Test deployment with config injection
5. Deploy monitoring alarms

---

## 💡 **KEY INSIGHTS:**

### **Config Management Strategy:**
```
System Level (NU):
  /opt/radio/radio.liq → Direct editing + testing
  /etc/icecast2/icecast.xml → Direct editing + testing
  /etc/nginx/sites-available/splashfm → Direct editing + testing
  
  ↓ When working ↓
  
Parameter Store (LATER):
  /g-forge-radio/development/liquidsoap/config
  /g-forge-radio/development/icecast/config
  /g-forge-radio/development/nginx/config
  
  ↓ On deployment ↓
  
Docker Containers (AUTOMATIC):
  /mnt/ramdisk/configs/liquidsoap/radio.liq (pulled from PS)
  /mnt/ramdisk/configs/icecast/icecast.xml (pulled from PS)
  /mnt/ramdisk/configs/nginx/sites-enabled/splashfm (pulled from PS)
```

### **Benefits:**
- ✅ Tune configs without redeployment
- ✅ Version control via Parameter Store
- ✅ Fresh configs bij elke deployment
- ✅ Environment-specific configs (dev/staging/prod)
- ✅ No hardcoded configs in code repository
- ✅ Easy rollback (deploy old parameter version)

---

**Status:** 📋 READY TO IMPLEMENT  
**Next Action:** Create `setup-ramdisk-configs.sh` and fix containers  
**Priority:** HIGH - Fix containers first, tune configs second, automate third
