# 🔄 System Transition: M3U → Hybrid SQS

**Date:** 13 November 2025, 23:40 CET  
**Status:** 🟢 APPROVED - Ready to Implement  
**Timeline:** 14-20 November 2025

---

## 📊 Current Situation

### **M3U System (DEPRECATED as of today)**
```
Status: ✅ ACTIVE maar DEPRECATED
Files: Lambda downloads ALLE tracks (16+)
Storage: 360 MB op EC2 local disk
Update: Elk uur (via EventBridge)
Flexibility: ❌ Laag (locked voor 1 uur)
```

---

## 🎯 New System: Hybrid SQS Just-In-Time Streaming

### **Concept:**
```
┌────────────────────────────────────────┐
│  Queue Status (Always 2 tracks)        │
├────────────────────────────────────────┤
│                                        │
│  Track 1: ▶️  PLAYING NOW              │
│  Track 2: ⏸️  READY (next up)          │
│                                        │
│  → Track 1 ends → Lambda adds Track 3 │
│                                        │
└────────────────────────────────────────┘
```

### **Key Innovation:**
- **Lambda triggers TWO keer:**
  1. **Initial:** Top of hour → Add Track 1 + Track 2
  2. **On-Demand:** When queue < 2 → Add next track

- **Liquidsoap:**
  - Speelt Track 1
  - Ziet: "Oh, queue heeft maar 1 track (Track 2)"
  - Triggers Lambda
  - Lambda adds Track 3
  - Track 2 staat KLAAR als Track 1 eindigt

### **Flow:**
```
Hour 22:00 → Lambda → Queue [Track 1] [Track 2]
              ↓
         Liquidsoap starts Track 1 ▶️
              ↓
         Queue now: [Track 2]
              ↓
         Liquidsoap checks: queue_size = 1
              ↓
         Triggers Lambda
              ↓
         Lambda adds Track 3
              ↓
         Queue now: [Track 2] [Track 3]
              ↓
         Track 1 ends
              ↓
         Liquidsoap starts Track 2 ▶️
              ↓
         Queue now: [Track 3]
              ↓
         Liquidsoap checks: queue_size = 1
              ↓
         Triggers Lambda → Add Track 4
              ↓
         ... CYCLE REPEATS ...
```

---

## ✅ Waarom Deze Aanpak?

### **Voordelen:**

1. **Maximale Flexibiliteit** 🎚️
   - Change playlist → Immediate effect (na huidige track)
   - Skip track → Gewoon queue purgen
   - Insert jingle → Add to queue, plays next

2. **Minimale Buffer** 📦
   - Altijd maar 2 tracks (current + next)
   - Geen grote downloads
   - Geen disk space nodig

3. **Real-time Control** 🎛️
   - Live DJ mode mogelijk
   - Emergency overrides
   - Listener requests

4. **Event-Driven** ⚡
   - Lambda reageert op queue state
   - Geen fixed schedule meer
   - Intelligent buffering

---

## 🏗️ Implementation Components

### **1. Lambda: track-queue-manager**

**Location:** `/amplify/functions/track-queue-manager/handler.ts`

**Triggers:**
- ✅ EventBridge (hourly) → Initial 2 tracks
- ✅ Liquidsoap invoke → Add next track
- ✅ Manual/API → Playlist change

**Logic:**
```typescript
1. Check queue size
2. If < 2:
   - Get current playlist
   - Get next track(s) to reach 2 total
   - Send to SQS FIFO
3. Done!
```

### **2. Liquidsoap Update**

**File:** `/opt/radio/radio.liq`

**Key Functions:**
```liquidsoap
def get_queue_size():
  # Check SQS queue
end

def get_next_track():
  # Check if queue < 2
  if queue_size < 2:
    trigger_lambda()  # Add next track
  
  # Poll SQS
  message = sqs.receive_message()
  return message.s3_url
end

radio = request.dynamic.list(
  prefetch=1,  # Always 1 ahead
  get_next_track
)
```

### **3. SQS FIFO Queue**

**Name:** `radio-track-stream-queue.fifo`  
**Target State:** 2 messages (always)  
**Message:** Track details + S3 URL

---

## 📋 Implementation Steps

### **Week 1: Lambda Development (14-15 Nov)**
- [ ] Create `track-queue-manager` function
- [ ] Implement queue size checking
- [ ] Implement track fetching logic
- [ ] Add SQS SendMessage
- [ ] Add playlist position tracking
- [ ] Test locally

### **Week 2: Liquidsoap Integration (16-17 Nov)**
- [ ] Update `/opt/radio/radio.liq`
- [ ] Add SQS polling function
- [ ] Add queue size check
- [ ] Add Lambda invoke logic
- [ ] Test on EC2
- [ ] Monitor logs

### **Week 3: Testing & Migration (18-20 Nov)**
- [ ] Test 2-track flow
- [ ] Test track transitions
- [ ] Monitor for 24 hours
- [ ] Production migration
- [ ] Decommission M3U

---

## 🔄 Migration Strategy

