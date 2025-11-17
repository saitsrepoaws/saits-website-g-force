# 🍾 CI/CD PIPELINE MASTERPLAN - CHAMPAGNE EDITION

**Date:** 17 November 2025, 00:55 CET  
**Status:** 🎯 PLANNING PHASE  
**Goal:** Complete AWS CodePipeline van local git → branch-based EC2 deployment in VPC

---

## 🎯 GERARD'S VISION

> "oke vanaf nu wil ik een pijpline hebben die een codepijp line maat vanuit mijn locale git repo een artifact bouwwd dan de code build indien nodig en dan een stateless artifact heeft die hij makkelijk kan uitrollen in code deployment op basis van git branch name net als de sandboxen dat nu ook doen een sanox draaien op basis van een branche snap jij dezze nog wel slimmer show hour super super mega pwoer over deze heel goed nadeken over ene plan de campnag en dan champange !!"

**Translation:**
1. **Local Git** → Push naar repo
2. **CodePipeline** → Detecteert push
3. **Artifact** → Stateless, immutable build
4. **CodeDeploy** → Deploy naar EC2
5. **Branch-Based** → Elke branch = eigen environment
6. **VPC** → Waar de rest staat (bestaande VPC!)
7. **Complete Setup** → Alles wat op kale AMI staat
8. **SMART** → Nog slimmer dan de huidige sandbox setup!

---

## 🏗️ HUIDIGE SITUATIE (AS-IS)

### ✅ **Sandbox System (Amplify)**
**Location:** `pipeline/docs/COMMIT_BASED_SUBDOMAINS.md`

**How it works:**
```
Git Commit (28a3670)
  ↓
Amplify Sandbox: commit-28a3670
  ↓
Route53: 28a3670.splashfm.nl
  ↓
SSL + CloudFront + Lambda@Edge
```

**Features:**
- ✅ Automatic commit-based deployment
- ✅ Route53 subdomain creation
- ✅ SSL certificates (ACM)
- ✅ Cleanup scripts
- ✅ Cost: ~$0.01/month

**Problem:** Dit is voor **frontend/backend (Amplify)**. Gerard wil dit voor **EC2 stream servers**!

---

### ✅ **EC2 Stream Server (Manual)**
**Location:** EC2 `i-054754fbca0bda346` (54.171.0.54)

**Current Software:**
```bash
# Installed:
Liquidsoap 2.0.2 (moet naar 2.4.0)
Icecast2 2.4.4
Nginx
Docker 29.0+
AWS CLI
ffmpeg, sox
SSM Agent
Security tools (rkhunter, chkrootkit, fail2ban)
```

**Problem:** Handmatig ge managed, geen CI/CD!

---

## 🚀 TARGET ARCHITECTURE (TO-BE)

### **Complete Flow:**

```
LOCAL → GitHub → CodePipeline → Artifact → CodeDeploy → EC2 (Branch-based)
```

**Details per stage:**

#### **1. Source (GitHub)**
```
Branch: feature/xyz
Push → GitHub webhook → CodePipeline trigger
```

#### **2. Build (CodeBuild)**
```
Input: Source code
Process:
  - Extract branch name
  - Package configs (Liquidsoap, Nginx, systemd)
  - Create deployment scripts
  - Build ZIP artifact
Output: radio-stream-feature-xyz-28a3670.zip
Upload: S3 bucket
```

#### **3. Deploy (CodeDeploy)**
```
Input: Artifact from S3
Target: EC2 tagged with Branch=feature-xyz
Process:
  - Stop old services
  - Install new configs
  - Start services
  - Healthcheck
Output: Running stream at feature-xyz.radio.splashfm.nl
```

---

## 📦 KEY COMPONENTS

### **1. Custom AMI**

**Purpose:** Pre-baked base image met alle dependencies

**Contents:**
- Ubuntu 22.04 LTS
- Docker + Liquidsoap 2.4.0 image
- Icecast, Nginx, ffmpeg, sox
- AWS CLI, SSM Agent
- CodeDeploy agent
- Security tools

