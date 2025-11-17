# 🧪 G-FORGE RADIO - DEPLOYMENT TESTING GUIDE

**Complete testing procedures for deployment verification**

---

## 📋 Overview

Dit document beschrijft alle test procedures die gebruikt moeten worden tijdens en na deployment van G-Force Radio infrastructure.

**Test Levels:**
1. **Unit Tests** - Individual components
2. **Integration Tests** - Component interactions
3. **System Tests** - Complete system health
4. **End-to-End Tests** - Full streaming pipeline
5. **Performance Tests** - Load & optimization verification

---

## 🚀 Quick Start

### **Pre-Deployment Tests**

```bash
# 1. Verify git is clean
git status

# 2. Run TypeScript checks
cd apps/web && npm run type-check

# 3. Verify AWS credentials
aws sts get-caller-identity
```

### **Post-Deployment Tests**

```bash
# 1. Run system audit
./pipeline/scripts/run-system-audit.sh <instance-id>

# 2. Run streaming tests
./pipeline/scripts/test-streaming-end-to-end.sh <instance-id>

# 3. Generate report
# Reports auto-saved to pipeline/docs/
```

---

## 📊 Test Scripts

### **1. System Audit** (`run-system-audit.sh`)

**Purpose:** Complete infrastructure health check

**Tests:**
- ✅ AWS Services (GuardDuty, Security Hub, CloudWatch, SNS, Parameter Store)
- ✅ EC2 System (CPU, Memory, Disk, Services)
- ✅ Performance Optimization (RAM disk, Memory tuning, Network)
- ✅ Security Tools (rkhunter, chkrootkit, ClamAV, Trivy)
- ✅ Network & DNS

**Usage:**
```bash
./pipeline/scripts/run-system-audit.sh [instance-id] [region]

# Examples:
./pipeline/scripts/run-system-audit.sh i-054754fbca0bda346
./pipeline/scripts/run-system-audit.sh i-054754fbca0bda346 eu-west-1
```

**Output:**
- Console: Colored test results
- Exit Code: 0 (pass), 1 (fail)
- Report: pipeline/docs/SYSTEM_AUDIT_REPORT_[timestamp].md

**Pass Criteria:**
- All critical services running
- AWS services deployed
- Parameter Store configured
- No critical failures

---

### **2. Streaming End-to-End Test** (`test-streaming-end-to-end.sh`)

**Purpose:** Verify complete streaming pipeline

**Pipeline Flow:**
```
SQS → Lambda → S3 → EC2 → Liquidsoap → Icecast → Nginx → CloudFront → User
```

**Tests:**
1. **SQS Queue** - Has messages, accessible
2. **Liquidsoap** - Running, streaming to Icecast
3. **Icecast** - Mount point active, metadata correct
4. **Nginx** - Proxy working, stream accessible
5. **DNS** - Resolves correctly to EC2
6. **CloudFront** - HTTPS delivery working
7. **Stream Quality** - Download test, bitrate check

**Usage:**
```bash
./pipeline/scripts/test-streaming-end-to-end.sh [instance-id]

# Example:
./pipeline/scripts/test-streaming-end-to-end.sh i-054754fbca0bda346
```

**Output:**
- Console: Real-time test results
- Exit Code: 0 (all pass), 1 (failures)

**Pass Criteria:**
- All 7 tests pass
- Stream downloadable
- < 5 second response time

---

## 📝 Manual Test Procedures

### **Test 1: AWS Services Verification**

```bash
# GuardDuty
aws guardduty list-detectors --region eu-west-1

# Security Hub
aws securityhub describe-hub --region eu-west-1

# CloudWatch Log Group
aws logs describe-log-groups \
  --log-group-name-prefix "/gforge-radio" \
  --region eu-west-1

# SNS Topic
aws sns list-topics --region eu-west-1 | grep gforge-radio

# Parameter Store
aws ssm get-parameters-by-path \
  --path "/gforge-radio/ec2" \
  --region eu-west-1
```

**Expected:** All services present and active

---

### **Test 2: EC2 System Health**

```bash
# Via SSM (no SSH needed)
aws ssm send-command \
  --instance-ids <instance-id> \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["uptime","free -h","df -h","systemctl status liquidsoap icecast2 nginx"]' \
  --region eu-west-1

# Get results
aws ssm get-command-invocation \
  --command-id <command-id> \
  --instance-id <instance-id> \
  --region eu-west-1
```

**Expected:**
- Uptime > 5 minutes
- Memory < 80% used
- Disk < 80% used
- All services active

---

### **Test 3: Streaming Pipeline**

```bash
# 1. Check SQS queue
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1

# 2. Test Icecast (internal)
curl http://<ec2-ip>:8000/status-json.xsl | jq .

# 3. Test Nginx proxy
curl -I http://<ec2-ip>/stream.mp3

# 4. Test DNS
dig +short stream.g-force.cloud

# 5. Test CloudFront
curl -I https://splashfm.nl/splashfm.mp3

# 6. Download test
curl -o /tmp/test.mp3 http://stream.g-force.cloud/stream.mp3 &
sleep 10
kill %1
ls -lh /tmp/test.mp3
```

**Expected:**
- Queue has messages
- Icecast shows mount point
- Nginx returns 200 OK
- DNS resolves correctly
- CloudFront returns 200 OK
- Download > 1MB in 10 seconds

---

### **Test 4: Performance Verification**

```bash
# Check RAM disk
ssh ec2-user@<ec2-ip>
df -h /mnt/ramdisk

# Check memory tuning
sysctl vm.swappiness
sysctl vm.vfs_cache_pressure
sysctl net.core.rmem_max

# Check CPU & Memory
top -b -n 1 | head -20
free -h

# Check network
ss -tuln | grep -E "80|443|8000"
```

