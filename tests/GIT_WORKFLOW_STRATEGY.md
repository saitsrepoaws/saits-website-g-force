# 🔄 GIT WORKFLOW STRATEGIE - LOKAAL vs REMOTE

**Gerard's Brilliant Idea: Dual Git Workflow**  
**Date:** 16 November 2025, 16:50 CET  
**Status:** ✅ DOCUMENTED

---

## 💡 HET IDEE

**Gebruik BEIDE git repositories voor verschillende doelen:**

- 🏠 **LOKALE GIT** → Testing & Development
- 🌍 **REMOTE GIT (GitHub)** → Releases & Production

**Voordeel:** Maximale flexibiliteit en controle!

---

## 🎯 WORKFLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  DEVELOPMENT CYCLE                                             │
│  ═══════════════════                                           │
│                                                                 │
│  1. Write Code                                                 │
│     ↓                                                          │
│  2. Commit LOKAAL                                              │
│     ↓                                                          │
│  3. Test LOKAAL                                                │
│     ├── Smoke tests                                           │
│     ├── Regression tests                                       │
│     ├── Amplify sandbox                                        │
│     └── Manual testing                                         │
│     ↓                                                          │
│  4. Iterate (repeat 1-3)                                       │
│     ↓                                                          │
│  5. Ready for Release?                                         │
│     ↓                                                          │
│  6. Push to REMOTE (GitHub)                                    │
│     ↓                                                          │
│  7. CodePipeline Triggers                                      │
│     ├── Build                                                  │
│     ├── Tests                                                  │
│     ├── Deploy Staging                                         │
│     ├── Manual Approval                                        │
│     └── Deploy Production                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏠 LOKALE GIT - VOOR TESTING

### **Purpose:**
- Snelle iteratie
- Experimenteren
- Testing
- Bug fixes
- Feature development

### **Workflow:**

```bash
# 1. Maak feature branch (lokaal)
git checkout -b feature/new-awesome-feature

# 2. Werk aan code
# ... coding ...

# 3. Commit lokaal
git add .
git commit -m "feat: Awesome feature WIP"

# 4. Test lokaal
pnpm run test:smoke
pnpm run test:regression

# 5. Deploy to local sandbox
pnpm exec ampx sandbox --once

# 6. Test manually
# Open http://localhost:3000

# 7. Iterate (repeat 2-6)
# ... more coding ...
git add .
git commit -m "feat: Awesome feature improvements"

# 8. Final testing
pnpm run test:all

# 9. Klaar voor release? → Push to remote!
```

### **Voordelen:**

✅ **Snel itereren** - Geen wachten op remote/pipeline  
✅ **Experimenteren** - Geen "dirty commits" op remote  
✅ **Privacy** - Code blijft lokaal tot je ready bent  
✅ **Offline werken** - Geen internet nodig  
✅ **Snelle rollback** - `git reset` zonder remote impact  
✅ **Test alles lokaal** - Voor je push naar production  

### **Commands:**

```bash
# Commit lokaal
git add .
git commit -m "feat: Feature description"

# Check history (lokaal)
git log --oneline

# Test changes
pnpm run test:all

# Deploy to sandbox (lokaal)
pnpm exec ampx sandbox

# Rollback (lokaal)
git reset --hard HEAD~1
```

---

## 🌍 REMOTE GIT (GITHUB) - VOOR RELEASES

### **Purpose:**
- Production releases
- Official versions
- Team collaboration
- CI/CD pipeline triggers
- Backup & archiving

### **Workflow:**

```bash
# 1. Test klaar lokaal? Push naar remote!
git push origin feature/new-awesome-feature

# 2. Create Pull Request op GitHub
# Review code
# Team approval

# 3. Merge naar main
# Pipeline triggers AUTOMATISCH:
#   - Build
#   - Smoke tests
#   - Regression tests
#   - Deploy to staging
#   - Manual approval (Gerard)
#   - Deploy to production

# 4. Tag release
git tag -a v1.2.0 -m "Release v1.2.0: Awesome feature"
git push origin v1.2.0

# 5. Production live! 🎉
```

### **Voordelen:**

✅ **Automated CI/CD** - Pipeline draait automatisch  
✅ **Quality gates** - Tests moeten passen  
✅ **Manual approval** - Gerard beslist production  
✅ **Team collaboration** - Pull Requests & Reviews  
✅ **Backup** - Code veilig op GitHub  
✅ **History** - Complete release history  

### **Commands:**

```bash
# Setup remote (first time only)
git remote add origin https://github.com/YOUR_USERNAME/g-forge-iot.git

# Push branch
git push origin feature-name

# Push main
git push origin main

# Push tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Check remotes
git remote -v
```

---

