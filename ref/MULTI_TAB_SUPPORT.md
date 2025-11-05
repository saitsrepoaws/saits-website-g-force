# Multi-Tab IoT Support

**Datum:** 4 November 2025  
**Status:** ✅ Geïmplementeerd

---

## 🎯 Probleem

AWS IoT Core **kickt duplicate client IDs**. Als meerdere tabs/browsers/devices proberen te connecten met dezelfde client ID, krijg je een reconnect loop:

```
Tab 1 connects → OK
Tab 2 connects with same ID → AWS kicks Tab 1
Tab 1 reconnects → AWS kicks Tab 2
Tab 2 reconnects → AWS kicks Tab 1
... infinite loop ...
```

**Symptomen:**
- Reconnect elke 5-10 seconden
- "Brief disconnect" warnings in console
- 0 incoming messages (subscription wordt telkens verbroken)

---

## ✅ Oplossing: Tab-Specific Client ID

Elke browser tab/window krijgt nu een **unieke Tab ID** die persistent is voor die sessie.

### **Client ID Format:**

```
{identityId}-tab-{random}-{timestamp}
```

**Voorbeeld:**
```
eu-west-1-084c17c5-b23b-c133-fadf-ed78a91bb4fc-tab-x7k9m2p-1730732456789
```

### **Voordelen:**

✅ **Meerdere tabs** - Elke tab heeft eigen IoT connectie  
✅ **Meerdere browsers** - Chrome + Firefox + Safari tegelijk  
✅ **Meerdere devices** - Desktop + laptop + mobile  
✅ **Development** - Test met meerdere players tegelijk  
✅ **Debugging** - Zie welke tab welke berichten ontvangt

---

## 🔧 Implementatie

### **1. Tab ID Generatie** (`pubsub.ts`)

```typescript
// Generate unique tab ID (persists for this browser tab/window session)
const TAB_ID = `tab-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`
console.log('🆔 Tab ID:', TAB_ID)
```

**Wanneer gegenereerd:**
- Bij eerste import van `pubsub.ts`
- Blijft hetzelfde voor hele tab sessie
- Nieuwe tab = nieuwe ID

### **2. Client ID met Tab ID**

```typescript
// Use identityId + TAB_ID to allow multiple tabs/devices
const cleanIdentity = identityId.replace(/:/g, '-')
const clientId = `${cleanIdentity}-${TAB_ID}`
```

### **3. Export Tab ID**

```typescript
export function getTabId(): string {
  return TAB_ID
}
```

### **4. useTabTitle Hook**

Herbruikbare hook voor browser tab titles:

```typescript
// hooks/useTabTitle.ts
import { useEffect } from 'react'
import { getTabId } from '../services/pubsub'

export function useTabTitle(pageTitle: string, icon: string = '📱') {
  useEffect(() => {
    const tabId = getTabId()
    const shortId = tabId.substring(4, 11)
    document.title = `${icon} ${pageTitle} [${shortId}]`
    
    return () => {
      document.title = 'G-Forge IoT'
    }
  }, [pageTitle, icon])
}
```

**Gebruik in pagina:**
```typescript
import { useTabTitle } from '../../hooks/useTabTitle'

function MyPage() {
  useTabTitle('Player', '🎵')  // → 🎵 Player [x7k9m2p]
  useTabTitle('Network', '🌐') // → 🌐 Network [a2b5c8d]
  useTabTitle('Playlist', '📋') // → 📋 Playlist [k9m3p7q]
  
  return <div>...</div>
}
```

---

## 📊 UI Diagnostics

### **Browser Tab Title**

Elke tab toont nu zijn unieke ID in de browser tab:

```
🎵 Player [x7k9m2p]
🌐 Network [a2b5c8d]
📋 Playlist [k9m3p7q]
```

**Voordelen:**
- ✅ Zie direct welke tab welke client is
- ✅ Switch makkelijk tussen tabs
- ✅ Debug multi-tab scenarios
- ✅ Geen verwarring meer!

### **In-App Diagnostics**

In de **Players** pagina zie je ook:

```
IoT Diagnostics:
  Tab ID:           tab-x7k9m2p-173073...
  Subscribed Topic: radio/player/player-001/command
  Exact Topic:      radio/player/player-001/command
  Wildcard Debug:   OFF
```

**Gebruik:**
- Zie volledige Tab ID
- Verify subscribed topics
- Check wildcard debug status

---

## 🧪 Testing Multi-Tab

### **Test 1: Twee Tabs, Zelfde Player**

1. Open Tab 1: `http://localhost:5173/devices/players`
   - Browser tab title: `🎵 Player [x7k9m2p]`
2. Open Tab 2: `http://localhost:5173/devices/players`
   - Browser tab title: `🎵 Player [a2b5c8d]` ← Verschillend!
3. Check console in beide tabs:
   ```
   Tab 1: 🆔 Tab ID: tab-x7k9m2p-...
   Tab 2: 🆔 Tab ID: tab-a2b5c8d-...
   ```
