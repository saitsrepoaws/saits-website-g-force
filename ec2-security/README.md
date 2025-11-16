# 🔒 G-FORGE RADIO - ML-POWERED SECURITY STACK

**Maximum AWS Security Standaarden met Machine Learning**

---

## 🎯 Overview

Complete security stack met:
- **🤖 AWS GuardDuty** - ML-based threat detection
- **🔐 AWS Security Hub** - Centralized security findings
- **🦠 ClamAV** - Antivirus scanning
- **🔍 rkhunter + chkrootkit** - Rootkit detection
- **🐳 Trivy** - Docker vulnerability scanning
- **📊 CloudWatch** - All logs in 1 group + ML anomaly detection
- **🔔 SNS Alerts** - Real-time security notifications
- **⏰ Automated Scans** - Nightly security scans

---

## 🚀 Quick Start

### 1. Deploy AWS ML Security Services

```bash
cd ec2-security
./deploy-ml-security.sh
```

**This enables:**
- ✅ AWS GuardDuty (ML threat detection)
- ✅ AWS Security Hub (centralized findings)
- ✅ CloudWatch Log Group (`/gforge-radio/all-logs`)
- ✅ SNS Topic for alerts
- ✅ Metric Filters (SSH, rootkit, virus)
- ✅ CloudWatch Alarms

### 2. Subscribe Email to Alerts

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:ACCOUNT_ID:gforge-radio-security-alerts \
  --protocol email \
  --notification-endpoint your@email.com \
  --region eu-west-1
```

**Check your email and confirm subscription!**

### 3. Install Security Tools on EC2

```bash
# SSH to EC2
ssh ubuntu@stream.g-force.cloud

# Run installer (as root)
sudo bash /path/to/install-security-stack.sh
```

**This installs:**
- ✅ AWS SSM Agent (remote management)
- ✅ CloudWatch Agent (log shipping)
- ✅ rkhunter + chkrootkit (rootkit scanners)
- ✅ ClamAV (antivirus)
- ✅ Trivy (Docker scanner)
- ✅ Automated security updates
- ✅ Nightly scan cron jobs

---

## 📊 What Gets Logged

**All logs go to:** `/gforge-radio/all-logs`

**Log Streams:**
```
{instance-id}/syslog            → System logs
{instance-id}/auth              → Authentication logs
{instance-id}/liquidsoap        → Liquidsoap streaming
{instance-id}/icecast-error     → Icecast errors
{instance-id}/icecast-access    → Icecast access
{instance-id}/nginx-access      → Nginx access
{instance-id}/nginx-error       → Nginx errors
{instance-id}/security-scans    → Security scan results
{instance-id}/docker            → Docker logs
```

---

## 🤖 ML-Powered Analysis

### Real-Time Threat Detection

**GuardDuty (ML) analyzes:**
- ✅ Network traffic patterns
- ✅ API call behaviors
- ✅ DNS queries
- ✅ VPC Flow Logs
- ✅ CloudTrail events

**Automatic detection of:**
- 🚨 Brute force attacks
- 🚨 Port scanning
- 🚨 Crypto mining
- 🚨 Unusual API calls
- 🚨 Compromised instances
- 🚨 Data exfiltration

### CloudWatch Anomaly Detection

**ML learns normal patterns for:**
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Log patterns

**Alerts on deviations!**

### Lambda Log Analysis

**Runs every 15 minutes:**
```typescript
// CloudWatch Insights queries with ML
- SSH brute force attempts
- Rootkit detections
- Virus infections
- Docker vulnerabilities
- Suspicious network activity
- Failed authentication patterns
```

---

## 🔍 Security Scans

### Nightly Automated Scans

**Runs at 02:00 AM daily:**

1. **Rootkit Scan (rkhunter)**
   - Checks: `/bin`, `/sbin`, `/usr/bin`, `/usr/sbin`
   - Detects: Hidden files, backdoors, rootkits

2. **Rootkit Scan (chkrootkit)**
   - Cross-verification
   - Different detection methods

3. **Virus Scan (ClamAV)**
   - Scans: `/home`, `/var/www`, `/opt/radio`
   - Updated virus definitions daily

4. **Docker Scan (Trivy)**
   - Scans all Docker images
   - Detects: HIGH + CRITICAL vulnerabilities
   - Checks: CVEs, misconfigurations

5. **Security Updates Check**
   - Lists available security patches
   - Auto-install (configurable)

6. **Network Audit**
   - Open ports
   - Active connections
   - Firewall rules

7. **Auth Audit**
   - Failed login attempts
   - Successful logins
   - Sudo usage

**Results logged to:** `/var/log/security-scans.log`

---

## 📧 Alert Types

### 🔴 CRITICAL Alerts

**Immediate notification:**
- Rootkit detected
- Virus found
- GuardDuty CRITICAL finding
- Instance compromised
- Crypto mining detected

### 🟠 HIGH Alerts

**Within 15 minutes:**
- Docker HIGH vulnerabilities
- Port scanning detected
- Brute force > 10 attempts
- GuardDuty HIGH finding
- Memory/CPU anomaly

### 🟡 MEDIUM Alerts

**Daily digest:**
- Failed authentication (5-10 attempts)
- Security updates available
- Docker MEDIUM vulnerabilities

### 🟢 LOW Alerts

**Weekly summary:**
- Minor misconfigurations
- Low-priority CVEs

---

## 💰 Cost Breakdown

### AWS Services

| Service | Cost | Notes |
|---------|------|-------|
| **GuardDuty** | ~$4.50/month | First 30 days FREE |
| **Security Hub** | $0.001/finding | ~$1/month |
| **CloudWatch Logs** | $0.50/GB | ~1GB = $0.50 |
| **CloudWatch Metrics** | FREE | First 10 metrics free |
| **SNS** | FREE | Email notifications |
| **Lambda** | FREE | < 1M invocations |
| **EventBridge** | FREE | < 1M events |

**Total: ~$5-10/month** 💰

### EC2 Tools (FREE)

- rkhunter: FREE ✅
- chkrootkit: FREE ✅
- ClamAV: FREE ✅
- Trivy: FREE ✅
- CloudWatch Agent: FREE ✅

---

## 🧪 Testing

### 1. Test SSH Brute Force Detection

```bash
# Trigger failed logins (from another machine)
for i in {1..10}; do
  ssh fake@stream.g-force.cloud
