# 🚀 Deployment Pipeline - Config Management

## Probleem

De frontend gebruikte soms oude Cognito User Pool Client IDs, wat leidde tot authentication errors:
```
User pool client 1romorvipedqlkllcmhesg51pp does not exist
```

## Oplossing

**Automatische config synchronisatie** - Altijd de nieuwste configuratie gebruiken!

---

## 📦 Hoe het werkt

### 1. **Parameter Store (Backend)**

Alle belangrijke configuratie wordt opgeslagen in AWS Systems Manager Parameter Store:

```typescript
// In amplify/backend.ts
new ssm.StringParameter(backend.auth.resources.userPool.stack, 'UserPoolId', {
  parameterName: '/gforce-radio/auth/user-pool-id',
  stringValue: backend.auth.resources.userPool.userPoolId,
  description: 'Cognito User Pool ID'
})

new ssm.StringParameter(backend.auth.resources.userPool.stack, 'UserPoolClientId', {
  parameterName: '/gforce-radio/auth/user-pool-client-id',
  stringValue: backend.auth.resources.userPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID'
})

// + Identity Pool ID en Storage Bucket Name
```

**Parameters:**
- `/gforce-radio/auth/user-pool-id`
- `/gforce-radio/auth/user-pool-client-id`
- `/gforce-radio/auth/identity-pool-id`
- `/gforce-radio/storage/bucket-name`

### 2. **Config Sync Script**

Automatisch script dat `amplify_outputs.json` kopieert naar de frontend:

```bash
./scripts/sync-amplify-config.sh
```

**Wat het doet:**
1. ✅ Controleert of `amplify_outputs.json` bestaat
2. 📋 Kopieert naar `apps/web/src/amplify_outputs.json`
3. 📊 Toont huidige configuratie (User Pool ID, Client ID, etc.)

### 3. **Post-Deployment Hook**

Automatisch uitgevoerd na elke `ampx sandbox` deployment:

```bash
.amplify/hooks/post-sandbox-deploy.sh
```

---

## 🎯 Gebruik

### Automatisch (Aanbevolen)

```bash
# Start sandbox - config wordt automatisch gesynct
npm run sandbox

# Of direct ampx gebruiken
npx ampx sandbox
```

### Handmatig

Als je alleen de config wilt syncen zonder nieuwe deployment:

```bash
npm run sync-config
```

---

## 🔍 Verificatie

Controleer of de juiste config gebruikt wordt:

```bash
# Toon huidige frontend config
cat apps/web/src/amplify_outputs.json | jq '.auth'

# Vergelijk met Parameter Store
aws ssm get-parameter \
  --name /gforce-radio/auth/user-pool-client-id \
  --region eu-west-1 \
  --query 'Parameter.Value' \
  --output text
```

---

## 📋 Deployment Checklist

Bij elke deployment:

1. ✅ **Deploy backend**: `npx ampx sandbox`
2. ✅ **Config sync**: Gebeurt automatisch via hook
3. ✅ **Frontend reload**: Herstart dev server indien nodig
4. ✅ **Test auth**: Login/logout werkt correct

---

## 🐛 Troubleshooting

### "User pool client does not exist"

**Oorzaak:** Frontend gebruikt oude config

**Oplossing:**
```bash
# 1. Sync config handmatig
npm run sync-config

# 2. Herstart dev server
cd apps/web
npm run dev
```

### Config sync faalt

**Oorzaak:** `amplify_outputs.json` niet gevonden

**Oplossing:**
```bash
# Deploy backend eerst
npx ampx sandbox --once

# Dan sync
npm run sync-config
```

### Cache issues

**Oplossing:**
```bash
# Clear browser cache
# Of gebruik incognito mode

# Clear Vite cache
cd apps/web
rm -rf node_modules/.vite
npm run dev
```

---

## 🏗️ Architectuur

```
┌─────────────────────────────────────────┐
│  AWS Amplify Backend Deployment         │
│  (npx ampx sandbox)                     │
└────────────────┬────────────────────────┘
                 │
                 ├─── Generates amplify_outputs.json
                 │
                 ├─── Stores config in SSM Parameter Store
                 │    • /gforce-radio/auth/*
                 │    • /gforce-radio/storage/*
                 │
                 └─── Post-deployment hook
                      │
                      ├─── sync-amplify-config.sh
                      │
                      └─── Copies to apps/web/src/
                           │
                           └─── Frontend uses latest config! ✅
```

---

## 🎉 Voordelen

1. **Altijd correcte config** - Geen oude User Pool Client IDs meer
2. **Automatisch** - Geen handmatige stappen nodig
3. **Parameter Store backup** - Config altijd ophaalbaar
4. **Documentatie** - Duidelijk welke config gebruikt wordt
5. **Troubleshooting** - Easy to debug config issues

---

## 📚 Gerelateerde Documentatie

- [Bulk Upload Guide](./BULK_UPLOAD_GUIDE.md)
- [AWS Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Amplify Gen 2 Outputs](https://docs.amplify.aws/gen2/reference/cli-commands/)
