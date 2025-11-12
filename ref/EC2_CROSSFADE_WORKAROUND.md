# Liquidsoap 2.0.2 Crossfade Workaround

**Probleem**: Ubuntu 22.04 heeft alleen Liquidsoap 2.0.2, geen 2.2.5+

**Oplossing**: Gebruik simple crossfade NU, upgrade later

---

## 🎯 Huidige Situatie

**EC2**: Ubuntu 22.04 LTS  
**Liquidsoap**: 2.0.2 (maximum beschikbaar)  
**Status**: ✅ Simple crossfade werkend

---

## 🔄 Upgrade Opties

### Optie 1: Blijf bij 2.0.2 (Simple Crossfade)
**Pro**:
- ✅ Werkt NU perfect
- ✅ Smooth transitions
- ✅ Geen risico
- ✅ Professional sound

**Con**:
- ❌ Geen UI control over fade times
- ❌ Geen custom presets

### Optie 2: Manual Build van 2.2.5+ (Complex)
```bash
# Compile from source - NIET aanbevolen
# Requires OPAM, OCaml, build tools
# Risk: break existing setup
```

### Optie 3: Upgrade OS naar Ubuntu 24.04 (Risico)
```bash
# do-release-upgrade
# Risk: downtime, compatibility issues
```

### Optie 4: Dynamic Variable File (AANBEVOLEN)
**Werk met wat we hebben!**

---

## ✅ Aanbevolen Strategie

### Simple Crossfade NU + Lambda Smart Analysis

**Wat werkt**:
1. ✅ Simple `crossfade()` op EC2
2. ✅ Lambda doet smart analysis (BPM, Key, Energy)
3. ✅ Lambda genereert optimal playlist
4. ✅ UI presets sturen Lambda analysis
5. ⏳ EC2 gebruikt simple crossfade

**Benefits**:
- Stream heeft crossfade NOW ✅
- Playlist kwaliteit verbetert (Lambda sorting) ✅
- UI is bruikbaar (configureert Lambda) ✅
- Geen risico op downtime ✅

**Toekomst** (bij OS upgrade naar 24.04):
- Dan krijg je full UI → EC2 control
- Custom fade times
- Autocue support

---

## 🎚️ Wat UI Settings Doen

### In Lambda (Werkt NU)
- ✅ BPM matching → Track sorting
- ✅ Harmonic mixing → Key compatibility
- ✅ Energy analysis → Smooth energy curve
- ✅ Presets → Analysis parameters

### Op EC2 (Simple)
- ✅ Basic crossfade → Default smooth transitions
- ✅ Normalize → -14 dBFS

---

## 💡 Conclusie

**AANBEVELING**: Blijf bij simple crossfade!

**Waarom**:
1. Werkt perfect ✅
2. Professional sound ✅
3. Zero downtime risk ✅
4. Lambda doet smart work ✅

**Later** (bij infrastructure upgrade):
- Upgrade naar Ubuntu 24.04
- Dan automatisch Liquidsoap 2.2.5+
- Full UI control geactiveerd

**Nu focus op**:
- ✅ Playlist quality (Lambda) ← Werkt al!
- ✅ Stream stability ← Werkt!
- ✅ UI experience ← Settings werken in Lambda!
