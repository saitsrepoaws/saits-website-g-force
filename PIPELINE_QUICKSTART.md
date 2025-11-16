# 🚀 CI/CD PIPELINE - QUICK START

**Voor Gerard - 16 November 2025**

---

## ⚡ SUPER QUICK DEPLOY (5 MINUTEN!)

### **Stap 1: GitHub Token**
```bash
# Ga naar: https://github.com/settings/tokens
# Klik: "Generate new token (classic)"
# Scopes: ✅ repo, ✅ admin:repo_hook
# Kopieer token

export GITHUB_TOKEN=ghp_jouw_token_hier
```

### **Stap 2: Configureer**
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot

# Repo (pas aan!)
export GITHUB_REPO=gerard/g-forge-iot  

# Email (optioneel)
export NOTIFICATION_EMAIL=your@email.com
```

### **Stap 3: Deploy Pipeline**
```bash
# Maak script uitvoerbaar
chmod +x scripts/deploy-pipeline.sh

# Deploy!
./scripts/deploy-pipeline.sh
```

**Klaar! Pipeline draait! 🎉**

---

## 📊 PIPELINE FLOW

```
Push code → GitHub
     ↓
Build (2-3 min)
     ↓
Smoke Tests (< 30 sec) ✅
     ↓
Regression Tests (2-5 min) ✅
     ↓
Deploy Staging ✅
     ↓
Manual Approval ✋ (JIJ beslist!)
     ↓
Deploy Production 🚀
```

---

## 🎯 EERSTE DEPLOYMENT TESTEN

```bash
# 1. Kleine change maken
echo "# Test" >> README.md

# 2. Commit & push
git add README.md
git commit -m "test: Pipeline test"
git push origin main

# 3. Watch magic happen!
# Open: https://console.aws.amazon.com/codesuite/codepipeline/
```

---

## ✅ CHECKLIST

- [ ] GitHub token gemaakt
- [ ] Environment vars gezet
- [ ] Pipeline deployed
- [ ] Code gepusht
- [ ] Pipeline draait!
- [ ] Tests passed!
- [ ] Staging deployed!
- [ ] Production approved!

---

## 🔗 BELANGRIJKE LINKS

**Pipeline:**  
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/gforge-radio-pipeline/view

**CodeBuild:**  
https://console.aws.amazon.com/codesuite/codebuild/projects

**S3 Artifacts:**  
https://s3.console.aws.amazon.com/s3/buckets/gforge-pipeline-artifacts

---

## 🆘 PROBLEMEN?

### Pipeline bestaat niet?
```bash
# Deploy opnieuw
./scripts/deploy-pipeline.sh
```

### Build faalt?
```bash
# Check logs
aws logs tail /aws/codebuild/gforge-build --since 30m --follow
```

### Tests falen?
```bash
# Run lokaal eerst
pnpm run test:smoke
pnpm run test:regression
```

---

## 📖 VOLLEDIGE DOCS

Zie: `ref/CI_CD_PIPELINE_COMPLETE_16NOV2025.md`

---

**Succes Gerard! Pipeline = MEGA PROF! 🚀**
