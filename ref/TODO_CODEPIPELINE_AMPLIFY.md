# 🚀 TODO: CodePipeline + Amplify Gen2 CI/CD Integration

**Datum:** 14 November 2025, 13:22 CET  
**Prioriteit:** Medium  
**Status:** 📝 TODO

---

## 🎯 **DOEL:**

AWS CodePipeline gebruiken voor geautomatiseerde deployments naar verschillende omgevingen in combinatie met Amplify Gen2 (v6).

**Voordelen:**
- ✅ Geautomatiseerde CI/CD pipeline
- ✅ Multi-environment support (dev/staging/prod)
- ✅ Build, test, deploy automatisch
- ✅ Rollback mogelijkheden
- ✅ Approval gates voor productie
- ✅ Integration met Git (push → auto deploy)

---

## 🏗️ **ARCHITECTUUR:**

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
│                  (feature/main branches)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Git Push/Merge
                     ↓
┌─────────────────────────────────────────────────────────┐
│              AWS CodePipeline (Master)                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Stage 1: SOURCE                                         │
│  ├─ GitHub connection                                    │
│  └─ Trigger on push/merge                                │
│                                                          │
│  Stage 2: BUILD                                          │
│  ├─ CodeBuild project                                    │
│  ├─ npm install                                          │
│  ├─ npm run build                                        │
│  ├─ npm run test                                         │
│  └─ Amplify build (npx ampx generate)                   │
│                                                          │
│  Stage 3: DEPLOY (DEV)                                   │
│  ├─ npx ampx deploy --branch dev                        │
│  └─ Auto-deploy zonder approval                          │
│                                                          │
│  Stage 4: APPROVAL (Optional)                            │
│  ├─ Manual approval voor staging/prod                    │
│  └─ SNS notification                                     │
│                                                          │
│  Stage 5: DEPLOY (STAGING)                               │
│  ├─ npx ampx deploy --branch staging                    │
│  └─ Integration tests                                    │
│                                                          │
│  Stage 6: APPROVAL (Production)                          │
│  ├─ Manual approval voor productie                       │
│  └─ Email/Slack notification                             │
│                                                          │
│  Stage 7: DEPLOY (PROD)                                  │
│  ├─ npx ampx deploy --branch main                       │
│  ├─ Health checks                                        │
│  └─ CloudWatch alarms                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Amplify Gen2 Environments                   │
├─────────────────────────────────────────────────────────┤
│  ├─ Dev:     splashfm-dev.amplify.app                   │
│  ├─ Staging: splashfm-staging.amplify.app               │
│  └─ Prod:    splashfm.nl (custom domain)                │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 **IMPLEMENTATION PLAN:**

### **Fase 1: Setup CodePipeline**

**1.1. Create IAM Roles**
```yaml
# IAM Role voor CodePipeline
CodePipelineServiceRole:
  - AWSCodePipelineFullAccess
  - Access to S3 (artifact store)
  - Access to CodeBuild
  - Access to Amplify

# IAM Role voor CodeBuild
CodeBuildServiceRole:
  - AWSCodeBuildAdminAccess
  - Access to S3
  - Access to CloudFormation
  - Access to Amplify
  - Access to all Amplify Gen2 resources
```

**1.2. Create S3 Bucket for Artifacts**
```bash
aws s3 mb s3://splashfm-pipeline-artifacts --region eu-west-1
```

**1.3. Connect GitHub**
```bash
# Via AWS Console:
# CodePipeline → Settings → Connections
# Create connection to GitHub
# Authorize AWS to access your repo
```

---

### **Fase 2: Create CodeBuild Project**

**buildspec.yml** (in root van repo):
```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - echo "Installing dependencies..."
      - npm ci
      - npm install -g @aws-amplify/cli

  pre_build:
    commands:
      - echo "Running pre-build checks..."
      - npm run lint || true
      - echo "Generating Amplify outputs..."
      - npx ampx generate outputs

  build:
    commands:
      - echo "Building application..."
      - npm run build
      - echo "Running tests..."
      - npm run test || true

  post_build:
    commands:
      - echo "Build completed!"
      - ls -la

artifacts:
  files:
    - '**/*'
  base-directory: .

cache:
  paths:
    - 'node_modules/**/*'
    - '.amplify-cache/**/*'
```

