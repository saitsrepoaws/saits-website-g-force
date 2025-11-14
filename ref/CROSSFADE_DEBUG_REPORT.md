# 🔍 Crossfade Debug Report

**Datum:** 14 November 2025, 16:56 CET  
**Status:** ❌ NOT WORKING  
**Root Cause:** IDENTIFIED

---

## 🎯 **SYMPTOM:**

Crossfade function wordt **NOOIT** aangeroepen tijdens track transitions.  
Geen debug output, geen SLAM transitions, tracks spelen niet goed over.

---

## 🔬 **DEEP DIVE ANALYSE:**

### **1. Crossfade Config ✅ CORRECT**
```liquidsoap
File: /opt/radio/advanced-crossfade.liq
Location: Line 35 in radio.liq

Function:
def advanced_crossfade(a, b) =
  print("🔥🔥🔥 CROSSFADE FUNCTION CALLED!")
  # ... rest of function
end

Applied:
radio = cross(duration=5.0, advanced_crossfade, radio)
```

**Verificatie:**
- ✅ File exists on EC2
- ✅ Include statement present
- ✅ Function syntax valid
- ✅ Debug logging enabled
- ✅ cross() operator applied correctly

---

### **2. Syntax Check ✅ PASSED**
```bash
$ sudo liquidsoap --check /opt/radio/radio.liq

Result: SUCCESS
Warnings: 7 unused variables (not critical)
Config loads: YES
```

---

### **3. Runtime Status ❌ PROBLEM**
```
Liquidsoap processes: 3 running
Stream status: SILENT / NO PLAYBACK
Crossfade messages: NEVER SEEN
```

**Why?**
```
playlist() source → tries to load tracks
                 ↓
Files don't exist (timing issue)
                 ↓
Source enters fallback mode
                 ↓
NO TRACKS PLAYING
                 ↓
NO TRANSITIONS
                 ↓
cross() NEVER CALLED!
```

---

## 🎯 **ROOT CAUSE:**

### **File-Based Playlist Timing Issue**

```
Lambda Process:
1. Generate M3U playlist with paths (/var/radio/tracks/xxx.wav)
2. Upload M3U to EC2
3. Start downloading tracks (takes ~30 seconds)
4. Liquidsoap detects M3U change (reload_mode="watch")
5. Liquidsoap tries to load tracks → FILES DON'T EXIST YET!
6. Source becomes "empty" / fallback
7. No playback = no crossfade

Timeline:
T+0s:  M3U uploaded
T+1s:  Liquidsoap reloads playlist
T+2s:  Tries to load first track → FILE NOT FOUND
T+10s: Files start arriving
T+30s: All files downloaded
       BUT: Source already in fallback/stuck state!
```

---

## 💡 **WAAROM DIT GEBEURT:**

### **Playlist Source Behavior:**
```liquidsoap
radio = playlist(
  mode="normal",
  reload_mode="watch",  # ← Watches file changes
  reload=3600,
  "/var/radio/playlists/current.m3u"
)
```

**Problem:**
- `watch` mode triggers IMMEDIATELY when M3U changes
- Liquidsoap doesn't wait for files to exist
- Failed track loads → source enters error state
- Doesn't automatically recover when files appear later

---

## 📋 **EVIDENCE:**

### **Test Results:**
```bash
# After Lambda trigger:
Playlist entries: 17 ✅
Files on disk: 0 → 16 (after 30s) ✅
Stream playing: NO ❌
Crossfade called: NO ❌

# File check during playlist load:
/var/radio/tracks/track1.wav → ❌ NOT FOUND
/var/radio/tracks/track2.mp3 → ❌ NOT FOUND
...

# Later (after downloads complete):
/var/radio/tracks/track1.wav → ✅ EXISTS
/var/radio/tracks/track2.mp3 → ✅ EXISTS
BUT: Liquidsoap source already "dead"
```

---

## 🔧 **SOLUTIONS:**

### **Option 1: Delay Playlist Update** (Quick Fix)
```
Lambda waits for ALL downloads to complete
THEN uploads M3U
Ensures files exist when Liquidsoap reloads
```

**Pros:** Simple
**Cons:** Lambda timeout risk (15min max)

### **Option 2: Liquidsoap Graceful Retry** (Better)
```liquidsoap
radio = playlist(
  mode="normal",
  reload_mode="watch",
  reload=60,  # Try reload every 60s
  "/var/radio/playlists/current.m3u"
)
```

**Add:**
```liquidsoap
# Retry failed requests
request.dynamic.list with retry logic
```

### **Option 3: Pre-Download Verification** (Best)
```
Lambda checks if files already exist
Only updates M3U if >80% of files present
Adds retry mechanism for missing files
```

### **Option 4: Hybrid Approach** (Robust)
```
1. Lambda downloads all tracks first
2. Verifies files on EC2
3. Only then updates M3U
4. Sends SNS notification to trigger reload
5. Liquidsoap subscribes to reload signal
```

---

## 🎬 **RECOMMENDED FIX:**

### **Immediate (Today):**
```bash
# Manual workflow until automated:
1. Trigger Lambda
2. Wait 40 seconds
3. Restart Liquidsoap manually:
   ssh radio-ec2 "sudo pkill -f liquidsoap && nohup sudo liquidsoap /opt/radio/radio.liq &"
4. Verify playback started
5. Monitor for crossfade messages
```

### **Permanent (Tomorrow):**
```
Update Lambda handler.ts:
1. Download all tracks via Promise.all()
2. Verify each file with SSM RunCommand
3. Only update M3U when 100% complete
4. Add delay buffer (5 seconds)
5. Send completion event to EventBridge
6. Optional: Trigger Liquidsoap reload via SSM
```

---

## 📊 **VERIFICATION PLAN:**

### **To Confirm Crossfade Works:**
```bash
# After fix applied:
1. ssh radio-ec2
2. tail -f /tmp/liq.log | grep -E '🔥|💥|🎙️'
3. Wait for track change
4. Should see:
   🔥🔥🔥 CROSSFADE FUNCTION CALLED!
   Track A: /var/radio/tracks/...
   Track B: /var/radio/tracks/...
   💥💥💥 SLAM TRANSITION: 0.2s fadeout, NO fadein!
```

---

## 🎯 **CONCLUSION:**

```
╔════════════════════════════════════════════════════╗
║                                                    ║
║   CROSSFADE CONFIG: ✅ PERFECT                    ║
║   SYNTAX: ✅ VALID                                 ║
║   APPLIED: ✅ CORRECTLY                            ║
║                                                    ║
║   PROBLEM: ❌ SOURCE NOT PLAYING                   ║
║   ROOT CAUSE: Timing issue with file downloads    ║
║                                                    ║
║   FIX NEEDED: Lambda download completion wait     ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

**The crossfade IS configured correctly. It just never gets a chance to execute because tracks aren't playing!**

---

**Next Steps:**
1. Fix Lambda to wait for downloads
2. Restart Liquidsoap after files ready
3. Monitor for crossfade debug output
4. Verify SLAM transitions audible
