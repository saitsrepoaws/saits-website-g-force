# Test Suite - Professional DJ Platform

Geautomatiseerde tests voor het valideren van de player en andere componenten na elke update.

## 📁 Structuur

```
tests/
├── smoke/              # Smoke tests (< 30 sec, kritieke functionaliteit)
│   └── player.smoke.test.ts
├── regression/         # Regression tests (2-5 min, alle functionaliteit)
│   └── player.regression.test.ts
├── e2e/                # End-to-end tests (toekomstig)
├── scripts/            # Test runner scripts
│   ├── run-smoke-tests.sh
│   ├── run-regression-tests.sh
│   └── run-all-tests.sh
└── README.md           # Deze file
```

## 🚀 Quick Start

### Installatie

```bash
# Install test dependencies
pnpm add -D vitest @vitest/ui @types/node

# Maak scripts uitvoerbaar
chmod +x tests/scripts/*.sh
```

### Run Tests

```bash
# Smoke tests (snel - < 30 sec)
./tests/scripts/run-smoke-tests.sh

# Regression tests (volledig - 2-5 min)
./tests/scripts/run-regression-tests.sh

# Alle tests (smoke + regression)
./tests/scripts/run-all-tests.sh
```

Of gebruik npm scripts:

```bash
pnpm test:smoke          # Smoke tests
pnpm test:regression     # Regression tests  
pnpm test:all            # Alle tests
```

## 🔍 Test Types

### Smoke Tests
**Doel:** Snelle validatie van kritieke functionaliteit  
**Duur:** < 30 seconden  
**Wanneer:** Na elke deployment, voor elke release  
**Scope:**
- Page availability (200 OK)
- SSL certificate validity
- Critical assets (logo, player HTML)
- Stream availability
- Metadata API responsiveness
- Security (blocked endpoints)
- CloudFront distribution
- Performance basics

**Test file:** `tests/smoke/player.smoke.test.ts`

### Regression Tests
**Doel:** Uitgebreide validatie van alle functionaliteit  
**Duur:** 2-5 minuten  
**Wanneer:** Voor major releases, na grote changes  
**Scope:**
- Complete UI components
- All network endpoints
- CORS configuration
- Cache behavior
- Complete metadata structure
- All security features
- SSL/TLS configuration
- Security headers
- Performance metrics
- Multi-domain support
- Failover & reliability
- Error handling

**Test file:** `tests/regression/player.regression.test.ts`

## 📝 Test Scenarios

### Smoke Test Scenarios

1. **Page Availability**
   - ✅ Player loads (200 OK)
   - ✅ Valid SSL certificate

2. **Critical Assets**
   - ✅ Logo loads
   - ✅ Essential HTML elements present

3. **Stream Availability**
   - ✅ Stream endpoint responds
   - ✅ Correct content type

4. **Metadata API**
   - ✅ Icecast status JSON available
   - ✅ Correct hostname

5. **Security**
   - ✅ Raw stream blocked (403)
   - ✅ Admin panel blocked (403)

6. **CloudFront**
   - ✅ CloudFront headers present
   - ✅ WWW subdomain works

7. **Performance**
   - ✅ Page loads < 3 seconds
   - ✅ Reasonable page size

### Regression Test Scenarios

1. **UI Components** (7 tests)
2. **Network & Streaming** (11 tests)
3. **Metadata & Status** (6 tests)
4. **Security Features** (10 tests)
5. **Performance Metrics** (6 tests)
6. **Multi-Domain Support** (4 tests)
7. **Failover & Reliability** (4 tests)

**Total:** ~48 regression tests

## 🔧 Configuration

### Environment Variables

```bash
# .env.test (optional)
VITE_PLAYER_URL=https://splashfm.nl
VITE_STREAM_URL=https://splashfm.nl/splashfm.mp3
VITE_STATUS_URL=https://splashfm.nl/status-json.xsl
```

### Vitest Config

Configuratie in `vitest.config.ts`:
- Test environment: Node
- Timeout: 30 seconds (network tests)
- Coverage: V8 provider
- Reporter: Verbose