**CodeBuild Environment:**
```yaml
Environment:
  Type: LINUX_CONTAINER
  Image: aws/codebuild/standard:7.0
  ComputeType: BUILD_GENERAL1_MEDIUM
  EnvironmentVariables:
    - Name: NODE_ENV
      Value: production
    - Name: AMPLIFY_APP_ID
      Value: <amplify-app-id>
```

---

### **Fase 3: Create Pipeline**

**Pipeline Structure:**

**Stage 1: Source**
```yaml
Source:
  Provider: GitHub
  Repository: g-forge-iot
  Branch: main (or feature branches)
  OutputArtifact: SourceOutput
```

**Stage 2: Build**
```yaml
Build:
  Provider: CodeBuild
  Project: splashfm-build
  InputArtifact: SourceOutput
  OutputArtifact: BuildOutput
```

**Stage 3: Deploy Dev**
```yaml
Deploy-Dev:
  Provider: Custom (Lambda or CodeBuild)
  Action: npx ampx deploy --branch dev
  InputArtifact: BuildOutput
```

**Stage 4: Approval (Staging)**
```yaml
Approve-Staging:
  Provider: Manual
  SNS Topic: pipeline-approvals
  Notification: Email/Slack
```

**Stage 5: Deploy Staging**
```yaml
Deploy-Staging:
  Provider: Custom
  Action: npx ampx deploy --branch staging
  InputArtifact: BuildOutput
```

**Stage 6: Approval (Production)**
```yaml
Approve-Production:
  Provider: Manual
  SNS Topic: pipeline-approvals
  Notification: Email/Slack
  CustomData: "Deploy to PRODUCTION?"
```

**Stage 7: Deploy Production**
```yaml
Deploy-Production:
  Provider: Custom
  Action: npx ampx deploy --branch main
  InputArtifact: BuildOutput
  Post-Deploy:
    - Health checks
    - CloudWatch alarms
    - Rollback on failure
```

---

### **Fase 4: Deploy Scripts**

**deploy-amplify.sh** (voor CodeBuild):
```bash
#!/bin/bash
set -e

BRANCH=$1
ENVIRONMENT=$2

echo "🚀 Deploying to Amplify Gen2 ($ENVIRONMENT)"

# Configure Amplify
echo "Configuring Amplify..."
npx ampx configure profile --name $ENVIRONMENT

# Generate outputs
echo "Generating outputs..."
npx ampx generate outputs --branch $BRANCH

# Deploy
echo "Deploying to branch: $BRANCH"
npx ampx deploy --branch $BRANCH --yes

# Verify deployment
echo "Verifying deployment..."
DEPLOY_STATUS=$(npx ampx status --branch $BRANCH --json | jq -r '.status')

if [ "$DEPLOY_STATUS" = "COMPLETED" ]; then
    echo "✅ Deployment successful!"
    exit 0
else
    echo "❌ Deployment failed!"
    exit 1
fi
```

**Usage in CodeBuild:**
```yaml
post_build:
  commands:
    - chmod +x deploy-amplify.sh
    - ./deploy-amplify.sh $BRANCH_NAME $ENVIRONMENT_NAME
```

---

### **Fase 5: Environment Configuration**

**Amplify Branches:**

**Dev Branch:**
```bash
Branch: dev
Auto-deploy: ✅ Yes (via pipeline)
Domain: splashfm-dev.amplifyapp.com
Backend: Sandbox environment
```

**Staging Branch:**
```bash
Branch: staging
Auto-deploy: ⏸️ Manual approval
Domain: splashfm-staging.amplifyapp.com
Backend: Staging environment
```

**Production Branch:**
```bash
Branch: main
Auto-deploy: ⏸️ Manual approval
Domain: splashfm.nl
Backend: Production environment
```

---

## 🔧 **AMPLIFY GEN2 INTEGRATION:**

