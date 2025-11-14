# 🎵 Playlist Generator - Quick Examples

**Copy-paste deze voorbeelden direct in GraphQL API Explorer!**

---

## 🎯 Example 1: 70% Techno, 30% House met Jingles

```graphql
mutation Generate70Techno30House {
  generatePlaylist(
    name: "SplashFM Peak Hour"
    description: "70% Techno, 30% House - Perfect radio hour"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":70},{\"genre\":\"House\",\"percentage\":30}]"
    bpmMin: 125
    bpmMax: 135
    includeJingles: true
    jinglesEveryN: 3
    jingleGenre: "Station ID"
    jingleTags: "SplashFM"
  ) {
    success
    playlist {
      id
      name
      trackCount
      totalDuration
    }
    tracksSelected
  }
}
```

**Result:**
- 42 minuten Techno
- 18 minuten House  
- Jingles every 3 tracks
- Total: ~60 minuten perfect!

---

## 🎯 Example 2: Triple Genre (60/30/10)

```graphql
mutation GenerateTripleGenre {
  generatePlaylist(
    name: "Dance Floor Journey"
    description: "Multi-genre progressive set"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":60},{\"genre\":\"House\",\"percentage\":30},{\"genre\":\"Trance\",\"percentage\":10}]"
    mood: "Energetic"
    bpmMin: 128
    bpmMax: 138
    includeJingles: true
    jinglesEveryN: 2
    jingleTags: "SplashFM,Peak Time"
  ) {
    success
    playlist {
      id
      name
      trackCount
      totalDuration
    }
  }
}
```

**Result:**
- 36 min Techno (60%)
- 18 min House (30%)
- 6 min Trance (10%)
- Professional interleaving!

---

## 🎯 Example 3: Pure Techno Hour zonder Jingles

```graphql
mutation PureTechnoHour {
  generatePlaylist(
    name: "Techno 60"
    description: "Pure techno - 1 hour set"
    genre: "Techno"
    bpmMin: 128
    bpmMax: 135
    mood: "Driving"
  ) {
    success
    playlist {
      id
      name
      trackCount
      totalDuration
      tracks
    }
  }
}
```

**Result:**
- 100% Techno
- 58-61 minutes exact
- Harmonic mixing if keys available
- Energy flow: build to peak

---

## 🎯 Example 4: Chill Mix met Veel Jingles

```graphql
mutation ChillWithJingles {
  generatePlaylist(
    name: "Late Night Chill"
    description: "Chill vibes with station IDs"
    genre: "Ambient"
    mood: "Chill"
    bpmMax: 110
    includeJingles: true
    jinglesEveryN: 2
    jingleGenre: "Station ID"
    jingleTags: "SplashFM,Chill"
  ) {
    success
    playlist {
      id
      trackCount
    }
  }
}
```

**Result:**
- Chill tracks only (BPM < 110)
- Jingle after every 2 tracks
- Perfect for late night slot

---

## 🎯 Example 5: Four-Genre Progressive (40/30/20/10)

```graphql
mutation FourGenreProgressive {
  generatePlaylist(
    name: "Progressive Journey"
    description: "Evolving 4-genre mix"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":40},{\"genre\":\"Progressive House\",\"percentage\":30},{\"genre\":\"Trance\",\"percentage\":20},{\"genre\":\"Melodic Techno\",\"percentage\":10}]"
    bpmMin: 128
    bpmMax: 140
    includeJingles: true
    jinglesEveryN: 4
  ) {
    success
    playlist {
      name
      trackCount
      totalDuration
    }
  }
}
```

**Result:**
- 24 min Techno
- 18 min Progressive House
- 12 min Trance
- 6 min Melodic Techno

---

## 🎯 Example 6: BPM Build (125 → 135)

```graphql
mutation BPMBuild {
  generatePlaylist(
    name: "BPM Builder"
    description: "Gradual tempo increase"
    genre: "Techno"
    bpmMin: 125
    bpmMax: 135
    mood: "Uplifting"
  ) {
    success
    playlist {
      name
      trackCount
    }
  }
}
```

**Result:**
- Starts: 125 BPM
- Gradually builds
- Ends: 135 BPM
- Smooth BPM transitions!

---

## 🎯 Example 7: Harmonic Mix (Key-Based)

```graphql
mutation HarmonicMix {
  generatePlaylist(
    name: "Harmonic Techno"
    description: "Perfect key transitions"
    genre: "Techno"
    keys: ["Am", "C", "G", "Em"]
    bpmMin: 128
    bpmMax: 132
  ) {
    success
    playlist {
      name
      trackCount
    }
  }
}
```

**Result:**
- Only compatible keys used
- Camelot Wheel matching
- Smooth harmonic transitions

