# Radio 538-Style Preset voor Stereo Tool
**Orban Optimod-achtige processing met VEEL BASS en loudness**

## Karakteristieken Radio 538:
- **Zeer agressieve multiband compression**
- **Bass boost** (diep en punchy, Orban-stijl)
- **Maximum loudness** (competitief met andere stations)
- **Consistent geluid** over alle tracks
- **Bright top-end** (helderheid)
- **Controlled dynamics** maar niet doodgeperst

## Stereo Tool Settings (te configureren in GUI of .sts file):

### 1. **MULTIBAND COMPRESSOR** (Hoofdbewerking)

**5-band setup:**
```
Band 1 (Sub-bass): 20-120 Hz
  - Ratio: 4:1
  - Threshold: -15 dB
  - Attack: 10 ms
  - Release: 150 ms
  - Gain: +3 dB (BASS BOOST!)

Band 2 (Bass): 120-500 Hz
  - Ratio: 3:1
  - Threshold: -12 dB
  - Attack: 8 ms
  - Release: 120 ms
  - Gain: +2 dB

Band 3 (Mids): 500-2000 Hz
  - Ratio: 3:1
  - Threshold: -10 dB
  - Attack: 5 ms
  - Release: 100 ms
  - Gain: 0 dB

Band 4 (Presence): 2000-6000 Hz
  - Ratio: 2.5:1
  - Threshold: -8 dB
  - Attack: 3 ms
  - Release: 80 ms
  - Gain: +1 dB (helderheid)

Band 5 (High): 6000-20000 Hz
  - Ratio: 2:1
  - Threshold: -6 dB
  - Attack: 2 ms
  - Release: 60 ms
  - Gain: +0.5 dB
```

### 2. **AGC (Automatic Gain Control)**
```
- Target level: -10 dBFS
- Speed: Medium-Fast
- Max gain: +15 dB
- Max attenuation: -20 dB
```

### 3. **BASS ENHANCEMENT** (Orban-stijl)
```
- Bass boost frequency: 60 Hz
- Boost amount: +4 dB
- Q-factor: 1.2 (niet te smal)
- Sub-harmonic generator: Enabled
- Sub-bass level: +2 dB
```

### 4. **STEREO ENHANCEMENT**
```
- Stereo width: 115% (niet overdrijven)
- Bass mono below: 150 Hz (belangrijk!)
- Phase correction: Enabled
```

### 5. **LIMITER** (Final stage - cruciaal!)
```
- Ceiling: -0.1 dBFS (safety headroom)
- Attack: 0.5 ms
- Release: 50 ms
- Look-ahead: 5 ms
- Overshoot protection: Enabled
```

### 6. **LOUDNESS MAXIMIZER**
```
- Target loudness: -9 LUFS (zeer loud, zoals 538!)
- True peak limit: -1.0 dBTP
- Dynamic range: 6 LU (tight maar niet dood)
```

### 7. **EQ (Final touch)**
```
- Low shelf (80 Hz): +2 dB (extra bass punch)
- Bell (3 kHz): +1.5 dB (presence, vocal clarity)
- High shelf (10 kHz): +1 dB (air, brightness)
```

---

## 🎛️ Quick Settings (Conservative Start)

Als je geen .sts file hebt, start conservatiever:

```bash
# In Stereo Tool GUI (als je die hebt):
1. Selecteer "FM Broadcast" preset als basis
2. Verhoog Bass (band 1 & 2) met +2-3 dB
3. Zet multiband compression ratio's naar 3:1 - 4:1
4. Enable loudness maximizer op -9 LUFS
5. Save als "Radio538Style.sts"
```

---

## 📝 Implementatie Opties:

### Optie 1: GUI Preset Maken (Aanbevolen)
1. Download Stereo Tool GUI (Windows/Mac)
2. Configureer bovenstaande instellingen
3. Export als `radio-538.sts`
4. Upload naar EC2:
   ```bash
   scp radio-538.sts radio-ec2:/opt/radio/preset.sts
   ```

### Optie 2: Command-line Presets
Stereo Tool heeft built-in presets:
```bash
# Zie beschikbare presets:
stereotool-cmd --list-presets

# Gebruik preset (in relay script):
stereotool-cmd -p "FM/Loud" - -
```

### Optie 3: Start met Built-in Loud Preset
Update `/usr/local/bin/stereotool-relay.sh`:

**Van:**
```bash
$STEREO_TOOL - -
```

**Naar:**
```bash
$STEREO_TOOL -p "FM/Loud" - -
```

Dit geeft je:
- ✅ Meer compression
- ✅ Meer loudness
- ✅ Meer bass
- ✅ Orban-achtig geluid

---

## ⚠️ WAARSCHUWINGEN:

1. **Over-processing kills dynamics**
   - Start conservatief en verhoog langzaam
   - Luister naar muziek én speech

2. **Bass boost = clipping risk**
   - Monitor levels
   - Check voor distortion

3. **Loudness war = listener fatigue**
   - -9 LUFS is ZEER loud
   - Overweeg -11 LUFS voor langere luister sessies

4. **Orban kost €€€€**
   - Echte Orban Optimod = €5000-15000
   - Stereo Tool is goede alternatief!

---

## 🎯 Radio 538 Specifiek:

Radio 538 draait waarschijnlijk:
- **Orban Optimod 8700i** (high-end processor)
- Target loudness: -8 tot -9 LUFS
- Zeer agressieve multiband (5-6 bands)
- Bass boost rond 60-80 Hz
- Limiter met <1ms attack

Stereo Tool komt hier dicht bij met bovenstaande settings!

---

## 📊 Testing Checklist:

- [ ] Luister naar verschillende genres
- [ ] Check vocal clarity (niet te veel compression!)
- [ ] Test bass op verschillende systemen
- [ ] Monitor voor clipping/distortion
- [ ] Vergelijk met echte 538 stream
- [ ] Adjust naar smaak

**TIP:** Radio 538 livestream: https://www.radio538.nl/ (voor referentie!)
