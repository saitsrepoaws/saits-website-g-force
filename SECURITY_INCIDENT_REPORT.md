# 🚨 SECURITY INCIDENT REPORT

**Date:** 17 November 2025, 12:05 CET  
**Severity:** CRITICAL  
**Status:** PARTIALLY MITIGATED - ACTION REQUIRED

---

## 📋 WHAT HAPPENED

During a security scan, the following credentials were found **EXPOSED ON GITHUB**:

### 1. ⚠️ AWS CREDENTIALS (CRITICAL!)
```
File:      .env.local (commit: 129baa7)
Exposure:  GitHub repository (public/private?)
Location:  https://github.com/saitsrepoaws/saits-website-g-force

Exposed Data:
- AWS_ACCESS_KEY_ID=AKIAQQTAXYWZJVIVNMVH
- AWS_SECRET_ACCESS_KEY=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
- AWS_DEFAULT_REGION=eu-west-1
- AWS_IOT_ENDPOINT=acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com
```

**Risk Level:** 🔴 CRITICAL
- Full AWS account access
- Can create/delete resources
- Can access all data
- Can incur costs

### 2. ⚠️ GITHUB PAT IN REMOTE URL
```
Token: ghp_GNIXF4yUILM8dCCHuGYJB********* (redacted)
Location: Git config (local only, NOT in GitHub)
```

**Risk Level:** 🟡 MEDIUM
- Only visible in local git config
- NOT exposed on GitHub
- Still should be rotated

---

## ✅ IMMEDIATE ACTIONS TAKEN

1. **Removed .env.local from git tracking** (commit: 1d7f3c2)
   - File removed from repository
   - Added to .gitignore
   - Future credentials protected

2. **Updated .gitignore**
   - Added: `.env`, `.env.local`, `.env.*.local`, `*.env`
   - Prevents future exposure

3. **Security fix pushed to GitHub**
   - Commit: 1d7f3c2
   - Branch: development

---

## 🚨 REQUIRED ACTIONS (DO THIS NOW!)

### STEP 1: ROTATE AWS CREDENTIALS IMMEDIATELY

**Why:** Credentials are ALREADY on GitHub (commit 129baa7)

**How:**
1. Go to: https://console.aws.amazon.com/iam/
2. Click: "Users" → Select your user
3. Go to: "Security credentials"
4. Find: Access key `AKIAQQTAXYWZJVIVNMVH`
5. Click: "Actions" → "Deactivate"
6. Click: "Actions" → "Delete"
7. Click: "Create access key"
8. Copy new credentials to **LOCAL** `.env.local` (NOT in git!)
9. Update local environment

**Verify:**
```bash
aws sts get-caller-identity
# Should show new credentials working
```

### STEP 2: ROTATE GITHUB PAT

**Why:** Extra security measure (not exposed but good practice)

**How:**
1. Go to: https://github.com/settings/tokens
2. Find token: `ghp_GNIXF4yUILM8dCCHuGYJB*********` (check local git remote)
3. Click: "Delete"
4. Create new token with same permissions
5. Update git remote:
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
git remote remove origin
git remote add origin https://NEW_PAT@github.com/saitsrepoaws/saits-website-g-force.git
```

### STEP 3: CHECK GITHUB REPOSITORY VISIBILITY

**Critical:** Is the repository PUBLIC or PRIVATE?

Check here: https://github.com/saitsrepoaws/saits-website-g-force/settings

**If PUBLIC:**
- 🚨 CRITICAL: Credentials exposed to EVERYONE!
- Change to PRIVATE immediately
- Rotate credentials ASAP

**If PRIVATE:**
- 🟡 MEDIUM: Only team members can see
- Still rotate credentials
- Less urgent but still important

### STEP 4: REVIEW AWS CLOUDTRAIL (Optional but Recommended)

Check if credentials were used by unauthorized parties:

1. Go to: https://console.aws.amazon.com/cloudtrail/
2. Select region: eu-west-1
3. Check "Event history"
4. Filter by: Access Key ID `AKIAQQTAXYWZJVIVNMVH`
5. Look for suspicious activity since: 17 Nov 2025, 12:00 CET

---

## 📊 IMPACT ASSESSMENT

### What Was Exposed:
- ✅ AWS credentials (can be rotated)
- ✅ AWS IoT endpoint (public info, OK)
- ✅ AWS region (public info, OK)
- ❌ No database credentials
- ❌ No private keys
- ❌ No user data

### Who Could Access:
- If repo is PUBLIC: Anyone on the internet
- If repo is PRIVATE: Only repo collaborators
- GitHub history: Commit 129baa7 contains credentials

### Potential Damage:
- 🔴 AWS resource creation/deletion
- 🔴 Data access (S3, DynamoDB, etc.)
- 🔴 Cost incurrence
- 🟡 IoT device access
- 🟢 No user data exposed (credentials only)

---

## 🛡️ PREVENTION MEASURES IMPLEMENTED

1. **✅ .gitignore updated**
   - All `.env` files excluded
   - Pattern matching for variations

2. **✅ .env.local removed from git**
   - File deleted from repository
   - Not tracked anymore

3. **✅ Documentation created**
   - This incident report
   - Security best practices

---

## 📚 BEST PRACTICES GOING FORWARD

### 1. Environment Variables
```bash
# ✅ CORRECT: Use .env.local (in .gitignore)
echo "AWS_ACCESS_KEY_ID=xxx" > .env.local

# ❌ WRONG: Never commit .env files
git add .env.local  # DON'T DO THIS!
```

### 2. Secrets Management
- Use AWS Secrets Manager for production
- Use AWS Systems Manager Parameter Store
- Use GitHub Secrets for CI/CD
- NEVER commit credentials to git

### 3. Pre-commit Checks
Consider adding:
```bash
# Install git-secrets
brew install git-secrets

# Setup
git secrets --install
git secrets --register-aws
```

### 4. Regular Audits
```bash
# Scan for secrets (what we just did)
git grep -i "AKIA"
git grep -E "aws_secret"
git grep -E "ghp_|github_pat_"
```

---

## 📋 CHECKLIST

Use this checklist to verify all steps are complete:

- [ ] AWS Access Key rotated
- [ ] New AWS credentials in local `.env.local`
- [ ] Old AWS credentials verified disabled
- [ ] GitHub PAT rotated
- [ ] Git remote URL updated with new PAT
- [ ] GitHub repository visibility checked
- [ ] CloudTrail reviewed for suspicious activity
- [ ] .env.local verified NOT in git
- [ ] .gitignore verified correct
- [ ] Team notified (if applicable)

---

## 📞 QUESTIONS?

**Q: Is my AWS account compromised?**  
A: Unknown until you check CloudTrail. Rotate credentials immediately to be safe.

**Q: Can I just delete the commit?**  
A: No! Git history is distributed. Anyone who cloned has the old commits.

**Q: Should I delete the repository?**  
A: No need if you rotate credentials. The fix (removing .env.local) is already pushed.

**Q: How do I prevent this in the future?**  
A: Follow the best practices section above. Use git-secrets. Review before pushing.

---

## 🎯 SUMMARY

**What happened:** AWS credentials committed to git and pushed to GitHub  
**Impact:** Potential full AWS account access  
**Fix:** Credentials removed from git, .gitignore updated  
**Required:** Rotate AWS credentials NOW  
**Status:** Partially mitigated, awaiting credential rotation  

**Priority:** 🔴 HIGH - Rotate credentials within 1 hour

---

**Report generated:** 17 November 2025, 12:05 CET  
**Last updated:** 17 November 2025, 12:05 CET  
**Next review:** After credential rotation
