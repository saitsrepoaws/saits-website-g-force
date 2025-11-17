# 🚀 Deployment Best Practices - G-Forge Radio

**Laatst bijgewerkt:** 17 November 2025  
**Auteur:** Gerard's instructie

---

## ⚠️ **KRITIEKE REGEL:**

> **"Bij deployments ALTIJD na afloop de CloudWatch logs van de pipeline checken op errors!"**
> 
> — Gerard, 17 Nov 2025

---

## 📋 **POST-DEPLOYMENT VERIFICATION CHECKLIST**

### **Na ELKE Deployment:**

```bash
# 1. Run verification script
bash scripts/verify-deployment.sh [deployment-id]

# OF manueel:

# 2. Check deployment status
aws deploy get-deployment \
  --deployment-id d-XXXXXXXXX \
  --region eu-west-1

# 3. Check CloudWatch logs voor errors
aws logs tail /g-forge-radio/stream-server/deployment \
  --since 10m \
  --region eu-west-1

# 4. Search specifiek naar errors
aws logs filter-log-events \
  --log-group-name /g-forge-radio/stream-server/deployment \
  --filter-pattern "ERROR" \
  --since 10m \
  --region eu-west-1

# 5. Check system logs
aws logs tail /g-forge-radio/stream-server/system \
  --since 10m \
  --region eu-west-1

# 6. Check container logs (if applicable)
aws logs tail /g-forge-radio/stream-server/docker --since 10m --region eu-west-1
aws logs tail /g-forge-radio/stream-server/liquidsoap --since 10m --region eu-west-1
aws logs tail /g-forge-radio/stream-server/icecast --since 10m --region eu-west-1
aws logs tail /g-forge-radio/stream-server/nginx --since 10m --region eu-west-1
```

---

## 🔍 **WAAROM DIT BELANGRIJK IS:**

### **1. Silent Failures Detecteren**
```
Deployment Status: ✅ Success
Maar in CloudWatch logs: ❌ Runtime errors!

→ Zonder log check: Je denkt alles werkt
→ Met log check: Je detecteert issue meteen
```

### **2. Pipeline Errors Vinden**
```
CodeDeploy zegt: "Deployment succeeded"
Maar lifecycle hook failed: Services niet gestart

CloudWatch logs tonen:
- Script execution errors
- Permission denied errors
- Service start failures
- Configuration errors
```

### **3. Early Detection**
```
Problem gevonden:    5 minuten na deployment
vs
Problem ontdekt:     3 uur later door users
vs
Problem in prod:     Downtime + unhappy users

→ Early detection = Quick fix = Happy users!
```

---

## 📊 **VERIFICATION WORKFLOW**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. START DEPLOYMENT                                        │
│     └─> ./deploy_streamserver                              │
│                                                             │
│  2. WAIT FOR COMPLETION                                     │
│     └─> Monitor deployment status                          │
│                                                             │
│  3. ⭐ CHECK CLOUDWATCH LOGS ⭐                             │
│     ├─> Pipeline logs (/deployment)                        │
│     ├─> System logs (/system)                              │
│     ├─> Container logs (/docker, /liquidsoap, etc.)        │
│     └─> Search for: ERROR, FAILED, EXCEPTION               │
│                                                             │
│  4. VERIFY SERVICES                                         │
│     ├─> docker ps (containers running?)                    │
│     ├─> systemctl status (services active?)                │
│     └─> Health checks (endpoints responding?)              │
│                                                             │
│  5. REPORT STATUS                                           │
│     ├─> ✅ All green? → Deployment SUCCESS                 │
│     └─> ❌ Errors found? → Investigate + Fix               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ **AUTOMATED VERIFICATION SCRIPT**

### **Usage:**

```bash
# With deployment ID (recommended)
bash scripts/verify-deployment.sh d-XXXXXXXXX

# Without deployment ID (checks current state)
bash scripts/verify-deployment.sh
```

### **What it checks:**

1. ✅ **Deployment Status** (if deployment ID provided)
2. ✅ **EC2 Instance Health** (running? stopped? terminated?)
3. ✅ **CloudWatch Logs** (errors in all log groups)
4. ✅ **Services Status** (docker containers + systemd services)
5. ✅ **Summary Report** (pass/fail with error count)

### **Exit Codes:**

```bash
0  = Success (no errors found)
1  = Failure (deployment failed OR errors found in logs)
```

**Usage in CI/CD:**
```bash
./deploy_streamserver && \
bash scripts/verify-deployment.sh $DEPLOYMENT_ID || \
  echo "Deployment verification failed! Check logs!"
```

---

## 📋 **LOG GROUPS TO CHECK**

### **Priority Order:**

1. **🔴 HIGH PRIORITY (Always check)**
   ```
   /g-forge-radio/stream-server/deployment   → Pipeline errors
   /g-forge-radio/stream-server/system       → System crashes
   ```

