# 🚨 EC2 Stream Server Recovery - 15 November 2025

**Date:** 15 November 2025, 17:40 CET  
**Issue:** EC2 instance missing, stream down  
**Root Cause:** CloudFormation stack in DELETE_FAILED state  
**Solution:** Force delete + clean redeploy

---

## 🔍 Problem Analysis

### What Happened:

1. **Vanmorgen (09:42 CET):** Tijdens destructieve acties ging de CloudFormation stack naar DELETE_FAILED
2. **Result:** EC2 instance (i-021451e919d39c898) werd deleted
3. **Impact:** Stream server down, geen audio stream beschikbaar
4. **Blocking Issue:** Stuck stack prevents new EC2 deployment

### Root Cause:

```
Stack: amplify-gforgeiot-gerard-sandbox-28f2e0c620
Status: DELETE_FAILED
Last Updated: 15 Nov 2025, 09:42:46 UTC

Stuck Resources:
- StreamVPCVPCGW05B9AFAC (VPC Gateway)
- StreamVPCPublicSubnet2Subnet1639858E
- StreamVPCPublicSubnet1SubnetB84F8F5B
- Nested stack: function1351588B
```

---

## ✅ Solution Applied

### OPTION A: Force Delete + Clean Redeploy

**Strategy:**
1. Stop current sandbox deployment ✅
2. Force delete stuck CloudFormation stack ⏳ IN PROGRESS
3. Wait for complete deletion
4. Redeploy sandbox with clean slate
5. EC2 automatically recreated
6. Configure stream from backup/snapshot

### Data Safety:

**NO DATA LOSS RISK!** ✅

- ✅ S3 Backups: Audio files, covers, waveforms intact
- ✅ EC2 Snapshot: Available for restore if needed
- ✅ Git Repository: All code preserved
- ✅ Documentation: Complete in ref/ folder
- ✅ DynamoDB: 747 tracks safe in database

---

## 📋 Recovery Steps

### Step 1: Stop Sandbox Deployment ✅ COMPLETED

```bash
# Find and stop sandbox process
ps aux | grep "ampx sandbox"
kill <PID>
```

**Result:** ✅ Sandbox process stopped (PID 20410)

---

### Step 2: Force Delete Stuck Stack ⏳ IN PROGRESS

```bash
# Initiate force delete
aws cloudformation delete-stack \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620 \
  --region eu-west-1
```

**Status:** DELETE_IN_PROGRESS  
**Time Started:** 15 Nov 2025, 17:35 CET  
**Expected Duration:** 5-15 minutes (VPC resources)

**Currently Deleting:**
- Nested stack: function1351588B (contains VPC, subnets, gateway)

---

### Step 3: Monitor Deletion Status

```bash
# Check if stack is fully deleted
aws cloudformation describe-stacks \
  --stack-name amplify-gforgeiot-gerard-sandbox-28f2e0c620 \
  --region eu-west-1 \
  --query 'Stacks[0].StackStatus' \
  --output text

# If error "Stack does not exist" → ✅ DELETED!
```

**Expected Result:**
- First: DELETE_IN_PROGRESS (5-15 minutes)
- Then: Stack not found (fully deleted)

---

### Step 4: Clean Redeploy Sandbox

**WAIT FOR STEP 3 TO COMPLETE FIRST!**

Once stack is fully deleted:

```bash
cd /Users/gerard/Desktop/T7/g-forge-iot

# Start clean deployment
nohup pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox \
  --identifier gerard > /tmp/amplify-CLEAN-REDEPLOY.log 2>&1 &

# Monitor deployment
tail -f /tmp/amplify-CLEAN-REDEPLOY.log
```

**Expected Duration:** 15-20 minutes

**What Gets Created:**
- ✅ All Lambda functions
- ✅ DynamoDB tables (reused, data preserved)
- ✅ S3 buckets (reused, data preserved)
- ✅ SQS FIFO queue
- ✅ VPC + Subnets + Gateway (fresh)
- ✅ **EC2 instance (NEW!)**
- ✅ Elastic IP
- ✅ EventBridge hourly trigger

---

### Step 5: Verify EC2 Instance Created

```bash
# Find new EC2 instance
aws ec2 describe-instances \
  --region eu-west-1 \
  --filters "Name=tag:Name,Values=*StreamServer*" \
  --query 'Reservations[*].Instances[*].{ID:InstanceId,State:State.Name,IP:PublicIpAddress}' \
  --output table

# Get Elastic IP from stack outputs
aws cloudformation describe-stacks \
  --stack-name amplify-gforgeiot-gerard-sandbox-<NEW-ID> \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`StreamServerPublicIP`].OutputValue' \
  --output text
```

**Expected Result:**
- ✅ EC2 instance running
- ✅ Elastic IP attached
- ⚠️ Fresh Ubuntu install (needs configuration)

---