## 🔄 COMPLETE WORKFLOW VOORBEELD

### **Scenario: Nieuwe Feature**

```bash
# ═══════════════════════════════════════════════════════════════
# FASE 1: LOKALE DEVELOPMENT
# ═══════════════════════════════════════════════════════════════

# Maak feature branch
git checkout -b feature/metadata-improvements

# Werk aan feature
# ... coding metadata improvements ...

# Commit lokaal (vaak!)
git add amplify/functions/audio-metadata/
git commit -m "feat: Add BPM detection"

# Test lokaal
pnpm run test:smoke
# ✅ 12/12 tests passed

# Continue coding
# ... more improvements ...

git add .
git commit -m "feat: Add key detection"

# Test weer
pnpm run test:regression
# ✅ 45/48 tests passed

# Deploy to local sandbox
pnpm exec ampx sandbox --once
# ✅ Deployed successfully

# Test manually
# Open player, upload track, check metadata
# ✅ Works perfectly!

# Final commit
git add .
git commit -m "feat: Complete metadata improvements"

# ═══════════════════════════════════════════════════════════════
# FASE 2: READY FOR RELEASE
# ═══════════════════════════════════════════════════════════════

# Merge to main (lokaal)
git checkout main
git merge feature/metadata-improvements

# Final testing on main
pnpm run test:all
# ✅ All tests passed

# Push to GitHub
git push origin main

# ═══════════════════════════════════════════════════════════════
# FASE 3: AUTOMATED PIPELINE
# ═══════════════════════════════════════════════════════════════

# Pipeline triggers automatically on GitHub push:
# 
# 1. Build (2-3 min)
#    ✅ Dependencies installed
#    ✅ TypeScript compiled
#    ✅ Linting passed
#
# 2. Smoke Tests (< 30 sec)
#    ✅ 12/12 passed (>= 90%)
#
# 3. Regression Tests (2-5 min)
#    ✅ 45/48 passed (>= 85%)
#
# 4. Deploy to Staging
#    ✅ Deployed to staging.splashfm.nl
#
# 5. Manual Approval
#    📧 Email notification to Gerard
#    ⏸️  Waiting for approval...
#
#    Gerard tests staging:
#    - Upload track
#    - Check metadata
#    - Test player
#    ✅ Looks good!
#
#    Gerard clicks "Approve" in AWS Console
#
# 6. Deploy to Production
#    ✅ Deployed to splashfm.nl
#    ✅ Zero downtime
#
# 7. Production Live! 🎉

# Tag release
git tag -a v1.3.0 -m "Release v1.3.0: Improved metadata"
git push origin v1.3.0

# Done! 🎊
```

---

## 📊 COMPARISON

| Feature | Lokale Git | Remote Git (GitHub) |
|---------|-----------|---------------------|
| **Speed** | ⚡ Instant | 🐢 ~10 min (pipeline) |
| **Testing** | 🧪 Manual | 🤖 Automated |
| **Privacy** | 🔒 Private | 🌍 Can be public |
| **Collaboration** | ❌ Solo only | ✅ Team access |
| **Backup** | ⚠️ Local only | ✅ Cloud backup |
| **CI/CD** | ❌ Manual | ✅ Automated |
| **Rollback** | ⚡ Instant | 🐢 Slower |
| **Approval** | ❌ None | ✅ Manual gates |
| **Cost** | 💰 Free | 💰 ~$7/month |

---

## 🎯 BEST PRACTICES

### **DO's ✅**

1. **Commit vaak lokaal**
   ```bash
   # Elke kleine verbetering = commit
   git commit -m "feat: Small improvement"
   ```

2. **Test ALTIJD lokaal eerst**
   ```bash
   pnpm run test:all
   pnpm exec ampx sandbox
   ```

3. **Gebruik duidelijke commit messages**
   ```bash
   # Good:
   git commit -m "feat: Add BPM detection to metadata"
   
   # Bad:
   git commit -m "update"
   ```

4. **Tag releases op GitHub**
   ```bash
   git tag -a v1.0.0 -m "Production release v1.0.0"
   git push origin v1.0.0
   ```

5. **Gebruik branches voor features**
   ```bash
   git checkout -b feature/awesome-thing
   ```

### **DON'Ts ❌**

1. **NOOIT force push naar main**
   ```bash
   # NEVER DO THIS:
   git push -f origin main  # ❌ DANGER!
   ```

2. **Niet pushen met failing tests**
   ```bash
   # Run tests first:
   pnpm run test:all
   # Only push if passed!
   ```

3. **Geen secrets in commits**
   ```bash
   # NEVER commit:
   # - API keys
   # - Passwords
   # - Tokens
   # Use .env files (in .gitignore)
   ```

