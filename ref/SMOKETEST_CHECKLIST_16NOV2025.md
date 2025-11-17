# Smoketest Checklist - Professional DJ Platform
**Date:** 16 November 2025, 00:26 CET  
**Status:** ✅ READY FOR SMOKETEST

## 🎯 Pre-Smoketest Verification

### ✅ TEST 1: EC2 Services (PASSED)
- [x] **Liquidsoap:** ✅ RUNNING (PID: 14631)
- [x] **Icecast:** ✅ RUNNING
- [x] **Nginx:** ✅ RUNNING
- [x] **IoT Control:** ⚠️ Optional (not critical for smoketest)

### ✅ TEST 2: Configuration Files (PASSED)
- [x] **Liquidsoap config:** ✅ EXISTS (227 lines, complete metadata)
- [x] **Icecast config:** ✅ EXISTS (hostname: splashfm.nl)
- [x] **Nginx config:** ✅ EXISTS
- [x] **Player HTML:** ✅ EXISTS (17,288 bytes)

### ✅ TEST 3: System Resources (PASSED)
- [x] **Disk Usage:** ✅ 15% used, 17G free (plenty of space)
- [x] **Memory:** ✅ 331Mi used, 239Mi free (healthy)
- [x] **Temp Files:** ✅ 0 cached tracks (clean start)

### ✅ TEST 4: External Access (PASSED)
- [x] **Player page:** ✅ https://splashfm.nl/ (200 OK)
- [x] **Logo:** ✅ https://splashfm.nl/logosplashfmfm.png (200 OK, 93KB)
- [x] **Status JSON:** ✅ https://splashfm.nl/status-json.xsl (hostname: splashfm.nl)
- [x] **www redirect:** ✅ https://www.splashfm.nl/ (200 OK)
- [x] **SSL Certificate:** ✅ Valid (expires: Dec 12 2026)

### ✅ TEST 5: Security (PASSED)
- [x] **Raw stream:** ✅ 403 Forbidden (correctly blocked)
- [x] **Unprocessed stream:** ✅ 403 Forbidden (correctly blocked)
- [x] **Admin panel:** ✅ 403 Forbidden (correctly blocked)

### ✅ TEST 6: AWS Resources (PASSED)
- [x] **SQS Queue:** ✅ Accessible (0 tracks - waiting for playlist)
- [x] **IoT Endpoint:** ✅ acjtf0bi0eel2-ats.iot.eu-west-1.amazonaws.com
- [x] **EC2 Instance:** ✅ running
- [x] **CloudFront:** ✅ Deployed

### ✅ TEST 7: Liquidsoap Logs (PASSED)
- [x] **Log file:** ✅ Accessible
- [x] **Status:** ⏸️ Waiting for tracks (queue empty - expected)
- [x] **Errors:** None (empty queue messages are normal)

---

## 🚀 Smoketest Procedure

### Step 1: Create Test Playlist
**Objective:** Verify end-to-end track flow

**Actions:**
1. Open UI (https://splashfm.nl/ or admin panel)
2. Create a test playlist with 2-3 tracks
3. Add tracks with complete metadata:
   - Title, Artist, Album
   - BPM, Key, Energy
   - Genre, Year
   - Cover art URL
   - File URL (S3 location)

**Expected Result:**
- ✅ Playlist created successfully
- ✅ Tracks added to DynamoDB

**Time:** ~5 minutes

---

### Step 2: Trigger Lambda (Manual or Timer)
**Objective:** Queue tracks to SQS

**Actions:**
1. **Option A:** Wait for hourly timer (cron)
2. **Option B:** Manually invoke `stream-playlist-updater` Lambda:
   ```bash
   aws lambda invoke \
     --function-name amplify-gforgeiot-gerard3-streamplaylistupdaterlam-lhkcGPRjm5o8 \
     --region eu-west-1 \
     response.json
   ```

**Expected Result:**
- ✅ Lambda executes successfully
- ✅ Tracks queued to SQS FIFO (check queue size)
- ✅ CloudWatch logs show success

**Verification:**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue-v2.fifo \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1
```

**Time:** ~2 minutes

---

### Step 3: Verify Liquidsoap Processing
**Objective:** Confirm track download and playback

**Actions:**
1. Monitor Liquidsoap logs:
   ```bash
   tail -f /var/log/liquidsoap/stdout.log
   ```

**Expected Output:**
```
🎧 Complete Metadata Received:
   Track: Artist Name - Song Title
   BPM: 128, Key: 8A, Energy: 0.85
   Mix In: 8s, Mix Out: 336s
   Genre: Techno, Year: 2024, Rating: 4
📥 Downloading MP3...
✅ Downloaded!
```

**Expected Result:**
- ✅ Track metadata parsed from SQS
- ✅ MP3 downloaded from S3
- ✅ Track playing (no errors)
- ✅ Icecast stream active

**Time:** ~3 minutes

---

### Step 4: Verify IoT Publishing
**Objective:** Confirm metadata published to IoT

**Actions:**
1. **Option A:** Subscribe to IoT topic in UI
2. **Option B:** Use AWS IoT MQTT test client:
   - Topic: `radio/stream/nowplaying`
   - Wait for message

**Expected Message:**
```json
{
  "trackId": "uuid",
  "title": "Song Title",
  "artist": "Artist Name",
  "bpm": 128,
  "key": "8A",
  "energy": 0.85,
  "coverArtUrl": "https://...",
  "waveformUrl": "https://...",
  "genre": "Techno",
  "year": "2024",
  "rating": 4,
  "timestamp": 1731708900,
  "source": "liquidsoap"
}
```

**Expected Result:**
- ✅ IoT message received
- ✅ Complete metadata included
- ✅ Timestamp current

**Time:** ~2 minutes

---

### Step 5: Test Stream Playback
**Objective:** Verify audio streaming works

**Actions:**
1. Open player: https://splashfm.nl/
2. Click play button
3. Listen for audio

**Alternative Test:**
```bash
# Direct stream test
ffplay https://splashfm.nl/splashfm.mp3

# Or with curl
curl -s https://splashfm.nl/splashfm.mp3 | ffplay -
```

**Expected Result:**
- ✅ Stream loads successfully
- ✅ Audio plays clearly
- ✅ No buffering issues
- ✅ Metadata displays in player

**Time:** ~2 minutes

---

### Step 6: Test Remote Control (Optional)
**Objective:** Verify IoT control commands work

**Actions:**
1. Create control message file on EC2:
   ```bash
   echo '{"action":"health","requestId":"smoketest-001"}' > /tmp/iot-control-message.json
   ```

2. Check response in logs:
   ```bash
   tail -f /var/log/iot-control.log
   ```

**Expected Result:**
- ✅ Health check executed
- ✅ Response shows all services status
- ✅ Response published to IoT

**Time:** ~3 minutes

---

### Step 7: Verify UI Updates
**Objective:** Confirm UI receives real-time updates

**Actions:**
1. Open player UI: https://splashfm.nl/
2. Observe "Now Playing" section
3. Wait for track change (or skip track)

**Expected Result:**
- ✅ Cover art displays
- ✅ Track title, artist shown
- ✅ BPM, Key, Genre visible (if implemented)
- ✅ Updates in real-time (< 100ms delay)

**Time:** ~5 minutes

---

### Step 8: Test Track Transition
**Objective:** Verify smooth track transitions

**Actions:**
1. Let first track play to completion
2. Observe transition to second track

**Expected Result:**
- ✅ Smooth crossfade (no silence)
- ✅ Second track starts playing
- ✅ New metadata published to IoT
- ✅ UI updates with new track info

**Time:** ~Wait for track duration

---

## 📊 Smoketest Results Template

```
SMOKETEST RESULTS
Date: [DATE]
Duration: [DURATION]

✅ PASSED / ❌ FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] Step 1: Playlist Created (2-3 tracks)
[ ] Step 2: Lambda Triggered (tracks queued)
[ ] Step 3: Liquidsoap Processing (tracks playing)
[ ] Step 4: IoT Publishing (metadata sent)
[ ] Step 5: Stream Playback (audio working)
[ ] Step 6: Remote Control (health check)
[ ] Step 7: UI Updates (real-time metadata)
[ ] Step 8: Track Transition (smooth crossfade)