**Expected:**
- RAM disk mounted
- Swappiness = 10
- TCP buffers = 16MB
- CPU < 50%
- Memory < 80%
- All ports listening

---

## 🎯 Test Checklists

### **Pre-Deployment Checklist**

```
Infrastructure:
[ ] AWS credentials configured
[ ] IAM roles created
[ ] Security Groups configured
[ ] Parameter Store populated
[ ] SNS topic created
[ ] CloudWatch Log Group created

Code:
[ ] All commits pushed
[ ] No uncommitted changes
[ ] TypeScript compiles
[ ] Linter passes
[ ] Tests pass

Documentation:
[ ] README updated
[ ] CHANGELOG updated
[ ] Deployment guide current
```

### **Post-Deployment Checklist**

```
AWS Services:
[ ] GuardDuty enabled
[ ] Security Hub enabled
[ ] CloudWatch logs shipping
[ ] SNS email confirmed
[ ] Parameter Store updated

EC2 Instance:
[ ] Instance running
[ ] System healthy (CPU, RAM, Disk)
[ ] Services running (Liquidsoap, Icecast, Nginx)
[ ] RAM disk mounted
[ ] Memory optimized
[ ] Security tools installed

Streaming:
[ ] SQS queue has tracks
[ ] Liquidsoap streaming
[ ] Icecast mount active
[ ] Nginx proxy working
[ ] DNS resolves
[ ] CloudFront delivers
[ ] Stream downloadable

Security:
[ ] Port 8000 blocked from internet
[ ] HTTPS working
[ ] Security scans configured
[ ] Alerts configured
```

---

## 📊 Test Reports

### **Auto-Generated Reports**

Reports are automatically generated in:
```
pipeline/docs/SYSTEM_AUDIT_REPORT_[timestamp].md
```

**Contents:**
- Complete test results
- Pass/Fail summary
- Detailed findings
- Recommendations
- Issue tracking

### **Report Archive**

Keep all reports for:
- Deployment history
- Regression tracking
- Performance trends
- Issue patterns

**Location:** `pipeline/docs/`

---

## 🚨 Troubleshooting

### **Test Failures**

**AWS Services Failed:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check region
echo $AWS_DEFAULT_REGION

# Check permissions
aws iam get-user
```

**EC2 Tests Failed:**
```bash
# Check SSM agent
aws ssm describe-instance-information \
  --instance-id <instance-id>

# Check EC2 status
aws ec2 describe-instances \
  --instance-ids <instance-id>

# SSH debug
ssh -v ubuntu@<ec2-ip>
```

**Streaming Tests Failed:**
```bash
# Check services
ssh ubuntu@<ec2-ip>
systemctl status liquidsoap icecast2 nginx

# Check logs
tail -f /var/log/liquidsoap/stdout.log
tail -f /var/log/icecast2/error.log
tail -f /var/log/nginx/error.log

# Check queue
aws sqs get-queue-attributes --queue-url <url>
```

---

## 🔄 CI/CD Integration

### **GitHub Actions Example**

```yaml
name: Deploy & Test

on:
  push:
    branches: [main]

jobs:
  deploy-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      
      - name: Deploy
        run: |
          npx ampx sandbox deploy --name production
      
      - name: Run System Audit
        run: |
          chmod +x pipeline/scripts/run-system-audit.sh
          ./pipeline/scripts/run-system-audit.sh ${{ secrets.EC2_INSTANCE_ID }}
      
      - name: Run Streaming Tests
        run: |
          chmod +x pipeline/scripts/test-streaming-end-to-end.sh
          ./pipeline/scripts/test-streaming-end-to-end.sh ${{ secrets.EC2_INSTANCE_ID }}
      
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: pipeline/docs/SYSTEM_AUDIT_REPORT_*.md
```

---

## 📚 Additional Resources

### **Related Documentation**

- `SYSTEM_AUDIT_REPORT_16NOV2025.md` - Latest complete audit
- `EC2_AUTO_REGISTER.md` - Auto-register Lambda documentation
- `EC2_PERFORMANCE_OPTIMIZATION.md` - RAM disk & performance
- `EC2_PARAMETER_STORE.md` - Parameter Store setup
- `COMMIT_BASED_SUBDOMAINS.md` - Sandbox subdomain system

### **Test Scripts**

- `run-system-audit.sh` - Complete system health check
- `test-streaming-end-to-end.sh` - Full streaming pipeline test
- `deploy-ml-security.sh` - Security services deployment
- `optimize-ec2-ramdisk.sh` - Performance optimization

---

## ✅ Success Criteria

### **Minimum Requirements**

```
System Audit:        > 80% pass rate
Streaming Tests:     100% pass (all 7 tests)
Response Time:       < 5 seconds
Stream Quality:      192kbps stereo
Uptime:             > 99.9%
```

### **Optimal Goals**

```
System Audit:        > 95% pass rate
Streaming Tests:     100% pass
Response Time:       < 2 seconds
Stream Quality:      192kbps+ stereo
Uptime:             > 99.99%
Security Scans:      Zero critical findings
```

---

## 🎯 Best Practices

1. **Run tests after EVERY deployment**
2. **Save all test reports**
3. **Compare with previous results**
4. **Fix failures immediately**
5. **Document any deviations**
6. **Automate where possible**
7. **Monitor trends over time**

---

**Document Version:** 1.0  
**Last Updated:** 17 November 2025  
**Next Review:** After production deployment