done
```

**Expected:**
- Metric filter catches attempts
- CloudWatch alarm triggers
- SNS alert sent
- Lambda analyzes pattern

### 2. Test Rootkit Scan

```bash
# Run manual scan
sudo rkhunter --check
```

**Expected:**
- Results in `/var/log/security-scans.log`
- CloudWatch receives logs
- Metric filter detects warnings

### 3. Test Virus Scan

```bash
# Create test file (EICAR test virus)
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar.txt

# Scan
sudo clamscan /tmp/eicar.txt
```

**Expected:**
- ClamAV detects virus
- Log shows "FOUND"
- Metric filter triggers
- Alarm sent

### 4. Test Docker Vulnerability Scan

```bash
# Scan an image with known vulnerabilities
trivy image node:14
```

**Expected:**
- HIGH/CRITICAL vulns detected
- Results logged
- Metric increments

---

## 📊 CloudWatch Dashboards

### View Logs

```bash
# AWS Console
https://console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group/$252Fgforge-radio$252Fall-logs
```

### CloudWatch Insights Queries

**Failed SSH Attempts:**
```
fields @timestamp, @message
| filter @message like /Failed password/
| stats count() by bin(1h)
```

**Rootkit Warnings:**
```
fields @timestamp, @message
| filter @message like /rootkit/ or @message like /Warning/
| filter @logStream like /security-scans/
| sort @timestamp desc
```

**Docker Vulnerabilities:**
```
fields @timestamp, @message
| filter @message like /HIGH/ or @message like /CRITICAL/
| filter @logStream like /security-scans/
| stats count() by bin(1d)
```

---

## 🔧 Maintenance

### Update Virus Definitions

```bash
# Automatic (daily via cron)
sudo freshclam

# Manual
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam
```

### Update Rootkit Databases

```bash
sudo rkhunter --update
sudo rkhunter --propupd
```

### Update Trivy Database

```bash
trivy image --download-db-only
```

### Check Security Updates

```bash
sudo apt update
sudo apt list --upgradable | grep security
```

### View Scan Logs

```bash
# All security scans
tail -f /var/log/security-scans.log