Issues Found:
- [None / List issues]

Notes:
- [Any observations]

Status: ✅ READY FOR PRODUCTION / ⚠️ NEEDS FIXES
```

---

## 🔍 Troubleshooting Guide

### Issue: No tracks in queue
**Check:**
```bash
# Verify Lambda executed
aws logs tail /aws/lambda/amplify-gforgeiot-gerard3-streamplaylistupdaterlam-lhkcGPRjm5o8 --follow --region eu-west-1

# Check queue manually
aws sqs receive-message \
  --queue-url https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue-v2.fifo \
  --region eu-west-1
```

**Fix:**
- Verify playlist exists in DynamoDB
- Check Lambda permissions (SQS write)
- Manually trigger Lambda

---

### Issue: Liquidsoap not playing
**Check:**
```bash
# Check Liquidsoap logs
tail -50 /var/log/liquidsoap/stdout.log

# Restart Liquidsoap
sudo pkill -9 liquidsoap
nohup liquidsoap /opt/radio/radio.liq > /var/log/liquidsoap/stdout.log 2>&1 &
```

**Fix:**
- Verify S3 file URLs are accessible
- Check IAM permissions (S3 read)
- Verify config syntax

---

### Issue: No IoT messages
**Check:**
```bash
# Verify IoT endpoint
aws iot describe-endpoint --endpoint-type iot:Data-ATS --region eu-west-1

# Check IAM permissions
aws iam get-role-policy \
  --role-name amplify-gforgeiot-gerard3--StreamServerRole6A0ED596-xshjBLTx3Dxi \
  --policy-name IoTAccess \
  --region eu-west-1
```

**Fix:**
- Verify IoT permissions in EC2 role
- Check network connectivity
- Review Liquidsoap logs for publish errors

---

### Issue: Stream not accessible
**Check:**
```bash
# Test Icecast directly
curl -I http://localhost:8000/stream.mp3

# Test Nginx proxy
curl -I http://localhost/splashfm.mp3

# Test CloudFront
curl -I https://splashfm.nl/splashfm.mp3
```

**Fix:**
- Verify Icecast is running
- Check Nginx config
- Verify CloudFront origin
- Check security groups/firewall

---

## ✅ Sign-Off Checklist

- [ ] All 8 smoketest steps completed successfully
- [ ] Audio streaming working (manual verification)
- [ ] Metadata flowing correctly (IoT messages)
- [ ] UI displaying real-time updates
- [ ] No critical errors in logs
- [ ] System resources healthy (< 70% usage)
- [ ] Security verified (blocked endpoints)
- [ ] Documentation reviewed and accurate

**Signed off by:** _________________  
**Date:** _________________  
**Status:** ✅ APPROVED FOR PRODUCTION

---

## 📝 Notes for Gerard

**Current Status:**
- ✅ All pre-smoketest checks PASSED
- ✅ System ready for playlist creation
- ⏸️ Waiting for tracks to be added

**To Start Smoketest:**
1. Create a playlist with 2-3 tracks in UI
2. Add complete metadata for each track
3. Trigger Lambda or wait for hourly cron
4. Follow steps 1-8 above
5. Document results

**Expected Duration:** ~25-30 minutes (excluding track playback time)

**Ready to Rock! 🚀**
