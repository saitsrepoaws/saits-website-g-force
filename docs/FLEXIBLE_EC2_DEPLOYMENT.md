# 🎯 Flexible EC2 Deployment Pipeline

## 📖 Overzicht

De EC2 Stream Server is nu **OPTIONEEL** in de deployment pipeline!

**Voordelen:**
- ⚡ Snellere sandbox deploys (geen EC2 provisioning)
- 💰 Lagere kosten (geen EC2 running tijdens development)
- 🔧 Flexibel: Deploy EC2 alleen wanneer nodig
- 🚀 Lambda functions werken onafhankelijk (via Parameter Store)

---

## 🎮 Deployment Modes

### Mode 1: Serverless Only (Default)

**Wat wordt deployed:**
- ✅ Lambda Functions
- ✅ S3 Storage
- ✅ DynamoDB Tables
- ✅ SQS Queues
- ✅ AppSync GraphQL API
- ✅ Parameter Store
- ❌ EC2 Stream Server (NIET deployed)

**Use case:**
- Development
- Testing bulk upload pipeline
- UI development
- Cost saving

**Command:**
```bash
npm run sandbox
# of
npm run deploy:fresh
```

**Console output:**
```
⏭️  EC2 Stream Server: DISABLED (feature flag not set)
💡 To enable: export DEPLOY_EC2=true && npm run sandbox
📦 Deploying serverless components only (Lambda, S3, DynamoDB)
✅ Lambda functions will work with existing EC2 (via Parameter Store)
```

---

### Mode 2: Full Stack met EC2

**Wat wordt deployed:**
- ✅ Lambda Functions
- ✅ S3 Storage
- ✅ DynamoDB Tables
- ✅ SQS Queues
- ✅ AppSync GraphQL API
- ✅ Parameter Store
- ✅ **EC2 Stream Server** (EC2 + Icecast + Liquidsoap)

**Use case:**
- Production deployment
- Testing live streaming
- Complete radio station setup

**Command:**
```bash
npm run sandbox:ec2
# of
npm run deploy:ec2
# of
export DEPLOY_EC2=true && npm run sandbox
```

**Console output:**
```
🚀 EC2 Stream Server: ENABLED
📦 Deploying EC2 instance with Icecast + Liquidsoap...
✅ EC2 Stream Server Stack created
📦 EC2 info available via CloudFormation exports
🎙️ Stream Server (EC2 + Icecast + Liquidsoap + IoT) via Pipeline
✅ All software installed via CodeDeploy (no UserData!)
```

---

## 📋 Commands Overzicht

| Command | EC2 Deployed? | Watch Mode | Use Case |
|---------|---------------|------------|----------|
| `npm run sandbox` | ❌ No | ✅ Yes | Development (serverless only) |
| `npm run sandbox:ec2` | ✅ Yes | ✅ Yes | Development (full stack) |
| `npm run deploy:fresh` | ❌ No | ❌ No | Deploy once (serverless only) |
| `npm run deploy:ec2` | ✅ Yes | ❌ No | Deploy once (full stack) |

**Manual:**
```bash
# Serverless only
npm run sandbox

# Full stack with EC2
DEPLOY_EC2=true npm run sandbox
```

---

## 🔄 Workflow Examples

### Scenario 1: Development zonder streaming

```bash
# 1. Start sandbox (serverless only)
npm run sandbox

# 2. Develop features
# - Upload tracks
# - Test metadata extraction
# - UI development
# - No EC2 costs!

# 3. Test bulk upload
aws s3 cp music.mp3 s3://BUCKET/public/audio/bulk/
# → Lambda processes → DynamoDB ✅
```

**Cost:** ~$0.50/day (alleen Lambda + S3 + DynamoDB)

---

### Scenario 2: Production met streaming

```bash
# 1. Deploy full stack with EC2
npm run deploy:ec2

# 2. Wait for EC2 to start (~2 min)

# 3. Connect en install software
aws ssm start-session --target i-XXXXXXXXX
bash ec2-complete-install.sh

# 4. Start streaming
cd ec2-scripts && bash start-stream.sh

# 5. Verify stream
curl http://ELASTIC_IP:8000/status.xsl
```

**Cost:** ~$30-50/month (EC2 t3.medium + data transfer)

---

### Scenario 3: Switch tussen modes

```bash
# Start met serverless only
npm run sandbox

# Later: Enable EC2 when needed
npm run sandbox:ec2
# → EC2 wordt toegevoegd aan bestaande stack!

# Later: Disable EC2 weer
npm run sandbox
# → EC2 blijft draaien maar wordt niet meer ge-managed
```

---

## 🏗️ Architecture

