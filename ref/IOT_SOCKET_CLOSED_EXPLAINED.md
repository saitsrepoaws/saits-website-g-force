# AWS IoT "Socket Closed" Warning - Explained

## ⚠️ THE WARNING

```
[WARN] MqttOverWS - eu-west-1-xxx {
  "errorCode": 8,
  "errorMessage": "AMQJS0008I Socket closed."
}
```

## ✅ THIS IS NORMAL - NOT A BUG!

This warning appears when AWS IoT closes the WebSocket connection temporarily. **This is expected behavior** and your app automatically reconnects.

---

## 🔍 WHY DOES THIS HAPPEN?

### **1. AWS Temporary Credentials Expiry (~1 hour)**

```
Timeline:
00:00 → Connected with credentials (expires 01:00)
01:00 → ❌ Socket closed (credentials expired)
01:00 → Amplify refreshes credentials automatically
01:01 → ✅ Reconnected with new credentials
```

**Your app handles this automatically:**
- Amplify detects expired credentials
- Fetches new credentials from Cognito
- Reconnects with fresh credentials
- **Total downtime: ~1 second**

---

### **2. TLS Session Timeout**

AWS IoT uses TLS for security. TLS sessions expire periodically (server-side decision):

```
Connection established → TLS handshake
... time passes ...
TLS session expires → Socket closed
Client initiates new TLS handshake → Reconnected
```

---

### **3. Network Idle Timeout**

Corporate firewalls, proxies, or NAT gateways may close idle connections:

```
WebSocket open
No activity detected by firewall (even with MQTT pings)
Firewall closes "idle" connection
Client auto-reconnects
```

**We prevent this with:**
- MQTT keepalive pings every 10 seconds
- Application-level keepalive publishes every 30 seconds

---

### **4. Normal MQTT Handshake**

MQTT over WebSocket has multiple connection states:

```
Connecting
  ↓
ConnectedPendingKeepAlive (brief)
  ↓
Connected
  ↓
ConnectedPendingDisconnect (credential refresh)
  ↓
ConnectionDisrupted (brief)
  ↓
Connecting (reconnect)
  ↓
Connected
```

Brief "disrupted" states during handshakes are **normal**.

---

## 🛡️ HOW WE HANDLE IT

### **1. Auto-Reconnect**
```typescript
reconnectTimeoutMs: 5000  // Reconnect after 5 seconds
```

### **2. MQTT Keepalive**
```typescript
keepAliveTimeoutMs: 10000  // Ping every 10 seconds
```

### **3. Application Keepalive**
```typescript
// Publish to radio/system/keepalive every 30 seconds
setInterval(() => {
  pubsub.publish({
    topics: 'radio/system/keepalive',
    message: { timestamp: Date.now(), type: 'ping' }
  })
}, 30000)
```

### **4. Credential Refresh Detection**
```typescript
// Suppress warnings for credential refresh disconnects
if (previousState === Connected && timeSinceConnected < 5000) {
  // This is normal - credentials are being refreshed
  log('info', '🔄 Brief disconnect (credential refresh) - auto-reconnecting...')
  return  // Don't spam console
}
```

### **5. Retry Logic for Critical Messages**
```typescript
// For critical publish operations:
try {
  await pubsub.publish(message)
} catch (err) {
  // Retry after reconnect
  setTimeout(() => pubsub.publish(message), 1000)
}
```

---

## 📊 EXPECTED BEHAVIOR

### **Normal Operation:**
```
✅ Connected
... 30 seconds ...
💚 IoT PING - Connection Alive
... 30 seconds ...
💚 IoT PING - Connection Alive
... 59 minutes ...
🔄 Brief disconnect (credential refresh) - auto-reconnecting...
✅ Connected
```

### **With Console Warnings:**
```
✅ Connected
... 59 minutes ...
[WARN] Socket closed  ← This is the credential refresh
✅ Reconnected
```

---

## ⚠️ WHEN TO WORRY

Only worry if:

1. **Reconnect fails** - No "✅ Reconnected" after disconnect
2. **Frequent disconnects** - More than once per hour
3. **No keepalive pings** - No "💚 IoT PING" messages
4. **Messages lost** - Critical publishes failing

---

## 🔧 TROUBLESHOOTING

### **Check 1: Credentials Valid**
```typescript
const session = await fetchAuthSession()
console.log('Identity:', session.identityId)
console.log('Expiration:', session.credentials?.expiration)
```

### **Check 2: IoT Policy**
```json
{
  "Effect": "Allow",
  "Action": [
    "iot:Connect",
    "iot:Subscribe",
    "iot:Publish",
    "iot:Receive"
  ],
  "Resource": [
    "arn:aws:iot:eu-west-1:*:topic/radio/*",
    "arn:aws:iot:eu-west-1:*:client/${cognito-identity.amazonaws.com:sub}"
  ]
}
```

### **Check 3: Network Stability**
```bash
# Test network connection
ping -c 10 acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com
```

### **Check 4: Keepalive Working**
Look for in console:
```
💚 IoT PING - Connection Alive  ← Should appear every 30 seconds
```

---

## 📚 REFERENCES

- [AWS IoT MQTT Keepalive](https://docs.aws.amazon.com/iot/latest/developerguide/mqtt.html)
- [Amplify PubSub](https://docs.amplify.aws/javascript/build-a-backend/add-aws-services/pubsub/)
- [Paho MQTT WebSocket](https://www.eclipse.org/paho/index.php?page=clients/js/index.php)

---

## 💡 SUMMARY

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  "Socket closed" warnings are NORMAL AWS IoT behavior   ║
║  Your app auto-reconnects - no action needed            ║
║  Only worry if reconnect fails or happens too often     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

**Key takeaway:** AWS IoT connections are designed to be resilient. Brief disconnects for credential refresh, TLS renewal, or network handshakes are expected and handled automatically. Your job is to ensure critical messages have retry logic, not to prevent disconnects entirely.