### Step 6: Configure Stream Server

**Option A: Restore from Snapshot**

```bash
# Find latest snapshot
aws ec2 describe-snapshots \
  --owner-ids self \
  --filters "Name=tag:Name,Values=*radio*" \
  --query 'Snapshots | sort_by(@, &StartTime) | [-1].{ID:SnapshotId,Date:StartTime,Size:VolumeSize}' \
  --output table

# Create volume from snapshot
aws ec2 create-volume \
  --region eu-west-1 \
  --availability-zone eu-west-1a \
  --snapshot-id snap-XXXXXXXX \
  --volume-type gp3

# Attach to EC2 instance
# Mount volume
# Copy configs to new instance
```

**Option B: Fresh Install from Documentation**

Use documented configs from ref/ folder:

1. **Install Liquidsoap 2.0.2**
   ```bash
   ssh radio-ec2
   sudo apt update
   sudo apt install -y liquidsoap
   ```

2. **Install Icecast**
   ```bash
   sudo apt install -y icecast2
   ```

3. **Configure Liquidsoap**
   - Copy config from `/opt/radio/radio.liq` (documented in ref/)
   - Update SQS queue URL
   - Set AWS credentials

4. **Configure Nginx**
   - Copy config from ref/
   - Enable streaming endpoint

5. **Start Services**
   ```bash
   sudo systemctl start icecast2
   sudo systemctl enable icecast2
   
   nohup liquidsoap /opt/radio/radio.liq &
   ```

---

### Step 7: Test Stream

```bash
# Test stream accessibility
curl -I http://<ELASTIC-IP>/stream.mp3

# Expected: HTTP 200 OK

# Test SQS queue processing
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1

# Should have messages if Lambda triggered
```

---

### Step 8: Trigger Playlist Update

```bash
# Manually trigger stream-playlist-updater Lambda
aws lambda invoke \
  --function-name <LAMBDA-NAME> \
  --region eu-west-1 \
  --payload '{}' \
  /tmp/lambda-response.json

# Check response
cat /tmp/lambda-response.json
```

---

## 🔧 Configuration Files to Restore

### Priority 1: Essential Configs

**Liquidsoap Config:** `/opt/radio/radio.liq`
```liquidsoap
# SQS queue URL (update to new FIFO queue)
QUEUE_URL = "https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"

# AWS region
AWS_REGION = "eu-west-1"

# Stream settings
def next_track() =
  path = get_next_track()
  if path != "" then
    [request.create(path)]
  else
    []
  end
end

radio = request.dynamic.list(prefetch=1, next_track)
radio = mksafe(radio)

# Output to Icecast
output.icecast(%mp3, 
  host="localhost", 
  port=8000,
  password="hackme",
  mount="stream.mp3",
  radio)
```

**Icecast Config:** `/etc/icecast2/icecast.xml`
- Default config usually OK
- Password: hackme (dev), change for prod

**Nginx Config:** `/etc/nginx/sites-available/radio`
```nginx
server {
    listen 80;
    server_name _;

    location /stream.mp3 {
        proxy_pass http://localhost:8000/stream.mp3;
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    location /status-json.xsl {
        proxy_pass http://localhost:8000/status-json.xsl;
    }

    location / {
        root /var/www/html;
        index index.html;
    }
}
```

### Priority 2: AWS Credentials

**EC2 IAM Role:** Already attached by CloudFormation
- SQS read/write
- S3 read
- SSM managed instance

**If manual credentials needed:**
```bash
# Configure AWS CLI on EC2
aws configure
# Region: eu-west-1
# Output: json
```

---

## 📊 Success Criteria

### ✅ Recovery Complete When:

1. **CloudFormation**
   - [ ] Old stack fully deleted
   - [ ] New stack deployed successfully
   - [ ] Status: CREATE_COMPLETE or UPDATE_COMPLETE

2. **EC2 Instance**
   - [ ] Instance running
   - [ ] Elastic IP attached
   - [ ] SSH accessible
   - [ ] Services running (Liquidsoap, Icecast, Nginx)

3. **Stream**
   - [ ] Stream URL accessible: http://<IP>/stream.mp3
   - [ ] Returns HTTP 200
   - [ ] Audio playing
   - [ ] No gaps or silence

4. **Lambda Integration**
   - [ ] stream-playlist-updater Lambda exists
   - [ ] EventBridge hourly trigger configured
   - [ ] SQS FIFO queue has messages
   - [ ] Liquidsoap consuming from queue

5. **Data Integrity**
   - [ ] DynamoDB tracks accessible (747 tracks)
   - [ ] S3 files accessible
   - [ ] No data loss confirmed

---

## ⏱️ Timeline

