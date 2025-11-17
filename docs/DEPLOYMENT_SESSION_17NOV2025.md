# 🚀 Deployment Session - 17 November 2025

**Tijd:** 22:40 - 22:50 CET  
**Status:** Infrastructure Updated, Pending New EC2 Deployment

---

## ✅ **WAT IS GEDAAN:**

### **1. Disk Space Issue Opgelost**

**Probleem:**
- Root disk: 6.8GB (95% vol, 405MB vrij)
- Deployment artifact: 161MB
- Error: "The disk is (or was) full during extraction"

**Oplossing:**
```typescript
// amplify/backend/stream-server/index.ts
blockDevices: [{
  deviceName: '/dev/sda1',
  volume: ec2.BlockDeviceVolume.ebs(20, {
    volumeType: ec2.EbsDeviceVolumeType.GP3,
    deleteOnTermination: true
  })
}]
```

**Resultaat:**
- Root disk: 8GB → 20GB (GP3)
- Samen met 20GB data volume = 40GB totaal
- Voldoende ruimte voor deployments

### **2. Oude EC2 Instance Terminated**

```
Instance ID: i-0924372740ff587ca
Status: shutting-down → terminated ✅
```

### **3. Code Gecommit & Gepushed**

```bash
Commit: 94d5549
Message: "fix: 💾 Increase EC2 root volume to 20GB (was 8GB)"
Branch: development
Status: Pushed ✅
```

### **4. Deployment Geprobeerd**

```
Deployment ID: d-AZ0I9SBYF
Artifact: g-forge-radio-development-94d5549-20251117-224800.zip
Size: 160MB
Status: Failed (instance niet meer beschikbaar) ✅ Expected
```

---

## 📋 **DEPLOYMENT FLOW (COMPLETE):**

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: INFRASTRUCTURE (PENDING)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Deploy via Amplify Sandbox:                                │
│   npx ampx sandbox                                         │
│                                                             │
│ Dit creëert:                                               │
│ ✓ Nieuwe EC2 instance (t3.small)                          │
│ ✓ Root volume: 20GB (GP3)                                  │
│ ✓ Data volume: 20GB (EBS)                                  │
│ ✓ Security Groups (SSH, HTTP, 8000)                        │
│ ✓ IAM Role met CloudWatch permissions                      │
│ ✓ CodeDeploy Application & Deployment Group                │
│ ✓ Parameter Store met nieuwe instance ID                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: CODE DEPLOYMENT                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Deploy via CodeDeploy:                                     │
│   ./deploy_streamserver                                    │
│                                                             │
│ Dit deploy:                                                │
│ ✓ CloudWatch monitoring scripts                           │
│ ✓ Deployment verification script                          │
│ ✓ Ramdisk config setup script                             │
│ ✓ Parameter Store integration scripts                     │
│ ✓ Complete documentatie                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: POST-DEPLOYMENT VERIFICATION                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Verify:                                                    │
│   bash scripts/verify-deployment.sh                        │
│                                                             │
│ Dit checkt:                                                │
│ ✓ Deployment status                                       │
│ ✓ CloudWatch logs (pipeline + system)                     │
│ ✓ Services status                                         │
│ ✓ Container health                                        │
│ ✓ Error count                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 **CURRENT STATUS:**

```
✅ COMPLETED:
   - Old EC2 terminated
   - Root disk config updated (20GB)
   - Code committed & pushed
   - Deployment scripts ready
   - Documentation complete

⏳ PENDING:
   - New EC2 deployment (infrastructure)
   - Code deployment to new EC2
   - Post-deployment verification

🔴 BLOCKER:
   - Need to deploy infrastructure first
   - Then can deploy code
```

---

## 🚀 **NEXT STEPS:**

### **Option 1: Amplify Sandbox (RECOMMENDED)**

```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
npx ampx sandbox
```

**Wat gebeurt:**
1. CDK synthesizes CloudFormation template
2. Creates new EC2 with 20GB root disk
3. Configures all permissions & security
4. Updates Parameter Store
5. Ready for code deployment

**Daarna:**
```bash
./deploy_streamserver
bash scripts/verify-deployment.sh
```

### **Option 2: AWS Console (MANUAL)**

1. Go to CloudFormation Console
2. Find `amplify-gforgeiot-gerard-s-amplify-backend-streamServer` stack
3. Update stack with new parameters
4. Wait for completion (~10 min)
5. Run `./deploy_streamserver`

### **Option 3: Tomorrow Fresh Start**

Wacht tot morgen en deploy dan alles fresh:
1. `npx ampx sandbox` (infrastructure)
2. `./deploy_streamserver` (code)
3. `bash scripts/verify-deployment.sh` (check)

---

## 📊 **DEZE SESSIE - VOLLEDIG OVERZICHT:**

### **Achievements:**

#### **1. CloudWatch Monitoring Setup ✅**
- 8 log groups created
- CloudWatch Agent configured
- IAM permissions fixed
- Docker awslogs driver setup
- Real-time log streaming
- Metrics collection (CPU, Memory, Disk)

**Files Created:**
- `scripts/setup-cloudwatch-logging-simple.sh`
- `docs/CLOUDWATCH_SETUP_COMPLETE.md`
- `docs/IAM_CLOUDWATCH_POLICY_FIXED.json`
- `docs/DEPLOYMENT_STATUS_17NOV2025.md`

