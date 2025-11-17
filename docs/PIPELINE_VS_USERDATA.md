# 🚀 Pipeline vs UserData - G-Forge Best Practice

**Datum:** 17 November 2025  
**Auteur:** Gerard  
**Principe:** "ALLES VIA DE PIPELINE!"

---

## 🎯 **WAAROM PIPELINE > USERDATA**

### **UserData Nadelen ❌**

1. **Niet Versionable**
   - UserData is onderdeel van EC2 launch config
   - Changes vereisen nieuwe EC2 instances
   - Geen Git history

2. **Niet Testable**
   - Kan pas testen na EC2 launch
   - Failures zijn pas zichtbaar na 5-10 minuten
   - Debugging is moeilijk

3. **Geen Rollback**
   - Bij failure moet je nieuwe instance launchen
   - Geen automated rollback mogelijk
   - Downtime tijdens fixes

4. **Geen Visibility**
   - Logs alleen in CloudWatch via cloud-init
   - Geen central deployment dashboard
   - Moeilijk te troubleshooten

5. **Slow Feedback Loop**
   - EC2 launch + UserData = 5-10 min
   - Bij failure: terminate + relaunch = 10-20 min
   - Development is traag

### **Pipeline Voordelen ✅**

1. **Version Control**
   ```
   scripts/deploy/*.sh → Git versioned
   appspec.yml → Git versioned
   Elke change is traceable
   ```

2. **Fast Iteration**
   ```
   Code change → git push → deploy → 3-5 min
   Bij failure → rollback → 2 min
   Development is snel
   ```

3. **Automated Rollback**
   ```
   Deployment fails → CodeDeploy rollback
   Automatic → geen manual intervention
   Zero downtime
   ```

4. **Complete Visibility**
   ```
   CodeDeploy console → all deployment steps
   CloudWatch logs → per lifecycle hook
   Easy debugging
   ```

5. **Testable**
   ```
   Scripts lokaal testbaar
   Staging environment testing
   Confidence in production deploy
   ```

---

## 📋 **G-FORGE DEPLOYMENT STRATEGIE**

### **UserData (MINIMAL)**

```typescript
// amplify/backend/stream-server/index.ts
userData.addCommands(
  '#!/bin/bash',
  'set -e',
  '',
  '# Update system',
  'apt-get update',
  'apt-get install -y awscli',
  '',
  '# Install CodeDeploy Agent',
  'wget https://aws-codedeploy-eu-west-1.s3.eu-west-1.amazonaws.com/latest/install',
  'chmod +x ./install',
  './install auto',
  '',
  '# Start CodeDeploy Agent',
  'service codedeploy-agent start',
  '',
  '# DONE - Everything else via CodeDeploy Pipeline!'
)
```

**UserData doel:** 
- ✅ System updates
- ✅ CodeDeploy Agent install
- ❌ GEEN applicatie setup
- ❌ GEEN configuratie

### **Pipeline (EVERYTHING ELSE)**

```yaml
# appspec.yml
hooks:
  BeforeInstall:
    - setup-ramdisk.sh           # RAM disk mount
    - pull-configs-from-parameter-store.sh  # Configs
    - install-dependencies.sh    # System packages
    
  ApplicationStart:
    - start-docker-containers.sh # Docker setup
    - start-services.sh          # System services
    
  ValidateService:
    - validate-deployment.sh     # Health checks
```

**Pipeline doel:**
- ✅ RAM disk setup
- ✅ Config management
- ✅ Docker containers
- ✅ Application services
- ✅ Validation

---

## 🔄 **DEPLOYMENT FLOW**

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: EC2 LAUNCH (UserData - 5 min)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Ubuntu 22.04 launch                                     │
│ 2. apt-get update                                          │
│ 3. Install AWS CLI                                         │
│ 4. Install CodeDeploy Agent                                │
│ 5. Start CodeDeploy Agent                                  │
│ 6. DONE ✅                                                 │
│                                                             │
│ Result: Clean EC2 ready for deployment                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: CODE DEPLOYMENT (Pipeline - 3-5 min)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ BeforeInstall:                                             │
│ ├─ Backup current deployment                               │
│ ├─ Setup RAM disk (3GB tmpfs)                              │
│ ├─ Pull configs from Parameter Store                       │
│ └─ Install dependencies (docker, nginx, etc)               │
│                                                             │
│ Install:                                                    │
│ └─ Copy files to /opt/g-forge-iot                          │
│                                                             │
│ AfterInstall:                                              │
│ ├─ Set permissions                                         │
│ └─ Update configurations                                    │
│                                                             │
│ ApplicationStart:                                          │
│ ├─ Start Docker containers                                 │
│ └─ Start system services                                   │
│                                                             │
│ ValidateService:                                           │
│ └─ Health checks + CloudWatch verification                 │
│                                                             │
│ Result: Fully configured application ✅                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 **BELANGRIJKSTE VOORDELEN**

### **1. Separation of Concerns**

```
UserData = Infrastructure Setup (1x)
Pipeline = Application Deployment (many x)
```

Elke EC2 instance is identiek → deployment bepaalt configuratie

### **2. Blue/Green Deployments**

```
Old instance = Current version
New deployment = Test on same instance
Success → Keep
Failure → Rollback to previous
```

### **3. Incremental Updates**

```
Config change → git push → deploy
No EC2 relaunch needed
3-5 minutes deploy time
```

### **4. Environment Parity**

