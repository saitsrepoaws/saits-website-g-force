# 🚀 SMART DEPLOYMENT SYSTEM - LIQUIDSOAP 2.4.0

**Idempotent • Resumable • Production-Safe**

---

## 📋 OVERZICHT

Dit deployment systeem gebruikt **state tracking** om:
- ✅ **Completed steps overslaan** → Sneller bij herstart
- ✅ **Na errors herstarten** → Geen handmatig werk
- ✅ **Veilig meerdere keren runnen** → Idempotent
- ✅ **Progress bijhouden** → JSON state file
- ✅ **Rollback support** → Backup van oude config

---

## 🏗️ ARCHITECTUUR

### State File
```json
{
  "version": "2.4.0",
  "timestamp": "2025-11-17T00:45:00+01:00",
  "steps": {
    "stop_old_services": {
      "completed": true,
      "timestamp": "2025-11-17T00:45:05+01:00"
    },
    "install_docker": {
      "completed": true,
      "timestamp": "2025-11-17T00:46:10+01:00"
    },
    "pull_liquidsoap_image": {
      "completed": false,
      "failed": true,
      "error": "Network timeout",
      "timestamp": "2025-11-17T00:47:15+01:00"
    }
  }
}
```

**Locatie:** `/opt/radio/.deployment-state.json`

### Deployment Steps

| Step | Naam | Wat het doet | Idempotent? |
|------|------|--------------|-------------|
| 1 | `stop_old_services` | Stop Liquidsoap + Docker | ✅ |
| 2 | `install_docker` | Installeer Docker (skip als al installed) | ✅ |
| 3 | `pull_liquidsoap_image` | Pull 2.4.0 image (skip als al pulled) | ✅ |
| 4 | `setup_ram_disk` | Mount /mnt/ramdisk (skip als al mounted) | ✅ |
| 5 | `backup_old_config` | Backup oude config | ✅ |
| 6 | `create_liquidsoap_config` | Maak nieuwe 2.4.0 config | ✅ |
| 7 | `create_systemd_service` | Maak systemd service | ✅ |
| 8 | `start_service` | Start Liquidsoap | ✅ |
| 9 | `verify_deployment` | Verify alles werkt | ✅ |

---

## 🎯 GEBRUIK

### Manual Deployment (SSH/SSM)

**1. Upload script naar EC2:**
```bash
scp pipeline/scripts/deploy-liquidsoap-2.4.0-smart.sh ec2-user@54.171.0.54:/tmp/
```

**2. Run deployment:**
```bash
ssh ec2-user@54.171.0.54
sudo bash /tmp/deploy-liquidsoap-2.4.0-smart.sh
```

**3. Bij error, gewoon opnieuw runnen:**
```bash
# Script slaat completed steps over!
sudo bash /tmp/deploy-liquidsoap-2.4.0-smart.sh
```

### Via AWS SSM

```bash
# Upload script
aws s3 cp pipeline/scripts/deploy-liquidsoap-2.4.0-smart.sh \
  s3://your-bucket/deploy.sh

# Execute via SSM
aws ssm send-command \
  --instance-ids i-054754fbca0bda346 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "aws s3 cp s3://your-bucket/deploy.sh /tmp/deploy.sh",
    "chmod +x /tmp/deploy.sh",
    "sudo bash /tmp/deploy.sh"
  ]' \
  --region eu-west-1
```

### Via AWS CodeBuild

**1. Create CodeBuild project:**
```bash
aws codebuild create-project \
  --name liquidsoap-deployment \
  --source type=GITHUB,location=https://github.com/your-repo \
  --artifacts type=NO_ARTIFACTS \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL \
  --service-role arn:aws:iam::ACCOUNT:role/CodeBuildServiceRole \
  --buildspec pipeline/codebuild/buildspec-liquidsoap-deploy.yml
```

**2. Start build:**
```bash
aws codebuild start-build --project-name liquidsoap-deployment
```

**3. Monitor:**
```bash
aws codebuild batch-get-builds --ids $BUILD_ID
```

---

## 🔧 SCRIPT COMMANDS

### Run Deployment
```bash
sudo bash deploy-liquidsoap-2.4.0-smart.sh
```
- Voert alle steps uit
- Slaat completed steps over
- Stopt bij errors

### Check Status
```bash
sudo bash deploy-liquidsoap-2.4.0-smart.sh --status
```
**Output:**
```
📊 DEPLOYMENT STATUS
════════════════════

stop_old_services        ✅ DONE
install_docker           ✅ DONE
pull_liquidsoap_image    ⏸️  PENDING
setup_ram_disk           ⏸️  PENDING
...
```

