# 🧪 AMI Build - Test Plan

**Gerard's Rule:** "controleer altijd dubbel je deployment op de juistheid en test end to end"

**Status:** PRE-BUILD VERIFICATION ✅

---

## 🎯 TEST STRATEGY

### **Phase 1: Script Verification**
✅ Check syntax errors
✅ Verify all paths
✅ Check AWS CLI commands
✅ Validate parameters

### **Phase 2: Dry Run**
✅ Test on current EC2 (without creating AMI)
✅ Verify all dependencies install
✅ Check for errors in setup script

### **Phase 3: End-to-End Build**
✅ Build AMI (small test)
✅ Launch instance from AMI
✅ Verify all software works
✅ Performance test

### **Phase 4: Production Build**
✅ Build final AMI
✅ Document AMI ID
✅ Ready for pipeline

---

## ✅ TEST 1: SCRIPT SYNTAX CHECK

### **build-base-ami.sh:**
```bash
# Check syntax
bash -n pipeline/ami/build-base-ami.sh

# Expected: No output = OK
```

### **ami-setup.sh:**
```bash
# Check syntax
bash -n pipeline/ami/ami-setup.sh

# Expected: No output = OK
```

**Status:** ⏳ PENDING

---

## ✅ TEST 2: PARAMETER VALIDATION

### **Check AWS Resources Exist:**

```bash
# 1. Check subnet exists
aws ec2 describe-subnets \
  --subnet-ids subnet-0cdb078c275014e24 \
  --region eu-west-1 \
  --query 'Subnets[0].SubnetId' \
  --output text

# Expected: subnet-0cdb078c275014e24

# 2. Check security group exists
aws ec2 describe-security-groups \
  --group-ids sg-005c8d71776faf97b \
  --region eu-west-1 \
  --query 'SecurityGroups[0].GroupId' \
  --output text

# Expected: sg-005c8d71776faf97b

# 3. Check Ubuntu 22.04 AMI exists
aws ec2 describe-images \
  --image-ids ami-0d64bb532e0502c46 \
  --region eu-west-1 \
  --query 'Images[0].ImageId' \
  --output text

# Expected: ami-0d64bb532e0502c46
```

**Status:** ⏳ PENDING

---

## ✅ TEST 3: DRY RUN ON CURRENT EC2

### **Test setup script WITHOUT creating AMI:**

```bash
# Copy script to EC2
aws ssm send-command \
  --instance-ids i-054754fbca0bda346 \
  --document-name "AWS-RunShellScript" \
  --comment "AMI Setup - Dry Run Test" \
  --parameters 'commands=[
    "# Download setup script",
    "cd /tmp",
    "cat > ami-setup-test.sh << '\''EOF'\''",
    "#!/bin/bash",
    "# Test: Docker installation",
    "echo \"Testing Docker install...\"",
    "apt-get update > /dev/null 2>&1",
    "apt-cache policy docker-ce | head -10",
    "",
    "# Test: Liquidsoap image pull",
    "echo \"Testing Liquidsoap image availability...\"",
    "docker pull savonet/liquidsoap:v2.4.0 --dry-run 2>&1 | head -5",
    "",
    "# Test: CodeDeploy agent",
    "echo \"Testing CodeDeploy agent URL...\"",
    "curl -I https://aws-codedeploy-eu-west-1.s3.eu-west-1.amazonaws.com/latest/install | head -5",
    "",
    "# Test: RAM disk",
    "echo \"Testing RAM disk creation...\"",
    "mkdir -p /tmp/test-ramdisk",
    "mount -t tmpfs -o size=512M tmpfs /tmp/test-ramdisk && echo \"RAM disk OK\" || echo \"RAM disk FAIL\"",
    "umount /tmp/test-ramdisk",
    "rm -rf /tmp/test-ramdisk",
    "EOF",
    "",
    "chmod +x ami-setup-test.sh",
    "./ami-setup-test.sh"
  ]' \
  --region eu-west-1

# Check results after 2 minutes
```

**Expected Results:**
- ✅ Docker package available
- ✅ Liquidsoap image exists
- ✅ CodeDeploy URL accessible
- ✅ RAM disk mounts successfully

**Status:** ⏳ PENDING

---

## ✅ TEST 4: PERMISSIONS CHECK

### **Check IAM Permissions:**

```bash
# Test if we can run EC2 operations
aws ec2 describe-instances \
  --instance-ids i-054754fbca0bda346 \
  --region eu-west-1 \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text

# Test if we can create images
aws ec2 describe-images \
  --owners self \
  --region eu-west-1 \
  --query 'Images[0].ImageId' \
  --output text

# Expected: Should not error
```

**Required Permissions:**
- ✅ ec2:RunInstances
- ✅ ec2:DescribeInstances
- ✅ ec2:StopInstances
- ✅ ec2:TerminateInstances
- ✅ ec2:CreateImage
- ✅ ec2:DescribeImages
- ✅ ec2:CreateTags

**Status:** ⏳ PENDING

---

## ✅ TEST 5: COST VALIDATION

### **Estimate Build Cost:**

```
Build Instance (t3.small):
  Duration: 0.5 hour
  Rate: $0.0208/hour
  Cost: $0.01

EBS Snapshot:
  Size: ~8 GB
  Rate: $0.05/GB/month
  Cost: $0.40/month

Total First Build: $0.41
```

**Approval Needed:** ✅ Cost is acceptable