2. **🟡 MEDIUM PRIORITY (Check if deployment touches containers)**
   ```
   /g-forge-radio/stream-server/docker       → Container lifecycle
   /g-forge-radio/stream-server/liquidsoap   → Stream errors
   /g-forge-radio/stream-server/icecast      → Server errors
   /g-forge-radio/stream-server/nginx        → Proxy errors
   ```

3. **🟢 LOW PRIORITY (Check if specific changes)**
   ```
   /g-forge-radio/stream-server/security     → Auth failures
   /g-forge-radio/stream-server/performance  → Performance issues
   ```

---

## 🔎 **ERROR PATTERNS TO SEARCH FOR**

### **CloudWatch Logs Insights Queries:**

```sql
-- Find all errors in last 10 minutes
fields @timestamp, @message
| filter @message like /ERROR|FAILED|EXCEPTION|FATAL/
| sort @timestamp desc
| limit 100
```

```sql
-- Find deployment failures
fields @timestamp, @message
| filter @logStream like /deployment/
| filter @message like /error|failed/
| sort @timestamp desc
```

```sql
-- Find container crashes
fields @timestamp, @message
| filter @message like /exit code|killed|oom|crash/
| sort @timestamp desc
```

---

## 🚨 **COMMON ISSUES & SOLUTIONS**

### **Issue 1: Deployment Success, Services Failed**
```
Symptom: CodeDeploy shows "Succeeded" but services don't start
Logs: /deployment shows "systemctl start failed"

Solution:
1. Check logs: aws logs tail /g-forge-radio/stream-server/deployment
2. Find error: "ExecStart failed with exit code 1"
3. Fix config, redeploy
```

### **Issue 2: Silent Container Crashes**
```
Symptom: Containers start then immediately crash
Logs: /liquidsoap shows "That source is fallible"

Solution:
1. Check container logs in CloudWatch
2. Find missing file/config error
3. Fix volume mounts, redeploy
```

### **Issue 3: Permission Denied Errors**
```
Symptom: Scripts can't execute or write files
Logs: /deployment shows "Permission denied"

Solution:
1. Check IAM role permissions
2. Check file ownership (chown)
3. Check execute bits (chmod +x)
```

---

## 📈 **METRICS TO MONITOR**

### **After Every Deployment:**

```bash
# Error rate (should be 0)
aws logs filter-log-events \
  --log-group-name /g-forge-radio/stream-server/deployment \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-10M +%s)000 \
  --query 'events | length(@)'

# Service health (should be "active")
aws ssm send-command \
  --instance-ids i-0924372740ff587ca \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["systemctl is-active icecast2","systemctl is-active nginx"]'

# Container status (should be "Up")
docker ps --format "{{.Names}}: {{.Status}}"
```

---

## ✅ **SUCCESS CRITERIA**

**A deployment is SUCCESSFUL when:**

```
✅ CodeDeploy Status: Succeeded
✅ CloudWatch Logs: No errors in last 10 minutes
✅ EC2 Instance: Running + healthy
✅ Services: All active (systemctl)
✅ Containers: All running (docker ps)
✅ Health Check: Endpoints responding
```

**If ANY of these fail → INVESTIGATE IMMEDIATELY!**

---

## 🔧 **QUICK COMMANDS**

### **Check Deployment Logs:**
```bash
# Last 10 minutes
aws logs tail /g-forge-radio/stream-server/deployment \
  --since 10m \
  --region eu-west-1

# Follow live
aws logs tail /g-forge-radio/stream-server/deployment \
  --follow \
  --region eu-west-1
```

### **Search for Errors:**
```bash
# All errors
aws logs filter-log-events \
  --log-group-name /g-forge-radio/stream-server/deployment \
  --filter-pattern "ERROR" \
  --region eu-west-1

# Specific time window
aws logs filter-log-events \
  --log-group-name /g-forge-radio/stream-server/deployment \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-10M +%s)000 \
  --region eu-west-1
```

### **Check Services:**
```bash
# Via SSM
aws ssm send-command \
  --instance-ids i-0924372740ff587ca \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker ps","systemctl status nginx","systemctl status icecast2"]' \
  --region eu-west-1
```

---

## 📚 **RELATED DOCUMENTATION**

- `scripts/verify-deployment.sh` - Automated verification script
- `docs/CLOUDWATCH_MONITORING_SETUP.md` - CloudWatch setup guide
- `docs/DEPLOYMENT_STATUS_17NOV2025.md` - Recent deployment report
- `deploy_streamserver` - Main deployment script

---

## 🎯 **KEY TAKEAWAY**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  "Een deployment is pas echt succesvol als:                │
│   1. CodeDeploy zegt SUCCESS                               │
│   2. CloudWatch logs geen errors tonen                     │
│   3. Services daadwerkelijk draaien"                       │
│                                                             │
│  → ALTIJD alle 3 checken!                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Status:** ⚠️ **MANDATORY** - Must follow for every deployment!  
**Updated:** 17 November 2025  
**Source:** Gerard's best practice instruction