## 📊 Test Results

### Expected Output

**Smoke Tests (PASSED):**
```
✅ 1. Page Availability (2 tests)
✅ 2. Critical Assets (2 tests)
✅ 3. Stream Availability (1 test)
✅ 4. Metadata API (1 test)
✅ 5. Security Checks (2 tests)
✅ 6. CloudFront Distribution (2 tests)
✅ 7. Performance (2 tests)

Total: 12 tests, 12 passed ✅
Duration: < 30 seconds
```

**Regression Tests (PASSED):**
```
✅ UI Components (7 tests)
✅ Network & Streaming (11 tests)
✅ Metadata & Status (6 tests)
✅ Security Features (10 tests)
✅ Performance Metrics (6 tests)
✅ Multi-Domain Support (4 tests)
✅ Failover & Reliability (4 tests)

Total: 48 tests, 48 passed ✅
Duration: 2-5 minutes
```

## 🐛 Troubleshooting

### Test Failures

**Problem:** Tests fail with network errors  
**Solution:** Check if player is accessible:
```bash
curl -I https://splashfm.nl/
```

**Problem:** SSL certificate validation fails  
**Solution:** Certificate might be expired or invalid:
```bash
openssl s_client -connect splashfm.nl:443 -servername splashfm.nl
```

**Problem:** Stream endpoint timeouts  
**Solution:** Check if Liquidsoap/Icecast are running:
```bash
aws ssm send-command \
  --instance-ids i-044ea4a949c8f562a \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["systemctl status liquidsoap icecast2"]'
```

### Debug Mode

Run tests with verbose output:
```bash
npx vitest run tests/smoke/ --reporter=verbose --no-coverage
```

Run specific test:
```bash
npx vitest run tests/smoke/player.smoke.test.ts -t "should load player page"
```

## 📈 Extending Tests

### Adding New Test File

1. Create test file:
```bash
touch tests/smoke/streaming.smoke.test.ts
```

2. Add test suite:
```typescript
import { describe, it, expect } from 'vitest'

describe('🎵 SMOKE TEST: Streaming Component', () => {
  it('should validate streaming functionality', async () => {
    // Test implementation
  })
})
```

3. Run tests:
```bash
./tests/scripts/run-smoke-tests.sh
```

### Adding New Component Tests

Volg deze structuur:
- `tests/smoke/[component].smoke.test.ts` - Kritieke tests
- `tests/regression/[component].regression.test.ts` - Complete tests

Componenten om tests voor te schrijven:
- [ ] Streaming (Liquidsoap, Icecast)
- [ ] IoT Publishing (metadata flow)
- [ ] Remote Control (IoT commands)
- [ ] AI Playlist Generator
- [ ] CloudFront Distribution
- [ ] SSL/Security
- [ ] Database (DynamoDB)
- [ ] Lambda Functions

## 🎯 Best Practices

1. **Smoke tests eerst** - Snel falen is beter dan langzaam
2. **Test critical paths** - Focus op user-facing functionaliteit
3. **Mock external deps** - Alleen test wat je controleert
4. **Clear test names** - Beschrijf WAT je test, niet HOE
5. **Independent tests** - Tests mogen geen side-effects hebben
6. **Fast feedback** - Smoke tests < 30 sec, regression < 5 min

## 📅 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: ./tests/scripts/run-smoke-tests.sh
      
  regression-tests:
    runs-on: ubuntu-latest
    needs: smoke-tests
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: ./tests/scripts/run-regression-tests.sh
```

## 📞 Support

**Issues?** Check:
1. Is player accessible? `curl https://splashfm.nl/`
2. Are services running? Check EC2 via SSM
3. Are env vars correct? Check `.env.test`
4. Is vitest installed? `npx vitest --version`

**Need help?** Review test output for specific failures and check the troubleshooting section above.

---

**Status:** ✅ Ready to use  
**Last Updated:** 16 November 2025  
**Test Coverage:** Player component (smoke + regression)  
**Total Tests:** 60 tests (12 smoke + 48 regression)
