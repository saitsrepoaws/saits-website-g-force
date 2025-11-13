# Scripts - Development Workflow

Handige scripts voor het starten en stoppen van de development omgeving.

## ⭐ **AANBEVOLEN: 2 Terminal Workflow**

Voor optimale development experience, gebruik **2 aparte terminal vensters**:

### **Terminal 1: Amplify Sandbox (Watch Mode)**
```bash
./scripts/start-sandbox.sh
```
- ✅ **Watch mode** - blijft draaien
- ✅ **Auto-detect** backend changes
- ✅ **Auto-redeploy** Lambda's, GraphQL schema, etc.
- ✅ **Updates** `amplify_outputs.json` automatisch

**Laat dit draaien tijdens hele development sessie!**

### **Terminal 2: Vite Dev Server (Hot Reload)**
```bash
./scripts/start-dev.sh
```
- ✅ **Hot reload** - instant browser updates
- ✅ **Auto-reload** bij frontend changes
- ✅ **Fast HMR** (Hot Module Replacement)
- ✅ **Dev server** op http://localhost:5173

**Laat dit draaien tijdens hele development sessie!**

---

## 📚 Volledige Documentatie

**Zie:** `/docs/DEVELOPMENT_WORKFLOW.md` voor complete uitleg van:
- 2-terminal setup
- Watch mode vs one-shot mode
- Auto-detect & auto-redeploy
- Troubleshooting tips

---

## 🔄 Oude Workflow (Legacy)

### Start Alles (One-Shot Mode)
```bash
./scripts/start-all.sh
```
⚠️ **Niet aanbevolen!** Dit script gebruikt `--once` mode:
- ❌ Sandbox stopt na 1x deploy
- ❌ Geen auto-detect van changes
- ❌ Moet opnieuw runnen bij elke change

**Gebruik liever de 2-terminal workflow hierboven!**

## 🛑 Stop Scripts

### Stop Alles
```bash
./scripts/stop-all.sh
```
Stopt alle draaiende processen:
- Vite dev server (port 5173)
- Amplify sandbox processen
- Gerelateerde Node processen

## 📋 Workflow

### Eerste keer opstarten:
```bash
# 1. Start sandbox + dev server
./scripts/start-all.sh

# 2. Open browser
# http://localhost:5173
```

### Dagelijkse workflow:
```bash
# Start
./scripts/start-all.sh

# ... werk aan je code ...

# Stop
./scripts/stop-all.sh
```

### Alleen frontend development:
Als de backend al draait en je wilt alleen de frontend aanpassen:
```bash
./scripts/start-dev.sh
```

## 🔧 Handmatige Commands

Als je meer controle wilt:

### Sandbox
```bash
# Start sandbox (once mode)
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir .

# Deploy (persistent environment)
pnpm --package=@aws-amplify/backend-cli dlx ampx deploy
```

### Dev Server
```bash
# Start dev server
pnpm --filter web dev

# Build production
pnpm --filter web build
```

### Outputs kopiëren
```bash
cp amplify_outputs.json apps/web/public/amplify_outputs.json
```

## 📚 Meer Info

Zie `/ref/cheatsheet.md` voor meer Amplify Gen 2 commands en tips.
