# Liquidsoap Crossfade Presets - Online Research

**Research Date:** 13 November 2025  
**Sources:** Liquidsoap Official Docs, Community Examples, Radio Platforms

---

## 📚 Official Liquidsoap Smart Crossfade

**Source:** https://liquidsoap.readthedocs.io/en/latest/content/crossfade.html

### Default Smart Crossfade Function

```liquidsoap
# Smart transition for crossfade
# @category Source / Track Processing
# @param ~log Default logger
# @param ~fade_in Fade-in duration, if any.
# @param ~fade_out Fade-out duration, if any.
# @param ~high Value, in dB, for loud sound level.
# @param ~medium Value, in dB, for medium sound level.
# @param ~margin Margin to detect sources that have too different sound level for crossing.
# @param ~default Smart crossfade: transition used when no rule applies (default: sequence).
# @param a Ending track
# @param b Starting track
def cross.smart(~log=log(label="cross.smart"), 
                ~fade_in=3.,
                ~fade_out=3., 
                ~default=(fun (a,b) -> (sequence([a, b]):source)), 
                ~high=-15., 
                ~medium=-32., 
                ~margin=4., 
                a, b)
  
  let fade.out = fade.out(type="sin",duration=fade_out)
  let fade.in = fade.in(type="sin",duration=fade_in)
  add = fun (a,b) -> add(normalize=false,[b, a])
  
  # This is for the type system..
  ignore(a.metadata["foo"])
  ignore(b.metadata["foo"])
  
  if
    # If A and B are not too loud and close, fully cross-fade them.
    a.db_level <= medium and 
    b.db_level <= medium and 
    abs(a.db_level - b.db_level) <= margin
  then
    log("Old <= medium, new <= medium and |old-new| <= margin.")
    log("Old and new source are not too loud and close.")
    log("Transition: crossed, fade-in, fade-out.")
    add(fade.out(a.source),fade.in(b.source))
    
  elsif
    # If B is significantly louder than A, only fade-out A.
    b.db_level >= a.db_level + margin and 
    a.db_level >= medium and 
    b.db_level <= high
  then
    log("new >= old + margin, old >= medium and new <= high.")
    log("New source is significantly louder than old one.")
    log("Transition: crossed, fade-out.")
    add(fade.out(a.source),b.source)
    
  elsif
    # Opposite as the previous one.
    a.db_level >= b.db_level + margin and 
    b.db_level >= medium and 
    a.db_level <= high
  then
    log("old >= new + margin, new >= medium and old <= high")
    log("Old source is significantly louder than new one.")
    log("Transition: crossed, fade-in.")
    add(a.source,fade.in(b.source))
    
  elsif
    # Do not fade if it's already very low.
    b.db_level >= a.db_level + margin and 
    a.db_level <= medium and 
    b.db_level <= high
  then
    log("new >= old + margin, old <= medium and new <= high.")
    log("Do not fade if it's already very low.")
    log("Transition: crossed, no fade.")
    add(a.source,b.source)
    
  # What to do with a loud end and a quiet beginning?
  # A good idea is to use a jingle to separate the two tracks.
  else
    log("No transition: using default.")
    default(a.source, b.source)
  end
end
```

### Key Parameters Explained

- **fade_in**: Duration of fade-in (default: 3.0s)
- **fade_out**: Duration of fade-out (default: 3.0s)
- **high**: dB level for loud sounds (default: -15 dB)
- **medium**: dB level for medium sounds (default: -32 dB)
- **margin**: dB margin for level difference (default: 4 dB)

---

## 🎛️ Industry Standard Presets

### 1. NewRadio.it Standard Configuration
**Source:** https://www.newradio.it (Professional Italian radio hosting)

```
Server: LiquidSoap Easy Radio V.3
Crossfade Settings:
  - Duration: 3/2 (3 seconds overlap, 2 seconds mix)
  - Fade IN: 0 seconds (instant start)
  - Fade OUT: 1.5 seconds
  - Replay Gain: Enabled (volume normalization)
```

**Use Case:** General radio station with music rotation  
**Good For:** Pop, Dance, mainstream formats

---

## 🎵 Common Presets By Music Genre

### Smooth/Progressive (Default)
```liquidsoap
radio = crossfade(duration=5.0, fade_in=3.0, fade_out=3.0, radio)
```
- **Duration:** 5 seconds
- **Fade In:** 3 seconds
- **Fade Out:** 3 seconds
- **Best For:** Ambient, Chill, Downtempo, Progressive House

### Energetic/Techno
```liquidsoap
radio = crossfade(duration=4.0, fade_in=2.0, fade_out=2.0, radio)
```
- **Duration:** 4 seconds
- **Fade In:** 2 seconds
- **Fade Out:** 2 seconds
- **Best For:** Techno, House, Trance