4. Beide tabs blijven connected ✅
5. Klik "Test Publish" in Tab 1
6. **Beide tabs** ontvangen het bericht ✅

### **Test 2: Drie Browsers**

1. Chrome: `http://localhost:5173/devices/players`
2. Firefox: `http://localhost:5173/devices/players`
3. Safari: `http://localhost:5173/devices/players`
4. Alle drie blijven connected ✅
5. Publish in één browser → alle drie ontvangen ✅

### **Test 3: Desktop + Mobile**

1. Desktop: `http://localhost:5173/devices/players`
2. Mobile: `http://192.168.1.x:5173/devices/players`
3. Beide blijven connected ✅
4. Publish op desktop → mobile ontvangt ✅

---

## 🔍 Console Commands

### **Check Tab ID**
```javascript
import { getTabId } from './services/pubsub'
console.log('Tab ID:', getTabId())
```

### **Compare Tab IDs**
```javascript
// In Tab 1 console:
console.log('Tab 1 ID:', getTabId())

// In Tab 2 console:
console.log('Tab 2 ID:', getTabId())

// Should be different!
```

### **Monitor All Tabs**
```javascript
// Subscribe to all player commands in each tab
const iot = window.__iotContext
await iot.subscribe('radio/player/+/command', (data) => {
  console.log(`[${getTabId()}] Received:`, data)
})
```

---

## 📈 Performance Impact

### **Before (Single Client ID):**
```
1 tab:  ✅ OK
2 tabs: ❌ Reconnect loop
3 tabs: ❌ Chaos
```

### **After (Tab-Specific ID):**
```
1 tab:  ✅ OK
2 tabs: ✅ OK
5 tabs: ✅ OK
10 tabs: ✅ OK (maar waarom? 😅)
```

**Resource Usage:**
- Each tab = 1 WebSocket connection
- Minimal overhead (~1KB/s per tab for keepalive)
- AWS IoT supports 1000+ concurrent connections per account

---

## 🚨 Troubleshooting

### **Issue: Tabs still kicking each other**

**Check:**
1. Hard refresh alle tabs (Cmd+Shift+R)
2. Check Tab IDs zijn verschillend:
   ```javascript
   console.log('Tab ID:', getTabId())
   ```
3. Check geen oude service worker:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(r => 
     r.forEach(reg => reg.unregister())
   )
   ```

### **Issue: Tab ID changes on refresh**

**Expected behavior!** Elke page refresh = nieuwe Tab ID.

**Waarom?**
- Voorkomt stale connections
- Fresh credentials bij elke load
- Cleanup van oude subscriptions

**Als je persistent ID wilt:**
```typescript
// Use sessionStorage (blijft bij refresh)
const TAB_ID = sessionStorage.getItem('tabId') || 
  `tab-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`
sessionStorage.setItem('tabId', TAB_ID)
```

---

## 🎓 Best Practices

### ✅ DO:

1. **Open meerdere tabs voor testing** - Test multi-player scenarios
2. **Check Tab ID in diagnostics** - Verify unieke IDs
3. **Use wildcard subscriptions** - `radio/player/+/command` ontvangt van alle players
4. **Monitor all tabs** - Zie berichten in alle tabs voor debugging

### ❌ DON'T:

1. **Hardcode client IDs** - Altijd gebruik Tab ID
2. **Share client IDs** - Elke connectie moet uniek zijn
3. **Ignore reconnect loops** - Check Tab IDs als dit gebeurt
4. **Open 100 tabs** - AWS heeft limits (maar 10-20 is OK)

---

## 📚 Related Docs

- **IOT_QUICK_REFERENCE.md** - IoT setup basics
- **IOT_SOCKET_CLOSED_EXPLAINED.md** - Waarom "socket closed" normaal is
- **IOT_CONSOLE_COMMANDS.md** - Console debugging commands
- **IOT_DEBUG_PLAN.md** - Systematische test flow

---

## 🎯 Use Cases

### **Development:**
```
Tab 1: Player 1 (testing)
Tab 2: Player 2 (testing)
Tab 3: Admin dashboard (monitoring)
Tab 4: AWS IoT Test Client (debugging)
```

### **Production:**
```
Device 1: Radio Player (living room)
Device 2: Radio Player (bedroom)
Device 3: Radio Player (kitchen)
Device 4: Admin panel (office)
```

### **Demo:**
```
Browser 1: Player view (projector)
Browser 2: Admin view (laptop)
Browser 3: Mobile view (phone)
All receiving same IoT messages ✅
```

---

## ✅ Success Criteria

**Multi-tab support werkt als:**

1. ✅ Meerdere tabs kunnen tegelijk connecten
2. ✅ Geen reconnect loops
3. ✅ Elke tab heeft unieke Tab ID
4. ✅ Berichten worden ontvangen in alle tabs
5. ✅ Connection blijft stabiel (>1 minuut zonder disconnect)
6. ✅ Tab ID zichtbaar in UI diagnostics

---

**Last Updated:** 4 November 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