# CloudWatch logs
aws logs tail /gforge-radio/all-logs --follow --region eu-west-1
```

---

## 🚨 Incident Response

### If Rootkit Detected

1. **Isolate instance**
   ```bash
   # Block all traffic
   sudo iptables -A INPUT -j DROP
   sudo iptables -A OUTPUT -j DROP
   ```

2. **Take snapshot**
   ```bash
   aws ec2 create-snapshot --instance-id i-054754fbca0bda346 --description "Incident-$(date +%Y%m%d)"
   ```

3. **Investigate**
   ```bash
   # Check scan details
   cat /var/log/security-scans.log | grep -A10 "ROOTKIT"
   
   # Check process list
   ps aux | grep suspicious
   
   # Check network connections
   sudo netstat -tuln
   ```

4. **Clean or rebuild**
   - If clean possible: Remove malware
   - If compromised: Rebuild from clean AMI

### If Virus Detected

1. **Quarantine file**
   ```bash
   sudo clamscan -r --move=/var/quarantine /path/to/infected
   ```

2. **Investigate source**
   ```bash
   # Check how it got there
   ls -la /path/to/infected
   grep "/path/to/infected" /var/log/syslog
   ```

3. **Full system scan**
   ```bash
   sudo clamscan -r /
   ```

### If Brute Force Detected

1. **Block attacker IP**
   ```bash
   sudo iptables -A INPUT -s ATTACKER_IP -j DROP
   ```

2. **Review auth logs**
   ```bash
   grep "Failed password" /var/log/auth.log | tail -50
   ```

3. **Update Security Group**
   ```bash
   # Remove port 22 from 0.0.0.0/0
   # Add specific IPs only
   ```

---

## ✅ Best Practices

### 🟢 DO:

1. **Subscribe email to SNS topic**
2. **Review alerts daily**
3. **Run manual scans weekly**
4. **Update security tools monthly**
5. **Backup before major changes**
6. **Document all incidents**
7. **Review logs in CloudWatch**

### 🔴 DON'T:

1. **Don't ignore CRITICAL alerts**
2. **Don't disable automated updates**
3. **Don't run as root unnecessarily**
4. **Don't expose port 22 to 0.0.0.0/0**
5. **Don't skip security patches**
6. **Don't delete logs**

---

## 📚 Documentation

- **AWS GuardDuty:** https://docs.aws.amazon.com/guardduty/
- **AWS Security Hub:** https://docs.aws.amazon.com/securityhub/
- **ClamAV:** https://www.clamav.net/documents
- **rkhunter:** http://rkhunter.sourceforge.net/
- **Trivy:** https://aquasecurity.github.io/trivy/

---

## 🎯 Summary

**Gerard's Request:**
> "IK WIL DE MAXIMALE AWS STANDAARDEN HEBBEN OP DE EC2 SERVER EN OP DE DOCKER CONTAINER PLAATS EEN ROOT KIT SCANNER EN EEN VIRUS SCANNER EN RUN MET DE CRON IN DE NACHT UREN KIJK OOK OF ALLE LOG FILES NAAR CLOUDWATCH GAAN MAAK MAAR 1 GROTE LOG FILE VAN ALLE COMPONETEN IN 1 CLOUDWATCROUPM DAT VISSEN WE LATER WEL UIT WAT WAT IS"

> "wacht installer meteen overal ML om te colleteren dus ook over hackpoginen en resiulten van de scann en van de log groeps"

**Delivered:**
- ✅ Maximum AWS security standards
- ✅ Rootkit scanners (rkhunter + chkrootkit)
- ✅ Virus scanner (ClamAV)
- ✅ Docker scanner (Trivy)
- ✅ Nightly cron jobs (02:00 AM)
- ✅ All logs → 1 CloudWatch Log Group
- ✅ ML-powered analysis (GuardDuty, Anomaly Detection, Lambda)
- ✅ Real-time hack attempt detection
- ✅ Automated scan result analysis
- ✅ Log group ML pattern detection

**Ready to deploy! 🚀**