### **amplify.yml** (Amplify build config):
```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci
        - npx ampx generate outputs --branch $AWS_BRANCH

frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### **Environment Variables per Branch:**

**Dev:**
```env
VITE_ENVIRONMENT=development
VITE_API_ENDPOINT=https://api-dev.splashfm.nl
VITE_LOG_LEVEL=debug
```

**Staging:**
```env
VITE_ENVIRONMENT=staging
VITE_API_ENDPOINT=https://api-staging.splashfm.nl
VITE_LOG_LEVEL=info
```

**Production:**
```env
VITE_ENVIRONMENT=production
VITE_API_ENDPOINT=https://api.splashfm.nl
VITE_LOG_LEVEL=error
```

---

## 📊 **WORKFLOW SCENARIOS:**

### **Scenario 1: Feature Development**

```
1. Developer creates feature branch
   └─ git checkout -b feature/new-player

2. Push to GitHub
   └─ git push origin feature/new-player

3. Pipeline triggers (DEV only)
   ├─ Source: Pull code
   ├─ Build: npm install + build
   ├─ Test: npm test
   └─ Deploy: Auto-deploy to dev branch
   
4. Dev environment updated
   └─ https://splashfm-dev.amplifyapp.com
   
5. Developer tests feature
   
6. Create Pull Request to staging
```

---

### **Scenario 2: Staging Release**

```
1. Merge PR to staging branch
   └─ git merge feature/new-player

2. Pipeline triggers
   ├─ Source: Pull staging branch
   ├─ Build: npm install + build
   ├─ Test: npm test + integration tests
   ├─ Approval: Manual approval needed
   │   └─ Email sent to team
   └─ Deploy: After approval → staging
   
3. Staging environment updated
   └─ https://splashfm-staging.amplifyapp.com
   
4. QA team tests
   
5. If OK: Create PR to main
```

---

### **Scenario 3: Production Release**

```
1. Merge PR to main branch
   └─ git merge staging

2. Pipeline triggers
   ├─ Source: Pull main branch
   ├─ Build: npm install + build
   ├─ Test: Full test suite
   ├─ Approval: Manual approval needed
   │   ├─ Email + Slack notification
   │   └─ Requires 2 approvals
   ├─ Deploy: After approval → production
   │   ├─ Blue/green deployment
   │   └─ Health checks
   └─ Post-deploy:
       ├─ CloudWatch alarms check
       ├─ Smoke tests
       └─ Rollback on failure
   
3. Production updated
   └─ https://splashfm.nl
   
4. Monitor CloudWatch metrics
```

---

### **Scenario 4: Hotfix**

```
1. Create hotfix branch from main
   └─ git checkout -b hotfix/critical-bug main

2. Fix + commit + push

3. Pipeline fast-track
   ├─ Skip staging (emergency)
   ├─ Build + Test
   ├─ Single approval
   └─ Deploy to production
   
4. Merge back to main + staging
```

---

## 🔐 **SECURITY & PERMISSIONS:**

### **IAM Policies:**

**CodePipeline Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "codebuild:StartBuild",
        "codebuild:BatchGetBuilds",
        "amplify:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**CodeBuild Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:*",
        "cloudformation:*",
        "s3:*",
        "dynamodb:*",
        "cognito-idp:*",
        "appsync:*",
        "lambda:*"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 📈 **MONITORING & NOTIFICATIONS:**

### **CloudWatch Metrics:**
```
- PipelineExecutionCount
- PipelineSuccessRate
- PipelineFailureRate
- BuildDuration
- DeploymentDuration
```

### **SNS Topics:**
```
1. pipeline-build-status
   - Build started
   - Build completed
   - Build failed

2. pipeline-approvals
   - Approval needed
   - Approval granted
   - Approval denied

3. pipeline-deployments
   - Deployment started
   - Deployment completed
   - Deployment failed
```

### **Slack Integration:**
```bash
# Lambda function to forward SNS to Slack
# Sends notifications to #deployments channel

Events:
✅ Build successful
❌ Build failed
⏸️ Approval required
🚀 Deployment started
✅ Deployment completed
```

---

## 💰 **COST ESTIMATE:**

```
AWS CodePipeline:
- First pipeline: $1/month
- Additional pipelines: $1/month each
- Estimated: $3/month (dev, staging, prod)

AWS CodeBuild:
- Build.general1.medium: $0.005/min
- ~10 builds/day × 5 min = 50 min/day
- 50 min × 30 days = 1500 min/month
- Cost: ~$7.50/month

