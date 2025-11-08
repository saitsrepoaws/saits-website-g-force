# 🧪 Notification Test - LIVE

## ✅ STATUS
Permission: **GRANTED** ✓
Code: **Executing** ✓
Issue: **Notification niet zichtbaar** ❌

## 🔍 DEBUG CONSOLE

Je ziet nu in console:
```
🔔 Showing browser notification: Track Changed
📝 Notification body: Now playing: Softmal - There Is No Reality
```

## 🧪 HANDMATIGE TEST

**Plak dit in de console (F12):**

```javascript
// Test 1: Basic notification
new Notification("Test", { body: "Dit is een test notification" })
```

**Verwacht:**
- Browser notification popup verschijnt
- Als NIET → Browser heeft notifications disabled

**Test 2: Met logging:**
```javascript
const n = new Notification("Test 2", { 
  body: "Test met events",
  requireInteraction: false
})
n.onshow = () => console.log("✅ Notification shown!")
n.onerror = (e) => console.error("❌ Error:", e)
```

**Test 3: Check notification center:**
```javascript
console.log('Permission:', Notification.permission)
console.log('Max actions:', Notification.maxActions)
```

## 🔧 MOGELIJKE OORZAKEN

### 1. **Focus Assist / Do Not Disturb**
- Windows: Focus Assist aan
- Mac: Do Not Disturb aan
- **Fix:** Check system notification settings

### 2. **Browser Notification Settings**
- Site notifications allowed MAAR:
- System-wide notifications disabled
- **Fix:** Check browser settings → Notifications

### 3. **Notification verschijnt maar verdwijnt direct**
- Wordt getoond maar direct gesloten
- Alleen zichtbaar in notification center
- **Fix:** Check notification center/action center

### 4. **Multiple monitors**
- Notification verschijnt op andere monitor
- **Fix:** Check all screens

### 5. **Browser-specifiek**
- Chrome: Check chrome://settings/content/notifications
- Firefox: Check about:preferences#privacy
- **Fix:** Reset site notifications

## 📊 VERWACHTE LOGS (na fix)

```
🔔 Showing browser notification: Track Changed
📝 Notification body: Now playing: ...
✅ Notification object created successfully
👀 Notification is now visible!        ← DIT MOET JE ZIEN
[After 10s]
⏰ Auto-closing notification after 10s
🚪 Notification closed
```

## 🎯 ACTIE STAPPEN

**Stap 1:** Run Test 1 in console
```javascript
new Notification("Test", { body: "Hello" })
```

**Stap 2:** Zie je een popup?
- **JA** → Notifications werken, IoT timing issue
- **NEE** → Browser/system issue

**Stap 3:** Als NEE, check:
- [ ] Windows notification center (bottom right)
- [ ] Mac notification center (top right)
- [ ] Focus Assist / Do Not Disturb OFF
- [ ] Browser settings → Site settings → Notifications
- [ ] System notifications enabled

## 💡 TIPS

### Windows
1. Click notification icon (bottom right taskbar)
2. Click "Focus assist"
3. Set to "Off"
4. Try test again

### Mac
1. Click Control Center (top right)
2. Check "Do Not Disturb" is OFF
3. System Settings → Notifications
4. Make sure Chrome/Firefox can show notifications
5. Try test again

### Chrome DevTools
1. F12 → Application tab
2. Notifications section
3. Check if notifications are being stored
4. Test "Show notification" button

## 🚨 IF STILL NOT WORKING

**Last resort test:**
```javascript
// Maximum simple test
if (Notification.permission === 'granted') {
  const n = new Notification('HELLO!')
  setTimeout(() => {
    console.log('Did you see a notification?')
    console.log('If not, check:')
    console.log('1. Notification center')
    console.log('2. Do Not Disturb is OFF')
    console.log('3. Try in incognito mode')
  }, 2000)
} else {
  console.error('Permission not granted!')
}
```

## ✅ SUCCESS CRITERIA

When working correctly, you should see:
1. **Console:** "👀 Notification is now visible!"
2. **Screen:** Popup with track info
3. **Sound:** (if not silent mode)
4. **Notification persists** for 10 seconds

---

**CURRENT STATUS:** Waiting for "👀 Notification is now visible!" log
