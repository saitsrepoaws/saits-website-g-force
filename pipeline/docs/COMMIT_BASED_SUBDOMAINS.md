# Commit-Based Sandbox Subdomains

## 🎯 Concept

Automatically create temporary sandbox subdomains based on git commit hash for testing and preview deployments.

**Example:**
```
Commit: 28a3670
Sandbox: commit-28a3670
Subdomain: 28a3670.splashfm.nl
URL: https://28a3670.splashfm.nl
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Local Mac                                                   │
│  ┌─────────────┐    ┌──────────────┐   ┌─────────────────┐ │
│  │  Git Commit │ -> │  Pipeline    │-> │  Amplify Sandbox│ │
│  │  28a3670    │    │  Script      │   │  commit-28a3670 │ │
│  └─────────────┘    └──────────────┘   └─────────────────┘ │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │  AWS Route53                              │
        │  ┌─────────────────────────────────────┐ │
        │  │  Hosted Zone: splashfm.nl           │ │
        │  │                                      │ │
        │  │  CNAME Record:                      │ │
        │  │  28a3670.splashfm.nl                │ │
        │  │    ↓                                 │ │
        │  │  d1abc123.amplifyapp.com            │ │
        │  └─────────────────────────────────────┘ │
        └───────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │  AWS Amplify Hosting                      │
        │  ┌─────────────────────────────────────┐ │
        │  │  App: g-forge-iot-commit-28a3670    │ │
        │  │  SSL: ACM Certificate (auto)        │ │
        │  │  Build: Frontend + Backend          │ │
        │  └─────────────────────────────────────┘ │
        └───────────────────────────────────────────┘
```

---

## 🚀 Usage

### Deploy with Commit-Based Subdomain

Run the pipeline and select option 3:

```bash
./pipeline/scripts/deploy-local-pipeline.sh
```

**Output:**
```
Deployment options:
1) New sandbox with identifier (recommended)
2) Update existing sandbox
3) Commit-based subdomain (auto: 28a3670.splashfm.nl)
4) Skip deployment (artifact only)

Select option (1-4): 3
```

**Flow:**
1. ✅ Frontend build
2. ✅ Backend CDK synth
3. ✅ Amplify sandbox deploy
4. ✅ Route53 CNAME creation
5. ✅ SSL certificate provisioning (5-10 min)

---

## 📝 Manual Usage

### Create Subdomain

```bash
./pipeline/scripts/create-sandbox-subdomain.sh <amplify-app-id>
```

**Example:**
```bash
# Get commit hash
COMMIT=$(git rev-parse --short HEAD)
echo "Commit: $COMMIT"

# Deploy Amplify sandbox first
pnpm exec ampx sandbox --identifier "commit-$COMMIT" --once

# Get Amplify app ID
APP_ID=$(aws amplify list-apps --query "apps[?name=='g-forge-iot-commit-$COMMIT'].appId" --output text)

# Create subdomain
./pipeline/scripts/create-sandbox-subdomain.sh "$APP_ID"
```

### Cleanup Subdomain

After testing, remove the Route53 record:

```bash
./pipeline/scripts/cleanup-sandbox-subdomain.sh <commit-hash>
```

**Example:**
```bash
./pipeline/scripts/cleanup-sandbox-subdomain.sh 28a3670
```

---

## 🔧 Technical Details

### Route53 Configuration

**Hosted Zone:**
- ID: `Z047697515CJEX2WUTUFW`
- Domain: `splashfm.nl`

**Record Type:** CNAME
**TTL:** 300 seconds (5 minutes)
**Value:** Amplify default domain (e.g., `d1abc123.amplifyapp.com`)

### Amplify Configuration

**App Name:** `g-forge-iot-commit-<hash>`
**Sandbox ID:** `commit-<hash>`
**Custom Domain:** `<hash>.splashfm.nl`

**SSL Certificate:**
- Provisioned automatically by ACM
- Takes 5-10 minutes
- Validates via DNS (automatic)

---

## 🎯 Benefits

### 1. **Isolated Testing**
Each commit gets its own sandbox environment:
- No conflicts between branches
- Test multiple features in parallel
- Easy rollback to previous commit

### 2. **Clean URLs**
```
❌ https://d1abc123.amplifyapp.com
✅ https://28a3670.splashfm.nl
```

### 3. **Easy Sharing**
Share preview URLs with team:
```
"Check out the new feature: https://28a3670.splashfm.nl"
```

### 4. **Automatic Cleanup**
Simple script to remove old sandboxes:
```bash
# List all commit-based subdomains
aws route53 list-resource-record-sets \
  --hosted-zone-id Z047697515CJEX2WUTUFW \
  --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, 'splashfm.nl')]"

# Delete old ones
./pipeline/scripts/cleanup-sandbox-subdomain.sh <old-commit>
```

