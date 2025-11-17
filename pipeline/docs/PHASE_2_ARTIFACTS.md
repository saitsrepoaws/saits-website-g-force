# 📦 Phase 2: Artifact Structure

**Status:** ✅ COMPLETE  
**Date:** 17 November 2025, 09:57 CET

---

## 🎯 Gerard's Genius Insight

> "we kunnen vanaf nu toch alles met de codepiple line runnen zet die scrript gewoon in onze repo geen directe actie meer op de ec2"

**100% CORRECT!** No more manual EC2 work or complex AMI builds!

---

## 📋 Architecture

```
OLD WAY (Manual):
├── Build custom AMI
├── Install everything in AMI
├── Deploy AMI to EC2
└── Manual updates

NEW WAY (CodeDeploy):
├── Basic Ubuntu AMI
├── CodeDeploy gets repo
├── Runs install-dependencies.sh
└── Automated everything!
```

---

## 📦 Artifact Structure

```
g-forge-iot/
├── appspec.yml                      ← CodeDeploy configuration
├── buildspec-radio-server.yml       ← Build configuration
├── deployment-info.json             ← Build metadata (generated)
│
├── pipeline/
│   └── ami/
│       └── ami-setup.sh             ← Complete installation script
│
└── scripts/
    └── deploy/
        ├── stop-services.sh         ← ApplicationStop hook
        ├── backup-current.sh        ← BeforeInstall hook
        ├── install-dependencies.sh  ← BeforeInstall hook (NEW!)
        ├── set-permissions.sh       ← AfterInstall hook
        ├── update-configs.sh        ← AfterInstall hook
        ├── start-services.sh        ← ApplicationStart hook
        └── validate-deployment.sh   ← ValidateService hook
```

---

## 🔧 How It Works

### 1. CodeBuild Phase
```bash
# Build creates artifact with:
- Entire repo
- deployment-info.json
- All scripts executable
```

### 2. CodeDeploy Phase
```bash
ApplicationStop:
  → Stop running services

BeforeInstall:
  → Backup current files
  → Install ALL dependencies (ami-setup.sh)
    - Docker
    - Liquidsoap 2.4.0
    - Icecast2
    - Nginx
    - AWS CLI
    - SSM Agent
    - CodeDeploy Agent
    - CloudWatch Agent
    - Security tools
    - RAM disk
    - Optimizations

Install:
  → Copy files to /opt/g-forge-iot/

AfterInstall:
  → Set permissions
  → Update configs

ApplicationStart:
  → Start all services

ValidateService:
  → Verify deployment
  → Health checks
```

---

## 🎯 Key Features

### ✅ Complete Installation
- **One script does everything:** `ami-setup.sh`
- **Idempotent:** Safe to run multiple times
- **Logged:** Everything goes to `/var/log/ami-setup.log`

### ✅ No Manual AMI Build
- Use basic Ubuntu 24.04 AMI
- CodeDeploy installs everything
- No more AMI build failures!

### ✅ Version Controlled
- All scripts in repo
- Every change tracked
- Easy rollback

### ✅ Automated
- Push to repo → CodePipeline triggers
- CodeBuild creates artifact
- CodeDeploy deploys to EC2
- No manual intervention!

---

## 📝 appspec.yml

```yaml
version: 0.0
os: linux

files:
  - source: /
    destination: /opt/g-forge-iot/

hooks:
  ApplicationStop:
    - location: scripts/deploy/stop-services.sh
      timeout: 300
      runas: root
  
  BeforeInstall:
    - location: scripts/deploy/backup-current.sh
      timeout: 300
      runas: root
    - location: scripts/deploy/install-dependencies.sh
      timeout: 1800  # 30 minutes for complete install!
      runas: root
  
  AfterInstall:
    - location: scripts/deploy/set-permissions.sh
      timeout: 300
      runas: root
    - location: scripts/deploy/update-configs.sh
      timeout: 300
      runas: root
  
  ApplicationStart:
    - location: scripts/deploy/start-services.sh
      timeout: 300
      runas: root
  
  ValidateService:
    - location: scripts/deploy/validate-deployment.sh
      timeout: 600
      runas: root
```

---

## 🚀 Usage

### Local Testing
```bash
# Test install script
sudo bash pipeline/ami/ami-setup.sh

# Test deployment hooks
sudo bash scripts/deploy/stop-services.sh
sudo bash scripts/deploy/backup-current.sh
sudo bash scripts/deploy/install-dependencies.sh
sudo bash scripts/deploy/set-permissions.sh
sudo bash scripts/deploy/update-configs.sh
sudo bash scripts/deploy/start-services.sh
sudo bash scripts/deploy/validate-deployment.sh
```

### CodePipeline
```bash
# Push to trigger pipeline
git add .
git commit -m "Deploy radio server"
git push

# Pipeline automatically:
# 1. CodeBuild creates artifact
# 2. CodeDeploy deploys to EC2
# 3. Runs all hooks
# 4. Validates deployment
```

---

## 🎓 Benefits

### 🔒 Security
- No hardcoded credentials
- IAM roles for everything
- Proper file permissions

### 📊 Visibility
- Complete logs
- Deployment history
- Easy debugging

### ⚡ Speed
- Parallel deployments
- Incremental updates
- Fast rollbacks

### 💰 Cost
- No AMI storage costs
- Pay only for deployments
- Efficient resource use

---

## 🎯 Next Steps

**Phase 3: CodeDeploy Setup**
- Create CodeDeploy Application
- Create Deployment Group
- Configure EC2 instances
- Test deployment

**Phase 4: Pipeline Integration**
- Create CodePipeline
- Connect GitHub source
- Add CodeBuild stage
- Add CodeDeploy stage

**Phase 5: Branch-Based Deployment**
- main → production
- develop → staging
- feature/* → test

---

## 📚 References

- AWS CodeDeploy: https://docs.aws.amazon.com/codedeploy/
- AppSpec Reference: https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file.html
- Deployment Hooks: https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html

---

## ✅ Status

```
✅ appspec.yml configured
✅ install-dependencies.sh created
✅ buildspec-radio-server.yml created
✅ All deploy scripts executable
✅ Complete installation script ready
✅ Documentation complete

READY FOR PHASE 3! 🚀
```

---

**Gerard's Quote:** "geen directe actie meer op de ec2"

**Result:** Everything automated via CodeDeploy! 💎
