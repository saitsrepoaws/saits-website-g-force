# 🚀 REAL MQTT - NEXT STEPS

## ✅ WAT ER NU WERKT:

**Player Kant (KLAAR!):**
```javascript
✅ updateFromIoT(artist, title) - Werkt perfect!
✅ Flash effect bij updates
✅ Metadata updates instant
✅ IoT status indicator
✅ Cognito auth
✅ IoT Policy attached
```

**Test in Browser Console:**
```javascript
updateFromIoT("Daft Punk", "Around the World")
```

---

## 🎯 WAT NOG MOET (Lambda Kant):

### Optie 1: Lambda IoT Publisher (SIMPELST!)

**When:** Track changes in Liquidsoap
**Action:** Lambda publiceert naar IoT
**Topic:** `radio/stream/nowplaying`

**Lambda Code:**
```javascript
const AWS = require('aws-sdk');
const iot = new AWS.IotData({
  endpoint: 'd08571201ngqyrl7gmlrx-ats.iot.eu-west-1.amazonaws.com'
});

exports.handler = async (event) => {
  const params = {
    topic: 'radio/stream/nowplaying',
    payload: JSON.stringify({
      artist: event.artist,
      title: event.title,
      timestamp: new Date().toISOString()
    }),
    qos: 0
  };
  
  await iot.publish(params).promise();
  console.log('Published to IoT!');
};
```

**Trigger:** 
- CloudWatch Events (elke 30 sec check Icecast)
- Of: Liquidsoap callback wanneer track wijzigt

---

### Optie 2: WebSocket MQTT (COMPLEX!)

**Probleem:** 
- Paho MQTT werkt niet direct met AWS IoT
- Vereist SigV4 signing voor WebSocket
- Vereist aws-iot-device-sdk-js-v2 (groot!)

**Alternatief:**
- AppSync Real-time subscriptions
- Of: API Gateway WebSocket
- Of: AWS IoT SDK v2 (300KB+)

---

## 💡 RECOMMENDED APPROACH:

### Phase 1 (NU - 5 MIN):
```
✅ Player heeft updateFromIoT() - DONE!
→ Lambda maakt die publiceert naar IoT
→ Player luistert via polling (huidig)
→ Werkt 100%!
```

### Phase 2 (LATER - 1 UUR):
```
→ Replace polling met AWS IoT SDK v2
→ WebSocket subscription
→ Real-time! (<100ms latency)
```

---

## 🔧 QUICK WIN (Nu implementeren):

### Lambda: stream-status-publisher

**File:** `amplify/functions/stream-status-publisher/handler.ts`

```typescript
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';

const iot = new IoTDataPlaneClient({
  region: 'eu-west-1',
  endpoint: 'd08571201ngqyrl7gmlrx-ats.iot.eu-west-1.amazonaws.com'
});

export const handler = async () => {
  // Fetch from Icecast
  const response = await fetch('https://www.splashfm.nl/status-json.xsl');
  const data = await response.json();
  
  const source = Array.isArray(data.icestats.source) 
    ? data.icestats.source[0] 
    : data.icestats.source;
  
  // Publish to IoT
  await iot.send(new PublishCommand({
    topic: 'radio/stream/nowplaying',
    payload: Buffer.from(JSON.stringify({
      artist: source.artist || 'G-Forge Radio',
      title: source.title || 'Unknown Track',
      timestamp: new Date().toISOString()
    })),
    qos: 0
  }));
  
  console.log('Published:', source.artist, '-', source.title);
};
```

**EventBridge Trigger:**
```
rate(30 seconds)
```

---

## 🎯 RESULT:

```
Icecast → Lambda (elke 30 sec) → IoT Topic → ALLE Players!
                                              ↓
                                         💫 Flash!
                                         🎵 Update!
                                         ⚡ Real-time!
```

**Alle players krijgen updates tegelijk! 🚀**

---

## 📊 CURRENT STATUS:

```
✅ Player: READY (updateFromIoT werkt!)
✅ IoT: READY (topic configured)
⏳ Lambda: TODO (15 min work)
```

---

**MORGEN:** Lambda maken = DONE! 💪