### 5. **CI/CD Ready**
Integrate with GitHub Actions:
```yaml
- name: Deploy Preview
  run: |
    ./pipeline/scripts/deploy-local-pipeline.sh <<< "3"
```

---

## 💰 Cost Analysis

### Route53 Costs
- **Hosted Zone:** $0.50/month (fixed)
- **DNS Queries:** $0.40 per million queries
- **CNAME Records:** Free (no extra cost)

**Example:**
- 10 sandboxes × 100 queries/day = 30,000 queries/month
- Cost: $0.01/month (negligible)

### Amplify Costs
- **Build Minutes:** Included in free tier (1000 min/month)
- **Hosting:** Included in free tier (15 GB/month)
- **Data Transfer:** $0.15/GB after 15 GB

**Example:**
- 5 sandboxes × 3 builds/day × 5 min/build = 450 min/month
- Storage: ~50 MB/sandbox = 250 MB total
- Cost: Free tier

### SSL Certificates
- **ACM:** Free for AWS services
- **Auto-renewal:** Free

**Total Extra Cost: ~$0.01/month** 🎉

---

## 🧹 Cleanup Strategy

### ✅ Automatic Cleanup (RECOMMENDED)
Use the integrated cleanup script that removes BOTH sandbox AND Route53 record:

```bash
# Delete sandbox + Route53 in one command
./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670
```

**What it does:**
1. ✅ Checks if commit-based sandbox
2. ✅ Deletes Route53 CNAME record
3. ✅ Deletes Amplify sandbox
4. ✅ Confirms before deletion
5. ✅ Shows cleanup summary

### Manual Cleanup (Legacy)
If you only want to delete the Route53 record:

```bash
# Delete Route53 record only
./pipeline/scripts/cleanup-sandbox-subdomain.sh 28a3670

# Delete Amplify sandbox separately
pnpm exec ampx sandbox delete --identifier commit-28a3670
```

### List All Sandboxes
View all sandboxes and Route53 records:

```bash
./pipeline/scripts/list-all-sandboxes.sh
```

**Output:**
- 📦 All Amplify sandboxes
- 🌐 All Route53 CNAME records
- ⚠️ Orphaned records (DNS without sandbox)
- 📊 Cleanup commands

### Bulk Cleanup by Age
Remove sandboxes older than X days (default: 7):

```bash
# Delete sandboxes older than 7 days
./pipeline/scripts/cleanup-old-sandboxes.sh

# Or specify custom age
./pipeline/scripts/cleanup-old-sandboxes.sh 14  # 14 days
```

**What it does:**
1. ✅ Scans all Amplify sandboxes
2. ✅ Finds sandboxes older than X days
3. ✅ Shows list for confirmation
4. ✅ Deletes sandbox + Route53 record
5. ✅ Reports success/failure

### Automated Cleanup (Future)
Lambda function that runs weekly:
1. List all Amplify sandboxes with `commit-*` prefix
2. Check last deployment date
3. Delete sandboxes older than 7 days
4. Delete corresponding Route53 records

---

## 🔒 Security

### DNS Records
- ✅ CNAME records are public (safe)
- ✅ No sensitive data exposed
- ✅ TTL = 300s (quick updates)

### Amplify Sandboxes
- ✅ IAM-protected (requires AWS credentials)
- ✅ Cognito authentication (same as production)
- ✅ API Gateway rate limiting
- ✅ CloudFront DDoS protection

### Best Practices
1. **Don't use production data** in sandbox environments
2. **Delete sandboxes** after testing (within 7 days)
3. **Monitor costs** in AWS Cost Explorer
4. **Use branch protection** for main/production branches

---

## 📚 Examples

### Example 1: Feature Branch Testing
```bash
# Switch to feature branch
git checkout feature/new-player

# Make changes and commit
git add .
git commit -m "feat: new player UI"

# Get commit hash
COMMIT=$(git rev-parse --short HEAD)
echo "Testing: https://$COMMIT.splashfm.nl"

# Deploy
./pipeline/scripts/deploy-local-pipeline.sh
# Select option 3

# Wait 5-10 min for SSL
# Test: https://abc1234.splashfm.nl

# After testing
./pipeline/scripts/cleanup-sandbox-subdomain.sh abc1234
```

### Example 2: Multiple Parallel Tests
```bash
# Developer A: Testing feature X
git checkout feature/player-enhancements
git commit -am "feat: add waveform"
# Deploy → https://a1b2c3d.splashfm.nl

# Developer B: Testing feature Y
git checkout feature/playlist-ui
git commit -am "feat: drag and drop"
# Deploy → https://e4f5g6h.splashfm.nl

# Both can test independently!
```

