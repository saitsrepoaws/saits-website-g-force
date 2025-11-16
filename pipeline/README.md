# 🚀 G-FORCE Radio - Standalone CI/CD Pipeline

**Modulaire, pluggbare CI/CD pipeline los van Amplify**

---

## 📁 Folder Structure

```
pipeline/
├── configs/           # Pipeline configuratie files
│   ├── buildspec.yml  # CodeBuild build specification
│   ├── amplify.yml    # Amplify Hosting configuration
│   └── appspec.yml    # CodeDeploy specification
├── scripts/           # Setup en deployment scripts
│   ├── setup-pipeline.sh         # Pipeline installatie
│   ├── deploy-pipeline.sh        # Manual deployment
│   └── cleanup-pipeline.sh       # Pipeline verwijderen
├── templates/         # Infrastructure as Code
│   ├── codepipeline.yml          # CloudFormation template
│   └── codepipeline-cdk.ts       # CDK template (alternative)
├── docs/              # Documentatie
│   ├── SETUP.md                  # Setup instructies
│   ├── BLOK_STRATEGY.md          # BLOK testing strategie
│   └── TROUBLESHOOTING.md        # Troubleshooting guide
└── README.md          # This file
```

---

## 🎯 Features

### ✅ BLOK-Based Testing Strategy

**6 BLOKs (Bouw Logische Ontwikkel Klassen):**

1. **🎮 BLOK PLAY** - Player frontend
   - Path: `apps/web/`, `tests/smoke/player`, `tests/regression/player`
   - Tests: Smoke + Regression

2. **📚 BLOK LIBERY** - Track library & metadata
   - Path: `amplify/data/`, `amplify/storage/`, `amplify/functions/audio-metadata`
   - Tests: TBD

3. **📋 BLOK PLAYLIST** - Playlist management
   - Path: `amplify/functions/playlist-generator`, `amplify/functions/genre-merger`
   - Tests: TBD

4. **📅 BLOK PLANNER** - Scheduler & automation
   - Path: `amplify/functions/stream-playlist-updater`, `amplify/functions/radio-scheduler`
   - Tests: TBD

5. **🖥️ BLOK EC2** - Stream server configuration
   - Path: `ec2-monitoring/`, `scripts/`
   - Tests: TBD

6. **📡 BLOK STREAMING** - Audio processing
   - Path: `amplify/functions/crossfade`, `liquidsoap`
   - Tests: TBD

### ✅ Smart Change Detection

- Git diff analysis bepaalt welke BLOKs gewijzigd zijn
- Alleen affected BLOKs worden getest
- Snellere build times

### ✅ Multi-Stage Pipeline

```
┌─────────────┐
│   Source    │  Git push → Trigger
└──────┬──────┘
       │
┌──────▼──────┐
│    Test     │  BLOK-based testing
└──────┬──────┘
       │
┌──────▼──────┐
│    Build    │  Frontend + Backend
└──────┬──────┘
       │
┌──────▼──────┐
│   Deploy    │  Amplify deployment
└─────────────┘
```

---

## 🚀 Deployment Options

### Option A: AWS CodePipeline + CodeBuild

**Pros:**
- ✅ Full AWS native
- ✅ Tight integration
- ✅ Advanced features (approvals, parallel stages)

**Setup:**
```bash
./scripts/setup-pipeline.sh --type codepipeline
```

### Option B: Amplify Hosting

**Pros:**
- ✅ Easiest setup
- ✅ Auto CI/CD
- ✅ Built-in previews

**Setup:**
```bash
./scripts/setup-pipeline.sh --type amplify
```

### Option C: GitHub Actions (Coming Soon)

**Pros:**
- ✅ Git-native
- ✅ Free tier
- ✅ Marketplace integrations

---

## 📋 Prerequisites

- AWS CLI configured
- Git repository (GitHub, CodeCommit, etc.)
- Node.js 18+ and pnpm
- AWS account with permissions for:
  - CodePipeline
  - CodeBuild
  - S3
  - CloudFormation
  - IAM

---

## 🛠️ Quick Start

### 1. Setup Pipeline (First Time)

```bash
cd pipeline
./scripts/setup-pipeline.sh
```

Dit script:
- Vraagt welk type pipeline (CodePipeline / Amplify)
- Configureert Git remote (als nog niet gedaan)
- Deployt CloudFormation/CDK stack
- Configureert webhooks
- Test de pipeline

### 2. Manual Deploy (Anytime)

```bash
./scripts/deploy-pipeline.sh
```

### 3. Cleanup (Als je wilt verwijderen)

```bash
./scripts/cleanup-pipeline.sh
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` in `pipeline/` folder:

```env
# AWS Configuration
AWS_REGION=eu-west-1
AWS_ACCOUNT_ID=035636364722

# Git Configuration
GIT_REPO_URL=https://github.com/your-org/g-forge-iot
GIT_BRANCH=main

# Amplify Configuration (if using Amplify Hosting)
AMPLIFY_APP_ID=your-app-id

# Pipeline Configuration
PIPELINE_NAME=g-forge-radio-pipeline
BUILD_COMPUTE_TYPE=BUILD_GENERAL1_SMALL
```

---

## 📊 Monitoring

### CodePipeline Dashboard

```bash
# View pipeline status
aws codepipeline get-pipeline-state \
  --name g-forge-radio-pipeline \
  --region eu-west-1
```

### Build Logs

```bash
# View latest build logs
aws codebuild batch-get-builds \
  --ids $(aws codebuild list-builds-for-project \
    --project-name g-forge-radio-build \
    --query 'ids[0]' --output text) \
  --region eu-west-1
```

---

## 🧪 Testing Locally

Test buildspec.yml locally met CodeBuild Local:

```bash
# Install CodeBuild Local
docker pull public.ecr.aws/codebuild/local-builds:latest

# Run build locally
./scripts/test-build-locally.sh
```

---

## 💰 Cost Estimate

**CodePipeline + CodeBuild:**
- CodePipeline: $1/month per active pipeline
- CodeBuild: $0.005/min (BUILD_GENERAL1_SMALL)
- Avg build time: 5 min
- Builds per day: 10
- **Total: ~$8/month**

**Amplify Hosting:**
- Build minutes: $0.01/min
- Hosting: Free tier (15 GB)
- **Total: ~$3/month**

---

## 🔐 Security

- Pipeline heeft minimale IAM permissions (principle of least privilege)
- Secrets opgeslagen in AWS Secrets Manager (niet in code!)
- Build artifacts encrypted in S3
- All communication via HTTPS

---

## 📚 Documentation

- [Setup Guide](docs/SETUP.md) - Detailed setup instructies
- [BLOK Strategy](docs/BLOK_STRATEGY.md) - Testing strategie uitleg
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues & fixes

---

## 🎯 Roadmap

- [ ] GitHub Actions template
- [ ] GitLab CI template
- [ ] Slack/Discord notifications
- [ ] Automated rollback
- [ ] Blue/Green deployment
- [ ] Canary releases

---

## 👨‍💻 Maintainer

**Gerard** - Master of G-FORCE Radio  
Pipeline ontworpen met 🧠 en 💪

---

**Status:** 🚧 Ready for setup - wachten op clean slate deployment