4. **Niet direct naar main pushen** (gebruik PR's)
   ```bash
   # Good workflow:
   git push origin feature-branch
   # Then: Create PR on GitHub
   ```

---

## 🧪 TESTING STRATEGIE

### **Lokaal (Voor Push):**

```bash
# 1. Unit tests
pnpm run test

# 2. Smoke tests
pnpm run test:smoke
# Must pass: >= 90% (11/12)

# 3. Regression tests
pnpm run test:regression
# Must pass: >= 85% (40/48)

# 4. Type checking
pnpm run typecheck

# 5. Linting
pnpm run lint

# 6. Manual testing
pnpm exec ampx sandbox
# Test in browser

# 7. ALL PASS? → Push to GitHub!
```

### **Remote (Automated):**

```
Pipeline automatically runs:
1. Build
2. Smoke tests (< 30 sec)
3. Regression tests (2-5 min)
4. Deploy staging
5. Manual approval (Gerard)
6. Deploy production

If ANY step fails → Pipeline stops!
```

---

## 🔧 SETUP

### **1. Lokale Git (Already Active!)**

```bash
# Check status
git status

# Commit
git add .
git commit -m "Your message"

# View history
git log --oneline

# Done! ✅
```

### **2. Remote Git (Setup When Ready)**

```bash
# Create repo on GitHub
# Visit: https://github.com/new

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/g-forge-iot.git

# Verify
git remote -v

# Create main branch
git branch -M main

# Push
git push -u origin main

# Done! ✅
```

### **3. CodePipeline (Deploy After Remote Setup)**

```bash
cd codedeploy-pipeline

# Set credentials
export GITHUB_OWNER=your-username
export GITHUB_REPO=g-forge-iot
export GITHUB_TOKEN=ghp_your_token

# Deploy pipeline
./scripts/deploy.sh

# Done! ✅
```

---

## 📝 COMMIT MESSAGE CONVENTION

### **Format:**

```
<type>: <description>

[optional body]

[optional footer]
```

### **Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style (formatting, etc)
- `refactor:` - Code refactoring
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks

### **Examples:**

```bash
# Feature
git commit -m "feat: Add BPM detection to audio metadata"

# Bug fix
git commit -m "fix: Resolve stream latency issue"

# Documentation
git commit -m "docs: Update deployment guide"

# Refactor
git commit -m "refactor: Optimize playlist generation algorithm"

# Test
git commit -m "test: Add smoke tests for player connect"

# Chore
git commit -m "chore: Update dependencies"
```

---

## 🚀 DEPLOYMENT MATRIX

| Environment | Trigger | Tests | Approval | Cost |
|------------|---------|-------|----------|------|
| **Local Sandbox** | Manual | Manual | None | Free |
| **Staging** | GitHub Push | Automated | None | $5/month |
| **Production** | Manual Approval | Automated | Required | $15/month |

---

## 🎯 QUICK REFERENCE

### **Lokale Development:**

```bash
# Start
git checkout -b feature/name

# Work
# ... code ...
git add .
git commit -m "feat: Description"

# Test
pnpm run test:all
pnpm exec ampx sandbox

# Repeat until ready
```

### **Release to Production:**

```bash
# Merge to main
git checkout main
git merge feature/name

# Push to GitHub
git push origin main

# Pipeline runs automatically
# Approve production deployment in AWS Console

# Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Done! 🎉
```

---

## 📊 METRICS TO TRACK

### **Lokale Development:**

- Commits per day
- Test pass rate
- Time to fix bugs
- Feature completion time

### **Remote Releases:**

- Pipeline success rate
- Time from push to production
- Failed deployments
- Rollback frequency

---

## ✅ CHECKLIST

### **Before Push to Remote:**

- [ ] All tests pass locally
- [ ] Code is linted
- [ ] Types check
- [ ] Manual testing done
- [ ] Commit messages clear
- [ ] No secrets in code
- [ ] Documentation updated

### **After Push to Remote:**

- [ ] Monitor pipeline
- [ ] Check build logs
- [ ] Verify test results
- [ ] Test staging environment
- [ ] Approve production (if ready)
- [ ] Monitor production
- [ ] Tag release

---

## 🎉 SUMMARY

**Gerard's Dual Git Strategy:**

🏠 **LOKAAL** = Fast iteration, testing, experimentation  
🌍 **REMOTE** = Official releases, automated CI/CD, production

**Best of both worlds!** 🚀

**Setup Time:** 5 minutes  
**Benefits:** Unlimited  
**Cost:** Free (lokaal) + $7/month (remote pipeline)  

---

**Created:** 16 November 2025, 16:50 CET  
**By:** Gerard + Cascade AI  
**Status:** ✅ ACTIVE STRATEGY
