# Scripts

Handige scripts voor het starten en stoppen van de development omgeving.

## 🚀 Start Scripts

### Start Alles (Sandbox + Dev Server)
```bash
./scripts/start-all.sh
```
Dit script:
1. Start Amplify Sandbox (--once mode)
2. Wacht tot sandbox klaar is
3. Kopieert `amplify_outputs.json` naar `apps/web/public/`
4. Start Vite dev server op http://localhost:5173

### Start Alleen Sandbox
```bash
./scripts/start-sandbox.sh
```
Start alleen de Amplify Sandbox en genereert `amplify_outputs.json`.

**Let op:** Je moet daarna handmatig de outputs kopiëren:
```bash
cp amplify_outputs.json apps/web/public/amplify_outputs.json
```

### Start Alleen Dev Server
```bash
./scripts/start-dev.sh
```
Start alleen de Vite dev server voor de web app.

**Vereist:** `amplify_outputs.json` moet al bestaan in `apps/web/public/`

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
