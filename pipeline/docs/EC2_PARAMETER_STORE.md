# EC2 Parameter Store Configuration

**Date:** 16 November 2025, 22:40 CET  
**Status:** ✅ IMPLEMENTED

---

## 🎯 Concept

**Before (Hardcoded):**
```typescript
backend.streamPlaylistUpdater.addEnvironment('EC2_INSTANCE_ID', 'i-021451e919d39c898')
```

**After (Parameter Store):**
```typescript
backend.streamPlaylistUpdater.addEnvironment('EC2_PARAM_PREFIX', '/gforge-radio/ec2')
grantEC2ParameterAccess(streamPlaylistLambda)
```

---

## 📦 Parameters Stored

**Namespace:** `/gforge-radio/ec2/`

| Parameter | Value | Description |
|-----------|-------|-------------|
| `/gforge-radio/ec2/instance-id` | `i-021451e919d39c898` | EC2 Stream Server Instance ID |
| `/gforge-radio/ec2/public-ip` | `79.125.44.178` | Current Public IP |
| `/gforge-radio/ec2/region` | `eu-west-1` | AWS Region |
| `/gforge-radio/ec2/elastic-ip` | (optional) | Elastic IP if assigned |

---

## 🔧 Implementation

### 1. Backend Setup (`backend.ts`)

```typescript
import { createEC2Parameters, grantEC2ParameterAccess } from './backend/ec2-config'

// Create parameters in Parameter Store
const ec2Config = createEC2Parameters(storageStack, {
  instanceId: 'i-021451e919d39c898',
  publicIp: '79.125.44.178',
  region: 'eu-west-1'
})

// Grant Lambda access
grantEC2ParameterAccess(streamPlaylistLambda, streamPlaylistLambda.stack)

// Environment variable (prefix only, not the full ID!)
backend.streamPlaylistUpdater.addEnvironment('EC2_PARAM_PREFIX', '/gforge-radio/ec2')
```

### 2. Lambda Function Usage

```typescript
import { getEC2Config, getEC2InstanceId } from '../shared/ec2-config'

export const handler = async (event) => {
  // Option 1: Get full config
  const config = await getEC2Config()
  console.log('Instance ID:', config.instanceId)
  console.log('Public IP:', config.publicIp)
  
  // Option 2: Get instance ID only (backwards compatible)
  const instanceId = await getEC2InstanceId()
  
  // Use in SSM commands, etc.
  const result = await ssm.send(new SendCommandCommand({
    InstanceIds: [config.instanceId],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: ['echo "Hello from Lambda!"']
    }
  }))
}
```

### 3. EC2 Scripts (Read Parameters)

```bash
#!/bin/bash

# Get instance ID from Parameter Store
INSTANCE_ID=$(aws ssm get-parameter --name "/gforge-radio/ec2/instance-id" --query "Parameter.Value" --output text)

# Get public IP
PUBLIC_IP=$(aws ssm get-parameter --name "/gforge-radio/ec2/public-ip" --query "Parameter.Value" --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
```

---

## 💡 Benefits

### 1. **No Hardcoded Values**
```typescript
❌ 'i-021451e919d39c898' // Bad: Hardcoded in 10+ places
✅ getEC2Config()           // Good: Single source of truth
```

### 2. **Easy Updates**
```bash
# Update instance ID (no code changes!)
aws ssm put-parameter \
  --name "/gforge-radio/ec2/instance-id" \
  --value "i-NEW-INSTANCE-ID" \
  --overwrite
```

### 3. **Environment Separation**
```
/gforge-radio-dev/ec2/instance-id   → Development EC2
/gforge-radio-prod/ec2/instance-id  → Production EC2
/gforge-radio/ec2/instance-id       → Default EC2
```

### 4. **Caching**
```typescript
// First call: Fetch from Parameter Store (~50ms)
const config1 = await getEC2Config()

// Second call: Use cached value (~0ms)
const config2 = await getEC2Config()
```

### 5. **Backwards Compatible**
```typescript
// Legacy code still works
const instanceId = process.env.EC2_INSTANCE_ID || await getEC2InstanceId()
```

---

## 🔒 IAM Permissions

### Lambda Execution Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParameterHistory",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:eu-west-1:035636364722:parameter/gforge-radio/ec2/*"
    }
  ]
}
```

**Granted via:**
```typescript
grantEC2ParameterAccess(lambdaFunction, stack)
```

### EC2 Instance Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:eu-west-1:035636364722:parameter/gforge-radio/ec2/*"
    }
  ]
}
```

---

## 📊 Cost

**Parameter Store (Standard Tier):**
- Storage: FREE (up to 10,000 parameters)
- API Calls: FREE (standard throughput)
- Total: **$0.00/month** ✅