### Example 3: PR Preview URLs
```yaml
# .github/workflows/pr-preview.yml
name: PR Preview
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Preview
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          COMMIT=$(git rev-parse --short HEAD)
          echo "Preview URL: https://$COMMIT.splashfm.nl" >> $GITHUB_STEP_SUMMARY
          ./pipeline/scripts/deploy-local-pipeline.sh <<< "3"
```

---

## 🎓 Advanced Features (Future)

### 1. **Branch-Based Subdomains**
```
Branch: feature/new-player
Subdomain: new-player.splashfm.nl
```

### 2. **PR Number Subdomains**
```
PR: #42
Subdomain: pr-42.splashfm.nl
```

### 3. **Environment Labels**
```
Commit: 28a3670
Environment: staging
Subdomain: staging-28a3670.splashfm.nl
```

### 4. **Subdomain Recycling**
```
Sandbox Limit: 5
Old sandbox: 28a3670 (7 days old) → Auto-delete
New sandbox: 9876543 → Reuse resources
```

---

## 🐛 Troubleshooting

### DNS Not Resolving

**Problem:** `dig 28a3670.splashfm.nl` returns no results

**Solutions:**
1. Wait 5 minutes (DNS propagation)
2. Check Route53 record exists:
   ```bash
   aws route53 list-resource-record-sets \
     --hosted-zone-id Z047697515CJEX2WUTUFW \
     --query "ResourceRecordSets[?Name=='28a3670.splashfm.nl.']"
   ```
3. Verify TTL (should be 300)
4. Check CNAME value points to Amplify

### SSL Certificate Pending

**Problem:** `https://28a3670.splashfm.nl` shows certificate error

**Solutions:**
1. Wait 5-10 minutes (ACM provisioning)
2. Check Amplify console → Domain Management
3. Verify DNS validation completed
4. Force browser to refresh (Ctrl+Shift+R)

### Amplify App Not Found

**Problem:** Script can't find Amplify app ID

**Solutions:**
1. Manually get app ID:
   ```bash
   aws amplify list-apps --query "apps[].{Name:name,AppId:appId}"
   ```
2. Pass app ID directly:
   ```bash
   ./pipeline/scripts/create-sandbox-subdomain.sh <app-id>
   ```

---

## 🎯 Best Practices

### ✅ DO:
1. **Always use the integrated cleanup script**
   - `delete-sandbox-with-cleanup.sh` removes BOTH sandbox AND DNS
   - Prevents orphaned Route53 records
   
2. **List sandboxes regularly**
   - Run `list-all-sandboxes.sh` weekly
   - Check for orphaned records
   
3. **Cleanup old sandboxes**
   - Run `cleanup-old-sandboxes.sh` monthly
   - Default 7 days is good for testing
   
4. **Use descriptive commit messages**
   - Subdomain = commit hash
   - Good commit message helps identify sandbox
   
5. **Share sandbox URLs with team**
   - `https://28a3670.splashfm.nl` is professional
   - Better than `d1abc123.amplifyapp.com`

### ❌ DON'T:
1. **Don't delete sandbox manually without DNS cleanup**
   - Always use `delete-sandbox-with-cleanup.sh`
   - Orphaned DNS records cost money (minimal, but still)
   
2. **Don't keep sandboxes forever**
   - Delete after testing (within 7 days)
   - Use bulk cleanup for old sandboxes
   
3. **Don't use production data in sandboxes**
   - Sandboxes are for testing only
   - Use test/dummy data
   
4. **Don't share sandbox credentials**
   - Each developer deploys their own sandbox
   - Use same Cognito pool for auth

---

## ✅ Summary

**What We Built:**
- ✅ Automatic subdomain creation per commit
- ✅ Route53 integration (CNAME records)
- ✅ Amplify custom domain configuration
- ✅ SSL certificate provisioning (ACM)
- ✅ **Integrated cleanup script (sandbox + DNS)**
- ✅ **List all sandboxes script**
- ✅ **Bulk cleanup by age script**
- ✅ Pipeline integration (option 3)

**Benefits:**
- 🚀 Isolated testing per commit
- 🌐 Clean, professional URLs
- 💰 Cost: ~$0.01/month extra
- 🔒 Secure (same as production)
- 🧹 Automatic cleanup (no orphaned records!)

**Cleanup Commands:**
```bash
# List all sandboxes
./pipeline/scripts/list-all-sandboxes.sh

# Delete single sandbox (+ DNS)
./pipeline/scripts/delete-sandbox-with-cleanup.sh commit-28a3670

# Bulk cleanup (7 days old)
./pipeline/scripts/cleanup-old-sandboxes.sh
```

**Next Steps:**
- Deploy with option 3
- Test your feature
- Share URL with team
- Cleanup when done (automatic!)

**Gerard's Innovation:** Brilliant idea om de zone file te gebruiken + auto-cleanup! 💪🎯
