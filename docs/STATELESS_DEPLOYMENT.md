# 🔧 Stateless Deployment - Parameter Store First

## 🎯 Probleem

Hardcoded configuratie waarden in code/files leiden tot:
- ❌ Oude Cognito User Pool Client IDs
- ❌ "User pool client 1romorvipedqlkllcmhesg51pp does not exist" errors
- ❌ Manual config updates nodig
- ❌ Deployment inconsistenties

## ✅ Oplossing: Parameter Store First

**Single Source of Truth: AWS Systems Manager Parameter Store**

Alle configuratie wordt:
1. Opgeslagen in SSM Parameter Store tijdens deployment
2. Opgehaald tijdens build time
3. NOOIT hardcoded in git
4. ALTIJD dynamisch gegenereerd

---

## 🏗️ Architectuur

```
┌─────────────────────────────────────────────────────────┐
│  DEPLOYMENT FLOW (Stateless)                            │
└─────────────────────────────────────────────────────────┘

1. Backend Deploy (Amplify CDK)
   ↓
2. SSM Parameters Created/Updated
   → /gforce-radio/auth/user-pool-id
   → /gforce-radio/auth/user-pool-client-id
   → /gforce-radio/auth/identity-pool-id
   → /gforce-radio/storage/bucket-name
   ↓
3. Build Process
   ↓
4. Fetch from Parameter Store (SSM)
   ↓
5. Generate Runtime Config
   ↓
6. Frontend uses LATEST values ✅

NO HARDCODED VALUES = NO STALE CONFIG!
```

---

## 📦 Parameter Store Structure

```bash
/gforce-radio/
├── auth/
│   ├── user-pool-id           # Cognito User Pool ID
│   ├── user-pool-client-id    # Cognito Client ID
│   └── identity-pool-id        # Cognito Identity Pool ID
├── storage/
│   └── bucket-name             # S3 Bucket Name
├── data/
│   └── appsync-url            # AppSync API URL (future)
└── bulk-upload/
    ├── queue-url               # SQS Queue URL
    ├── queue-arn               # SQS Queue ARN
    ├── s3-prefix               # Bulk upload S3 prefix
    └── lambda-name             # Bulk processor Lambda name
```

---

## 🚀 Gebruik

### Lokale Development

```bash
# Optie 1: Met auto-sync (aanbevolen)
npm run sandbox

# Optie 2: Fresh deployment met sync
npm run deploy:fresh

# Optie 3: Alleen config syncen
npm run sync-config

# Optie 4: Stateless build
npm run build:stateless
```

### CI/CD Pipeline

GitHub Actions workflow gebruikt automatisch Parameter Store:

```yaml
- name: Fetch config from Parameter Store
  run: |
    USER_POOL_CLIENT_ID=$(aws ssm get-parameter \
      --name /gforce-radio/auth/user-pool-client-id \
      --query 'Parameter.Value' \
      --output text)
    
    # Generate runtime config
    cat > apps/web/src/amplify_outputs.json << EOF
    {
      "auth": {
        "user_pool_client_id": "$USER_POOL_CLIENT_ID"
      }
    }
    EOF
```

---

## 🔍 Verificatie

### Check Parameter Store

```bash
# Alle parameters
aws ssm describe-parameters \
  --region eu-west-1 \
  --filters "Key=Name,Values=/gforce-radio/" \
  --query 'Parameters[*].[Name,LastModifiedDate]' \
  --output table

# Specifieke waarde
aws ssm get-parameter \
  --name /gforce-radio/auth/user-pool-client-id \
  --region eu-west-1 \
  --query 'Parameter.Value' \
  --output text
```

### Check Frontend Config

```bash
# Huidige frontend config
cat apps/web/src/amplify_outputs.json | jq '.auth.user_pool_client_id'

# Vergelijk met Parameter Store
PARAM_VALUE=$(aws ssm get-parameter \
  --name /gforce-radio/auth/user-pool-client-id \
  --region eu-west-1 \
  --query 'Parameter.Value' \
  --output text)

FRONTEND_VALUE=$(cat apps/web/src/amplify_outputs.json | jq -r '.auth.user_pool_client_id')

if [ "$PARAM_VALUE" == "$FRONTEND_VALUE" ]; then
  echo "✅ MATCH - Frontend uses latest config!"
else
  echo "❌ MISMATCH - Run: npm run sync-config"
fi
```

---

## 🛠️ Scripts

### 1. `sync-amplify-config.sh`

**Purpose:** Sync config met Parameter Store first, fallback naar amplify_outputs.json

**Features:**
- ✅ Fetches from Parameter Store (SSM)
- ✅ Falls back to amplify_outputs.json if SSM empty
- ✅ Generates frontend config
- ✅ Verifies correctness

```bash
./scripts/sync-amplify-config.sh
```