### Reset Deployment
```bash
sudo bash deploy-liquidsoap-2.4.0-smart.sh --reset
```
- Verwijdert state file
- Start fresh deployment
- Gebruik bij complete rebuild

### Show Help
```bash
sudo bash deploy-liquidsoap-2.4.0-smart.sh --help
```

---

## 🔄 HERSTART NA ERROR

### Scenario: Network timeout bij Docker pull

**1. Error gebeurt:**
```
STEP 3: Pull Liquidsoap 2.4.0 Image
⬇️  Pulling Liquidsoap 2.4.0 Docker image...
❌ Error: Network timeout
❌ Step 'pull_liquidsoap_image' marked as failed
```

**2. State file:**
```json
{
  "steps": {
    "stop_old_services": {"completed": true},
    "install_docker": {"completed": true},
    "pull_liquidsoap_image": {
      "completed": false,
      "failed": true,
      "error": "Network timeout"
    }
  }
}
```

**3. Fix network, run opnieuw:**
```bash
sudo bash /tmp/deploy.sh
```

**4. Output:**
```
⏭️  Step 'stop_old_services' already completed, skipping
⏭️  Step 'install_docker' already completed, skipping

STEP 3: Pull Liquidsoap 2.4.0 Image
⬇️  Pulling Liquidsoap 2.4.0 Docker image...
✅ Image pulled
✅ Step 'pull_liquidsoap_image' marked as completed

STEP 4: Setup RAM Disk
...
```

**Result:** Deployment gaat verder waar het was gebleven! ✅

---

## 🛡️ ROLLBACK

### Automatic Backup

Bij elke deployment:
```
/opt/radio/backups/
├── radio.liq.backup-20251117_004500
├── radio.liq.backup-20251117_005000
└── radio.liq.backup-20251117_010000
```

### Manual Rollback

**1. Stop nieuwe versie:**
```bash
sudo systemctl stop liquidsoap
sudo docker stop liquidsoap
```

**2. Restore oude config:**
```bash
sudo cp /opt/radio/backups/radio.liq.backup-TIMESTAMP /opt/radio/radio.liq
```

**3. Start oude versie:**
```bash
# Als Docker container
sudo docker run -d --name liquidsoap ... savonet/liquidsoap:v2.0.2 /opt/radio/radio.liq

# Of als systemd service
sudo systemctl start liquidsoap
```

### Via State Reset

```bash
# Reset deployment state
sudo bash /tmp/deploy.sh --reset

# Stop huidige versie
sudo systemctl stop liquidsoap

# Restore backup
sudo cp /opt/radio/backups/radio.liq.backup-TIMESTAMP /opt/radio/radio.liq

# Clear state
sudo rm /opt/radio/.deployment-state.json
```

---

## 📊 MONITORING

### Check Service Status
```bash
# Systemd service
sudo systemctl status liquidsoap

# Docker container
sudo docker ps | grep liquidsoap
sudo docker stats liquidsoap --no-stream

# Logs
sudo journalctl -u liquidsoap -f
sudo docker logs -f liquidsoap
```

### Check Deployment State
```bash
# Show state
sudo bash /tmp/deploy.sh --status

# View state file
sudo cat /opt/radio/.deployment-state.json | jq

# View logs
sudo tail -f /var/log/liquidsoap-deploy-*.log
```

### Check Stream
```bash
# Icecast
curl -I http://localhost:8000/stream.mp3

# External
curl -I https://splashfm.nl/splashfm.mp3

# RAM disk
df -h /mnt/ramdisk
ls -lah /mnt/ramdisk/
```

---

## 🧪 TESTING

### Test Deployment Locally

**1. Test in Docker:**
```bash
docker run -it --rm \
  -v /opt/radio:/opt/radio:ro \
  savonet/liquidsoap:v2.4.0 \
  liquidsoap --check /opt/radio/radio.liq
```

**2. Test config syntax:**
```bash
docker exec liquidsoap liquidsoap --check /opt/radio/radio.liq
```

**3. Test stream:**
```bash
# Local
curl -I http://localhost:8000/stream.mp3

# With audio
ffplay http://localhost:8000/stream.mp3
```

### Test State Management

**1. Start deployment:**
```bash
sudo bash deploy.sh
```

**2. Kill at random step:**
```bash
# In another terminal
sudo pkill -9 -f deploy.sh
```

**3. Check state:**
```bash
sudo bash deploy.sh --status
```

**4. Resume:**
```bash
sudo bash deploy.sh
# Should skip completed steps!
```

---

## 🔐 SECURITY

### IAM Permissions Required