### Quick/Radio-Style
```liquidsoap
radio = crossfade(duration=3.0, fade_in=1.5, fade_out=1.5, radio)
```
- **Duration:** 3 seconds
- **Fade In:** 1.5 seconds
- **Fade Out:** 1.5 seconds
- **Best For:** CHR (Contemporary Hit Radio), Pop stations

### Hard Cut/Hardcore
```liquidsoap
radio = crossfade(duration=2.0, fade_in=1.0, fade_out=1.0, radio)
```
- **Duration:** 2 seconds
- **Fade In:** 1 second
- **Fade Out:** 1 second
- **Best For:** Hardcore, Gabber, Hard Rock

### Ultra Fast (Our Current DJ Blend)
```liquidsoap
radio = crossfade(duration=5.0, fade_in=1.0, fade_out=0.5, radio)
```
- **Duration:** 5 seconds (start next timing)
- **Fade In:** 1.0 seconds
- **Fade Out:** 0.5 seconds
- **Best For:** Dance, House, Techno with tight transitions

### No Fade (Instant Cut)
```liquidsoap
radio = crossfade(duration=0.5, fade_in=0.0, fade_out=0.5, radio)
```
- **Duration:** 0.5 seconds
- **Fade In:** 0 seconds (instant)
- **Fade Out:** 0.5 seconds (quick exit)
- **Best For:** News, Jingles, Station IDs

---

## 🎯 Per-Track Crossfade Control

**Source:** https://github.com/mcfiredrill/mcfiredrill.github.io

You can control crossfade per track using metadata:

### Metadata Variables
```liquidsoap
liq_fade_in    # Fade-in duration for this track
liq_fade_out   # Fade-out duration for this track
liq_cue_in     # Start playback at X seconds
liq_cue_out    # Stop playback at X seconds
```

### Example: Annotate Protocol
```liquidsoap
# Static example
request.create("annotate:liq_fade_in=\"0.5\",liq_fade_out=\"0.5\",liq_cue_in=\"30\",liq_cue_out=\"50\":/path/to/track.mp3")

# Dynamic from database/API
result = list.hd(get_process_lines("ruby ./next_song.rb"))
json = of_json(default=[("error","fail")], result)
fade_in = int_of_string(json["fade_in"])
fade_out = int_of_string(json["fade_out"])
cue_in = int_of_string(json["cue_in"])
cue_out = int_of_string(json["cue_out"])
track = json["track"]

annotate_line = "annotate:liq_fade_in=#{fade_in},liq_fade_out=#{fade_out},liq_cue_in=#{cue_in},liq_cue_out=#{cue_out}:#{track}"
request.create(annotate_line)
```

### Required Operators
```liquidsoap
source = cue_cut(source)      # Apply cue points
source = crossfade(source)    # Apply crossfades
```

---

## 📊 Comparison Table

| Preset | Duration | Fade In | Fade Out | Use Case | Energy |
|--------|----------|---------|----------|----------|--------|
| **Ambient** | 8s | 6s | 6s | Chill, Lounge | Very Low |
| **Progressive** | 5s | 4s | 4s | Progressive House | Low |
| **Smooth** | 5s | 3s | 3s | General music | Medium |
| **Standard Radio** | 3s | 1.5s | 1.5s | CHR, Pop | Medium-High |
| **Techno** | 4s | 2s | 2s | Techno, Trance | High |
| **DJ Blend** | 5s | 1s | 0.5s | Dance, House | Very High |
| **Hardcore** | 2s | 1s | 1s | Hardcore, Metal | Very High |
| **Cut/Hit** | 0.5s | 0s | 0.5s | News, Jingles | Instant |

---

## 🎨 Advanced Crossfade Techniques

### 1. Smart Volume-Based Crossfade
Uses dB levels to determine transition type automatically.

```liquidsoap
# Loud tracks (> -15dB): No crossfade
# Medium tracks (-32dB to -15dB): Full crossfade
# Quiet tracks (< -32dB): No fade-in on quiet track

radio = cross.smart(
  fade_in=3.0,
  fade_out=3.0,
  high=-15.0,
  medium=-32.0,
  margin=4.0,
  radio
)
```

### 2. BPM-Matched Crossfade
Calculate crossfade duration based on BPM:

```liquidsoap
# Example: Fade over 8 beats
bpm = 128
beats = 8
fade_duration = (60.0 / bpm) * beats  # = 3.75 seconds

radio = crossfade(duration=5.0, fade_in=fade_duration, fade_out=fade_duration, radio)
```

