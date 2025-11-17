# 🚀 CI/CD Pipeline Setup - G-Forge IoT Radio

**Datum:** 16 November 2025, 02:30 CET  
**Status:** Ready for deployment  
**Gerard's Vision:** "Stabiel gaan, geen sorry, vooruit kijken naar top model product"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 CONCEPT: PER-BLOK TESTING

**Gerard's Briljante Idee:**
> "schrijf elk blok waar binnen aanpassingen vallen triggeren de testen dus er kunnen meerdere blokken testen gaan draaien"

**Hoe het werkt:**
1. Git push naar main branch
2. Pipeline detecteert welke BLOKs gewijzigd zijn
3. Draait tests ALLEEN voor gewijzigde BLOKs
4. Build & deploy als alle tests passed
5. Automatic rollback bij failures

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📦 COMPONENTS

### 1. AWS CodeBuild
**File:** `buildspec.yml`

**What it does:**
- Detects changed files
- Maps files to BLOKs:
  - `apps/web/` → BLOK PLAY
  - `amplify/functions/audio-metadata` → BLOK LIBERY
  - `amplify/functions/playlist-generator` → BLOK PLAYLIST
  - `amplify/functions/stream-playlist-updater` → BLOK PLANNER
  - `ec2-monitoring/` → BLOK EC2
  - `amplify/functions/crossfade` → BLOK STREAMING
- Runs tests for affected BLOKs only
- Builds frontend & backend
- Creates deployment package

**Duration:** 5-10 minutes (depending on BLOKs changed)

---

### 2. AWS CodeDeploy
**File:** `appspec.yml`

**What it does:**
- Deploys to EC2 instance
- Runs deployment hooks:
  1. `ApplicationStop` - Stop Nginx (keep stream alive!)
  2. `BeforeInstall` - Backup current deployment
  3. `AfterInstall` - Set permissions, update configs
  4. `ApplicationStart` - Start Nginx
  5. `ValidateService` - Run health checks
- Automatic rollback on failure

**Duration:** 2-5 minutes

---

### 3. AWS CodePipeline
**File:** `pipeline-config.yml`

**What it does:**
- Orchestrates entire CI/CD flow
- 5 stages:
  1. **Source** - Pull from GitHub
  2. **Build** - Run CodeBuild (tests + build)
  3. **Test** - Run per-BLOK tests
  4. **Approval** - Manual approval (optional)
  5. **Deploy** - Deploy via CodeDeploy
- S3 artifact storage
- CloudWatch logs

---

### 4. Deployment Scripts
**Location:** `scripts/deploy/`

All scripts are executable and idempotent:
- `stop-services.sh` - Graceful service stop
- `backup-current.sh` - Backup before deploy
- `set-permissions.sh` - Fix file permissions
- `update-configs.sh` - Update environment
- `start-services.sh` - Start services
- `validate-deployment.sh` - Health checks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔄 WORKFLOW

### Complete Flow:
```
1. Developer pushes to main
   ↓
2. GitHub webhook triggers CodePipeline
   ↓
3. CodeBuild starts:
   ├─ Detect changed files
   ├─ Map to BLOKs
   ├─ Run tests for affected BLOKs
   ├─ Build frontend (Vite)
   ├─ Build backend (Amplify)
   └─ Create artifact
   ↓
4. Manual Approval (optional)
   ↓
5. CodeDeploy deploys to EC2:
   ├─ Stop Nginx
   ├─ Backup current version
   ├─ Copy new files
   ├─ Set permissions
   ├─ Update configs
   ├─ Start Nginx
   └─ Validate deployment
   ↓
6. Success or Rollback
```

### Example: BLOK PLAY Change
```
Files changed:
- apps/web/src/components/Player.tsx

Pipeline:
✅ Detected: BLOK PLAY changed
✅ Run smoke tests (12 tests)
✅ Run regression tests (48 tests)
✅ Tests passed: 45/50 (90%)
✅ Build frontend
✅ Deploy to EC2
✅ Validation passed
✅ DEPLOYED!
```

