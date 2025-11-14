# 🔐 TODO: Parameter Store & Secrets Manager Setup

**Priority:** Medium  
**Status:** TODO - Planned  
**Date Created:** 14 November 2025

---

## 🎯 **DOEL:**

Alle configuratie parameters en secrets (zoals Stereo Tool license key) migreren naar AWS Systems Manager Parameter Store en AWS Secrets Manager, zodat ze veilig en centraal beheerd kunnen worden per multi-tenant omgeving.

---

## 📋 **PARAMETERS & SECRETS TE MIGREREN:**

### **1. Stereo Tool:**
```
Type: Secret (License Key)

Current:
  - Hardcoded in /usr/local/bin/stereotool-relay.sh
  - License: <3fa047595fd7f30240fdd93981a10b3581c1a1812197a4f27c2dec0fec2c>

Target:
  AWS Secrets Manager:
  - /splashfm/prod/stereotool/license-key
  - /wildfm/prod/stereotool/license-key
  
  Per station eigen license mogelijk
```

### **2. Icecast Credentials:**
```
Type: Secret (Passwords)

Current:
  - /etc/icecast2/icecast.xml
  - source-password: gforge2024radio
  - admin-password: gforge2024admin

Target:
  AWS Secrets Manager:
  - /splashfm/prod/icecast/source-password
  - /splashfm/prod/icecast/admin-password
  - /wildfm/prod/icecast/source-password
  - /wildfm/prod/icecast/admin-password
```

### **3. S3 Bucket Names:**
```
Type: Parameter (Config)

Current:
  - Hardcoded in scripts
  - amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr

Target:
  AWS Parameter Store:
  - /splashfm/prod/s3/media-bucket
  - /splashfm/prod/s3/config-bucket
  - /wildfm/prod/s3/media-bucket
```

### **4. SQS Queue URLs:**
```
Type: Parameter (Config)

Current:
  - Hardcoded in radio.liq
  - https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo

Target:
  AWS Parameter Store:
  - /splashfm/prod/sqs/track-queue-url
  - /wildfm/prod/sqs/track-queue-url
```

### **5. Stream URLs:**
```
Type: Parameter (Config)

Current:
  - Hardcoded in configs
  - http://localhost:8000/stream.mp3

Target:
  AWS Parameter Store:
  - /splashfm/prod/stream/icecast-url
  - /splashfm/prod/stream/public-url
  - /wildfm/prod/stream/icecast-url
```

### **6. News Feed URLs:**
```
Type: Parameter (Config)

Current:
  - Hardcoded in Lambda
  - http://www.downloadlokaalmedia.nl/special/nieuwswildfm.mp3

Target:
  AWS Parameter Store:
  - /splashfm/prod/news/feed-url
  - /wildfm/prod/news/feed-url
```

### **7. Database Connection Info:**
```
Type: Secret (Connection strings)

Current:
  - Amplify managed

Target:
  AWS Secrets Manager:
  - /splashfm/prod/database/connection
  - Per station mogelijk eigen database
```

### **8. API Keys:**
```
Type: Secret

Future:
  - Spotify API key (voor metadata)
  - Last.fm API key (voor cover art)
  - etc.

Target:
  AWS Secrets Manager:
  - /splashfm/prod/api/spotify-key
  - /splashfm/prod/api/lastfm-key
```

---

## 🏗️ **PARAMETER STRUCTURE:**

### **Naming Convention:**
```
Pattern: /{station}/{environment}/{service}/{parameter}

Examples:
  /splashfm/prod/stereotool/license-key
  /splashfm/dev/icecast/source-password
  /wildfm/prod/sqs/track-queue-url
  /shared/prod/news/backup-feed-url
```

### **Per Station:**
```
/splashfm/
  └── prod/
      ├── stereotool/
      │   ├── license-key (Secret)
      │   └── web-port (Parameter)
      ├── icecast/
      │   ├── source-password (Secret)
      │   ├── admin-password (Secret)
      │   └── port (Parameter)
      ├── s3/
      │   ├── media-bucket (Parameter)
      │   └── config-bucket (Parameter)
      ├── sqs/
      │   └── track-queue-url (Parameter)
      ├── stream/
      │   ├── icecast-url (Parameter)
      │   └── public-url (Parameter)
      └── news/
          └── feed-url (Parameter)

/wildfm/
  └── prod/
      └── (same structure)
```

---

## 🔧 **IMPLEMENTATION PLAN:**

### **Phase 1: Create Parameters (Week 1)**
```bash
# 1. Create Parameter Store entries
aws ssm put-parameter \
  --name "/splashfm/prod/sqs/track-queue-url" \
  --type "String" \
  --value "https://sqs.eu-west-1.amazonaws.com/..." \
  --description "SQS queue URL for SplashFM production"

# 2. Create Secrets Manager entries
aws secretsmanager create-secret \
  --name "/splashfm/prod/stereotool/license-key" \
  --secret-string "3fa047595fd7f30240fdd93981a10b3581c1a1812197a4f27c2dec0fec2c" \
  --description "Stereo Tool license key for SplashFM"

# 3. Create IAM policies
# EC2 role needs:
#   - ssm:GetParameter
#   - secretsmanager:GetSecretValue
```