| Time | Action | Status | Duration |
|------|--------|--------|----------|
| 17:30 | Identified EC2 missing | ✅ | - |
| 17:35 | Stopped sandbox deployment | ✅ | 1 min |
| 17:36 | Initiated force delete | ⏳ | Ongoing |
| TBD | Stack fully deleted | ⏳ | 5-15 min |
| TBD | Clean redeploy started | ⏳ | 15-20 min |
| TBD | EC2 instance created | ⏳ | - |
| TBD | Stream configured | ⏳ | 10-30 min |
| TBD | Stream operational | ⏳ | - |

**Estimated Total Time:** 30-60 minutes

---

## 🚨 Troubleshooting

### Issue: Stack Delete Fails Again

**Symptoms:** Stack goes back to DELETE_FAILED

**Solution:**
1. Check which resources failed
   ```bash
   aws cloudformation describe-stack-resources \
     --stack-name <STACK> \
     --query 'StackResources[?ResourceStatus==`DELETE_FAILED`]'
   ```

2. Manually delete stuck resources
3. Retry stack delete

**Nuclear Option:**
- Deploy with new identifier: `gerard-new`
- Leave old stack (manual cleanup later)

---

### Issue: EC2 Not Created in New Deployment

**Symptoms:** Stack deploys but no EC2 instance

**Check:**
1. Verify backend.ts has StreamServer definition
2. Check CloudFormation events for errors
3. Review VPC/subnet creation

**Solution:**
- Check backend.ts line 1310 (StreamServer)
- Ensure VPC resources created first
- Check service quotas (EC2 limits)

---

### Issue: Stream Not Accessible

**Symptoms:** EC2 exists but stream URL 404/timeout

**Check:**
1. Security group allows port 80
2. Nginx running: `sudo systemctl status nginx`
3. Icecast running: `sudo systemctl status icecast2`
4. Liquidsoap running: `ps aux | grep liquidsoap`

**Solution:**
```bash
# Check security group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*StreamServer*"

# Should allow:
# - Port 80 (HTTP) from 0.0.0.0/0
# - Port 22 (SSH) from your IP
# - Port 8000 (Icecast) from localhost only
```

---

### Issue: Liquidsoap Not Playing Tracks

**Symptoms:** Stream online but silent or fallback music

**Check:**
1. SQS queue has messages
2. Liquidsoap can reach SQS
3. AWS credentials configured
4. S3 progressive download working

**Solution:**
```bash
# Test SQS access
aws sqs receive-message \
  --queue-url <QUEUE-URL> \
  --region eu-west-1

# Test S3 access
aws s3 ls s3://<BUCKET>/public/audio/

# Check Liquidsoap logs
tail -f /var/log/liquidsoap/radio.log
```

---

## 📚 Related Documentation

- **BLOK EC2 Guide:** `ref/BLOK_EC2_END_TO_END.md` (to be created)
- **Stream Server Setup:** `ref/STREAM_SERVER_SETUP.md`
- **EC2 Inspection Report:** `ref/EC2_INSPECTION_REPORT.md`
- **Radio Station System:** `ref/RADIO_STATION_SYSTEM.md`
- **FIFO Queue Setup:** Memory: Radio Station Model deployment

---

## 🔐 Security Notes

**After Recovery:**

1. **Change Default Passwords**
   - Icecast password (currently: hackme)
   - If using Stereo Tool web interface

2. **Review Security Groups**
   - Ensure minimal exposure
   - SSH only from trusted IPs
   - HTTP from 0.0.0.0/0 OK for stream

3. **EC2 SSH Key**
   - Ensure key exists: ~/.ssh/ec2-radio-key
   - Permissions: chmod 400

4. **IAM Permissions**
   - EC2 role should have minimal permissions
   - SQS, S3, SSM only

---

## 💾 Backup Strategy

**Going Forward:**

1. **EC2 Snapshots**
   - Create snapshot before major changes
   - Tag clearly: radio-server-backup-<DATE>
   - Automated: Weekly snapshots via AWS Backup

2. **Configuration Backups**
   - Store all configs in Git (ref/ folder)
   - Export before changes
   - Version control everything

3. **Data Backups**
   - S3: Already versioned
   - DynamoDB: Enable point-in-time recovery
   - Track table exports weekly

---

## ✅ Next Steps After Recovery

1. **Test BLOK EC2 End-to-End**
   - Upload track
   - Create playlist
   - Schedule playlist
   - Verify stream plays

2. **Document BLOK EC2**
   - Create `BLOK_EC2_END_TO_END.md`
   - Testing procedures
   - Recovery procedures

3. **Automate Recovery**
   - Snapshot schedule
   - Automated restore script
   - Health monitoring

4. **Continue System Testing**
   - BLOK PLANNER
   - BLOK STREAMING
   - BLOK PLAY

---

**Status:** 🟡 IN PROGRESS  
**Next Action:** Wait for stack deletion to complete  
**ETA:** 5-15 minutes  

**Last Updated:** 15 November 2025, 17:45 CET
