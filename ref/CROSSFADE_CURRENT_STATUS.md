# 🎛️ Crossfade Huidige Configuratie - Overzicht

**Date:** 14 November 2025, 11:50 CET  
**Status:** ✅ ACTIEF  
**Config:** `/opt/radio/advanced-crossfade.liq`

---

## 📊 **HUIDIGE INSTELLINGEN:**

### **Main Settings:**
```liquidsoap
# In /opt/radio/radio.liq:
radio = cross(duration=5.0, advanced_crossfade, radio)

# Parameters:
duration = 5.0 seconden (overlap window)
```

### **Crossfade Parameters:**
```liquidsoap
# Default fade times (fallback als geen BPM):
default_fade_in  = 1.0 sec
default_fade_out = 0.5 sec
default_duration = 5.0 sec

# BPM-based fades:
fade_beats = 4  # Fade over 4 beats

# Fade curve:
fade_type = "sin"  # Sinusoidal fade (smooth)
```

### **Jingle Detection:**
```liquidsoap
jingle_threshold = 30.0 sec

# Regel: Tracks < 30 seconden = NO CROSSFADE
# Result: Instant cut voor jingles/IDs
```

### **Volume Detection (dB):**
```liquidsoap
high_db   = -15.0 dB
medium_db = -32.0 dB
margin_db =   4.0 dB

# Gebruikt voor smart mixing logic
```

---

## 🎵 **HOE HET WERKT:**

### **Decision Tree:**
```
Track Transition:
├─ Is jingle (< 30 sec)?
│  └─ YES → ⚡ Instant cut (no crossfade)
│
├─ Has per-track metadata (liq_fade_in/out)?
│  └─ YES → 🎚️ Use custom fades
│
├─ Both tracks have BPM?
│  └─ YES → 🎵 BPM-matched crossfade
│      ├─ Calculate fade over 4 beats
│      ├─ Use average BPM
│      └─ Apply volume-based smart mixing
│
└─ NO BPM data
   └─ 📻 Fallback: default DJ blend (1.0s/0.5s)
```

---

## 🎼 **BPM-MATCHED CROSSFADE:**

### **Formule:**
```javascript
fade_duration = (60 / BPM) * beats

Example:
BPM = 128
Beats = 4
→ fade_duration = (60 / 128) * 4 = 1.875 sec

BPM = 140 (Techno)
Beats = 4
→ fade_duration = (60 / 140) * 4 = 1.714 sec
```

### **Safety Limits:**
```
Min fade: 0.5 sec
Max fade: 6.0 sec
```

---

## 🎚️ **VOLUME-BASED SMART MIXING:**

### **3 Modi:**

#### **1. Full Crossfade:**
```
Conditie: Beide tracks medium volume en similar
Volume A: -30 dB
Volume B: -28 dB (verschil < 4 dB)

Action: Full fade-out A + fade-in B
```

#### **2. Fade-out Only:**
```
Conditie: Track B is louder
Volume A: -25 dB
Volume B: -18 dB (B is 7 dB louder)

Action: Fade-out A, direct cut in B
```

#### **3. Fade-in Only:**
```
Conditie: Track A is louder
Volume A: -18 dB
Volume B: -25 dB (A is 7 dB louder)

Action: Direct cut out A, fade-in B
```

---

## 📋 **GENRE-SPECIFIC PRESETS:**

### **Configured Genres:**
```liquidsoap
House:
  fade_in:  1.5 sec
  fade_out: 1.0 sec
  beats:    4

Techno:
  fade_in:  1.0 sec
  fade_out: 0.5 sec (tight!)
  beats:    4

Trance:
  fade_in:  2.0 sec
  fade_out: 2.0 sec (smooth)
  beats:    8

Dance:
  fade_in:  1.2 sec
  fade_out: 0.8 sec
  beats:    4

Default (geen match):
  fade_in:  1.0 sec
  fade_out: 0.5 sec
  beats:    4
```

---

## 🎙️ **JINGLE HANDLING:**

### **Detection:**
```liquidsoap
if duration < 30.0 sec then
  → is_jingle = true
  → NO CROSSFADE
  → Instant cut (professional radio sound)
end
```

### **Examples:**
```
Station ID (15 sec)     → ⚡ Instant cut
Sweeper (8 sec)         → ⚡ Instant cut
Promo (25 sec)          → ⚡ Instant cut
Music track (3:45)      → 🎵 BPM-matched crossfade
```

---

## 🎛️ **PER-TRACK METADATA OVERRIDE:**

### **Database Fields:**
```graphql
Track {
  liq_fade_in:  "2.5"  # Custom fade-in (seconds)
  liq_fade_out: "1.0"  # Custom fade-out (seconds)
}
```

### **Usage:**
```
Als track heeft liq_fade_in/out metadata:
→ Use custom values (ignore BPM/genre)
→ Voor special tracks die specifieke fades nodig hebben
```

---

## 📊 **VOORBEELD SCENARIOS:**

### **Scenario 1: House → House**
```
Track A: "Deep House Track" (125 BPM, -28 dB)
Track B: "Tech House Track" (128 BPM, -26 dB)

Calculation:
  Average BPM: (125 + 128) / 2 = 126.5
  Fade duration: (60 / 126.5) * 4 = 1.897 sec
  Genre: House → multiplier applied
  Volume: Similar → Full crossfade

Result:
  🎵 Fade-out A over 1.9 sec
  🎵 Fade-in B over 1.9 sec
  Perfect beat-matched transition!
```