#### **2. Post-Deployment Verification ✅**
- Automated verification script
- CloudWatch log checking
- Error detection
- Service health checks
- Complete documentation

**Files Created:**
- `scripts/verify-deployment.sh`
- `docs/DEPLOYMENT_BEST_PRACTICES.md`

**Memory Created:**
- Post-Deployment Verification best practice

#### **3. EC2 Deployment Strategy ✅**
- 3-phase deployment plan
- Config management workflow
- Parameter Store integration
- CodeDeploy lifecycle hooks
- Complete automation scripts

**Files Created:**
- `docs/DEPLOYMENT_STRATEGY_EC2.md`
- `scripts/setup-ramdisk-configs.sh`
- `scripts/deploy/pull-configs-from-parameter-store.sh`
- `scripts/deploy/start-docker-containers.sh`

#### **4. Disk Space Issue Fixed ✅**
- Identified: 8GB root too small
- Solution: Increase to 20GB (GP3)
- Code updated in infrastructure
- Committed & pushed

**Files Modified:**
- `amplify/backend/stream-server/index.ts`

---

## 💾 **DISK CONFIGURATION:**

### **Before:**
```
Root (/)     : 6.8GB (95% full, 405MB free) ❌
Data (/data) : 20GB  (10% used, 17GB free)  ✅
Total        : ~27GB
```

### **After (New EC2):**
```
Root (/)     : 20GB  (will be ~30% used)    ✅
Data (/data) : 20GB  (10% used, 17GB free)  ✅
Total        : 40GB
```

**Benefits:**
- Deployments: 161MB artifact + extraction = safe
- System files: Plenty of room for logs, cache
- Docker images: No more "disk full" errors
- Future growth: Room for expansion

---

## 📈 **COSTS:**

### **Storage Costs (per month):**

**Before:**
```
Root: 8GB GP2  @ $0.10/GB = $0.80
Data: 20GB GP2 @ $0.10/GB = $2.00
Total: $2.80/month
```

**After:**
```
Root: 20GB GP3 @ $0.08/GB = $1.60
Data: 20GB GP2 @ $0.10/GB = $2.00
Total: $3.60/month
```

**Increase:** $0.80/month (+29%)

**Benefits:**
- GP3 is faster (3000 IOPS baseline vs 240 for GP2)
- No more deployment failures
- Better performance
- Room for growth

**Total Project Cost:**
```
EC2 t3.small:        $15/month
Storage (40GB):      $3.60/month
CloudWatch Logs:     $4-5/month
Other AWS:           $2-3/month
─────────────────────────────────
TOTAL:              ~$25-27/month ✅ Zeer betaalbaar!
```

---

## 🔧 **TECHNICAL CHANGES:**

### **1. Block Device Mapping:**
```typescript
// NEW in amplify/backend/stream-server/index.ts
blockDevices: [{
  deviceName: '/dev/sda1',
  volume: ec2.BlockDeviceVolume.ebs(20, {
    volumeType: ec2.EbsDeviceVolumeType.GP3,
    deleteOnTermination: true
  })
}]
```

### **2. IAM Permissions:**
```json
{
  "Sid": "CloudWatchLogsFullAccess",
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "arn:aws:logs:*:*:log-group:/g-forge-radio/*"
}
```

### **3. Docker Logging:**
```json
{
  "log-driver": "awslogs",
  "log-opts": {
    "awslogs-region": "eu-west-1",
    "awslogs-group": "/g-forge-radio/stream-server/docker"
  }
}
```

---

## 📚 **DOCUMENTATION CREATED:**

1. `docs/CLOUDWATCH_SETUP_COMPLETE.md`
2. `docs/CLOUDWATCH_MONITORING_SETUP.md`
3. `docs/DEPLOYMENT_STATUS_17NOV2025.md`
4. `docs/DEPLOYMENT_BEST_PRACTICES.md`
5. `docs/DEPLOYMENT_STRATEGY_EC2.md`
6. `docs/IAM_SETUP_INSTRUCTIONS.md`
7. `docs/IAM_CLOUDWATCH_POLICY_FIXED.json`
8. `docs/DEPLOYMENT_SESSION_17NOV2025.md` (this document)

---

## ✅ **DEPLOYMENT READY:**

**Infrastructure Code:**
- ✅ 20GB root disk configured
- ✅ CloudWatch permissions
- ✅ Security groups
- ✅ IAM roles

**Application Code:**
- ✅ Monitoring scripts
- ✅ Config management
- ✅ Verification tools
- ✅ Documentation

**Deployment Scripts:**
- ✅ Infrastructure: `npx ampx sandbox`
- ✅ Application: `./deploy_streamserver`
- ✅ Verification: `bash scripts/verify-deployment.sh`

---

## 🎯 **NEXT ACTION:**

```bash
# Deploy infrastructure (nieuwe EC2 met 20GB root):
npx ampx sandbox

# Wacht tot compleet (~10 min), dan:
./deploy_streamserver

# Verify:
bash scripts/verify-deployment.sh
```

---

**Status:** Ready for Infrastructure Deployment  
**Blocker:** Need new EC2 instance  
**Solution:** Run `npx ampx sandbox`  
**ETA:** ~15 minutes total (10 min infra + 5 min code)

Gerard, alles is klaar voor deployment! De code is geüpdatet met 20GB root disk, alle scripts zijn ready. We moeten alleen de infrastructure deployen (nieuwe EC2 maken) en dan de code deployen. 🚀