### Serverless Only Mode

```
┌─────────────────────────────────────────────────────────────┐
│  SERVERLESS PIPELINE (Default)                               │
│                                                               │
│  Upload → S3 → SQS → Lambda → DynamoDB                      │
│            ↓                                                  │
│        Metadata extraction                                    │
│        Cover art generation                                   │
│        Waveform generation                                    │
│        Deduplication                                          │
│                                                               │
│  NO EC2 → Lower costs, faster deploys                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Full Stack Mode

```
┌─────────────────────────────────────────────────────────────┐
│  FULL STACK PIPELINE (DEPLOY_EC2=true)                       │
│                                                               │
│  Upload → S3 → SQS → Lambda → DynamoDB                      │
│            ↓                    ↓                            │
│        Processing         stream-playlist-updater            │
│                                ↓                             │
│                           EC2 Stream Server                   │
│                           ├─ Icecast                         │
│                           ├─ Liquidsoap                      │
│                           ├─ IoT Queue Listener              │
│                           └─ Audio Processing                │
│                                ↓                             │
│                           Live Stream 🎧                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Verification

### Check deployment mode

```bash
# Check CloudFormation stacks
aws cloudformation list-stacks \
  --region eu-west-1 \
  --query 'StackSummaries[?contains(StackName, `StreamServer`)].{Name:StackName, Status:StackStatus}'

# If EC2 deployed:
# → StreamServerStack exists

# If EC2 NOT deployed:
# → StreamServerStack missing (expected!)
```

### Check Lambda functions

```bash
# Lambda functions work in BOTH modes!
aws lambda list-functions \
  --region eu-west-1 \
  --query 'Functions[?contains(FunctionName, `stream`)].FunctionName'

# Output should include:
# - stream-playlist-updater
# - stream-track-pusher
# - stream-health-monitor
# - etc.
```

---

## 🎯 Best Practices

### Development

✅ **DO:**
- Use serverless mode during development
- Only enable EC2 when testing streaming
- Save costs by not running EC2 24/7

❌ **DON'T:**
- Run EC2 in development if not needed
- Deploy EC2 in every sandbox run

### Production

✅ **DO:**
- Deploy full stack with EC2
- Keep EC2 running 24/7
- Monitor EC2 health

❌ **DON'T:**
- Stop EC2 if streaming is active
- Forget to backup EC2 state

---

## 🐛 Troubleshooting

### EC2 not deploying

**Problem:** `npm run sandbox:ec2` doesn't deploy EC2

**Solution:**
```bash
# Check feature flag
echo $DEPLOY_EC2  # Should output: true

# If empty, set it:
export DEPLOY_EC2=true
npm run sandbox
```

### Lambda can't find EC2

**Problem:** stream-playlist-updater fails with "EC2 not found"

**Cause:** EC2 not deployed OR Parameter Store not updated

**Solution:**
```bash
# Option 1: Deploy EC2
npm run deploy:ec2

# Option 2: Update Parameter Store manually
aws ssm put-parameter \
  --name /gforce-radio/ec2/instance-id \
  --value "i-XXXXXXXXX" \
  --overwrite
```

### Cost too high

**Problem:** AWS bill too high

**Cause:** EC2 running 24/7 during development

**Solution:**
```bash
# Switch to serverless mode
npm run sandbox

# Stop EC2 instance
aws ec2 stop-instances --instance-ids i-XXXXXXXXX

# Later: Restart when needed
aws ec2 start-instances --instance-ids i-XXXXXXXXX
```

---

## 💰 Cost Comparison

| Component | Serverless Only | Full Stack with EC2 |
|-----------|----------------|---------------------|
| Lambda | ~$5/month | ~$5/month |
| S3 | ~$1/month | ~$1/month |
| DynamoDB | ~$2/month | ~$2/month |
| EC2 t3.medium | $0 | ~$30/month |
| Data Transfer | ~$0.50/month | ~$10/month |
| **TOTAL** | **~$8.50/month** | **~$48/month** |

**Savings:** ~$40/month by using serverless mode during development! 💰

---

## 🎊 Summary

**Flexible EC2 Deployment = SLIM! 🚀**

✅ Sneller deployen (geen EC2 wait time)  
✅ Lagere kosten (geen EC2 tijdens development)  
✅ Flexibel (deploy EC2 wanneer nodig)  
✅ Lambda functions werken altijd (via Parameter Store)  
✅ Production ready (full stack met 1 command)  

**Commands:**
```bash
# Development (serverless only)
npm run sandbox

# Production (full stack)
npm run sandbox:ec2
```

**KLAAR VOOR FLEXIBELE PIPELINE! 💪**