### **Scenario 2: Track → Jingle**
```
Track A: "Dance Track" (130 BPM, 3:45 duration)
Track B: "Station ID" (15 sec duration)

Detection:
  Track B < 30 sec → is_jingle = true

Result:
  ⚡ Instant cut (no crossfade)
  Professional radio sound!
```

### **Scenario 3: Techno → Techno (tight mix)**
```
Track A: "Techno Track" (140 BPM, -22 dB)
Track B: "Techno Track" (138 BPM, -20 dB)

Calculation:
  Average BPM: 139
  Genre: Techno → tight fade (0.5s out, 1.0s in)
  Fade: (60 / 139) * 4 = 1.726 sec
  Techno preset: multiplier 0.5/1.0

Result:
  🎵 Quick fade-out: 0.86 sec
  🎵 Smooth fade-in: 1.73 sec
  Tight techno mixing!
```

### **Scenario 4: No BPM Data**
```
Track A: "Old track" (no BPM metadata)
Track B: "New track" (no BPM metadata)

Fallback:
  Use default DJ Blend preset
  Fade-out: 0.5 sec
  Fade-in:  1.0 sec

Result:
  📻 Standard crossfade
  Still sounds professional!
```

---

## 🔧 **CONFIG FILES:**

### **Main Config:**
```bash
/opt/radio/radio.liq

# Relevante regels:
%include "/opt/radio/advanced-crossfade.liq"
radio = cue_cut(radio)
radio = cross(duration=5.0, advanced_crossfade, radio)
```

### **Crossfade Logic:**
```bash
/opt/radio/advanced-crossfade.liq

# Bevat:
- BPM calculation functions
- Jingle detection
- Genre presets
- Volume-based smart mixing
- Advanced crossfade function
```

---

## 📈 **VOORDELEN HUIDIGE SETUP:**

```
✅ BPM-matched transitions (pro DJ sound)
✅ Smart jingle handling (instant cuts)
✅ Genre-aware fades (House vs Techno)
✅ Volume-based intelligent mixing
✅ Per-track custom control
✅ Safe fallbacks (always works)
✅ Tight techno mixing (0.5s fades)
✅ Smooth trance transitions (2.0s fades)
```

---

## ⚙️ **AANPASSINGSMOGELIJKHEDEN:**

### **Quick Tweaks:**

#### **1. Fade Beats Aanpassen:**
```liquidsoap
# Huidige: 4 beats
fade_beats = 4

# Meer beats = langere fade (smoother)
fade_beats = 8  # Voor progressive house

# Minder beats = snellere fade (tighter)
fade_beats = 2  # Voor hardcore techno
```

#### **2. Default Fade Times:**
```liquidsoap
# Huidige:
default_fade_in  = 1.0 sec
default_fade_out = 0.5 sec

# Aanpassen voor andere stijl:
default_fade_in  = 2.0 sec  # Smoother
default_fade_out = 1.5 sec
```

#### **3. Jingle Threshold:**
```liquidsoap
# Huidige: < 30 sec = jingle
jingle_threshold = 30.0

# Aanpassen:
jingle_threshold = 45.0  # Meer tracks als jingle
jingle_threshold = 20.0  # Alleen echt korte jingles
```

#### **4. Fade Curve:**
```liquidsoap
# Huidige: "sin" (sinusoidal - smooth)
fade_type = "sin"

# Opties:
fade_type = "lin"  # Linear (constant speed)
fade_type = "log"  # Logarithmic (fast start, slow end)
fade_type = "exp"  # Exponential (slow start, fast end)
```

---

## 🎯 **HUIDIGE SOUND:**

### **Karakter:**
```
🎵 Tight professional DJ-style mixing
🎵 BPM-matched transitions
🎵 Clean jingle cuts
🎵 Genre-aware fading
🎵 Smart volume mixing
```

### **Best Voor:**
```
✅ House music (Deep/Tech House)
✅ Dance / EDM
✅ Techno / Minimal
✅ Trance / Progressive
✅ Mixed genre sets
✅ Professional radio with jingles
```

---

## 📝 **VOORBEELD LOGS:**

### **Console Output:**
```
🎵 BPM-matched crossfade: A=125bpm, B=128bpm, Avg=126.5bpm
   Fade over 4 beats: in=1.9s, out=1.9s
   Genre: House
   Mode: Full crossfade (similar volumes)

🎙️ Jingle detected - Instant cut (no crossfade)

⚠️ No BPM data - Using default DJ Blend preset (1.0s/0.5s)
```

---

## 🔍 **TESTEN:**

### **Check Current Crossfade:**
```bash
# Luister naar stream
open https://splashfm.nl

# Check logs
ssh radio-ec2 "tail -f /tmp/liquidsoap.log | grep -i cross"
```

### **Test Scenarios:**
```
1. Music → Music: Should have smooth BPM-matched fade
2. Music → Jingle: Should cut instantly
3. Jingle → Music: Should start clean
4. Same BPM tracks: Should be perfectly beat-matched
```

---

## 💡 **AANBEVELINGEN:**

### **Huidige Setup is GOED voor:**
```
✅ Professional radio sound
✅ Dance music focus
✅ Jingle integration
✅ Automated 24/7 streaming
```

### **Mogelijke Verbeteringen:**
```
1. Genre preset tuning (per genre fijnafstemmen)
2. Key-aware mixing (harmonic mixing)
3. Energy-based transitions (high→low energy)
4. Custom per-track fades in database
```

---

## 📚 **DOCUMENTATIE:**

```
Config:  /opt/radio/advanced-crossfade.liq
Main:    /opt/radio/radio.liq
Logs:    /tmp/liquidsoap.log
Stream:  https://splashfm.nl
```

---

**🎛️ Professionele BPM-matched crossfades met smart jingle handling! 🎛️**
