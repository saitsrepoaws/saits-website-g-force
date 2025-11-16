# 🚀 Hybrid SQS System - Deployment Guide

**Created:** 13 November 2025, 23:45 CET  
**Status:** Ready to Deploy  
**System:** Just-in-Time Track Streaming with 2-Track Buffer

---

## 📦 What Was Built

### **1. Lambda Function: track-queue-manager**
```
Location: /amplify/functions/track-queue-manager/
Files:
  - handler.ts (queue management logic)
  - resource.ts (Lambda definition)
  - package.json (dependencies)
```

**Features:**
- ✅ Maintains queue of exactly 2 tracks
- ✅ Triggered hourly by EventBridge
- ✅ Can be invoked by Liquidsoap when queue < 2
- ✅ Tracks playlist position in DynamoDB
- ✅ Loops playlist automatically

### **2. SQS FIFO Queue**
```
Name: radio-track-stream-queue.fifo
Type: FIFO (First-In-First-Out)
Visibility: 5 minutes
Retention: 1 day
Long Polling: 20 seconds
```

### **3. Liquidsoap Configuration**
```
File: /liquidsoap-sqs-hybrid.liq
Mode: request.dynamic.list(prefetch=1)
Features:
  - Polls SQS for tracks
  - Checks queue size
  - Triggers Lambda when queue < 2
  - Deletes messages after playing
```

### **4. Backend Integration**
```
File: /amplify/backend.ts
Added:
  - trackQueueManager Lambda
  - SQS FIFO queue
  - EventBridge hourly trigger
  - IAM permissions
  - Environment variables
```

---

## 🚀 Deployment Steps

### **Step 1: Deploy Backend (Lambda + SQS)**

```bash
cd /Users/gerard/Desktop/T7/g-forge-iot

# Deploy to sandbox
npx ampx sandbox

# Wait for deployment... (5-10 minutes)
# Lambda will be created: amplify-gforgeiot-gerard-s-trackQueueManagerlambda-XXXXX
# SQS queue will be created: radio-track-stream-queue.fifo
```

**After deployment, note the outputs:**
- Lambda function name
- SQS queue URL
- SQS queue ARN

### **Step 2: Update Liquidsoap Config**

```bash
# Get Lambda function name from deployment
LAMBDA_NAME=$(aws lambda list-functions --region eu-west-1 --output json | \
  jq -r '.Functions[] | select(.FunctionName | contains("trackQueueManager")) | .FunctionName')

echo "Lambda name: $LAMBDA_NAME"

# Update liquidsoap-sqs-hybrid.liq with actual Lambda name
sed -i "s/amplify-gforgeiot-gerard-s-trackQueueManagerlambda-XXXXXXX/$LAMBDA_NAME/g" liquidsoap-sqs-hybrid.liq
```

### **Step 3: Deploy to EC2**

```bash
# Copy new Liquidsoap config to EC2
scp liquidsoap-sqs-hybrid.liq radio-ec2:/opt/radio/radio-sqs.liq

# SSH to EC2
ssh radio-ec2

# Backup current config
sudo cp /opt/radio/radio.liq /opt/radio/radio.liq.m3u.backup

# Test new config
liquidsoap --check /opt/radio/radio-sqs.liq

# If OK, make it active
sudo cp /opt/radio/radio-sqs.liq /opt/radio/radio.liq

# Restart Liquidsoap
sudo pkill liquidsoap
nohup liquidsoap /opt/radio/radio.liq > /tmp/liquidsoap.log 2>&1 &

# Check if running
ps aux | grep liquidsoap

# Monitor logs
tail -f /tmp/liquidsoap.log
```

### **Step 4: Grant EC2 IAM Permissions**

```bash
# EC2 needs SQS permissions
# Get SQS queue ARN from CloudFormation outputs

QUEUE_ARN=$(aws cloudformation describe-stacks \
  --region eu-west-1 \
  --output json | \
  jq -r '.Stacks[].Outputs[] | select(.ExportName == "TrackStreamQueueArn") | .OutputValue')

echo "Queue ARN: $QUEUE_ARN"

# Update EC2 IAM role policy
aws iam put-role-policy \
  --role-name amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju \
  --policy-name SQSStreamAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "'$QUEUE_ARN'"
    }]
  }'

echo "✅ EC2 IAM permissions updated"
```

### **Step 5: Initialize Queue**

```bash
# Manually trigger Lambda to add first 2 tracks
LAMBDA_NAME=$(aws lambda list-functions --region eu-west-1 --output json | \
  jq -r '.Functions[] | select(.FunctionName | contains("trackQueueManager")) | .FunctionName')

aws lambda invoke \
  --function-name "$LAMBDA_NAME" \
  --region eu-west-1 \
  --payload '{}' \
  /tmp/lambda-response.json

cat /tmp/lambda-response.json | jq '.'

# Check queue
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1

# Should show: "ApproximateNumberOfMessages": "2"
```

### **Step 6: Monitor & Verify**

