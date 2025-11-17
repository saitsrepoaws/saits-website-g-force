# 🎛️ G-Forge Crossfade Preset System

**Date:** 14 November 2025, 12:30 CET  
**Status:** ✅ ACTIVE (g-forge-Quick-Mix-Extreme)

---

## 🎯 **OVERVIEW:**

Three professional crossfade presets stored in S3 with easy switching between them. Based on expert research on commercial radio crossfade settings.

**Current Active Preset:** `g-forge-Quick-Mix-Extreme` (SLAM style)

---

## 📦 **AVAILABLE PRESETS:**

### **1. g-forge-Ultra-Tight**
```
Settings: 0.5s fadeout / 0s fadein / linear
Style:    Radio 538, maximum energy
Use:      Hit radio CHR/Top 40, young audience

Characteristics:
✓ NO fade-in (instant start)
✓ Ultra-short fade-out (0.5s)
✓ Tight overlap (0.5s)
✓ Linear curve (direct)
✓ Maximum energy flow
```

### **2. g-forge-Quick-Mix**
```
Settings: 1.0s fadeout / 0s fadein / exponential
Style:    Commercial hit radio, professional
Use:      Broad audience, mixed genres

Characteristics:
✓ NO fade-in (instant start)
✓ Quick fade-out (1.0s)
✓ Short overlap (1.0s)
✓ Exponential curve (natural decay)
✓ Professional sound
```

### **3. g-forge-Quick-Mix-Extreme** ⭐ **CURRENT ACTIVE**
```
Settings: 0.2s fadeout / 0s fadein / linear
Style:    SLAM transitions, extreme energy
Use:      Dance radio, club style

Characteristics:
✓ NO fade-in (instant start)
✓ Minimal fade-out (0.2s)
✓ Minimal overlap (0.2s)
✓ Linear curve (instant slam)
✓ Maximum impact and energy
```

---

## 🗂️ **S3 STORAGE:**

### **Structure:**
```
s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/
└── crossfade-presets/
    ├── g-forge-Ultra-Tight.liq
    ├── g-forge-Quick-Mix.liq
    ├── g-forge-Quick-Mix-Extreme.liq
    └── backups/
        ├── crossfade-backup-20251114-122022.liq
        ├── crossfade-backup-20251114-122147.liq
        └── ... (timestamped backups)
```

### **Versioning:**
```
✓ S3 bucket has versioning enabled
✓ Every upload creates a new version
✓ Old versions can be restored
✓ Automatic backup before each switch
```

---

## 🔄 **SWITCHING PRESETS:**

### **Command:**
```bash
./switch-crossfade-preset.sh <preset-name>
```

### **Available presets:**
- `g-forge-Ultra-Tight`
- `g-forge-Quick-Mix`
- `g-forge-Quick-Mix-Extreme`

### **What it does:**
```
1. Downloads preset from S3
2. Backs up current config to S3
3. Uploads new preset to EC2
4. Restarts Liquidsoap
5. Verifies stream is running
```

### **Example:**
```bash
# Switch to Ultra-Tight (Radio 538 style)
./switch-crossfade-preset.sh g-forge-Ultra-Tight

# Switch to Quick-Mix (commercial radio)
./switch-crossfade-preset.sh g-forge-Quick-Mix

# Switch to Extreme (SLAM style) - CURRENT
./switch-crossfade-preset.sh g-forge-Quick-Mix-Extreme
```

---

## 📊 **COMPARISON WITH OLD SYSTEM:**

### **Before (Advanced Crossfade):**
```
Fade-in:  1.0 sec
Fade-out: 0.5 sec
Overlap:  5.0 sec (BPM-matched, 4 beats)
Type:     sin (smooth)
Features: BPM matching, jingle detection, genre presets
```

### **After (g-forge-Quick-Mix-Extreme):**
```
Fade-in:  0.0 sec ✅ NO FADE-IN!
Fade-out: 0.2 sec ✅ MUCH shorter
Overlap:  0.2 sec ✅ 25x shorter!
Type:     lin (instant)
Features: Jingle detection (kept), BPM removed
```

### **Result:**
```
✓ 25x faster transitions (5.0s → 0.2s)
✓ NO fade-in = instant energy!
✓ Simpler logic = more reliable
✓ Professional commercial radio sound
```

---

## 🎙️ **JINGLE HANDLING:**

**All presets include intelligent jingle detection:**

```liquidsoap
# Jingles get INSTANT cut (no crossfade)
if is_jingle(track) then
  sequence([a.source, b.source])  # Instant cut
else
  # Apply preset crossfade
end

# Detection criteria:
- Duration < 30 seconds
- Genre = "Station ID" or "Jingle"
```

**Result:** Jingles always play cleanly without crossfading.

---

## 📝 **PRESET FILE FORMAT:**

Each preset is a standalone Liquidsoap file:

```liquidsoap
#!/usr/bin/liquidsoap

# Header with preset info
# Configuration parameters
# Jingle detection function
# advanced_crossfade() function (used by radio.liq)
# Logging/confirmation
```

**Function name:** All presets use `advanced_crossfade()` so they work with existing `radio.liq` without changes.

---

## 🔐 **BACKUP & ROLLBACK:**

### **Automatic Backups:**
```
✓ Before each preset switch
✓ Timestamped in S3
✓ Saved to: s3://.../crossfade-presets/backups/
```

### **Manual Rollback:**
```bash
# 1. List backups
aws s3 ls s3://$BUCKET/crossfade-presets/backups/

# 2. Download specific backup
aws s3 cp s3://$BUCKET/crossfade-presets/backups/crossfade-backup-TIMESTAMP.liq ./

# 3. Upload to EC2
scp ./crossfade-backup-TIMESTAMP.liq radio-ec2:/tmp/crossfade.liq
ssh radio-ec2 "sudo mv /tmp/crossfade.liq /opt/radio/advanced-crossfade.liq"

# 4. Restart Liquidsoap
ssh radio-ec2 "sudo pkill liquidsoap && cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 &"
```

