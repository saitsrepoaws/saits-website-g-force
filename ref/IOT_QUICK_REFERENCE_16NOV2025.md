# IoT Quick Reference - Professional DJ Platform

**Date:** 16 November 2025  
**Status:** Production Ready

## 🎛️ IoT Topics

### Publishing (EC2 → UI)
```
radio/stream/nowplaying    - Current track metadata
radio/stream/status        - Server health
radio/response/control     - Command responses
```

### Subscribing (UI → EC2)
```
radio/control/restart/liquidsoap   - Restart Liquidsoap
radio/control/restart/icecast      - Restart Icecast  
radio/control/restart/nginx        - Restart Nginx
radio/control/restart/all          - Restart all services
radio/control/system/cleanup       - Cleanup temp files
radio/control/system/reset         - Full system reset
radio/control/stream/skip          - Skip current track
radio/control/system/health        - Health check
```

## 📡 Message Examples

### Restart Service
```json
{
  "action": "restart",
  "service": "liquidsoap",
  "requestId": "uuid",
  "userId": "user123"
}
```

### Skip Track
```json
{
  "action": "skip",
  "requestId": "uuid"
}
```

### Health Check
```json
{
  "action": "health",
  "requestId": "uuid"
}
```

## 🎵 Metadata Fields

```typescript
{
  trackId, title, artist, album,          // Identity
  bpm, key, energy, loudness,             // DJ Essentials
  intro, outro, mixInPoint, mixOutPoint,  // Mix Points
  autoGain, vocalPresence,                // Performance
  fileUrl, coverArtUrl, waveformUrl,      // URLs
  year, genre, label, rating, color       // Display
}
```

## 🚀 Quick Commands

### Restart Liquidsoap
```bash
# Via IoT (from UI)
Publish to: radio/control/restart/liquidsoap

# Via SSH
sudo pkill -9 liquidsoap
nohup liquidsoap /opt/radio/radio.liq > /var/log/liquidsoap/stdout.log 2>&1 &
```

### Health Check
```bash
# Via IoT
Publish to: radio/control/system/health

# Via SSH
systemctl status liquidsoap icecast2 nginx
```

### Cleanup
```bash
# Via IoT  
Publish to: radio/control/system/cleanup

# Via SSH
rm -f /tmp/track-*.mp3
```

## 📊 Monitoring

### Service Status
```bash
ps aux | grep liquidsoap
systemctl status icecast2 nginx
```

### Logs
```bash
tail -f /var/log/liquidsoap/stdout.log
tail -f /var/log/iot-control.log
```

### Queue Status
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue-v2.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1
```

## 🌐 URLs

**Public:**
- https://splashfm.nl/ - Player
- https://splashfm.nl/splashfm.mp3 - Stream
- https://splashfm.nl/status-json.xsl - Metadata

**Blocked (403):**
- /stream-raw.mp3 - Raw stream
- /admin - Icecast admin

## 🔑 Key Configuration

**EC2:** i-044ea4a949c8f562a (79.125.44.178)  
**SQS:** radio-track-stream-queue-v2.fifo  
**IoT Endpoint:** acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com  
**Region:** eu-west-1

## 💡 Tips

1. **Always test via IoT** - Use control messages from UI
2. **Check logs** - /var/log/liquidsoap/stdout.log
3. **Monitor queue** - Should have tracks when playlist active
4. **Metadata size** - Keep < 1KB per track
5. **Response topics** - UI should subscribe to radio/response/control

---

**Ready to Rock! 🚀**