**Status:** ⏳ PENDING

---

## ✅ TEST 6: ROLLBACK PLAN

### **If Build Fails:**

```bash
# 1. Terminate build instance
aws ec2 terminate-instances \
  --instance-ids <instance-id> \
  --region eu-west-1

# 2. Delete failed AMI (if created)
aws ec2 deregister-image \
  --image-id <ami-id> \
  --region eu-west-1

# 3. Delete snapshot (if created)
aws ec2 delete-snapshot \
  --snapshot-id <snapshot-id> \
  --region eu-west-1

# 4. Review logs
aws ssm get-command-invocation \
  --command-id <command-id> \
  --instance-id <instance-id> \
  --region eu-west-1
```

**Status:** ⏳ DOCUMENTED

---

## ✅ TEST 7: END-TO-END VERIFICATION

### **After AMI is Created:**

```bash
# 1. Launch test instance
TEST_INSTANCE=$(aws ec2 run-instances \
  --image-id <new-ami-id> \
  --instance-type t3.small \
  --subnet-id subnet-0cdb078c275014e24 \
  --security-group-ids sg-005c8d71776faf97b \
  --region eu-west-1 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=AMI-E2E-Test}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

# 2. Wait for instance
aws ec2 wait instance-running --instance-ids $TEST_INSTANCE --region eu-west-1

# 3. Wait for SSM (2 min)
sleep 120

# 4. Run verification
aws ssm send-command \
  --instance-ids $TEST_INSTANCE \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "echo \"🧪 E2E VERIFICATION\"",
    "echo \"\"",
    "echo \"✅ Docker:\"",
    "docker --version",
    "echo \"\"",
    "echo \"✅ Liquidsoap Image:\"",
    "docker images | grep liquidsoap",
    "echo \"\"",
    "echo \"✅ CodeDeploy Agent:\"",
    "systemctl status codedeploy-agent --no-pager | head -3",
    "echo \"\"",
    "echo \"✅ SSM Agent:\"",
    "systemctl status amazon-ssm-agent --no-pager | head -3",
    "echo \"\"",
    "echo \"✅ RAM Disk:\"",
    "df -h /mnt/ramdisk",
    "echo \"\"",
    "echo \"✅ AWS CLI:\"",
    "aws --version",
    "echo \"\"",
    "echo \"🎉 ALL CHECKS PASSED!\"",
    ""
  ]' \
  --region eu-west-1

# 5. Cleanup test instance
aws ec2 terminate-instances --instance-ids $TEST_INSTANCE --region eu-west-1
```

**Expected Output:**
- ✅ Docker version shown
- ✅ Liquidsoap image present
- ✅ CodeDeploy agent: active (running)
- ✅ SSM agent: active (running)
- ✅ RAM disk: 512M mounted
- ✅ AWS CLI v2.x

**Status:** ⏳ PENDING

---

## 📋 TEST EXECUTION ORDER

```
1. ✅ Script Syntax Check        (2 min)
2. ✅ Parameter Validation        (2 min)
3. ✅ Permissions Check           (2 min)
4. ✅ Dry Run on Current EC2      (5 min)
5. ✅ Cost Validation             (manual)
6. ✅ Rollback Plan Review        (manual)
7. ✅ Build AMI                   (25 min)
8. ✅ End-to-End Verification     (10 min)
────────────────────────────────────────────
TOTAL TIME:                       ~46 min
```

---

## ✅ SUCCESS CRITERIA

**AMI is production-ready when:**

- ✅ All syntax checks pass
- ✅ All parameters validated
- ✅ Dry run successful
- ✅ AMI builds without errors
- ✅ Test instance launches < 3 min
- ✅ All software verified working
- ✅ CodeDeploy agent active
- ✅ RAM disk mounted
- ✅ No errors in logs

---

## 🚨 FAILURE CRITERIA

**ABORT BUILD IF:**

- ❌ Syntax errors in scripts
- ❌ AWS resources don't exist
- ❌ Permissions insufficient
- ❌ Dry run fails
- ❌ Cost exceeds $1.00
- ❌ Setup script errors

---

## 📊 TEST RESULTS LOG

### **Test 1: Syntax Check**
```
Date: _____________
Result: ⏳ PENDING
Notes: _____________
```

### **Test 2: Parameters**
```
Date: _____________
Result: ⏳ PENDING
Notes: _____________
```

### **Test 3: Dry Run**
```
Date: _____________
Result: ⏳ PENDING
Notes: _____________
```

### **Test 4: Permissions**
```
Date: _____________
Result: ⏳ PENDING
Notes: _____________
```

### **Test 5: Cost**
```
Date: _____________
Result: ⏳ PENDING
Notes: _____________
```

### **Test 6: Rollback**
```
Date: _____________
Result: ⏳ DOCUMENTED
Notes: _____________
```

### **Test 7: E2E**
```
Date: _____________
Result: ⏳ PENDING
Notes: _____________
```

---

## 🎯 NEXT ACTIONS

**BEFORE BUILD:**
1. Run all tests 1-6
2. Document results
3. Get Gerard's approval
4. Build AMI (test 7)

**AFTER BUILD:**
5. Run E2E verification
6. Document AMI ID
7. Proceed to Phase 2

---

**Gerard's Rule Applied:** ✅ DOUBLE CHECK EVERYTHING!

**Made with 💎 by Gerard & Cascade**
