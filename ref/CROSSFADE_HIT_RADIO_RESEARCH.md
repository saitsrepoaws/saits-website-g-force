# 🔍 Crossfade Settings Research - Hit Radio Experts

**Date:** 14 November 2025, 12:05 CET  
**Research Goal:** Find optimal crossfade settings for hit radio (snelle overgangen, weinig/geen fade-in)

---

## 📊 **EXPERT BEVINDINGEN:**

### **🎯 KEY INSIGHT - COMMERCIAL RADIO PROFESSIONAL:**

**Bron:** [AzuraCast GitHub Discussion](https://github.com/AzuraCast/AzuraCast/discussions/5865)  
**Expert:** Radio automation professional met jaren ervaring

**Hoofdpunten:**

> **"FadeIn? For what? It's not and mostly never necessary for the transition of Songs."**

> **"X Crossfading only using People who mixes Beats together or doing Scratching Vinyls. But no one use that of real Radio Broadcasting."**

**Wat echte radio doet:**
```
✅ NO FADE-IN
✅ ONLY FADE-OUT (if hot end)
✅ Overlap van ~2 seconden
✅ Simpele transitions zonder complexe crossfading
```

**Zijn conclusie:**
```
LibreTime doet het goed:
- No FadeIn
- Only Fade Out if it's a Hot End
- Overlap is voor de FadeOut tijd van de oude song
```

---

## 📋 **OPTION 1: ULTRA-TIGHT COMMERCIAL HIT RADIO**

### **Settings:**
```liquidsoap
Fade-in:   0.0 sec (DISABLED!)
Fade-out:  0.5 sec (ultra-kort)
Overlap:   0.5 sec
Type:      linear (snel en direct)
```

### **Karakter:**
```
🎵 Super strak
🎵 Energiek
🎵 Snel tempo
🎵 Radio 538 / Q-Music style
🎵 Geen "blend" - gewoon volgende track!
```

### **Perfect voor:**
- Hit radio CHR/Top 40
- Jonge doelgroep
- Energieke playlists
- Commerciële radio

### **Voordeel:**
```
✅ Maximum energy
✅ Snel tempo
✅ Geen saai gebuur tussen tracks
✅ Professional commercial sound
```

### **Nadeel:**
```
❌ Kan abrupt klinken bij slow tracks
❌ Niet geschikt voor smooth genres
```

---

## 📋 **OPTION 2: QUICK MIX (RECOMMENDED)**

### **Settings:**
```liquidsoap
Fade-in:   0.0 sec (DISABLED!)
Fade-out:  1.0 sec (kort maar smooth)
Overlap:   1.0 sec
Type:      exponential (natuurlijk decay)
```

### **Karakter:**
```
🎵 Strak maar smooth
🎵 Professional
🎵 Snel maar niet abrupt
🎵 Radio 1 / 3FM style
```

### **Perfect voor:**
- Hit radio met variatie
- Mix van energieke en rustige tracks
- Professional sound
- Breed publiek

### **Voordeel:**
```
✅ Goede balans snel/smooth
✅ Werkt bij alle genres
✅ Professional sound
✅ Geen fade-in = direct tempo
```

### **Nadeel:**
```
⚠️  Iets minder energiek dan Option 1
```

---

## 📋 **OPTION 3: SLAM TRANSITION**

### **Settings:**
```liquidsoap
Fade-in:   0.0 sec (DISABLED!)
Fade-out:  0.2 sec (minimal!)
Overlap:   0.2 sec
Type:      linear (instant)
```

### **Karakter:**
```
🎵 VERY aggressive
🎵 "Slam" style
🎵 Maximum energy
🎵 Club/dance radio style
```

### **Perfect voor:**
- Dance radio
- Club mixes
- Extreme energy
- Special events

### **Voordeel:**
```
✅ Maximum impact
✅ Instant energy switch
✅ Modern club sound
```

### **Nadeel:**
```
❌ Kan te agressief zijn
❌ Alleen voor specific formats
❌ Niet voor alle tracks geschikt
```

---

## 📋 **OPTION 4: CURRENT SETUP (REFERENCE)**

### **Settings:**
```liquidsoap
Fade-in:   1.0 sec
Fade-out:  0.5 sec
Overlap:   5.0 sec
BPM:       matched (4 beats)
Type:      sin (smooth)
```

### **Karakter:**
```
🎵 DJ-style blends
🎵 BPM-matched
🎵 Smooth transitions
🎵 Dance/House focused
```

### **Perfect voor:**
- Dance radio
- House music
- Progressive sets
- Mix shows

---

## 📊 **EXPERT SETTINGS VERGELIJKING:**

### **RadioDJ Expert (DJ Garybaldy):**
```
Fade-out:  3900ms (3.9 seconden)
Type:      Not specified
Note:      Smooth for all music types
```

### **Commercial Radio Professional:**
```
Fade-in:   DISABLED (0 sec)
Fade-out:  ~2 sec (overlap tijd)
Type:      Simple
Note:      "No X-crossfading in real radio"
```

### **Live365 Recommendations:**
```
Duration:  0-20 sec (configurable)
Type:      Exponential (natural decay)
Note:      "Best for long fade-outs"
```

---

## 🎯 **MIJN AANBEVELING VOOR SPLASH FM:**

### **OPTION 2: QUICK MIX (MODIFIED)**

```liquidsoap
# GEEN FADE-IN
default_fade_in = 0.0

# KORTE FADE-OUT
default_fade_out = 1.0

# KORT OVERLAP WINDOW
default_duration = 1.0

# NATURAL DECAY
fade_type = "exp"  # Exponential (natuurlijk)

# GEEN BPM MATCHING
# (disable BPM logic, use simple fade)
```

### **Waarom deze keuze:**

**✅ PRO:**
```
1. No fade-in = direct start next track (energy!)
2. 1.0 sec fade-out = snel maar niet abrupt
3. Exponential = natural sound decay
4. Works voor alle genres
5. Professional commercial radio sound
6. Simpel en betrouwbaar (geen BPM complexity)
```

**Vergelijking met nu:**
```
NU:
  Fade-in:  1.0 sec  →  NIEUW: 0.0 sec ✅
  Fade-out: 0.5 sec  →  NIEUW: 1.0 sec (iets langer voor smooth)
  Overlap:  5.0 sec  →  NIEUW: 1.0 sec ✅ (veel korter!)
  BPM:      matched  →  NIEUW: disabled ✅ (simpeler)
  
Result: VEEL strakker en sneller!
```

---

## 🎯 **ALTERNATIEF: ULTRA-TIGHT (OPTION 1)**

Als je ECHT maximaal strak wilt (Radio 538 style):

```liquidsoap
default_fade_in = 0.0
default_fade_out = 0.5
default_duration = 0.5
fade_type = "lin"  # Linear (instant)
```

**Effect:**
- Super snel
- Maximum energy
- Zeer strakke overgangen
- Kan soms abrupt zijn

---

## 🎚️ **JINGLE HANDLING:**

**BELANGRIJK:** Behoud de jingle instant cut!

```liquidsoap
if is_jingle(track) then
  sequence([a.source, b.source])  # Instant cut
else
  # Nieuwe fade settings
end
```

---

## 📝 **IMPLEMENTATIE OPTIES:**

### **Option A: Simpel (No BPM)**
```liquidsoap
# Disable advanced crossfade
# Use simple fade:

radio = fade.in(duration=0.0, radio)
radio = fade.out(duration=1.0, radio)
radio = cross(duration=1.0, fun(a,b) ->
  add(normalize=false, [
    fade.out(duration=1.0, type="exp", a.source),
    b.source  # No fade-in!
  ])
end, radio)
```

### **Option B: Modify Advanced (Keep Smart Features)**
```liquidsoap
# Update advanced-crossfade.liq:
default_fade_in = 0.0   # DISABLED
default_fade_out = 1.0  # Quick but smooth
default_duration = 1.0  # Tight overlap
fade_type = "exp"       # Natural decay

# Disable BPM matching
# Just use defaults always
```

---

## 💬 **EXPERT QUOTES:**

> "FadeIn? For what? It's not and mostly never necessary for the transition of Songs."  
> — Radio automation professional

> "X Crossfading only using People who mixes Beats together. But no one use that of real Radio Broadcasting."  
> — Radio automation professional

> "The sine fade is often used for fading out music since it produces a smoother, more musical sounding fade out."  
> — Live365 Documentation

> "My fadeout duration has been set at 3900ms for a few years now and always fades tracks rather well."  
> — DJ Garybaldy (RadioDJ expert)

---

## 🎯 **CONCLUSIE:**

### **Voor Commercial Hit Radio:**

**DO:**
```
✅ NO Fade-in (instant start next track)
✅ Short fade-out (0.5-1.5 sec)
✅ Short overlap (0.5-1.5 sec)
✅ Simple transitions (no complex BPM matching)
✅ Exponential/Linear curves (natural/instant)
```

**DON'T:**
```
❌ Lange fade-ins
❌ Lange overlaps (>2 sec)
❌ Complex BPM beat-matching (is voor DJ mixes)
❌ Sinusoidal fades (te smooth/slow)
```

---

## 🚀 **VOLGENDE STAP:**

**Keuze maken tussen:**

1. **OPTION 1: Ultra-Tight** (0.5s out, 0s in, linear)
   - Radio 538 / Q-Music style
   - Maximum energy

2. **OPTION 2: Quick Mix** (1.0s out, 0s in, exponential) ⭐ **RECOMMENDED**
   - Professional commercial radio
   - Balans snel/smooth

3. **OPTION 3: Slam** (0.2s out, 0s in, linear)
   - Extreme energy
   - Dance/club only

**Ik adviseer: OPTION 2** (quick mix met 1.0s fadeout, geen fadein)

---

**📄 Sources:**
- RadioDJ Community (DJ Garybaldy)
- AzuraCast GitHub Discussion (Radio Professional)
- Live365 Documentation
- RadioBoss Documentation

**Status:** ✅ READY FOR DECISION
