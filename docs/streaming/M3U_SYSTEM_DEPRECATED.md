# ⚠️ M3U Playlist System - DEPRECATED

**Status:** 🔴 DEPRECATED (13 November 2025)  
**Reason:** Being replaced by Hybrid SQS system  
**Replacement:** [HYBRID_SQS_STREAMING.md](./HYBRID_SQS_STREAMING.md)  
**Active Until:** Migration complete

---

## ⚠️ Deprecation Notice

The M3U file-based playlist system is **DEPRECATED** and will be replaced by the Hybrid SQS streaming system.

**Do not develop new features on this system.**

---

## 📋 Current M3U System (Active but Deprecated)

### **How It Works:**

```
Lambda (hourly)
  ↓
Download ALL tracks (S3 → EC2)
  ↓
Generate M3U file (/var/radio/playlists/current.m3u)
  ↓
Liquidsoap playlist() reads local files
  ↓
Plays 16+ tracks from disk
```

**Files:**
- Lambda: `/amplify/functions/stream-playlist-updater/handler.ts`
- Liquidsoap: `/opt/radio/radio.liq`
- M3U: `/var/radio/playlists/current.m3u` (on EC2)
- Tracks: `/var/radio/tracks/*.mp3` (on EC2, ~360 MB)

---

## ❌ Why Deprecated?

### **Limitations:**
1. **No Real-time Updates**
   - Playlist locked for 1 hour
   - Can't skip tracks easily
   - Can't insert jingles on the fly

2. **Large Disk Usage**
   - 360 MB+ per playlist
   - All tracks downloaded even if not played

3. **No Flexibility**
   - Emergency playlist changes require:
     - Lambda re-trigger
     - Liquidsoap restart
     - Wait for downloads

4. **Live DJ Mode Impossible**
   - Can't queue tracks dynamically
   - No real-time control

---

## ✅ Replacement: Hybrid SQS System

### **Advantages:**

1. **Real-time Updates**
   - Queue only 2 tracks (current + next)
   - Add tracks on-demand
   - Skip/insert immediately

2. **Minimal Storage**
   - No local track storage
   - Stream direct from S3

3. **Maximum Flexibility**
   - Change playlist anytime
   - Live DJ mode possible
   - Emergency overrides easy

4. **Better Monitoring**
   - SQS metrics
   - Track history
   - Queue visibility

**See:** [HYBRID_SQS_STREAMING.md](./HYBRID_SQS_STREAMING.md)

---

## 🔄 Migration Plan

### **Phase 1: Preparation (Now)**
- [x] Document M3U deprecation
- [x] Create Hybrid SQS architecture doc
- [ ] Implement `track-queue-manager` Lambda
- [ ] Update Liquidsoap SQS polling

### **Phase 2: Testing**
- [ ] Deploy Lambda to sandbox
- [ ] Test 2-track queue flow
- [ ] Verify track transitions
- [ ] Monitor for 24 hours

### **Phase 3: Migration**
- [ ] Deploy to production
- [ ] Populate initial 2 tracks
- [ ] Switch Liquidsoap config
- [ ] Monitor stream stability

### **Phase 4: Cleanup**
- [ ] Remove M3U generation from Lambda
- [ ] Delete `/var/radio/tracks/*` on EC2
- [ ] Archive M3U documentation

---

## 📊 Current Status (M3U System)

**As of 13 November 2025, 23:34 CET:**

```
✅ Active: M3U system running
📁 Playlist: 16 tracks (TechnoHouse)
💾 Storage: 360 MB on EC2
🔊 Stream: http://46.137.184.91:8000/stream-processed.mp3
📻 Status: STABLE (but deprecated)
```

---

## ⚠️ For Developers

### **DO NOT:**
- ❌ Add new features to M3U system
- ❌ Optimize M3U generation
- ❌ Expand local storage
- ❌ Build on top of M3U architecture

### **DO:**
- ✅ Focus on Hybrid SQS implementation
- ✅ Keep M3U running during migration
- ✅ Document any M3U issues (for migration)
- ✅ Test Hybrid SQS thoroughly

---

## 🆘 Emergency Procedures (Until Migration)

### **Playlist Not Playing:**
1. Check Liquidsoap: `ps aux | grep liquidsoap`
2. Check M3U file: `cat /var/radio/playlists/current.m3u`
3. Restart Liquidsoap: `sudo pkill liquidsoap && nohup liquidsoap /opt/radio/radio.liq &`

### **Need to Change Playlist:**
```bash
# Trigger Lambda
aws lambda invoke \
  --function-name amplify-gforgeiot-gerard--streamplaylistupdaterlam-qbTpNx6cATgr \
  --region eu-west-1 \
  response.json

# Wait 2-3 minutes for downloads
# Liquidsoap auto-reloads M3U
```

### **Stream Down:**
1. SSH to EC2: `ssh radio-ec2`
2. Check Liquidsoap logs: `tail -f /tmp/liquidsoap.log`
3. Restart if needed

---

## 📝 Timeline

| Date | Event |
|------|-------|
| **13 Nov 2025** | M3U system marked DEPRECATED |
| **14-15 Nov 2025** | Hybrid SQS Lambda development |
| **16-17 Nov 2025** | Liquidsoap SQS integration |
| **18-19 Nov 2025** | Testing & monitoring |
| **20 Nov 2025** | Production migration |
| **21+ Nov 2025** | M3U system decommissioned |

---

## 🔗 Related Documents

- [Hybrid SQS Streaming (NEW)](./HYBRID_SQS_STREAMING.md) - Replacement system
- [SQS Streaming Architecture](./SQS_STREAMING_ARCHITECTURE.md) - Original SQS plan
- [Lambda Functions Reference](/docs/infrastructure/LAMBDA_FUNCTIONS.md) - Lambda docs
- [EC2 Setup](/docs/infrastructure/EC2_SETUP.md) - Liquidsoap config

---

## ❓ Questions?

**Why not keep M3U for stability?**
- SQS system is more stable long-term
- Better for live operations
- Industry standard (many stations use queue-based systems)

**What about the 360 MB on disk?**
- Will be freed after migration
- Tracks deleted automatically
- More space for logs/backups

**Can we rollback if SQS fails?**
- Yes! M3U code remains in Lambda (commented)
- Can re-enable in 5 minutes
- Keep for 1 month as backup

---

**Last Updated:** 13 November 2025, 23:40 CET  
**Migration Status:** 🟡 In Progress  
**Owner:** Gerard / Development Team