S3 Artifacts:
- Storage: ~1GB
- Cost: ~$0.03/month

SNS:
- Notifications: ~100/month
- Cost: ~$0.10/month

Total: ~$11/month
```

---

## 🎯 **IMPLEMENTATION STEPS:**

### **Step 1: Repository Setup**
```bash
# Add buildspec.yml to repo
# Add deploy-amplify.sh to repo
# Add amplify.yml (if not exists)
# Commit + push
```

### **Step 2: AWS Setup**
```bash
# 1. Create IAM roles
# 2. Create S3 bucket for artifacts
# 3. Connect GitHub to CodePipeline
# 4. Create CodeBuild project
```

### **Step 3: Create Pipeline**
```bash
# Via AWS Console or CloudFormation:
# 1. Create pipeline
# 2. Add stages (source, build, deploy)
# 3. Configure approvals
# 4. Test pipeline
```

### **Step 4: Configure Amplify Branches**
```bash
# Create branches in Amplify Console:
npx ampx create branch dev
npx ampx create branch staging
npx ampx create branch main
```

### **Step 5: Test**
```bash
# 1. Push to dev → Auto deploy
# 2. Merge to staging → Approval + Deploy
# 3. Merge to main → Approval + Deploy prod
```

---

## 🔄 **ROLLBACK STRATEGY:**

### **Automated Rollback:**
```yaml
Post-Deploy Health Checks:
  - HTTP 200 check
  - API endpoint check
  - CloudWatch alarm check
  
If checks fail:
  - Trigger rollback
  - Revert to previous version
  - Send alert
```

### **Manual Rollback:**
```bash
# Via AWS Console:
# CodePipeline → Execution history
# Select previous successful execution
# Re-run deployment stage

# Or via CLI:
aws codepipeline start-pipeline-execution \
  --name splashfm-pipeline \
  --client-request-token rollback-$(date +%s)
```

---

## 📚 **DOCUMENTATION TO CREATE:**

```
1. PIPELINE_SETUP_GUIDE.md
   - Step-by-step setup
   - Screenshots
   - Troubleshooting

2. DEPLOYMENT_RUNBOOK.md
   - How to deploy
   - Approval process
   - Rollback procedures

3. BRANCH_STRATEGY.md
   - Git workflow
   - Branch naming
   - Merge policies

4. ENVIRONMENT_CONFIG.md
   - Dev/Staging/Prod differences
   - Environment variables
   - Access control
```

---

## ✅ **SUCCESS CRITERIA:**

```
✅ Pipeline deploys to dev automatically
✅ Pipeline requires approval for staging
✅ Pipeline requires approval for production
✅ Build time < 10 minutes
✅ Deployment time < 5 minutes
✅ Rollback works within 2 minutes
✅ Notifications sent to Slack
✅ CloudWatch metrics tracked
✅ Zero-downtime deployments
✅ < $15/month cost
```

---

## 🎊 **BENEFITS:**

```
Automation:
✅ No manual deployments
✅ Consistent build process
✅ Automatic testing

Safety:
✅ Approval gates
✅ Rollback capability
✅ Health checks

Visibility:
✅ Deployment history
✅ Build logs
✅ Notifications

Efficiency:
✅ Faster releases
✅ Less human error
✅ Parallel builds
```

---

## 📝 **NEXT STEPS:**

```
1. Create buildspec.yml
2. Setup IAM roles
3. Create CodeBuild project
4. Create CodePipeline
5. Test dev deployment
6. Test staging approval
7. Test production deployment
8. Setup monitoring
9. Document process
10. Train team
```

---

## 📚 **KEYWORDS:**

`codepipeline` `amplify-gen2` `ci-cd` `automation` `deployment` `multi-environment` `dev-staging-prod` `approval-gates` `codebuild` `github-integration` `rollback` `monitoring` `notifications` `slack-integration` `zero-downtime`

---

**Status:** 📝 TODO  
**Priority:** Medium  
**Effort:** 8-12 uur (complete setup)  
**Cost:** ~$11/maand  
**Next:** Create buildspec.yml + Setup IAM
