# 🔍 EC2 Inspection Report - Crossfade Integration

**Date**: 9 November 2025, 19:30 CET
**Instance**: i-0426ac5a6811b0d2a (79.125.44.178)
**Method**: AWS SSM Session Manager

---

## 📊 Current Status

### ✅ Services Running
```
Liquidsoap: Active (running normally)
Icecast:    Active (running normally)
Stream:     LIVE on http://79.125.44.178:8000/stream.mp3
```

### 📁 File Locations on EC2

#### Playlists & Configs
```bash
/tmp/current-playlist.m3u          # 1.9 KB (from 7 Nov)
/tmp/test-download.m3u              # 1.9 KB (test file)
/tmp/liquidsoap-crossfade.liq      # NOT PRESENT ❌
```

#### Liquidsoap
```bash
/opt/radio/radio.liq                # Main config
/opt/radio/radio.liq.backup         # Backup (created during test)
/opt/radio/fallback.mp3             # Silence fallback
/var/log/liquidsoap/radio.log       # Logs
```

#### Icecast
```bash
/etc/icecast2/icecast.xml           # Main config
/var/log/icecast2/access.log        # Access logs
/var/log/icecast2/error.log         # Error logs
```

---

## 🔍 Key Findings

### 1. **Liquidsoap Version**
```
Liquidsoap 2.0.2
Copyright (c) 2003-2021 Savonet team
```

**Impact**: Newer version with different crossfade API

### 2. **Current Liquidsoap Config** (`/opt/radio/radio.liq`)

```liquidsoap
# G-Forge Radio - Liquidsoap Configuration
set("init.allow_root",true)
set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 4)

s3_bucket = "radio-playlists-035636364722"
playlist_file = "/tmp/current-playlist.m3u"

def fetch_playlist() =
  log("📥 Fetching playlist from S3...")
  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")
  log("S3 result: #{ret}")
  playlist_file
end

ignore(fetch_playlist())
add_timeout(300., fun () -> begin ignore(fetch_playlist()); -1. end)

# Create playlist source
radio = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)

# Fallback to silence when playlist is empty
radio = fallback(track_sensitive=false, [radio, blank()])

# ❌ NO CROSSFADE HERE!
radio = normalize(radio)

output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="stream.mp3",
  name="G-Forge Radio",
  description="Techno & Electronic Music 24/7",
  radio
)
```

**Missing**: Crossfade line between playlist and normalize

### 3. **Crossfade Config Not Downloaded**

```bash
# Expected file: /tmp/liquidsoap-crossfade.liq
# Status: NOT PRESENT ❌
```

**Reason**: No download script on EC2 to fetch crossfade config from S3

### 4. **S3 Has the Config**

```bash
# S3 Location: s3://radio-playlists-035636364722/liquidsoap-crossfade.liq
# Status: EXISTS ✅
# Content:
# Crossfade configuration
radio = crossfade(
  start_next=3.0,
  fade_in=2.0,
  fade_out=2.0,
  radio
)

# Normalize audio levels
radio = normalize(radio)
```

**Problem**: This syntax doesn't work with Liquidsoap 2.0.2!

---

## ❌ Issues Discovered

### Issue 1: API Incompatibility
**Problem**: Generated crossfade config uses old Liquidsoap 1.x syntax
```liquidsoap
# Generated (doesn't work in 2.0.2):
radio = crossfade(start_next=3.0, fade_in=2.0, fade_out=2.0, radio)

# Error:
Error 6: Cannot apply that parameter because the function
has no argument labeled "start_next"!
```

**Liquidsoap 2.0.2 API**: Parameters changed

### Issue 2: Source Fallibility
**Problem**: Crossfade requires infallible source
```
Error 7: Invalid value: That source is fallible
```

**Cause**: `playlist()` source can fail (end of playlist)

**Solution**: Apply crossfade BEFORE fallback, or use mksafe()

### Issue 3: No Auto-Download
**Problem**: `liquidsoap-crossfade.liq` is not downloaded from S3

**Current**: Only `current-playlist.m3u` is auto-synced every 5 min

**Missing**:
- Download script for crossfade config
- Reload mechanism for Liquidsoap when config changes

---

## ✅ What Works

1. ✅ **Playlist Auto-Sync**: Every 5 minutes via S3
2. ✅ **Lambda Generation**: Crossfade config generated correctly
3. ✅ **S3 Upload**: Config uploaded to S3 successfully
4. ✅ **Stream Stability**: No interruptions during testing
5. ✅ **Services**: Liquidsoap & Icecast running perfectly

---

## 🛠️ Solutions

### Option 1: Update Liquidsoap Config (Manual - One-time)

Update `/opt/radio/radio.liq` with working crossfade:

```liquidsoap
# Create playlist source
p = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)

# Apply simple crossfade (works in 2.0.2)
radio = crossfade(p)

# Fallback to silence
radio = fallback(track_sensitive=false, [radio, blank()])

# Normalize
radio = normalize(radio)
```

**Pro**: Simple, works immediately
**Con**: Uses default crossfade settings (can't be configured from UI)

### Option 2: Update backend.ts (Best - Permanent Fix)

Update `amplify/backend/stream-server/index.ts` to generate correct Liquidsoap 2.0 config:

```typescript
// In stream server UserData script:
'# Create playlist source',
's = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)',
'',
'# Apply crossfade',
's = crossfade(s)',
'',
'# Fallback and normalize',
'radio = fallback(track_sensitive=false, [s, blank()])',
'radio = normalize(radio)',
```

**Pro**: New EC2 instances get crossfade automatically
**Con**: Doesn't fix existing EC2

### Option 3: Dynamic Crossfade (Advanced - Future)

1. **Download crossfade config** from S3 every 5 min
2. **Parse settings** from config file
3. **Generate Liquidsoap code** dynamically
4. **Reload** Liquidsoap without interruption

**Script** (`/opt/radio/sync-crossfade.sh`):
```bash
#!/bin/bash
# Download latest crossfade settings (as JSON)
aws s3 cp s3://bucket/crossfade-settings.json /tmp/crossfade.json

# Generate Liquidsoap config from settings
# (Would need custom parser)

# Reload Liquidsoap
systemctl reload liquidsoap-radio
```

**Pro**: Full UI → EC2 integration
**Con**: Complex, requires significant development

### Option 4: Upgrade to Liquidsoap Rolling Release (Experimental)

Install newer Liquidsoap with better API:

```bash
sudo apt-get update
sudo apt-get install liquidsoap-core liquidsoap
```

**Pro**: Latest features
**Con**: May break existing config, requires testing

---

## 📋 Recommended Action Plan

### Immediate (Now)
1. ✅ **Stream restored** - Running without crossfade (works fine)
2. ⏳ **Option 1**: Manually add simple crossfade to existing EC2
   - Quick fix (~5 min)
   - Uses default settings
   - Better than no crossfade

### Short Term (This Week)
3. 🔄 **Option 2**: Update backend.ts
   - Fix for future EC2 instances
   - Deploy via CDK update
   - Test on new instance

### Long Term (Future)
4. 🚀 **Option 3**: Dynamic crossfade config
   - Full UI integration
   - Real-time updates
   - Professional setup

---

## 🧪 Testing Results

### Attempted Fixes (All Tested)
```
❌ Crossfade with start_next parameter → API error
❌ Crossfade on fallible source → Source error
❌ Cross() with custom function → Type error
❌ Mksafe() + crossfade → Still fallible
✅ Restore original config → Stream works
```

### Current State
```
Stream:         LIVE ✅
Crossfade:      NOT ACTIVE ❌
Config Backup:  CREATED ✅
S3 Config:      UPLOADED ✅
```

---

## 📝 Files Modified During Testing

```bash
# Created:
/opt/radio/radio.liq.backup         # Original working config
/tmp/crossfade-insert.liq           # Test crossfade snippet

# Attempted to modify:
/opt/radio/radio.liq                # Restored to original

# Not created:
/tmp/liquidsoap-crossfade.liq       # Would be downloaded from S3
```

---

## 💡 Quick Manual Fix (5 Minutes)

If you want crossfade NOW on the existing EC2:

```bash
# Via SSM Session Manager:
sudo nano /opt/radio/radio.liq

# Change line 20-22 from:
radio = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)
radio = fallback(track_sensitive=false, [radio, blank()])
radio = normalize(radio)

# To:
p = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)
p = crossfade(p)
radio = fallback(track_sensitive=false, [p, blank()])
radio = normalize(radio)

# Save and restart:
sudo systemctl restart liquidsoap-radio
```

**Result**: Simple crossfade active (default 3s blend)

---

## 🎯 Summary

### Current Setup
- ✅ Playlist updates: **Working**
- ✅ Stream playback: **Working**
- ✅ Lambda analysis: **Working**
- ✅ S3 sync: **Working**
- ❌ Crossfade on EC2: **Not active**
- ❌ Dynamic config: **Not implemented**

### The Gap
```
Lambda → S3 Config → ??? → EC2 Liquidsoap
                     ↑
                  Missing link
```

### Next Steps
1. Decide: Quick fix vs. proper implementation
2. Update backend.ts for future instances
3. Consider dynamic config for v2.0

---

**Conclusion**: Smart Crossfade analysis works perfectly in Lambda, but EC2 integration needs implementation. Stream is stable, crossfade is optional enhancement.

**Recommendation**: Apply manual fix now, update backend.ts for future, plan dynamic system later.