**For CodeBuild:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:DescribeInstanceInformation",
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "*"
    }
  ]
}
```

**For EC2 Instance:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "*"
    }
  ]
}
```

### State File Security

```bash
# Set permissions
sudo chmod 600 /opt/radio/.deployment-state.json
sudo chown root:root /opt/radio/.deployment-state.json
```

---

## 🐛 TROUBLESHOOTING

### Common Issues

**1. State file corrupted:**
```bash
# Reset
sudo bash deploy.sh --reset

# Or manually
sudo rm /opt/radio/.deployment-state.json
```

**2. Docker image pull fails:**
```bash
# Check Docker
sudo systemctl status docker

# Manual pull
sudo docker pull savonet/liquidsoap:v2.4.0

# Check network
ping registry.hub.docker.com
```

**3. Service won't start:**
```bash
# Check logs
sudo journalctl -u liquidsoap -n 50

# Check Docker
sudo docker logs liquidsoap

# Check config
sudo docker exec liquidsoap liquidsoap --check /opt/radio/radio.liq
```

**4. RAM disk not mounted:**
```bash
# Check
mountpoint /mnt/ramdisk

# Manual mount
sudo mount -t tmpfs -o size=512M tmpfs /mnt/ramdisk
```

**5. Step stuck:**
```bash
# Check state
sudo bash deploy.sh --status

# View logs
sudo tail -f /var/log/liquidsoap-deploy-*.log

# Force retry (mark as incomplete)
sudo nano /opt/radio/.deployment-state.json
# Change "completed": true to false
```

---

## 📈 PERFORMANCE

### Deployment Times

| Scenario | Time | Notes |
|----------|------|-------|
| Fresh install | ~5 min | All steps |
| After error (resume) | ~2 min | Skips completed |
| Config change only | ~30 sec | Skips infra setup |
| Docker image cached | -2 min | No download |

### Resource Usage

| Resource | Before | After | Delta |
|----------|--------|-------|-------|
| RAM | 318 MB | 450 MB | +132 MB |
| Disk | 28% | 29% | +1% |
| CPU (idle) | 0% | 0% | 0% |
| RAM disk | 0 MB | 0-512 MB | Variable |

---

## ✅ SUCCESS CRITERIA

### Deployment Success Checklist

- [ ] All 9 steps marked as completed
- [ ] Systemd service is active
- [ ] Docker container is running
- [ ] Liquidsoap version is 2.4.0
- [ ] RAM disk is mounted
- [ ] Stream is accessible (port 8000)
- [ ] No errors in logs
- [ ] Config backup exists
- [ ] State file is valid JSON

### Verification Commands

```bash
# All-in-one check
sudo bash deploy.sh --status && \
systemctl is-active liquidsoap && \
docker ps | grep liquidsoap && \
curl -s -I http://localhost:8000/stream.mp3 | head -1 && \
echo "✅ ALL SYSTEMS GO!"
```

---

## 📚 REFERENCES

- **Liquidsoap 2.4.0 Docs:** https://www.liquidsoap.info/doc-2.4.0/
- **Docker Hub:** https://hub.docker.com/r/savonet/liquidsoap
- **State File:** `/opt/radio/.deployment-state.json`
- **Log Files:** `/var/log/liquidsoap-deploy-*.log`
- **Backup Dir:** `/opt/radio/backups/`

---

## 🎯 BEST PRACTICES

1. **Always check status before deploying:**
   ```bash
   sudo bash deploy.sh --status
   ```

2. **Monitor logs during deployment:**
   ```bash
   tail -f /var/log/liquidsoap-deploy-*.log
   ```

3. **Test config before deploying:**
   ```bash
   docker run --rm -v /opt/radio:/opt/radio savonet/liquidsoap:v2.4.0 \
     liquidsoap --check /opt/radio/radio.liq
   ```

4. **Keep backups:**
   ```bash
   ls -lt /opt/radio/backups/ | head -5
   ```

5. **Use CodeBuild for production:**
   - Automatic logging
   - SNS notifications
   - Audit trail

---

## 🤝 SUPPORT

**Questions?**
- Check logs: `/var/log/liquidsoap-deploy-*.log`
- View state: `sudo bash deploy.sh --status`
- Reset state: `sudo bash deploy.sh --reset`

**Need Help?**
- Open GitHub issue
- Check documentation in `/pipeline/docs/`
- Review buildspec: `/pipeline/codebuild/buildspec-liquidsoap-deploy.yml`

---

**Made with 💎 by Gerard & Cascade**

**Version:** 1.0.0  
**Last Updated:** 17 November 2025