**Advanced Tier (if needed):**
- Storage: $0.05 per parameter per month
- API Calls: $0.05 per 10,000 requests
- Total: ~$0.10/month for our usage

---

## 🧪 Testing

### 1. Verify Parameters Exist

```bash
# List all EC2 parameters
aws ssm get-parameters-by-path \
  --path "/gforge-radio/ec2" \
  --recursive

# Get specific parameter
aws ssm get-parameter \
  --name "/gforge-radio/ec2/instance-id"
```

### 2. Test Lambda Function

```typescript
// test/ec2-config.test.ts
import { getEC2Config, clearEC2ConfigCache } from '../functions/shared/ec2-config'

describe('EC2 Config', () => {
  beforeEach(() => {
    clearEC2ConfigCache()
  })

  it('should load config from Parameter Store', async () => {
    const config = await getEC2Config()
    
    expect(config.instanceId).toBe('i-021451e919d39c898')
    expect(config.publicIp).toBe('79.125.44.178')
    expect(config.region).toBe('eu-west-1')
  })

  it('should cache config', async () => {
    const config1 = await getEC2Config()
    const config2 = await getEC2Config()
    
    // Should return same object (cached)
    expect(config1).toBe(config2)
  })
})
```

### 3. Test EC2 Script

```bash
# On EC2 instance
cd /opt/radio
./scripts/test-parameter-store.sh
```

---

## 🔄 Migration Guide

### Step 1: Deploy Parameter Store

```bash
# Deploy backend with Parameter Store setup
pnpm exec ampx sandbox --once
```

### Step 2: Update Lambda Functions

```typescript
// OLD
const instanceId = process.env.EC2_INSTANCE_ID

// NEW
const instanceId = await getEC2InstanceId()
```

### Step 3: Update EC2 Scripts

```bash
# OLD
INSTANCE_ID="i-021451e919d39c898"

# NEW
INSTANCE_ID=$(aws ssm get-parameter --name "/gforge-radio/ec2/instance-id" --query "Parameter.Value" --output text)
```

### Step 4: Remove Hardcoded Values

```typescript
// Remove from backend.ts
❌ backend.streamPlaylistUpdater.addEnvironment('EC2_INSTANCE_ID', 'i-021451e919d39c898')

// Keep prefix only
✅ backend.streamPlaylistUpdater.addEnvironment('EC2_PARAM_PREFIX', '/gforge-radio/ec2')
```

---

## 📚 Files Modified

### Created:
- `/amplify/backend/ec2-config.ts` - Parameter Store setup
- `/amplify/functions/shared/ec2-config.ts` - Lambda helper
- `/pipeline/docs/EC2_PARAMETER_STORE.md` - This documentation

### Modified:
- `/amplify/backend.ts` - Use Parameter Store instead of hardcoded values
- Lambda functions (as needed) - Use `getEC2Config()` helper

---

## 🚨 Important Notes

### 1. **Parameter Store Region**
Parameters are region-specific! EC2 in `eu-west-1` needs parameters in `eu-west-1`.

### 2. **Cache Lifetime**
Config is cached for Lambda execution context lifetime (~15 min). Update Parameter Store + wait for new Lambda invocations.

### 3. **Backwards Compatibility**
Old environment variable `EC2_INSTANCE_ID` still works:
```typescript
// Try Parameter Store first, fall back to env var
const instanceId = await getEC2InstanceId()
```

### 4. **No Sensitive Data**
Instance IDs and IPs are not sensitive. Use SecureString type only for secrets (passwords, API keys).

---

## 🎯 Next Steps

### 1. Update All Lambda Functions
Replace `process.env.EC2_INSTANCE_ID` with `await getEC2InstanceId()`

### 2. Update EC2 Scripts
Create `/opt/radio/scripts/get-ec2-config.sh` helper

### 3. Add More Parameters
- VPC ID
- Security Group ID
- Subnet ID
- IAM Role ARN

### 4. Environment-Specific Prefixes
```
/gforge-radio-dev/ec2/*   → Development
/gforge-radio-staging/ec2/* → Staging
/gforge-radio-prod/ec2/*  → Production
```

---

## ✅ Summary

**What We Built:**
- ✅ Parameter Store for EC2 configuration
- ✅ Lambda helper for reading parameters
- ✅ IAM permissions for secure access
- ✅ Caching for performance
- ✅ Backwards compatibility

**Benefits:**
- 🎯 Single source of truth
- 🔄 Easy updates (no code changes!)
- 💰 FREE (Parameter Store standard tier)
- 🔒 Secure (IAM-based access)
- ⚡ Fast (caching)

**Gerard's Insight:**
"we zouden kunnen starten met de waarde die je nodig hebt parameter values in de parameter store te zetten"

**Result:** Perfect architecture for EC2 configuration management! 💪🎯