### 2. `build-with-params.sh`

**Purpose:** Stateless build met runtime config generation

**Features:**
- ✅ Parameter Store lookup
- ✅ Runtime config generation
- ✅ Zero hardcoded values
- ✅ Verification step

```bash
./scripts/build-with-params.sh
```

---

## 🔄 Deployment Workflows

### Development

```bash
# 1. Start sandbox
npm run sandbox

# Sandbox automatically:
# - Deploys backend
# - Creates/updates SSM parameters
# - Generates amplify_outputs.json
# - Runs sync-config hook
# - Frontend has latest config ✅
```

### Production

```bash
# 1. Deploy backend
npx ampx sandbox --once

# 2. Sync config
npm run sync-config

# 3. Build with latest config
npm run build

# 4. Deploy frontend
# (your deployment tool here)
```

### CI/CD

```yaml
- name: Deploy backend
  run: npx ampx sandbox --once

- name: Fetch from Parameter Store
  run: |
    # Script fetches all values from SSM
    ./scripts/build-with-params.sh

- name: Build frontend
  run: npm run build
```

---

## 🐛 Troubleshooting

### "User pool client does not exist"

**Oorzaak:** Frontend gebruikt oude hardcoded config

**Oplossing:**
```bash
# 1. Sync nieuwste config
npm run sync-config

# 2. Check Parameter Store
aws ssm get-parameter \
  --name /gforce-radio/auth/user-pool-client-id \
  --region eu-west-1

# 3. Herstart dev server
cd apps/web && npm run dev
```

### Parameter Store leeg

**Oorzaak:** Backend nog niet gedeployed met nieuwe CDK stack

**Oplossing:**
```bash
# Deploy backend om parameters aan te maken
npx ampx sandbox --once

# Wacht tot deployment compleet
# Check of parameters aangemaakt zijn
aws ssm describe-parameters \
  --region eu-west-1 \
  --filters "Key=Name,Values=/gforce-radio/"
```

### Config mismatch tussen Parameter Store en Frontend

**Oorzaak:** Sync script niet gedraaid

**Oplossing:**
```bash
# Re-sync config
npm run sync-config

# Verify
cat apps/web/src/amplify_outputs.json | jq '.auth.user_pool_client_id'
```

---

## 📊 Voordelen

| Aspect | Oud (Hardcoded) | Nieuw (Stateless) |
|--------|----------------|-------------------|
| **Config Source** | Git committed files | Parameter Store (AWS) |
| **Updates** | Manual file edits | Automatic from deployment |
| **Consistency** | ❌ Can drift | ✅ Always in sync |
| **CI/CD** | ❌ Manual config | ✅ Automatic fetch |
| **Debugging** | ❌ Hard to trace | ✅ Easy to verify |
| **Rollbacks** | ❌ Manual revert | ✅ Redeploy backend |
| **Secrets** | ❌ In git history | ✅ Secure in AWS |

---

## 🎯 Best Practices

1. **NEVER commit amplify_outputs.json to git**
   ```bash
   # Add to .gitignore
   echo "apps/web/src/amplify_outputs.json" >> .gitignore
   ```

2. **Always sync after backend deployment**
   ```bash
   npx ampx sandbox && npm run sync-config
   ```

3. **Verify config before builds**
   ```bash
   npm run sync-config
   npm run build
   ```

4. **Use Parameter Store in CI/CD**
   - Never hardcode in GitHub Actions
   - Always fetch at build time

5. **Keep backup of parameters**
   ```bash
   # Export all parameters
   aws ssm describe-parameters \
     --region eu-west-1 \
     --filters "Key=Name,Values=/gforce-radio/" > parameters-backup.json
   ```

---

## 🔐 Security

### Parameter Store Security

- ✅ All values stored in AWS SSM (encrypted at rest)
- ✅ IAM controls who can read/write
- ✅ Audit trail via CloudTrail
- ✅ No secrets in git history

### Access Control

```bash
# Required IAM permissions
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters",
    "ssm:DescribeParameters"
  ],
  "Resource": "arn:aws:ssm:eu-west-1:*:parameter/gforce-radio/*"
}
```

---

## 📚 Gerelateerde Documentatie

- [Deployment Pipeline](./DEPLOYMENT_PIPELINE.md)
- [Bulk Upload Guide](./BULK_UPLOAD_GUIDE.md)
- [AWS Parameter Store Docs](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)

---

## 🎉 Status

✅ **STATELESS DEPLOYMENT OPERATIONAL**

- Parameter Store integration: ✅
- Auto-sync scripts: ✅
- CI/CD workflow: ✅
- Documentation: ✅
- Zero hardcoded values: ✅

**Key: STATELESS = NO STALE CONFIG = SCHOON & FRIS! 🚀**
