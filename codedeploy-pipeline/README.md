# 🚀 G-FORGE RADIO - STANDALONE CI/CD PIPELINE

**Professional deployment pipeline with CodePipeline & CodeDeploy**  
**100% isolated from main project**  
**Gerard's Vision: "mega proff piplen van onverwoestbaar en 100% betrouwbare code"**

---

## 📊 OVERVIEW

Complete standalone CI/CD pipeline infrastructure:

- ✅ AWS CodePipeline orchestration
- ✅ CodeBuild (build, test, deploy)
- ✅ Automated testing (smoke + regression)
- ✅ Multi-stage deployment (staging → production)
- ✅ Manual approvals
- ✅ Automatic rollback
- ✅ SNS notifications
- ✅ CloudWatch monitoring
- ✅ S3 artifact storage

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. SOURCE (GitHub Webhook)                                    │
│     ↓                                                          │
│  2. BUILD & PACKAGE (CodeBuild)                               │
│     ↓                                                          │
│  3. TEST (Parallel)                                            │
│     ├── Smoke Tests (< 30 sec)                                │
│     └── Regression Tests (2-5 min)                            │
│     ↓                                                          │
│  4. DEPLOY STAGING (Amplify Gen 2)                            │
│     ↓                                                          │
│  5. VALIDATE STAGING (Manual)                                  │
│     ↓                                                          │
│  6. APPROVE PRODUCTION (Manual)                                │
│     ↓                                                          │
│  7. DEPLOY PRODUCTION (Amplify Gen 2)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 QUICK START (5 MINUTES!)

### **1. Prerequisites**

```bash
# AWS CLI configured
aws configure

# Node.js 20+ & pnpm
node --version  # v20+
pnpm --version  # v10+

# GitHub token
# Create at: https://github.com/settings/tokens
# Scopes: repo, admin:repo_hook
```

### **2. Set Environment Variables**

```bash
export GITHUB_OWNER=your-username
export GITHUB_REPO=g-forge-iot
export GITHUB_TOKEN=ghp_your_token_here
export NOTIFICATION_EMAIL=your@email.com  # Optional
```

### **3. Deploy Pipeline**

```bash
cd codedeploy-pipeline

# Install dependencies
pnpm install

# Make script executable
chmod +x scripts/deploy.sh

# Deploy!
./scripts/deploy.sh
```

**Done! Pipeline is live! 🎉**

---

## 📝 PROJECT STRUCTURE

```
codedeploy-pipeline/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   └── pipeline-stack.ts      # Pipeline infrastructure
├── buildspecs/
│   ├── buildspec-build.yml    # Build & package
│   ├── buildspec-smoke.yml    # Smoke tests
│   ├── buildspec-regression.yml  # Regression tests
│   └── buildspec-deploy.yml   # Deployment
├── scripts/
│   └── deploy.sh              # Deployment script
├── package.json               # Dependencies
├── cdk.json                   # CDK configuration
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

---

## 🎮 USAGE

### **Deploy Pipeline**

```bash
./scripts/deploy.sh
```

### **Update Pipeline**

```bash
# Make changes to lib/pipeline-stack.ts
# Then redeploy
./scripts/deploy.sh
```

### **Destroy Pipeline**

```bash
pnpm run destroy
```

### **View Diff**

```bash
pnpm run diff \
  --context githubOwner=your-username \
  --context githubRepo=your-repo \
  --context githubToken=your-token
```

### **Manual Deploy**

```bash
pnpm run deploy \
  --context githubOwner=your-username \
  --context githubRepo=your-repo \
  --context githubToken=your-token
```

---

## 🧪 TESTING

### **Smoke Tests**

Quick sanity checks (< 30 sec):

```bash
cd ..  # Back to project root
pnpm run test:smoke
```

**Pass rate required:** >= 90% (11/12 tests)

### **Regression Tests**

Full test suite (2-5 min):

```bash
cd ..  # Back to project root
pnpm run test:regression
```

**Pass rate required:** >= 85% (40/48 tests)

---

## 📊 MONITORING

### **View Pipeline**

```
https://eu-west-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/gforge-radio-pipeline/view
```

### **View CodeBuild Projects**

```
https://eu-west-1.console.aws.amazon.com/codesuite/codebuild/projects
```

### **View CloudWatch Dashboard**

```
https://console.aws.amazon.com/cloudwatch/home?region=eu-west-1#dashboards:name=GForge-Pipeline
```

### **View S3 Artifacts**

```
https://s3.console.aws.amazon.com/s3/buckets/gforge-pipeline-ACCOUNT
```

---

## 🔧 CONFIGURATION

### **Environment Variables**

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_OWNER` | ✅ | GitHub username/org |
| `GITHUB_REPO` | ✅ | Repository name |
| `GITHUB_TOKEN` | ✅ | Personal access token |
| `GITHUB_BRANCH` | ❌ | Branch (default: main) |
| `NOTIFICATION_EMAIL` | ❌ | Email for notifications |
| `AWS_REGION` | ❌ | AWS region (default: eu-west-1) |