### **Quick Rollback (last backup):**
```bash
# Get latest backup
LATEST=$(aws s3 ls s3://$BUCKET/crossfade-presets/backups/ | sort | tail -1 | awk '{print $4}')

# Restore
aws s3 cp s3://$BUCKET/crossfade-presets/backups/$LATEST /tmp/restore.liq
scp /tmp/restore.liq radio-ec2:/tmp/
ssh radio-ec2 "sudo mv /tmp/restore.liq /opt/radio/advanced-crossfade.liq && sudo pkill liquidsoap && cd /opt/radio && nohup sudo liquidsoap radio.liq &"
```

---

## 🎛️ **HOW TO CREATE NEW PRESET:**

### **1. Create preset file:**
```bash
# Copy template
cp crossfade-presets/g-forge-Quick-Mix.liq crossfade-presets/my-new-preset.liq

# Edit settings:
# - default_fade_in
# - default_fade_out
# - default_duration
# - fade_type ("lin", "exp", "sin")

# Update header comments
```

### **2. Test locally:**
```bash
# Syntax check
liquidsoap --check my-new-preset.liq
```

### **3. Upload to S3:**
```bash
aws s3 cp crossfade-presets/my-new-preset.liq s3://$BUCKET/crossfade-presets/
```

### **4. Deploy:**
```bash
./switch-crossfade-preset.sh my-new-preset
```

---

## 📚 **RESEARCH BASIS:**

Based on expert research documented in: `CROSSFADE_HIT_RADIO_RESEARCH.md`

**Key findings:**
- Commercial radio does NOT use fade-in
- Short fade-outs (0.5-2.0s) are standard
- BPM matching is for DJ mixes, not radio
- Simple = reliable
- Linear/exponential curves preferred over sine

**Sources:**
- RadioDJ experts (DJ Garybaldy)
- AzuraCast professional radio users
- Live365 documentation
- Commercial radio best practices

---

## 📊 **DEPLOYMENT HISTORY:**

```
2025-11-14 12:20 CET - Initial preset creation
2025-11-14 12:21 CET - Upload to S3
2025-11-14 12:22 CET - First deploy attempt (function name fix needed)
2025-11-14 12:26 CET - g-forge-Quick-Mix-Extreme deployed ✅
                       Status: ACTIVE
```

---

## 🎯 **USE CASES:**

### **When to use each preset:**

**g-forge-Ultra-Tight:**
```
✓ Hit radio format (CHR/Top 40)
✓ Young, energetic audience
✓ Fast-paced programming
✓ Radio 538 / Q-Music style
```

**g-forge-Quick-Mix:**
```
✓ General commercial radio
✓ Mixed genres
✓ Broad audience appeal
✓ Professional sound
✓ All-day programming
```

**g-forge-Quick-Mix-Extreme:**
```
✓ Dance/club radio
✓ High-energy shows
✓ Special events
✓ Maximum impact needed
✓ Electronic music focus
```

---

## 🔧 **TECHNICAL DETAILS:**

### **EC2 Location:**
```
Server:  79.125.44.178 (radio-ec2)
Path:    /opt/radio/advanced-crossfade.liq
Main:    /opt/radio/radio.liq
Logs:    /tmp/liquidsoap.log
```

### **Integration:**
```liquidsoap
# In radio.liq:
%include "/opt/radio/advanced-crossfade.liq"
radio = cross(duration=5.0, advanced_crossfade, radio)
```

**Note:** The `duration=5.0` in radio.liq is the buffer/look-ahead time, NOT the actual crossfade duration. The preset controls actual fade durations.

---

## 📈 **MONITORING:**

### **Check active preset:**
```bash
ssh radio-ec2 "head -30 /tmp/liquidsoap.log | grep 'G-Forge'"
```

### **Check crossfade performance:**
```bash
# Watch live transitions
ssh radio-ec2 "tail -f /tmp/liquidsoap.log | grep -i 'crossfade\|jingle'"
```

### **Stream health:**
```bash
curl -I http://79.125.44.178/
```

---

## ✅ **BENEFITS:**

```
✓ Easy preset switching (1 command)
✓ Automatic backups before changes
✓ S3 versioning (rollback any time)
✓ No downtime (fast restart)
✓ Professional sound
✓ Research-based settings
✓ Flexible (3 styles ready)
✓ Expandable (easy to add more)
```

---

## 🚀 **NEXT STEPS:**

**Potential enhancements:**

1. **UI preset switcher**
   - Web interface to switch presets
   - Real-time preview of settings

2. **A/B testing**
   - Schedule preset changes
   - Collect listener feedback

3. **Per-show presets**
   - Different presets for different shows
   - Time-based auto-switching

4. **Analytics**
   - Track which preset is used when
   - Listener retention per preset

---

## 📞 **SUPPORT:**

**Files:**
- Presets: `/crossfade-presets/`
- Switch script: `./switch-crossfade-preset.sh`
- Research doc: `CROSSFADE_HIT_RADIO_RESEARCH.md`

**S3 Bucket:**
```
amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr
Path: /crossfade-presets/
```

**Server:**
```
Host: radio-ec2 (79.125.44.178)
SSH:  ssh radio-ec2
```

---

**Status:** ✅ PRODUCTION READY  
**Active:** g-forge-Quick-Mix-Extreme (SLAM style)  
**Stream:** http://79.125.44.178/stream.mp3

🎛️ **EASY SWITCHING. PROFESSIONAL SOUND. S3 VERSIONED.**