---

## 🎯 Example 8: Quick Test (10 tracks)

```graphql
mutation QuickTest {
  generatePlaylist(
    name: "Test Playlist"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":80},{\"genre\":\"House\",\"percentage\":20}]"
    maxTracks: 10
    includeJingles: true
    jinglesEveryN: 3
  ) {
    success
    playlist {
      id
      trackCount
      totalDuration
    }
    tracksSelected
  }
}
```

**Result:**
- 8 music tracks (80% Techno, 20% House)
- 2-3 jingles
- ~30-35 minutes total

---

## 🎯 Example 9: Peak Time Party (80% Main, 20% Filler)

```graphql
mutation PeakTimeParty {
  generatePlaylist(
    name: "Peak Time Bangers"
    description: "80% peak time, 20% buildup"
    genreMix: "[{\"genre\":\"Techno (Peak Time / Driving)\",\"percentage\":80},{\"genre\":\"Progressive House\",\"percentage\":20}]"
    bpmMin: 130
    bpmMax: 138
    mood: "Energetic"
    includeJingles: true
    jinglesEveryN: 3
    jingleTags: "Peak Time,Energy"
  ) {
    success
    playlist {
      id
      name
      trackCount
      totalDuration
    }
  }
}
```

---

## 🎯 Example 10: All-In Pro Mix

```graphql
mutation ProMix {
  generatePlaylist(
    name: "Professional Radio Hour"
    description: "Multi-genre with perfect timing and jingles"
    genreMix: "[{\"genre\":\"Techno\",\"percentage\":50},{\"genre\":\"House\",\"percentage\":30},{\"genre\":\"Trance\",\"percentage\":15},{\"genre\":\"Melodic Techno\",\"percentage\":5}]"
    mood: "Driving"
    bpmMin: 128
    bpmMax: 136
    keys: ["Am", "C", "G", "Em", "Dm"]
    includeJingles: true
    jinglesEveryN: 3
    jingleGenre: "Station ID"
    jingleTags: "SplashFM,Peak Time,Professional"
  ) {
    success
    playlist {
      id
      name
      description
      trackCount
      totalDuration
      tracks
    }
    tracksMatched
    tracksSelected
  }
}
```

**Features:**
- ✅ 4 genres professionally mixed
- ✅ Harmonic mixing (compatible keys)
- ✅ BPM smoothing (±8 BPM range)
- ✅ Energy progression (driving)
- ✅ Jingles every 3 tracks
- ✅ Perfect 60 minute targeting

---

## 📋 Parameters Cheat Sheet

### **genreMix Format:**
```json
"[{\"genre\":\"NAME\",\"percentage\":XX},{...}]"
```

### **Common Genres:**
- `"Techno"`
- `"House"`
- `"Trance"`
- `"Progressive House"`
- `"Melodic Techno"`
- `"Deep House"`
- `"Tech House"`

### **Moods:**
- `"Energetic"` - High energy, driving
- `"Chill"` - Low energy, relaxed
- `"Dark"` - Moody, intense
- `"Uplifting"` - Positive, building
- `"Driving"` - Constant momentum

### **BPM Ranges:**
- Chill/Ambient: 80-110
- House: 120-128
- Techno: 125-135
- Hard Techno: 135-145
- Hardcore: 160+

### **Jingles:**
```
includeJingles: true
jinglesEveryN: 2      # Every 2 tracks
jingleGenre: "Station ID"
jingleTags: "SplashFM,Peak Time"
```

---

## 🎛️ Testing Checklist

- [ ] Test single genre (Example 3)
- [ ] Test multi-genre 2-way (Example 1)
- [ ] Test multi-genre 3-way (Example 2)
- [ ] Test with jingles (Example 4)
- [ ] Test without jingles (Example 3)
- [ ] Test BPM range (Example 6)
- [ ] Test mood (Example 2)
- [ ] Test keys/harmonic (Example 7)
- [ ] Test maxTracks limit (Example 8)

---

## 💡 Pro Tips

1. **Always check genre names exactly**
   - Use: `./genre-merger.sh stats` to see available genres

2. **Percentages must add to 100**
   - ✅ [70, 30] = 100%
   - ❌ [70, 40] = 110% (invalid!)

3. **BPM range should be narrow for smooth mix**
   - ✅ 125-135 (10 BPM range)
   - ❌ 120-150 (30 BPM range - too wide!)

4. **Jingles tags are case-insensitive OR matching**
   - `"SplashFM,Peak"` matches jingles with "splashfm" OR "peak"

5. **Test with maxTracks=10 first**
   - Faster testing before full 60-min generation

---

**🚀 Ready to use! Pick an example and try it!**
