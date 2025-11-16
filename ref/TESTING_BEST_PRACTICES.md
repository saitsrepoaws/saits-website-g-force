# 🧪 Testing Best Practices - G-Forge IoT Radio

**Datum:** 16 November 2025  
**Status:** Active Policy  
**Mandatory:** YES - Run tests after every update!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 POLICY: TEST BEFORE COMMIT

**Gerard's Rule:**
> "doe jij nu over de BLOK PLAYER je automated test draaien met smoke test en de regressie testen graag en commit na testn belangrijk om dit na elke updat eronde te doen zet in dos in de ref en index en in je hoofdtje vast oke uddy"

**Translation:**
- ✅ Run automated tests BEFORE every commit
- ✅ Run both smoke AND regression tests
- ✅ Document results in ref/
- ✅ Update INDEX.md
- ✅ Commit test results WITH code changes

**This is NOT optional!** 🔴

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 WHEN TO RUN TESTS

### ALWAYS (Mandatory):
- Before committing code changes
- After fixing bugs
- After adding features
- After configuration changes
- After deployment to EC2
- After Nginx/Icecast updates

### RECOMMENDED:
- Daily (during active development)
- After merging branches
- Before releases
- After infrastructure changes

### OPTIONAL:
- During development (continuous testing)
- After minor doc updates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚀 TESTING WORKFLOW

### Step 1: Run Smoke Tests (< 30 sec)
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
npx vitest run tests/smoke/player.smoke.test.ts
```

**Purpose:** Quick validation of critical functionality  
**Duration:** < 30 seconds  
**Tests:** 12 critical path tests

**Pass Criteria:** ALL tests must pass (or known issues documented)

---

### Step 2: Run Regression Tests (2-5 min)
```bash
npx vitest run tests/regression/player.regression.test.ts
```

**Purpose:** Comprehensive validation of all functionality  
**Duration:** 2-5 minutes  
**Tests:** 38-48 complete tests

**Pass Criteria:** ≥ 90% pass rate (known issues allowed)

---

### Step 3: Document Results
```bash
# Create test report
touch ref/TEST_REPORT_[DATE].md

# Update INDEX.md
# Add report link to latest updates
```

**Required:**
- Date stamp
- Pass/fail counts
- Known issues
- Root cause analysis
- Fix recommendations

---

### Step 4: Commit Everything
```bash
git add .
git commit -m "test: automated tests post-[FEATURE] - 90% passing"
git push
```

**Commit Message Format:**
```
test: automated tests post-[FEATURE] - [X]% passing

Smoke: [X]/12 passed
Regression: [X]/48 passed
Known issues: [LIST]

Fixes validated:
- [FIX 1]
- [FIX 2]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ ACCEPTANCE CRITERIA

### ✅ Tests Pass:
- Smoke: ≥ 90% (11/12 minimum)
- Regression: ≥ 85% (40/48 minimum)
- No NEW failures
- Known issues documented

### ✅ Documentation:
- Test report created in ref/
- INDEX.md updated
- Known issues listed
- Fixes validated

### ✅ Commit:
- Code + test results committed together
- Clear commit message
- Test report included

### ❌ DO NOT COMMIT IF:
- New critical failures (not known issues)
- Tests haven't been run
- Results not documented
- < 80% pass rate (without justification)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 TEST COVERAGE REQUIREMENTS

### BLOK PLAY (Player):
- ✅ Smoke tests: 12 tests
- ✅ Regression tests: 48 tests
- ✅ Total: 60 tests

**Coverage:**
- Page availability: 100%
- SSL/HTTPS: 100%
- CORS: 100%
- Security: 100%
- Metadata API: 100%
- Performance: 100%
- Stream URL: Blocked by known issue

### Future BLOKs (TODO):
- ❌ LIBERY: 0 tests (manual only)
- ❌ PLAYLIST: 0 tests (manual only)
- ❌ PLANNER: 0 tests (manual only)
- ❌ EC2: 0 tests (manual only)
- ❌ STREAMING: 0 tests (manual only)

**Goal:** 100% automated coverage for all BLOKs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🐛 HANDLING TEST FAILURES

### New Failure (Not Known Issue):
1. ❌ **DO NOT COMMIT!**
2. Investigate root cause
3. Fix the issue
4. Re-run tests
5. Document in test report
6. Commit with fix

### Known Issue (Documented):
1. ✅ OK to commit (if ≥ 90% pass rate)
2. Reference issue number/report
3. Document in commit message
4. Track in issue tracker
5. Plan fix in next sprint

### Flaky Test:
1. Re-run 3 times
2. If still fails → treat as new failure
3. If passes → document as flaky
4. Fix flakiness ASAP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📈 TEST METRICS

### Track These Metrics:
- Pass rate (%)
- Failed test count
- Duration (seconds)
- Regression rate (new failures vs old)
- Coverage (% of code tested)

### Report Format:
```
Test Run: 16 Nov 2025, 02:20 CET
Smoke: 11/12 (91.7%) ✅
Regression: 34/38 (89.5%) ✅
Total: 45/50 (90%) ✅
Duration: 2.5 min
Known Issues: 5 (documented)
New Failures: 0 ✅
```

### Trend Analysis:
- Compare with previous run
- Track improvements
- Monitor regressions
- Document patterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 CONTINUOUS IMPROVEMENT

### After Each Test Run:
1. Review failures
2. Identify root causes
3. Fix issues
4. Add new tests for gaps
5. Improve coverage

### Monthly Review:
- Analyze test trends
- Update test suite
- Remove obsolete tests
- Add new coverage
- Optimize performance

### Quarterly Goals:
- Increase coverage to 100%
- Reduce test duration
- Eliminate flaky tests
- Automate more components

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚨 EMERGENCY BYPASS

**ONLY in production emergencies:**
- Critical bug in production
- Security vulnerability
- Service down

**Process:**
1. Document reason for bypass
2. Create emergency fix
3. Deploy immediately
4. Run tests AFTER deployment
5. Document results retroactively
6. Create follow-up ticket

**This should be RARE!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📚 RESOURCES

### Test Files:
- `tests/smoke/player.smoke.test.ts` - Smoke tests
- `tests/regression/player.regression.test.ts` - Regression tests
- `tests/README.md` - Complete test documentation

### Documentation:
- `ref/TEST_REPORT_16NOV2025.md` - Latest test report
- `ref/SMOKETEST_CHECKLIST_16NOV2025.md` - Manual checklist
- `ref/QUICK_TEST_GUIDE.md` - Quick test guide

### Commands:
```bash
# Smoke only
npx vitest run tests/smoke/

# Regression only
npx vitest run tests/regression/

# All tests
npm run test:all

# Watch mode (during development)
npx vitest --watch
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ CHECKLIST

Before every commit:

- [ ] Smoke tests run
- [ ] Regression tests run
- [ ] Results documented in ref/
- [ ] INDEX.md updated
- [ ] Known issues documented
- [ ] Pass rate ≥ 90%
- [ ] Commit message follows format
- [ ] Test report included

**If all checked:** ✅ **READY TO COMMIT!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Policy Owner:** Gerard  
**Enforced By:** Cascade AI  
**Effective Date:** 16 November 2025  
**Review Date:** Monthly

**Remember: Test-driven development = Happy Gerard! 🚀**
