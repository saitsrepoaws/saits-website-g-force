# Liquidsoap 2.0.2 Compatibility Matrix

**EC2 Version**: Liquidsoap 2.0.2  
**Date**: 10 November 2025

---

## ❌ NIET Ondersteund in 2.0.2

### Named Parameters
```liquidsoap
# ❌ WERKT NIET:
radio = crossfade(start_next=3.0, fade_in=2.0, fade_out=2.0, radio)
```

**Error**:
```
Error 6: Cannot apply that parameter because the function
has no argument labeled "start_next"!
```

### Autocue (Requires 2.2.5+)
```liquidsoap
# ❌ WERKT NIET in 2.0.2:
enable_autocue_metadata()
```

---

## ✅ WEL Ondersteund in 2.0.2

### 1. Simple Crossfade (Default)
```liquidsoap
# ✅ WERKT:
radio = crossfade(radio)
```

**Eigenschappen**:
- Gebruikt default transitie
- Geen configureerbare parameters
- Simple fade in/out
- Automatische overlap detection

### 2. Cross Operator met Custom Function
```liquidsoap
# ✅ WERKT:
radio = cross(transition_function, radio)
```

**Custom Transition Function**:
```liquidsoap
def transition(a, b) =
  # a = ending track metadata + source
  # b = starting track metadata + source
  
  # Apply fades
  a = fade.out(duration=3.0, type="sin", a)
  b = fade.in(duration=2.0, type="sin", b)
  
  # Mix
  add(normalize=false, [a, b])
end

radio = cross(duration=5.0, transition, radio)
```

### 3. Fade Functions
```liquidsoap
# ✅ WERKT:
fade.in(duration=2.0, type="sin", source)
fade.out(duration=3.0, type="sin", source)
```

**Parameters**:
- `duration` - Float (seconds)
- `type` - String: "sin", "exp", "log", "lin"
- `source` - Audio source

### 4. Add/Mix
```liquidsoap
# ✅ WERKT:
add(normalize=false, [source_a, source_b])
add(normalize=true, weights=[0.5, 0.5], [source_a, source_b])
```

### 5. Normalize
```liquidsoap
# ✅ WERKT:
radio = normalize(radio)
radio = normalize(target=-14.0, radio)
```

---

## 📊 UI Settings → Liquidsoap Mapping

### Wat We KUNNEN Gebruiken uit UI:

| UI Setting | Liquidsoap Equivalent | Status |
|------------|----------------------|--------|
| `crossfadeEnabled` | Enable/disable cross | ✅ Werkt |
| `crossfadeFadeIn` | `fade.in(duration=X)` | ✅ Werkt |
| `crossfadeFadeOut` | `fade.out(duration=X)` | ✅ Werkt |
| `crossfadeNormalize` | `normalize(radio)` | ✅ Werkt |
| `crossfadeStartNext` | N/A | ❌ Niet bruikbaar |

### Wat We NIET KUNNEN Gebruiken:

| UI Setting | Reden |
|------------|-------|
| `crossfadeStartNext` | Named parameter niet supported in 2.0.2 |
| `smartCrossfadeBpmTolerance` | Geen BPM detection in Liquidsoap 2.0.2 |
| `harmonicMixingEnabled` | Geen key detection in Liquidsoap 2.0.2 |
| `energyMatchingEnabled` | Geen energy analysis in Liquidsoap 2.0.2 |

**Note**: Smart features kunnen WEL in Lambda analysis, maar niet in realtime op Liquidsoap.

---

## 🎯 Implementatie Strategie

### Optie 1: Simple Crossfade (Makkelijk)
```liquidsoap
# Config from UI:
# crossfadeEnabled = true
# crossfadeNormalize = true

radio = playlist(...)
radio = fallback([radio, blank()])

if crossfade_enabled then
  radio = crossfade(radio)
end

if normalize_enabled then
  radio = normalize(radio)
end
```

**Voordelen**:
- ✅ Simpel
- ✅ Werkt gegarandeerd
- ✅ Geen errors

**Nadelen**:
- ❌ Geen controle over fade durations
- ❌ Geen custom presets

