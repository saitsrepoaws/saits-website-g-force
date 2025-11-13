# 🚀 Development Workflow - Best Practice

## **📋 Recommended Setup: 2 Terminal Windows**

Voor optimale development experience, gebruik **2 aparte terminal vensters**:

```
Terminal 1: Amplify Sandbox (watch mode)
Terminal 2: Vite Dev Server (hot reload)
```

---

## **🎯 Terminal 1: Amplify Sandbox (Backend)**

### **Start:**
```bash
./scripts/start-sandbox.sh
```

**Of direct:**
```bash
npx ampx sandbox
```

### **Wat doet het:**
- ✅ **Deploys backend** (GraphQL schema, Lambda's, Auth, Storage, etc.)
- ✅ **Watch mode** - blijft draaien
- ✅ **Auto-detect changes** in `amplify/` folder
- ✅ **Auto-redeploy** bij code changes
- ✅ **Updates** `amplify_outputs.json` automatisch

### **Output:**
```
✔ Backend synthesized in 5.36 seconds
✔ Updated AWS::Lambda::Function playlist-generator-lambda
✔ Deployment completed in 26.436 seconds
AppSync API endpoint = https://...
```

### **Wanneer redeploy:**
- ✅ GraphQL schema changes (`amplify/data/resource.ts`)
- ✅ Lambda code changes (`amplify/functions/**/handler.ts`)
- ✅ Lambda permissions changes (`amplify/backend.ts`)
- ✅ Auth/Storage config changes

### **Laat draaien:**
Blijf dit terminal venster open en draaiend! 
Sandbox detecteert changes automatisch.

---

## **🌐 Terminal 2: Vite Dev Server (Frontend)**

### **Start:**
```bash
./scripts/start-dev.sh
```

**Of direct:**
```bash
pnpm --filter web dev
```

### **Wat doet het:**
- ✅ **Start Vite dev server** op `http://localhost:5173`
- ✅ **Hot reload** - instant browser updates
- ✅ **Auto-reload** bij frontend changes
- ✅ **Fast HMR** (Hot Module Replacement)

### **Output:**
```
VITE v5.4.21  ready in 124 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### **Wanneer reload:**
- ✅ React components (`*.tsx`, `*.jsx`)
- ✅ CSS/Tailwind changes
- ✅ TypeScript files
- ✅ Assets (images, etc.)

### **Laat draaien:**
Blijf dit terminal venster open en draaiend!
Vite reload browser automatisch.

---

## **⚡ Development Flow:**

### **1. Initial Setup (EENMALIG):**
```bash
# Terminal 1
./scripts/start-sandbox.sh
# Wacht ~2-3 min voor eerste deploy

# Terminal 2
./scripts/start-dev.sh
# Open browser: http://localhost:5173
```

### **2. Backend Changes:**
```typescript
// Edit: amplify/functions/playlist-generator/handler.ts
// Wijzig Lambda code

// Terminal 1 (sandbox) detecteert automatisch:
✔ File change detected
✔ Rebuilding Lambda...
✔ Updated AWS::Lambda::Function playlist-generator-lambda
✔ Deployment completed

// Browser refresh → nieuwe Lambda code actief! ✅
```

### **3. Frontend Changes:**
```typescript
// Edit: apps/web/src/pages/devices/Playlist.tsx
// Wijzig React component

// Terminal 2 (Vite) reload automatisch:
✔ page reload src/pages/devices/Playlist.tsx

// Browser update automatisch! ✅ (geen refresh nodig)
```

### **4. GraphQL Schema Changes:**
```typescript
// Edit: amplify/data/resource.ts
// Voeg field toe aan Track model

// Terminal 1 (sandbox) detecteert automatisch:
✔ Schema change detected
✔ Updating GraphQL API...
✔ Updated AWS::AppSync::GraphQLSchema
✔ Deployment completed

// amplify_outputs.json wordt bijgewerkt
// Browser refresh → nieuwe schema actief! ✅
```

---

## **❌ OUDE Workflow (niet aanbevolen):**

```bash
# ❌ start-all.sh gebruikt --once flag
./scripts/start-all.sh

# Nadelen:
❌ Sandbox draait maar 1x (no watch)
❌ Bij code changes: moet je opnieuw draaien
❌ Beide processen in 1 terminal (moeilijk te stoppen)
❌ Geen automatische redeploy
```

---

## **✅ NIEUWE Workflow (aanbevolen):**

```bash
# Terminal 1: Sandbox (watch mode)
./scripts/start-sandbox.sh

# Terminal 2: Dev server (hot reload)
./scripts/start-dev.sh

# Voordelen:
✅ Beide blijven draaien
✅ Auto-detect alle changes
✅ Aparte terminals (makkelijk te stoppen)
✅ Snellere development cycle
✅ Geen manual redeploy nodig
```

---

## **🛠️ Troubleshooting:**

### **"No changes detected"**
```bash
# Terminal 1: Ctrl+C
# Herstart sandbox:
./scripts/start-sandbox.sh
```

### **"Lambda not updated"**
```bash
# Check of sandbox draait in Terminal 1
# Als niet: start ./scripts/start-sandbox.sh
# Sandbox MOET draaien voor auto-deploy!
```

### **"Browser niet updated"**
```bash
# Check of Vite draait in Terminal 2
# Als niet: start ./scripts/start-dev.sh
# Hard refresh browser: Cmd+Shift+R (Mac)
```

### **"amplify_outputs.json missing"**
```bash
# Wacht tot eerste sandbox deploy compleet is
# Check output in Terminal 1:
# "✔ Deployment completed"
# Dan pas Terminal 2 starten
```

---

## **📊 Comparison:**

| Feature | Old (start-all.sh) | New (2 terminals) |
|---------|-------------------|-------------------|
| Backend watch | ❌ No (`--once`) | ✅ Yes |
| Frontend reload | ✅ Yes | ✅ Yes |
| Auto-redeploy Lambda | ❌ No | ✅ Yes |
| Separate terminals | ❌ No | ✅ Yes |
| Easy to stop | ❌ No | ✅ Yes |
| Development speed | 🐌 Slow | ⚡ Fast |

---

## **🎯 Recommended Workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│ Terminal 1: Amplify Sandbox (watch backend changes)         │
├─────────────────────────────────────────────────────────────┤
│ $ ./scripts/start-sandbox.sh                                │
│                                                              │
│ ✔ Backend synthesized                                       │
│ ✔ Watching for changes...                                   │
│ ✔ [File change detected] Rebuilding...                      │
│ ✔ Deployment completed                                      │
│                                                              │
│ LAAT DRAAIEN → Auto-detect & redeploy                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Terminal 2: Vite Dev Server (hot reload frontend)           │
├─────────────────────────────────────────────────────────────┤
│ $ ./scripts/start-dev.sh                                    │
│                                                              │
│ VITE ready in 124ms                                          │
│ ➜  Local:   http://localhost:5173/                          │
│                                                              │
│ ✔ [HMR] page reload...                                      │
│                                                              │
│ LAAT DRAAIEN → Auto-reload browser                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Browser: http://localhost:5173                              │
├─────────────────────────────────────────────────────────────┤
│ • Frontend changes → instant update (no refresh)            │
│ • Backend changes → refresh once                            │
│ • Fast development cycle ⚡                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## **💡 Pro Tips:**

1. **Altijd 2 terminals gebruiken** voor development
2. **Laat sandbox draaien** tijdens hele development sessie
3. **Backend change?** → Wacht op "Deployment completed" in Terminal 1 → Browser refresh
4. **Frontend change?** → Browser update automatisch (no action needed)
5. **Einde van de dag:** Ctrl+C in beide terminals

---

**HAPPY CODING! 🚀**
