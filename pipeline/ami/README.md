# 🎵 G-Forge Radio - Custom AMI Builder

**Purpose:** Create production-ready Amazon Machine Image (AMI) with all dependencies pre-installed.

---

## 🎯 What's Included

### **Software Stack:**
- **OS:** Ubuntu 22.04 LTS
- **Docker:** Latest (29.0+) + Liquidsoap 2.4.0 image
- **Streaming:** Icecast2 + Nginx
- **Audio Tools:** ffmpeg, sox, lame
- **AWS Tools:** CLI v2, SSM Agent, CodeDeploy Agent, CloudWatch Agent
- **Security:** fail2ban, rkhunter, chkrootkit

### **Optimizations:**
- RAM disk (tmpfs) at `/mnt/ramdisk` (512MB)
- Low swappiness (vm.swappiness=10)
- BBR TCP congestion control
- Optimized network buffers

### **Directory Structure:**
```
/opt/radio/           # Application files
/opt/radio/backups/   # Config backups
/var/log/liquidsoap/  # Liquidsoap logs
/mnt/ramdisk/         # RAM disk (ultra-fast I/O)
```

---

## 🚀 Build AMI

### **Prerequisites:**
```bash
# AWS CLI configured
aws configure

# Permissions needed:
# - ec2:RunInstances
# - ec2:CreateImage
# - ec2:DescribeInstances
# - ec2:DescribeImages
# - ec2:TerminateInstances
```

### **Build Command:**
```bash
cd pipeline/ami
chmod +x build-base-ami.sh
./build-base-ami.sh
```

### **Process:**
1. ✅ Launches temporary t3.small instance
2. ✅ Runs setup script (installs all dependencies)
3. ✅ Waits 15 minutes for completion
4. ✅ Stops instance
5. ✅ Creates AMI snapshot
6. ✅ Waits for AMI to be available
7. ✅ Terminates build instance

**Total Time:** ~20-25 minutes

---

## 📋 Manual Build (Step-by-Step)

### **Step 1: Launch Build Instance**
```bash
aws ec2 run-instances \
  --image-id ami-0d64bb532e0502c46 \
  --instance-type t3.small \
  --subnet-id subnet-0cdb078c275014e24 \
  --security-group-ids sg-005c8d71776faf97b \
  --user-data file://ami-setup.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=AMI-Build-Temp}]' \
  --region eu-west-1
```

### **Step 2: Wait for Setup**
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@<instance-ip>

# Watch setup log
tail -f /var/log/ami-setup.log

# Wait for: "🎉 AMI SETUP COMPLETE!"
```

### **Step 3: Create AMI**
```bash
# Stop instance
aws ec2 stop-instances --instance-ids <instance-id>

# Create AMI
aws ec2 create-image \
  --instance-id <instance-id> \
  --name "g-forge-radio-base-v1.0" \
  --description "Ubuntu 22.04 with Liquidsoap 2.4.0, Icecast, Nginx, CodeDeploy" \
  --region eu-west-1

# Wait for AMI
aws ec2 wait image-available --image-ids <ami-id>
```

### **Step 4: Test AMI**
```bash
# Launch test instance
aws ec2 run-instances \
  --image-id <your-ami-id> \
  --instance-type t3.small \
  --subnet-id subnet-0cdb078c275014e24 \
  --security-group-ids sg-005c8d71776faf97b \
  --region eu-west-1

# Verify:
# - Docker is running
# - Liquidsoap image is present
# - CodeDeploy agent is running
# - RAM disk is mounted
```

---

## 🧪 Test AMI

### **Quick Verification:**
```bash
# SSH into instance launched from AMI
ssh -i your-key.pem ubuntu@<instance-ip>

# Run verification
docker --version
docker images | grep liquidsoap
systemctl status codedeploy-agent
systemctl status amazon-ssm-agent
df -h /mnt/ramdisk
aws --version
```

### **Expected Output:**
```
✅ Docker: 29.0+
✅ Liquidsoap image: savonet/liquidsoap:v2.4.0
✅ CodeDeploy: active (running)
✅ SSM Agent: active (running)
✅ RAM disk: 512M mounted at /mnt/ramdisk
✅ AWS CLI: 2.x
```

---

## 💰 Cost

### **AMI Creation:**
- **Build Instance:** $0.02/hour × 0.5 hour = **$0.01**
- **AMI Storage:** $0.05/GB/month × 8GB = **$0.40/month**

### **Running Instances (from AMI):**
- **t3.small:** $0.0208/hour = **$15/month** (24/7)
- **t3.micro:** $0.0104/hour = **$7.50/month** (24/7)

**Total First Month:** $15.41 (build + storage + 1 instance)  
**Following Months:** $15.40/month (storage + 1 instance)

---

## 🔄 Update AMI

### **When to Update:**
- New Liquidsoap version released
- Security patches needed
- Additional software required
- Performance optimizations

### **Process:**
1. Edit `ami-setup.sh`
2. Update version in `build-base-ami.sh` (v1.0 → v1.1)
3. Run build script
4. Test new AMI
5. Update pipeline configuration with new AMI ID
6. Delete old AMI (optional)

---

## 📚 Files

| File | Purpose |
|------|---------|
| `build-base-ami.sh` | Main build script (launches instance, creates AMI) |
| `ami-setup.sh` | Setup script (installs all dependencies) |
| `README.md` | This file |
| `CHANGELOG.md` | Version history |

---

## 🎯 Next Steps

After AMI is created:

1. **Save AMI ID** → Use in pipeline configuration
2. **Test launch** → Verify everything works
3. **Phase 2** → Create artifact structure
4. **Phase 3** → Setup CodeDeploy
5. **Phase 4** → Build complete pipeline

---

## 🐛 Troubleshooting

### **Build fails at Docker install:**
```bash
# SSH into build instance
# Check Docker installation:
cat /var/log/ami-setup.log | grep -A 20 "Installing Docker"
```

### **CodeDeploy agent not running:**
```bash
# On AMI-launched instance:
sudo systemctl status codedeploy-agent
sudo systemctl restart codedeploy-agent
```

### **RAM disk not mounted:**
```bash
# Check fstab:
cat /etc/fstab | grep ramdisk

# Mount manually:
sudo mount /mnt/ramdisk
```

---

## ✅ Success Criteria

**AMI is ready when:**
- ✅ All software installed (no errors in log)
- ✅ Docker running + Liquidsoap image present
- ✅ CodeDeploy agent active
- ✅ SSM agent active
- ✅ RAM disk configured and mounted
- ✅ Test instance launches successfully
- ✅ All optimizations applied

---

**Made with 💎 by Gerard & Cascade**

**Date:** 17 November 2025, 01:09 CET