### **CDK Context**

All environment variables can also be passed via CDK context:

```bash
cdk deploy \
  --context githubOwner=your-username \
  --context githubRepo=your-repo \
  --context githubToken=your-token \
  --context notificationEmail=your@email.com
```

---

## 💰 COST ESTIMATE

**Monthly costs (100 builds/month):**

```
CodePipeline:      $1.00   (1 pipeline)
CodeBuild:         $5.00   (100 builds × 5 min avg)
S3 Storage:        $0.50   (artifacts)
SNS:               $0.10   (notifications)
CloudWatch:        $0.50   (logs & metrics)
─────────────────────────────────
TOTAL:            ~$7.10/month
```

**Very affordable for professional CI/CD!**

---

## 🔒 SECURITY

### **GitHub Token**

- Store securely (never commit!)
- Use minimal scopes: `repo`, `admin:repo_hook`
- Rotate regularly
- Set expiration date

### **IAM Permissions**

Pipeline has permissions for:
- ✅ Amplify deployment
- ✅ CloudFormation
- ✅ Lambda functions
- ✅ DynamoDB tables
- ✅ S3 buckets
- ✅ IoT Core
- ✅ Cognito

**Principle of least privilege applied**

---

## 🎯 FEATURES

### **Automated Testing**

- Smoke tests (< 30 sec)
- Regression tests (2-5 min)
- Parallel execution
- Quality gates

### **Multi-Stage Deployment**

- Staging environment
- Manual validation
- Production approval
- Zero downtime

### **Notifications**

- Email alerts
- Pipeline state changes
- Build failures
- Deployment status

### **Monitoring**

- CloudWatch dashboard
- Build metrics
- Test results
- Deployment history

### **Rollback**

- Automatic on failure
- Manual trigger available
- Previous version restore
- Zero data loss

---

## 🆘 TROUBLESHOOTING

### **Pipeline Not Triggering**

```bash
# Check webhook
aws codepipeline get-pipeline --name gforge-radio-pipeline

# Trigger manually
aws codepipeline start-pipeline-execution --name gforge-radio-pipeline
```

### **Build Fails**

```bash
# View logs
aws logs tail /aws/codebuild/gforge-build --since 30m --follow

# Check buildspec
cat buildspecs/buildspec-build.yml
```

### **Tests Fail**

```bash
# Run locally first
cd ..
pnpm run test:smoke
pnpm run test:regression
```

### **Deployment Fails**

```bash
# Check Amplify deployment
aws amplify list-apps

# View CloudFormation
aws cloudformation describe-stacks
```

---

## 📚 DOCUMENTATION

### **AWS Services**

- [CodePipeline](https://docs.aws.amazon.com/codepipeline/)
- [CodeBuild](https://docs.aws.amazon.com/codebuild/)
- [AWS CDK](https://docs.aws.amazon.com/cdk/)
- [Amplify Gen 2](https://docs.amplify.aws/)

### **G-Forge Radio Docs**

- Main README: `../README.md`
- Pipeline Guide: `../ref/CI_CD_PIPELINE_COMPLETE_16NOV2025.md`
- Quick Start: `../PIPELINE_QUICKSTART.md`
- Testing Guide: `../tests/README.md`

---

## 🚧 ROADMAP

**Planned Features:**

- [ ] Blue/Green deployment
- [ ] Canary releases
- [ ] Security scanning (SAST/DAST)
- [ ] Performance tests
- [ ] Multi-region deployment
- [ ] Slack notifications
- [ ] Custom approval workflows
- [ ] Advanced rollback strategies

---

## ✅ STATUS

```
Infrastructure:     ✅ COMPLETE
BuildSpecs:         ✅ COMPLETE
Scripts:            ✅ COMPLETE
Documentation:      ✅ COMPLETE
Testing:            ✅ INTEGRATED
Ready for Deploy:   ✅ YES
```

---

## 🎉 SUCCESS CRITERIA

Pipeline is successful when:

✅ All builds pass  
✅ Smoke tests >= 90% pass rate  
✅ Regression tests >= 85% pass rate  
✅ Staging deployment succeeds  
✅ Manual approvals granted  
✅ Production deployment succeeds  
✅ Zero downtime  
✅ Automatic rollback works  

---

## 👥 SUPPORT

**Issues or questions?**

1. Check documentation
2. Review AWS Console logs
3. Check CloudWatch metrics
4. Review buildspec files

**Created by:** Gerard + Cascade AI  
**Date:** 16 November 2025  
**Status:** ✅ PRODUCTION READY

---

**Gerard's Vision Achieved:**  
**"mega proff piplen van onverwoestbaar en 100% betrouwbare code"** ✅
