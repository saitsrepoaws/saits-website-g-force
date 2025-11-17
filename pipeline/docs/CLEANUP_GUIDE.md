# 🧹 Sandbox Cleanup Guide

Quick reference for cleaning up sandboxes and Route53 records.

---

## ⚡ Quick Commands

### Delete Single Sandbox
```bash
# Delete sandbox + DNS record (RECOMMENDED)
./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670
```

### List All Sandboxes
```bash
# View all sandboxes + check for orphaned records
./pipeline/scripts/list-all-sandboxes.sh
```

### Bulk Cleanup
```bash
# Delete sandboxes older than 7 days (default)
./pipeline/scripts/cleanup-old-sandboxes.sh

# Delete sandboxes older than 14 days
./pipeline/scripts/cleanup-old-sandboxes.sh 14
```

### Delete DNS Only (Legacy)
```bash
# Delete Route53 record only
./pipeline/scripts/cleanup-sandbox-subdomain.sh 28a3670
```

---

## 📋 Detailed Guide

### 1. List All Sandboxes

**Command:**
```bash
./pipeline/scripts/list-all-sandboxes.sh
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ALL SANDBOXES OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 AMPLIFY SANDBOXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📦 g-forge-iot-commit-28a3670
     App ID: d1abc123def
     Created: 2025-11-16T20:30:45.123Z
     Domain: d1abc123.amplifyapp.com

  📦 g-forge-iot-commit-9876543
     App ID: d2xyz456ghi
     Created: 2025-11-10T15:20:30.456Z
     Domain: d2xyz456.amplifyapp.com

🌐 ROUTE53 CNAME RECORDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🌐 28a3670.splashfm.nl.
     → d1abc123.amplifyapp.com
     TTL: 300s

  🌐 9876543.splashfm.nl.
     → d2xyz456.amplifyapp.com
     TTL: 300s

🔍 ORPHANED RECORDS CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ No orphaned records found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Amplify Sandboxes: 2
  Route53 CNAMEs:    2

Cleanup commands:

  ./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670
  ./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-9876543
```

**Use Cases:**
- ✅ Weekly health check
- ✅ Find orphaned DNS records
- ✅ Get cleanup commands

---

### 2. Delete Single Sandbox

**Command:**
```bash
./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670
```

**Interactive Flow:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️  DELETE SANDBOX WITH CLEANUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sandbox ID: commit-28a3670

✅ Commit-based sandbox detected
   Subdomain: 28a3670.splashfm.nl

⚠️  Delete sandbox 'commit-28a3670'? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 STEP 1: CLEANUP ROUTE53 CNAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Checking Route53 record...
✅ Found: 28a3670.splashfm.nl → d1abc123.amplifyapp.com

🗑️  Deleting Route53 CNAME...
✅ Route53 record deleted: /change/C123ABC456DEF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 STEP 2: DELETE AMPLIFY SANDBOX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗑️  Deleting Amplify sandbox...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CLEANUP COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cleaned up:
  ✅ Route53 CNAME: 28a3670.splashfm.nl
  ✅ Amplify Sandbox: commit-28a3670

Resources freed ✨
```

**Features:**
- ✅ Detects commit-based sandboxes automatically
- ✅ Deletes Route53 CNAME if exists
- ✅ Deletes Amplify sandbox
- ✅ Confirmation before deletion
- ✅ Shows what was cleaned up

---

### 3. Bulk Cleanup by Age

**Command:**
```bash
# Delete sandboxes older than 7 days (default)
./pipeline/scripts/cleanup-old-sandboxes.sh

# Or specify custom age
./pipeline/scripts/cleanup-old-sandboxes.sh 14  # 14 days
./pipeline/scripts/cleanup-old-sandboxes.sh 30  # 30 days
```

**Interactive Flow:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹 CLEANUP OLD SANDBOXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Max age: 7 days

Scanning for sandboxes older than 2025-11-09 20:30:00...

  🗑️  OLD: g-forge-iot-commit-9876543
     Age: 8 days
     Created: 2025-11-08T15:20:30.456Z
     App ID: d2xyz456ghi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  FOUND 1 OLD SANDBOX(ES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Delete these sandboxes? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️  DELETING OLD SANDBOXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deleting: commit-9876543
  🌐 Cleaning up Route53: 9876543.splashfm.nl
     ✅ Route53 deleted
  📦 Deleting Amplify sandbox
  ✅ Deleted successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CLEANUP COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deleted: 1 sandbox(es)
```

**Use Cases:**
- ✅ Monthly cleanup (run via cron)
- ✅ Remove old test sandboxes
- ✅ Free up AWS resources