### Optie 2: Cross met Custom Function (Geavanceerd)
```liquidsoap
# Config from UI:
# crossfadeFadeIn = 2.0
# crossfadeFadeOut = 3.0
# crossfadeNormalize = true

def my_transition(a, b) =
  # Get fade durations from config
  fade_in_duration = {{ crossfadeFadeIn }}
  fade_out_duration = {{ crossfadeFadeOut }}
  
  # Apply fades
  a = fade.out(duration=fade_out_duration, type="sin", a)
  b = fade.in(duration=fade_in_duration, type="sin", b)
  
  # Mix
  add(normalize=false, [a, b])
end

radio = playlist(...)
radio = fallback([radio, blank()])

# Apply crossfade
radio = cross(duration=5.0, my_transition, radio)

# Normalize if enabled
if normalize_enabled then
  radio = normalize(radio)
end
```

**Voordelen**:
- ✅ Volledige controle over fade durations
- ✅ UI presets werken
- ✅ Professional quality

**Nadelen**:
- ⚠️ Complexer config
- ⚠️ Moet correct getest worden

### Optie 3: Hybrid (Aanbevolen)
```liquidsoap
# Use simple crossfade for now
radio = crossfade(radio)
radio = normalize(radio)

# Future: upgrade to 2.2.5+ for full control
```

**Voordelen**:
- ✅ Werkt nu
- ✅ Simpel
- ✅ Upgrade path ready

---

## 🔄 Generatie Flow

### Van UI naar EC2:

```
1. User wijzigt settings in UI
   ↓
2. Settings → DynamoDB
   ↓
3. Lambda (stream-playlist-updater):
   - Load settings
   - Generate compatible Liquidsoap config
   - Upload to S3: liquidsoap-crossfade.liq
   ↓
4. EC2:
   - Download config from S3 (via cron/script)
   - Include in main config
   - Reload Liquidsoap
   ↓
5. Icecast: New crossfade active!
```

---

## 📝 Config Template (Optie 2)

```liquidsoap
# Generated from UI settings
# Date: {{ timestamp }}
# Preset: {{ crossfadePreset }}

# Crossfade transition function
def crossfade_transition(a, b) =
  # Fade durations from UI
  fade_in = {{ crossfadeFadeIn }}
  fade_out = {{ crossfadeFadeOut }}
  
  # Apply fades with sine curve
  a = fade.out(duration=fade_out, type="sin", a)
  b = fade.in(duration=fade_in, type="sin", b)
  
  # Mix both sources
  add(normalize=false, [a, b])
end

# Apply crossfade to radio source
# Note: 'radio' variable must be defined before this
radio = cross(
  duration=5.0,
  crossfade_transition,
  radio
)

{{ if crossfadeNormalize }}
# Normalize audio levels
radio = normalize(target=-14.0, radio)
{{ endif }}
```

---

## ⚠️ Belangrijke Notes

### 1. Source Fallibility
```liquidsoap
# ❌ FOUT - crossfade op fallible source:
radio = playlist(...)
radio = crossfade(radio)  # Error: source is fallible

# ✅ CORRECT - eerst fallback:
radio = playlist(...)
radio = fallback([radio, blank()])
radio = crossfade(radio)  # OK - source is infallible
```

### 2. Order Matters
```liquidsoap
# Correcte volgorde:
radio = playlist(...)       # 1. Source
radio = fallback([...])     # 2. Make infallible
radio = crossfade(radio)    # 3. Apply crossfade
radio = normalize(radio)    # 4. Normalize
output.icecast(...)         # 5. Output
```

### 3. Reload zonder Onderbreking
```bash
# Graceful reload:
systemctl reload liquidsoap-radio

# Of:
liquidsoap --check /opt/radio/radio.liq && \
systemctl restart liquidsoap-radio
```

---

## 🚀 Aanbevolen Implementatie

**Nu (Snel & Simpel)**:
- Simple `crossfade(radio)`
- Normalize uit UI
- Werkt gegarandeerd

**Toekomst (Bij upgrade naar 2.2.5+)**:
- Enable autocue
- Named parameters
- Full UI control
- Smart features in Liquidsoap

---

## ✅ Conclusie

**Voor Liquidsoap 2.0.2**:

**Bruikbaar uit UI**:
- ✅ `crossfadeEnabled` (on/off)
- ✅ `crossfadeFadeIn` (via custom function)
- ✅ `crossfadeFadeOut` (via custom function)
- ✅ `crossfadeNormalize` (ja/nee)
- ✅ Presets (via fade durations)

**Niet Bruikbaar**:
- ❌ `crossfadeStartNext` (API limitation)
- ❌ Smart features (geen realtime detection in 2.0.2)

**Oplossing**:
1. Start met simple `crossfade()` - werkt direct
2. Later: custom function met fade durations
3. Toekomst: upgrade naar 2.2.5+ voor alles

**Smart features** blijven werken in Lambda voor playlist analysis!