```
Development → scripts/deploy/*.sh
Staging → scripts/deploy/*.sh
Production → scripts/deploy/*.sh

Same scripts = same behavior = confidence
```

---

## 📊 **COMPARISON TABLE**

| Aspect | UserData | Pipeline |
|--------|----------|----------|
| **Version Control** | ❌ No | ✅ Git |
| **Rollback** | ❌ Manual | ✅ Automatic |
| **Testing** | ❌ Production only | ✅ Staging + Prod |
| **Visibility** | ⚠️ CloudWatch only | ✅ CodeDeploy Dashboard |
| **Deploy Time** | ❌ 10-15 min | ✅ 3-5 min |
| **Debugging** | ❌ Difficult | ✅ Easy |
| **Incremental Updates** | ❌ New instance | ✅ Same instance |
| **Blue/Green** | ❌ No | ✅ Yes |
| **Cost** | 💰 New instance each time | 💰 Reuse instances |

---

## 🎯 **G-FORGE PRINCIPLES**

### **1. Infrastructure as Code**
```
Everything in Git
Everything versionable
Everything reviewable
```

### **2. Fast Iteration**
```
Change → Test → Deploy → Verify
In minutes, not hours
```

### **3. Zero Downtime**
```
Blue/Green deployments
Automatic rollback
Health checks
```

### **4. Observability**
```
Every step logged
Every metric tracked
Every error visible
```

### **5. Developer Experience**
```
Simple workflows
Clear feedback
Easy debugging
```

---

## 🚀 **DEPLOYMENT SCRIPTS**

### **Pipeline Scripts (Version Controlled)**

```
scripts/deploy/
├── backup-current.sh              # Backup before deploy
├── setup-ramdisk.sh               # RAM disk mount
├── pull-configs-from-parameter-store.sh  # Config management
├── install-dependencies.sh        # System packages
├── set-permissions.sh             # File permissions
├── update-configs.sh              # Config updates
├── start-docker-containers.sh     # Docker setup
├── start-services.sh              # System services
├── validate-deployment.sh         # Health checks
└── stop-services.sh               # Graceful stop
```

### **Execution Order (appspec.yml)**

```yaml
1. ApplicationStop:  stop-services.sh
2. BeforeInstall:    backup + ramdisk + configs + deps
3. Install:          Copy files
4. AfterInstall:     Permissions + config updates
5. ApplicationStart: Docker + services
6. ValidateService:  Health checks
```

---

## 📝 **BEST PRACTICES**

### **DO ✅**

1. **Keep UserData minimal**
   - Only infrastructure essentials
   - Only things that don't change

2. **Put everything in Pipeline**
   - Application code
   - Configurations
   - Docker containers
   - Services

3. **Use Parameter Store**
   - Configs in Parameter Store
   - Secrets in Secrets Manager
   - Pull during deployment

4. **Version everything**
   - Scripts in Git
   - Configs in Parameter Store (versioned)
   - Track all changes

5. **Test before production**
   - Staging environment
   - Automated tests
   - Manual verification

### **DON'T ❌**

1. **Don't put application logic in UserData**
   - Slow to iterate
   - Hard to debug
   - Not versionable

2. **Don't hardcode configs**
   - Use Parameter Store
   - Environment-specific
   - Easy to update

3. **Don't skip validation**
   - Always validate deployment
   - Check health
   - Monitor CloudWatch

4. **Don't ignore errors**
   - Automatic rollback on failure
   - Alert on issues
   - Fix root cause

---

## 🎓 **LESSONS LEARNED**

### **17 November 2025 - Disk Full Issue**

**Problem:**
- Deployment failed: "Disk full"
- Root disk: 8GB (95% full)

**Old Approach (UserData):**
```
1. Identify issue
2. Terminate instance
3. Update UserData (increase disk)
4. Launch new instance
5. Wait 10 minutes
6. Test deployment
Total: 20-30 minutes
```

**New Approach (Pipeline):**
```
1. Identify issue
2. Update infrastructure code
3. Deploy new instance (5 min)
4. Deploy via pipeline (3 min)
5. Verify
Total: 10 minutes
```

**Result:** 
- ✅ 2x faster recovery
- ✅ All changes in Git
- ✅ Reproducible
- ✅ Testable

---

## 🔮 **FUTURE IMPROVEMENTS**

1. **Automated Testing**
   ```
   Deploy to staging → Run tests → Deploy to prod
   ```

2. **Canary Deployments**
   ```
   Deploy to 10% → Monitor → Deploy to 100%
   ```

3. **Feature Flags**
   ```
   Deploy code → Enable feature → Gradual rollout
   ```

4. **Monitoring Integration**
   ```
   Deployment → Auto-scale → Auto-heal
   ```

---

## ✅ **CONCLUSIE**

### **Gerard's Principe:**

> "ALLES VIA DE PIPELINE!"

**Waarom?**
- ✅ **Sneller:** 3-5 min vs 10-20 min
- ✅ **Veiliger:** Automatic rollback
- ✅ **Beter:** Version control + testing
- ✅ **Duidelijker:** Complete visibility
- ✅ **Goedkoper:** Reuse instances

**UserData = Infrastructure (minimal)**  
**Pipeline = Application (everything)**

**Result:**  
Professional, production-ready deployment system! 🚀

---

**Status:** ✅ IMPLEMENTED  
**Best Practice:** ✅ DOCUMENTED  
**Next:** Deploy via pipeline and verify!