---

## 🎯 Best Practices

### ✅ DO:

1. **Use integrated cleanup script**
   ```bash
   # GOOD: Deletes both sandbox AND DNS
   ./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670
   ```

2. **List sandboxes regularly**
   ```bash
   # Weekly health check
   ./pipeline/scripts/list-all-sandboxes.sh
   ```

3. **Run bulk cleanup monthly**
   ```bash
   # Cleanup old sandboxes (7 days)
   ./pipeline/scripts/cleanup-old-sandboxes.sh
   ```

4. **Check for orphaned records**
   ```bash
   # List script shows orphaned records
   ./pipeline/scripts/list-all-sandboxes.sh
   ```

### ❌ DON'T:

1. **Don't delete sandbox manually**
   ```bash
   # BAD: Leaves orphaned DNS record
   pnpm exec ampx sandbox delete --identifier commit-28a3670
   
   # GOOD: Use integrated script
   ./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670
   ```

2. **Don't forget to cleanup after testing**
   - Delete sandbox within 7 days
   - Use bulk cleanup for old sandboxes

3. **Don't delete Route53 zone manually**
   - Scripts handle DNS automatically
   - Zone ID is hardcoded

---

## 🤖 Automation

### Cron Job (Weekly Cleanup)

Add to crontab for automatic cleanup:

```bash
# Edit crontab
crontab -e

# Add this line (runs every Sunday at 2 AM)
0 2 * * 0 cd /path/to/g-forge-iot && ./pipeline/scripts/cleanup-old-sandboxes.sh 7 >/dev/null 2>&1
```

### GitHub Actions (PR Cleanup)

Automatically cleanup sandbox when PR is merged:

```yaml
# .github/workflows/cleanup-pr-sandbox.yml
name: Cleanup PR Sandbox

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Cleanup Sandbox
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          COMMIT=$(git rev-parse --short ${{ github.event.pull_request.head.sha }})
          ./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-$COMMIT
```

---

## 📊 Monitoring

### Check Costs

Route53 costs in AWS Cost Explorer:

```bash
# Get Route53 costs for last 30 days
aws ce get-cost-and-usage \
  --time-period Start=2025-10-17,End=2025-11-16 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --filter file://<(echo '{
    "Dimensions": {
      "Key": "SERVICE",
      "Values": ["Amazon Route 53"]
    }
  }')
```

### Count Resources

```bash
# Count Amplify sandboxes
aws amplify list-apps --query "apps[?contains(name, 'g-forge-iot')].name" | jq length

# Count Route53 CNAME records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z047697515CJEX2WUTUFW \
  --query "ResourceRecordSets[?Type=='CNAME'].Name" | jq length
```

---

## 🐛 Troubleshooting

### Orphaned DNS Records

**Problem:** Route53 record exists but sandbox is deleted

**Solution:**
```bash
# List all sandboxes (shows orphaned records)
./pipeline/scripts/list-all-sandboxes.sh

# Cleanup orphaned record
./pipeline/scripts/cleanup-sandbox-subdomain.sh <commit-hash>
```

### Sandbox Won't Delete

**Problem:** `delete-sandbox-with-cleanup.sh` fails

**Solutions:**
1. Check if sandbox exists:
   ```bash
   aws amplify list-apps --query "apps[?name=='g-forge-iot-commit-28a3670']"
   ```

2. Delete manually:
   ```bash
   # Delete Amplify sandbox
   pnpm exec ampx sandbox delete --identifier commit-28a3670 --yes
   
   # Delete Route53 record
   ./pipeline/scripts/cleanup-sandbox-subdomain.sh 28a3670
   ```

### Permission Denied

**Problem:** AWS CLI permission errors

**Solution:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Required permissions:
# - amplify:*
# - route53:ListResourceRecordSets
# - route53:ChangeResourceRecordSets
```

---

## ✅ Summary

**Cleanup Commands:**
```bash
# List all
./pipeline/scripts/list-all-sandboxes.sh

# Delete single
./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670

# Bulk cleanup (7 days)
./pipeline/scripts/cleanup-old-sandboxes.sh
```

**Key Points:**
- ✅ Always use integrated cleanup script
- ✅ Check for orphaned records weekly
- ✅ Run bulk cleanup monthly
- ✅ Set up cron job for automation
- ❌ Never delete sandbox manually

**Gerard's Request:** "vergeet ze niet op te ruimen als de sandbox gedeleet word"
**Solution:** Integrated cleanup ensures DNS is ALWAYS deleted with sandbox! 🎉