### **Step 1: Parallel Run**
```
M3U system: Keep running (backup)
SQS system: Deploy and test
Duration: 2-3 days
```

### **Step 2: Switch**
```
1. Stop Liquidsoap
2. Clear M3U playlist
3. Update Liquidsoap config (SQS mode)
4. Trigger Lambda (add 2 tracks)
5. Start Liquidsoap
6. Monitor for 1 hour
```

### **Step 3: Cleanup**
```
1. Delete tracks from EC2 (/var/radio/tracks/*)
2. Comment out M3U code in Lambda
3. Update documentation
4. Archive M3U system
```

---

## ⚠️ Risk Mitigation

### **Risk 1: SQS Polling Fails**
**Mitigation:**
- Keep M3U code in Lambda (commented)
- Can re-enable in 5 minutes
- Fallback to silence source in Liquidsoap

### **Risk 2: Lambda Doesn't Trigger**
**Mitigation:**
- Manual Lambda invoke via CLI
- CloudWatch alarm on queue size
- Backup EventBridge trigger every 5 min

### **Risk 3: S3 Streaming Issues**
**Mitigation:**
- S3 Transfer Acceleration
- Cache last 2 tracks locally
- Monitor S3 latency

---

## 📊 Success Metrics

### **Must Have:**
- ✅ Queue always has 1-2 tracks
- ✅ No gaps between tracks
- ✅ Track transitions smooth (< 1s)
- ✅ Lambda triggers reliably
- ✅ 99% uptime

### **Nice to Have:**
- ✅ Playlist changes < 5 min effect
- ✅ Track skip works instantly
- ✅ Live DJ mode functional
- ✅ Cost stays in free tier

---

## 💰 Cost Comparison

### **M3U System:**
```
Lambda: ~24 invocations/day × $0.000000208 = $0.005/day
S3 downloads: 16 tracks × 24 = 384 tracks/day × $0.0004 = $0.15/day
Storage: 360 MB × $0.023/GB = $0.008/day
Total: ~$0.16/day = $5/month
```

### **Hybrid SQS:**
```
Lambda: ~288 invocations/day × $0.000000208 = $0.06/day
SQS: 288 messages × $0 (free tier) = $0
S3 streaming: 288 tracks × $0.0004 = $0.12/day
Total: ~$0.18/day = $5.50/month
```

**Difference:** +$0.50/month (acceptable for flexibility gain!)

---

## 📞 Rollback Plan

### **If SQS Fails:**
```bash
# 1. SSH to EC2
ssh radio-ec2

# 2. Stop Liquidsoap
sudo pkill liquidsoap

# 3. Restore M3U config
# (keep backup of radio.liq)
sudo cp /opt/radio/radio.liq.m3u.backup /opt/radio/radio.liq

# 4. Trigger M3U Lambda
aws lambda invoke \
  --function-name stream-playlist-updater \
  response.json

# 5. Restart Liquidsoap
nohup liquidsoap /opt/radio/radio.liq &

# Time to rollback: 5 minutes
```

---

## 📝 Documentation Updates

- [x] Create HYBRID_SQS_STREAMING.md
- [x] Create M3U_SYSTEM_DEPRECATED.md
- [x] Update INDEX.md
- [ ] Update LAMBDA_FUNCTIONS.md (add track-queue-manager)
- [ ] Update TECH_STACK.md (SQS streaming)
- [ ] Update CHANGELOG.md (v1.1.0 release)

---

## ✅ Next Actions (Jij!)

### **Vandaag (13 Nov):**
- [x] Documentatie approved ✅
- [ ] Start Lambda development

### **Morgen (14 Nov):**
- [ ] Implement track-queue-manager Lambda
- [ ] Test SQS message format
- [ ] Test queue size checking

### **Overmorgen (15 Nov):**
- [ ] Update Liquidsoap config
- [ ] Test SQS polling
- [ ] Test Lambda triggering

### **Weekend (16-17 Nov):**
- [ ] End-to-end testing
- [ ] Monitor logs
- [ ] Fine-tune timings

### **Volgende Week (18-20 Nov):**
- [ ] Production deployment
- [ ] Migration execution
- [ ] M3U decommissioning

---

## 🎉 Summary

**We gaan van:**
- 🔴 M3U: Hele playlist elk uur downloaden (360 MB)
- 🔴 Geen flexibiliteit
- 🔴 Locked voor 1 uur

**Naar:**
- 🟢 SQS: 2 tracks just-in-time (minimal buffer)
- 🟢 Maximale flexibiliteit
- 🟢 Real-time updates

**Voordelen:**
- ✅ Live DJ mode
- ✅ Skip tracks instantly
- ✅ Change playlists anytime
- ✅ Insert jingles on-the-fly
- ✅ Better monitoring

**Timeline:** 1 week implementatie, 1 week testing, 1 week migration

---

**Ready to start?** Let's build the Lambda first! 🚀

**Status:** 🟢 APPROVED - GO!  
**Owner:** Gerard  
**Target:** 20 November 2025