**Build:** `pipeline/ami/build-base-ami.sh`

---

### **2. Artifact Structure**

```
radio-stream-{branch}-{commit}.zip
├── appspec.yml                    # CodeDeploy config
├── configs/
│   ├── radio.liq                  # Liquidsoap config
│   ├── nginx-radio.conf           # Nginx config
│   └── liquidsoap.service         # Systemd service
├── scripts/
│   ├── stop-services.sh
│   ├── install-artifact.sh
│   ├── start-services.sh
│   └── healthcheck.sh
└── metadata.json                  # Branch, commit info
```

---

### **3. Branch-Based Deployment**

**Strategy:** One EC2 instance per active branch

**Examples:**
```
Branch: main              → main.radio.splashfm.nl
Branch: develop           → develop.radio.splashfm.nl
Branch: feature/new-ui    → new-ui.radio.splashfm.nl
```

**EC2 Tagging:**
```yaml
Tags:
  - Key: Branch
    Value: feature/new-ui
  - Key: Application
    Value: radio-stream
  - Key: ManagedBy
    Value: CodePipeline
```

---

## 🔧 IMPLEMENTATION PHASES

### **Phase 1: Custom AMI (3 days)**
1. Create base AMI build script
2. Install all dependencies
3. Add CodeDeploy agent
4. Test AMI launch
5. **Deliverable:** AMI ID + build script

### **Phase 2: Artifact Build (3 days)**
1. Create CodeBuild buildspec
2. Package configs and scripts
3. Generate appspec.yml
4. Upload to S3
5. **Deliverable:** Working artifact creation

### **Phase 3: CodeDeploy (4 days)**
1. Setup CodeDeploy application
2. Create deployment groups
3. Write deployment hooks
4. Test deployment
5. **Deliverable:** Working deployment

### **Phase 4: Pipeline Integration (3 days)**
1. Create CodePipeline
2. Connect Source → Build → Deploy
3. Add branch filters
4. Test end-to-end
5. **Deliverable:** Working pipeline

### **Phase 5: Branch-Based Auto (5 days)**
1. Auto Scaling Group per branch
2. Route53 auto-creation
3. Cleanup on branch delete
4. Test multi-branch
5. **Deliverable:** Full automation

### **Phase 6: Testing & Champagne (4 days)**
1. E2E testing
2. Documentation
3. Monitoring setup
4. **CHAMPAGNE!** 🍾

**Total Time:** ~3-4 weeks

---

## 💰 COST ESTIMATE

### **Monthly Costs:**

```
CodePipeline:     $1.00
CodeBuild:        $0.75 (250 build minutes)
S3 Artifacts:     $0.03
EC2 (main):       $15.00 (t3.small)
CloudWatch:       $2.50
─────────────────────────
TOTAL (1 branch): $19.28/month

With 2 branches:  $34.28/month
With 3 branches:  $49.28/month
```

**Optimization:** Stop feature branches when not in use → ~$25-30/month

---

## 🍾 CHAMPAGNE CRITERIA

**We pop champagne when:**

1. ✅ Push to branch
2. ✅ Pipeline triggers auto
3. ✅ Artifact builds
4. ✅ EC2 launches
5. ✅ Stream plays
6. ✅ ONE BUTTON DEPLOY!

---

## 🎯 NEXT STEPS

### **Today:**
1. Review plan met Gerard
2. Get approval
3. Start Phase 1

### **This Week:**
1. Build custom AMI
2. Create artifact structure
3. Test manual deployment

---

## 📚 RELATED DOCS

See detailed specs in:
- `CICD_PIPELINE_ARCHITECTURE.md` - Technical architecture
- `CICD_PIPELINE_IMPLEMENTATION.md` - Implementation details
- `AMI_BUILD_GUIDE.md` - AMI creation
- `ARTIFACT_SPEC.md` - Artifact structure

---

**Made with 💎 by Gerard & Cascade**

**Let's build this! MEGA POWER! 🚀🍾**