```bash
# Check Liquidsoap logs
ssh radio-ec2 "tail -f /tmp/liquidsoap.log"

# Check stream status
curl http://79.125.44.178/status-json.xsl | jq '.icestats.source'

# Monitor Lambda
aws logs tail /aws/lambda/$LAMBDA_NAME --follow --region eu-west-1

# Monitor SQS
watch -n 5 'aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1 | jq -r ".Attributes.ApproximateNumberOfMessages"'
```

---

## 🧪 Testing

### **Test 1: Manual Lambda Invoke**
```bash
# Add 2 tracks manually
aws lambda invoke \
  --function-name [LAMBDA_NAME] \
  --region eu-west-1 \
  response.json

cat response.json | jq '.'
```

**Expected:**
```json
{
  "success": true,
  "tracksAdded": 2,
  "currentPosition": 2,
  "queueSize": 2
}
```

### **Test 2: Queue Check**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1
```

**Expected:** 2 messages

### **Test 3: Liquidsoap Polling**
```bash
# Watch Liquidsoap logs for:
# - "Polling SQS for next track..."
# - "Got track: [Artist] - [Title]"
# - "Queue healthy (2 tracks)"

tail -f /tmp/liquidsoap.log | grep -E "Polling|Got track|Queue"
```

### **Test 4: Auto-Refill**
```bash
# Wait for track to play (~3-5 min)
# Liquidsoap should detect queue < 2
# Should trigger Lambda automatically
# Queue should refill to 2 tracks

# Watch for:
# - "Queue low (1 tracks) - Triggering Lambda"
# - "Lambda invoked asynchronously"
```

---

## 🔄 Rollback Plan

### **If Something Goes Wrong:**

```bash
# SSH to EC2
ssh radio-ec2

# Restore M3U config
sudo cp /opt/radio/radio.liq.m3u.backup /opt/radio/radio.liq

# Restart Liquidsoap
sudo pkill liquidsoap
nohup liquidsoap /opt/radio/radio.liq > /tmp/liquidsoap.log 2>&1 &

# Trigger M3U Lambda
aws lambda invoke \
  --function-name amplify-gforgeiot-gerard--streamplaylistupdaterlam-qbTpNx6cATgr \
  --region eu-west-1 \
  response.json

# Wait 2-3 minutes
# Stream should be back on M3U system
```

**Rollback time: 5 minutes**

---

## 📊 Monitoring

### **CloudWatch Logs:**
```bash
# Lambda logs
aws logs tail /aws/lambda/[LAMBDA_NAME] --follow

# Look for:
# - "✅ Successfully added X track(s)"
# - "📊 Final queue size: 2"
# - Errors or warnings
```

### **SQS Metrics:**
```bash
# Queue depth (should stay at 1-2)
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=radio-track-stream-queue.fifo \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region eu-west-1
```

### **Stream Health:**
```bash
# Icecast status
curl -s http://79.125.44.178/status-json.xsl | \
  jq '.icestats.source[] | {mount, title, listeners}'
```

---

## ⚠️ Troubleshooting

### **Problem: Queue stays at 0**
```bash
# Check Lambda invocation
aws lambda invoke --function-name [LAMBDA_NAME] response.json
cat response.json

# Check CloudWatch logs
aws logs tail /aws/lambda/[LAMBDA_NAME]

# Check schedule
# Lambda should trigger hourly at :00
```

### **Problem: Liquidsoap not playing**
```bash
# Check if Liquidsoap is running
ps aux | grep liquidsoap

# Check logs
tail -100 /tmp/liquidsoap.log

# Test SQS polling manually
aws sqs receive-message \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo \
  --max-number-of-messages 1 \
  --wait-time-seconds 5 \
  --region eu-west-1
```

### **Problem: Lambda not triggered by Liquidsoap**
```bash
# Check EC2 IAM permissions
aws iam get-role-policy \
  --role-name amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju \
  --policy-name SQSStreamAccess

# Test Lambda invoke from EC2
ssh radio-ec2
aws lambda invoke \
  --function-name [LAMBDA_NAME] \
  --invocation-type Event \
  --region eu-west-1 \
  response.json
```

---

## ✅ Success Criteria

- [ ] Lambda deployed successfully
- [ ] SQS queue created (FIFO)
- [ ] Liquidsoap running with SQS config
- [ ] Queue initialized with 2 tracks
- [ ] First track playing on stream
- [ ] Queue auto-refills when < 2
- [ ] No gaps between tracks
- [ ] Lambda triggers every hour
- [ ] Playlist loops correctly

---

## 📝 Post-Deployment

### **Update Documentation:**
- [ ] Update `CHANGELOG.md` (v1.1.0 release)
- [ ] Mark M3U system as deprecated
- [ ] Update `README.md` with new architecture
- [ ] Add to `LAMBDA_FUNCTIONS.md`

### **Cleanup:**
- [ ] Remove `/var/radio/tracks/*` (after 24h)
- [ ] Comment out M3U code in stream-playlist-updater
- [ ] Delete M3U EventBridge rule (optional)

---

**Status:** 🟢 Ready to Deploy!  
**Next:** Run Step 1 - Deploy Backend  
**Owner:** Gerard  
**Date:** 13 November 2025
