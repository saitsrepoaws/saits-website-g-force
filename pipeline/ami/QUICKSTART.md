# ⚡ AMI Quick Start - Just 3 Commands!

**Goal:** Build production-ready AMI in 25 minutes! 🚀

---

## 🎯 ONE-LINE BUILD

```bash
cd pipeline/ami && chmod +x build-base-ami.sh && ./build-base-ami.sh
```

**That's it!** ☕ Grab a coffee, wait 25 min, you're done!

---

## 📋 What Happens

```
Step 1: Launch build instance    (2 min)
Step 2: Install dependencies      (15 min)
Step 3: Create AMI                (5 min)
Step 4: Cleanup                   (3 min)
─────────────────────────────────────────
TOTAL:                            ~25 min
```

---

## 🎉 Success!

**When done, you'll see:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 AMI BUILD COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 AMI Details:
  AMI ID: ami-0123456789abcdef0
  AMI Name: g-forge-radio-base-v1.0
  Region: eu-west-1

💾 Save this AMI ID for pipeline configuration!
```

---

## ✅ Test AMI

**Quick test launch:**

```bash
# Copy AMI ID from output above
AMI_ID="ami-0123456789abcdef0"

# Launch test instance
aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --subnet-id subnet-0cdb078c275014e24 \
  --security-group-ids sg-005c8d71776faf97b \
  --region eu-west-1 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=AMI-Test}]'
```

**Verify (via SSM):**

```bash
# Get instance ID from above
INSTANCE_ID="i-xxxxx"

# Check Docker
aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker --version && docker images"]' \
  --region eu-west-1

# Expected: Docker 29+ and liquidsoap:v2.4.0 image
```

---

## 🚀 Next: Phase 2

**AMI ready?** → Start Phase 2: Artifact Build!

```bash
cd ../docs
open CICD_PIPELINE_MASTERPLAN.md
# → Jump to Phase 2
```

---

**Time:** 25 min build + 5 min test = **30 min total**

**Cost:** $0.01 build + $0.40/month storage = **Peanuts!** 🥜

**CHAMPAGNE:** Getting closer! 🍾