### **Phase 2: Update Scripts (Week 2)**
```bash
# Update stereotool-relay.sh
# FROM:
LICENSE_KEY="<hardcoded>"

# TO:
LICENSE_KEY=$(aws secretsmanager get-secret-value \
  --secret-id /splashfm/prod/stereotool/license-key \
  --query SecretString --output text)

# Update radio.liq
# FROM:
queue_url = "https://sqs.eu-west-1.amazonaws.com/..."

# TO:
queue_url = get_process_output("aws ssm get-parameter \
  --name /splashfm/prod/sqs/track-queue-url \
  --query Parameter.Value --output text")
```

### **Phase 3: Update Lambda Functions (Week 2)**
```typescript
// FROM:
const queueUrl = 'https://sqs.eu-west-1.amazonaws.com/...'

// TO:
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

const getParameter = async (name: string) => {
  const client = new SSMClient({ region: 'eu-west-1' })
  const response = await client.send(
    new GetParameterCommand({ Name: name })
  )
  return response.Parameter?.Value
}

const queueUrl = await getParameter('/splashfm/prod/sqs/track-queue-url')
```

### **Phase 4: Multi-Station Support (Week 3-4)**
```typescript
// Station-aware configuration
const station = process.env.STATION || 'splashfm'
const env = process.env.ENV || 'prod'

const getStationParameter = async (service: string, param: string) => {
  const name = `/${station}/${env}/${service}/${param}`
  return await getParameter(name)
}

// Usage:
const queueUrl = await getStationParameter('sqs', 'track-queue-url')
const licenseKey = await getStationSecret('stereotool', 'license-key')
```

---

## 🔒 **IAM PERMISSIONS:**

### **EC2 Role Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:eu-west-1:*:parameter/splashfm/*",
        "arn:aws:ssm:eu-west-1:*:parameter/wildfm/*",
        "arn:aws:ssm:eu-west-1:*:parameter/shared/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:eu-west-1:*:secret:/splashfm/*",
        "arn:aws:secretsmanager:eu-west-1:*:secret:/wildfm/*"
      ]
    }
  ]
}
```

### **Lambda Role Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:eu-west-1:*:parameter/${STATION}/${ENV}/*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:eu-west-1:*:secret:/${STATION}/${ENV}/*"
    }
  ]
}
```

---

## 💰 **KOSTEN:**

### **Parameter Store:**
```
Standard parameters: FREE
Advanced parameters: $0.05 per 10,000 API calls

Estimated:
  ~20 parameters per station
  ~2 stations
  ~1000 reads/day
  
  Cost: Negligible (< $1/month)
```

### **Secrets Manager:**
```
$0.40 per secret per month
$0.05 per 10,000 API calls

Estimated:
  ~5 secrets per station
  ~2 stations = 10 secrets
  
  Cost: ~$4/month
```

**Total: ~$5/month**

---

## ✅ **BENEFITS:**

```
✅ Centralized config management
✅ No hardcoded secrets in code
✅ Easy multi-station setup
✅ Environment-specific configs (dev/prod)
✅ Automatic rotation support (Secrets Manager)
✅ Audit trail (CloudTrail)
✅ IAM-based access control
✅ No git commit of secrets
```

---

## 📝 **MIGRATION CHECKLIST:**

### **Preparation:**
- [ ] Document all current parameters and secrets
- [ ] Design parameter naming structure
- [ ] Create IAM policies
- [ ] Test in dev environment

### **Parameter Store:**
- [ ] Create all parameters
- [ ] Test parameter retrieval
- [ ] Update EC2 scripts
- [ ] Update Lambda functions
- [ ] Test end-to-end

### **Secrets Manager:**
- [ ] Create all secrets
- [ ] Test secret retrieval
- [ ] Update scripts to use secrets
- [ ] Rotate test secrets
- [ ] Verify rotation works

### **Cleanup:**
- [ ] Remove hardcoded values from code
- [ ] Update documentation
- [ ] Backup old configs
- [ ] Delete temporary test parameters

---

## 🧪 **TESTING:**

### **Test Script:**
```bash
# Test parameter retrieval
aws ssm get-parameter \
  --name /splashfm/prod/sqs/track-queue-url \
  --query Parameter.Value --output text

# Test secret retrieval
aws secretsmanager get-secret-value \
  --secret-id /splashfm/prod/stereotool/license-key \
  --query SecretString --output text

# Test in Liquidsoap
test_queue_url = get_process_output("aws ssm get-parameter ...")
print("Queue URL: #{test_queue_url}")
```

---

## 📚 **DOCUMENTATION:**

### **To Create:**
```
- PARAMETER_STORE_GUIDE.md
- SECRETS_MANAGER_GUIDE.md
- MULTI_STATION_CONFIG.md
- IAM_POLICIES.md
```

---

## 🔗 **RELATED:**

```
- TODO_MULTI_STATION_FEATURE.md
- SERVER_CONFIG_VERSIONING.md
- PLAYER_VERSION_MANAGEMENT.md
```

---

## ⏰ **TIMELINE:**

```
Week 1: Design & create parameters
Week 2: Update scripts & Lambda
Week 3: Multi-station support
Week 4: Testing & documentation

Total: 1 month
```

---

**Priority:** Medium  
**Effort:** Medium (1 month)  
**Impact:** High (enables multi-tenant, better security)

**Status:** 📋 TODO - Ready for implementation

---

**Created:** 14 November 2025, 12:00 CET  
**Related to:** Multi-tenant support, Security best practices