### 3. Genre-Specific Transitions
Different crossfades for different genres:

```liquidsoap
def genre_crossfade(metadata, ~fade_in, ~fade_out, source)
  genre = metadata["genre"]
  
  if genre == "Techno" then
    crossfade(fade_in=2.0, fade_out=2.0, source)
  elsif genre == "Ambient" then
    crossfade(fade_in=6.0, fade_out=6.0, source)
  else
    crossfade(fade_in=3.0, fade_out=3.0, source)
  end
end
```

### 4. Jingle Handling
No crossfade for short tracks (jingles, station IDs):

```liquidsoap
# Smart crossfade with threshold
# Tracks shorter than 30 seconds won't crossfade
def smart_jingle_crossfade(~threshold=30., ~fade_in=3., ~fade_out=3., s)
  cross(s, fun(a,b) ->
    if a.metadata["duration"] < threshold or b.metadata["duration"] < threshold then
      # No crossfade for short tracks
      sequence([a.source, b.source])
    else
      # Normal crossfade for long tracks
      add(normalize=false, [
        fade.out(duration=fade_out, type="sin", a.source),
        fade.in(duration=fade_in, type="sin", b.source)
      ])
    end
  )
end
```

---

## ⚙️ Configuration Best Practices

### 1. Start Next Timing
- **Conservative:** `start_next = duration + 2s` (buffer time)
- **Tight:** `start_next = duration` (precise timing)
- **Our Setup:** `start_next = 4s` with `fade_out = 0.5s`, `fade_in = 1.0s`

### 2. Fade Types
```liquidsoap
fade.in(type="sin")    # Smooth sine curve (default)
fade.in(type="lin")    # Linear fade (faster perceived start)
fade.in(type="log")    # Logarithmic (natural volume perception)
fade.in(type="exp")    # Exponential (quick start, slow finish)
```

### 3. Normalization
```liquidsoap
# Volume normalization (recommended for radio)
radio = normalize(radio)

# Or in crossfade
add(normalize=true, [fade.out(a), fade.in(b)])
```

---

## 🔧 Troubleshooting Common Issues

### Problem: Gaps Between Tracks
**Solution:** Reduce `fade_out` and `fade_in` to create overlap
```liquidsoap
radio = crossfade(duration=5.0, fade_in=2.0, fade_out=2.0, radio)
```

### Problem: Tracks Bleed Too Much
**Solution:** Increase `fade_out` to end tracks cleaner
```liquidsoap
radio = crossfade(duration=5.0, fade_in=1.0, fade_out=3.0, radio)
```

### Problem: Volume Inconsistency
**Solution:** Enable normalization
```liquidsoap
radio = normalize(target=-14.0, threshold=-40.0, radio)
```

### Problem: Jingles Get Crossfaded
**Solution:** Use threshold-based smart crossfade (see above)

---

## 📚 Additional Resources

### Official Documentation
- **Liquidsoap Crossfade Docs:** https://liquidsoap.readthedocs.io/en/latest/content/crossfade.html
- **Metadata Protocol:** http://savonet.sourceforge.net/doc-svn/metadata.html
- **Liquidsoap Book:** http://www.liquidsoap.info/book/book.pdf

### Community Examples
- **GitHub Issues:** https://github.com/savonet/liquidsoap/issues?q=crossfade
- **Discussions:** https://github.com/savonet/liquidsoap/discussions
- **Radio Setups:** Search "liquidsoap radio configuration" on GitHub

### Commercial Platforms Using Liquidsoap
- **NewRadio.it** - Professional radio hosting (Italy)
- **AzuraCast** - Open source radio automation
- **Airtime** - Radio station management
- **Centova Cast** - Streaming control panel

---

## 💡 Our Current Setup (G-Forge IoT)

### Active Configuration
```liquidsoap
# DJ Blend preset
radio = crossfade(duration=5.0, fade_in=1.0, fade_out=0.5, radio)
```

### Why This Works
- **Start Next (4s):** Track starts loading 4 seconds before end
- **Fade Out (0.5s):** Ultra-fast exit, no bleeding
- **Fade In (1.0s):** Quick but smooth entry
- **Total Overlap:** ~1.5 seconds (very tight)
- **Effect:** High-energy, professional DJ-style transitions

### Future Improvements
1. **Smart Crossfade:** Implement volume-based transitions
2. **BPM Matching:** Calculate fade based on musical bars
3. **Per-Track Control:** Use metadata for custom fades
4. **Genre Detection:** Different presets per genre
5. **Jingle Handling:** No crossfade for short tracks

---

**Last Updated:** 13 November 2025  
**Research Sources:** Liquidsoap Docs, NewRadio.it, GitHub Community