### Example: Multiple BLOKs Changed
```
Files changed:
- apps/web/src/components/Player.tsx (BLOK PLAY)
- amplify/functions/playlist-generator/handler.ts (BLOK PLAYLIST)

Pipeline:
✅ Detected: BLOK PLAY + BLOK PLAYLIST changed
✅ Run BLOK PLAY tests (60 tests)
⚠️  BLOK PLAYLIST tests: No automated tests yet
✅ Build both components
✅ Deploy to EC2
✅ DEPLOYED!
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 BLOK TO FILE MAPPING

### BLOK PLAY (Player Frontend)
**Triggers on:**
- `apps/web/**` (any web app changes)
- `tests/smoke/player*` (test changes)
- `tests/regression/player*` (test changes)

**Tests:** 60 automated (12 smoke + 48 regression)

---

### BLOK LIBERY (Track Library)
**Triggers on:**
- `amplify/data/**` (GraphQL schema)
- `amplify/storage/**` (S3 config)
- `amplify/functions/audio-metadata/**` (metadata extraction)
- `amplify/functions/waveform-generator/**` (waveform gen)
- `amplify/functions/audio-analyzer/**` (BPM/Key detection)

**Tests:** 0 automated (manual testing required)

---

### BLOK PLAYLIST (Playlist Management)
**Triggers on:**
- `amplify/functions/playlist-generator/**`
- `amplify/functions/track-queue-manager/**`
- `amplify/functions/genre-merger/**`

**Tests:** 0 automated (TODO)

---

### BLOK PLANNER (Radio Scheduler)
**Triggers on:**
- `amplify/functions/stream-playlist-updater/**`
- `amplify/functions/radio-scheduler/**`

**Tests:** 0 automated (TODO)

---

### BLOK EC2 (Stream Server)
**Triggers on:**
- `ec2-monitoring/**` (monitoring scripts)
- `scripts/**` (deployment/management scripts)

**Tests:** 0 automated (TODO)

---

### BLOK STREAMING (Audio Processing)
**Triggers on:**
- `amplify/functions/crossfade-controller/**`
- Files with "liquidsoap" in path

**Tests:** 0 automated (TODO)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚀 SETUP INSTRUCTIONS

### Step 1: AWS Console Setup

#### 1.1 Create S3 Bucket
```bash
aws s3 mb s3://g-forge-radio-pipeline-035636364722 --region eu-west-1
aws s3api put-bucket-versioning \
  --bucket g-forge-radio-pipeline-035636364722 \
  --versioning-configuration Status=Enabled \
  --region eu-west-1
```

#### 1.2 Create CodeBuild Project
```bash
# Via AWS Console:
# Services → CodeBuild → Create project
# Name: g-forge-radio-build
# Source: GitHub (connect to repo)
# Environment: Ubuntu Standard 7.0
# Buildspec: Use buildspec.yml from source
# Artifacts: Amazon S3 (use bucket from 1.1)
```

#### 1.3 Create CodeDeploy Application
```bash
# Via AWS Console:
# Services → CodeDeploy → Create application
# Application name: g-forge-radio
# Compute platform: EC2/On-premises
# 
# Create Deployment Group:
# Name: production
# Service role: (create with AWSCodeDeployRole policy)
# EC2 instances: Tag - Project=g-forge-radio
# Deployment config: OneAtATime
# Enable auto-rollback
```

#### 1.4 Create CodePipeline
```bash
# Via AWS Console:
# Services → CodePipeline → Create pipeline
# Pipeline name: g-forge-radio-pipeline
# Source: GitHub (select repo & branch)
# Build: AWS CodeBuild (select project from 1.2)
# Deploy: AWS CodeDeploy (select app from 1.3)
```

---

### Step 2: EC2 Setup

#### 2.1 Install CodeDeploy Agent
```bash
ssh ec2-user@79.125.44.178

# Install agent
sudo yum install ruby wget -y
cd /home/ec2-user
wget https://aws-codedeploy-eu-west-1.s3.eu-west-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto

# Start agent
sudo service codedeploy-agent start
sudo service codedeploy-agent status
```

#### 2.2 Tag EC2 Instance
```bash
aws ec2 create-tags \
  --resources i-044ea4a949c8f562a \
  --tags Key=Project,Value=g-forge-radio \
  --region eu-west-1
```

#### 2.3 Update IAM Role
```bash
# Add policy to EC2 IAM role:
# - AmazonS3ReadOnlyAccess (to read deployment artifacts)
# - CloudWatchAgentServerPolicy (for logs)
```

---

### Step 3: GitHub Setup

#### 3.1 Add Webhook
```bash
# GitHub Settings → Webhooks → Add webhook
# Payload URL: (from CodePipeline webhook)
# Content type: application/json
# Events: Push events
```

#### 3.2 Add Secrets
```bash
# GitHub repo Settings → Secrets → Actions
# Add: AWS_ACCESS_KEY_ID
# Add: AWS_SECRET_ACCESS_KEY
# Add: AWS_REGION=eu-west-1
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🧪 TESTING

### Manual Test
```bash
# Trigger pipeline manually:
aws codepipeline start-pipeline-execution \
  --name g-forge-radio-pipeline \
  --region eu-west-1
```

### Monitor Pipeline
```bash
# Watch pipeline:
aws codepipeline get-pipeline-state \
  --name g-forge-radio-pipeline \
  --region eu-west-1
```

### Check Logs
```bash
# CodeBuild logs:
# AWS Console → CodeBuild → Build history → View logs

# CodeDeploy logs on EC2:
ssh ec2-user@79.125.44.178
tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔧 TROUBLESHOOTING

### Build Fails
```bash
# Check buildspec.yml syntax
# Check test results
# Check dependencies (pnpm install)
# Review CloudWatch logs
```

### Deploy Fails
```bash
# Check appspec.yml syntax
# Check scripts are executable (chmod +x)
# Check EC2 CodeDeploy agent is running
# Check IAM permissions
# Review /var/log/aws/codedeploy-agent/
```

### Tests Fail
```bash
# Run tests locally first:
npx vitest run tests/smoke/player.smoke.test.ts
npx vitest run tests/regression/player.regression.test.ts

# Fix issues
# Commit & push
# Pipeline will re-run
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 BENEFITS

### Zero-Downtime Deployment
✅ Nginx stops/starts gracefully  
✅ Icecast & Liquidsoap keep running  
✅ Stream never drops  
✅ Automatic rollback on failure

### Per-BLOK Testing
✅ Only test what changed  
✅ Faster CI/CD (skip unchanged BLOKs)  
✅ Clear feedback which BLOK failed  
✅ Easy to add tests for new BLOKs

### Automated Everything
✅ Push to main → auto deploy  
✅ No manual steps  
✅ Consistent deployments  
✅ Audit trail (CloudWatch logs)

### Professional Standard
✅ Industry best practices  
✅ Automatic rollback  
✅ Health checks  
✅ Backups before deploy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📈 NEXT STEPS

### Phase 1: Setup (Week 1)
- [ ] Create AWS resources (CodeBuild, CodeDeploy, Pipeline)
- [ ] Install CodeDeploy agent on EC2
- [ ] Connect GitHub webhook
- [ ] Test manual deployment

### Phase 2: Testing (Week 2)
- [ ] Add tests for BLOK LIBERY
- [ ] Add tests for BLOK PLAYLIST
- [ ] Add tests for BLOK PLANNER
- [ ] Add tests for BLOK EC2
- [ ] Add tests for BLOK STREAMING

### Phase 3: Optimization (Week 3)
- [ ] Add automated rollback triggers
- [ ] Add Slack/Email notifications
- [ ] Add deployment approval gates
- [ ] Add canary deployments
- [ ] Add blue/green deployments

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📚 FILES CREATED

```
g-forge-iot/
├── buildspec.yml              # CodeBuild configuration
├── appspec.yml                # CodeDeploy configuration
├── pipeline-config.yml        # CodePipeline CloudFormation template
└── scripts/
    └── deploy/
        ├── stop-services.sh       # Stop Nginx gracefully
        ├── backup-current.sh      # Backup before deploy
        ├── set-permissions.sh     # Fix file permissions
        ├── update-configs.sh      # Update environment
        ├── start-services.sh      # Start services
        └── validate-deployment.sh # Health checks
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚀 GERARD'S VISION REALIZED

> "Stabiel gaan, geen sorry, vooruit kijken naar top model product"

**This CI/CD pipeline delivers:**
✅ **Stabiel:** Automatic tests, rollback, zero-downtime  
✅ **Geen sorry:** We learn from failures, improve, move forward  
✅ **Vooruit kijken:** Professional standard, scalable, maintainable  
✅ **Top model product:** Industry best practices, fully automated

**We bouwen samen het perfecte platform! 🚀**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Documentation:** ref/CICD_PIPELINE_SETUP.md  
**Status:** Ready for deployment  
**Created:** 16 November 2025, 02:30 CET
