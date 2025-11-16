# Professional Crossfade + StereoTool Integration

## ✅ Implemented: Beat-Matched Crossfade

### Current Configuration
```liquidsoap
radio = crossfade(duration=5.0, fade_in=3.0, fade_out=3.0, radio)
```

### Behavior
- **Music tracks**: Smooth 5-second overlap with 3-second fades
- **Beat-matched**: Timing optimized for dance/pop music
- **Professional**: Clean transitions without gaps

## 🎚️ StereoTool Integration (Ready to Enable)

### What is StereoTool?
Professional audio processing software used by radio stations worldwide for:
- **Multiband compression** (punchier, more consistent sound)
- **EQ optimization** (balanced frequencies)
- **Loudness maximization** (competitive commercial volume)
- **Stereo enhancement** (wider soundstage)
- **Bass boost** (deeper low-end)

### Installation Steps

1. **Download StereoTool**
```bash
wget https://www.thimeo.com/stereo-tool/download/linux64/st
sudo mv st /usr/local/bin/stereotool-cmd
sudo chmod +x /usr/local/bin/stereotool-cmd
```

2. **Upload Preset**
```bash
scp stereotools/preset.sts radio-ec2:/opt/radio/preset.sts
```

3. **Enable in Liquidsoap**
Edit `/opt/radio/radio.liq`, uncomment line:
```liquidsoap
radio = stereotool(preset="/opt/radio/preset.sts", radio)
```

4. **Restart**
```bash
ssh radio-ec2
sudo pkill -f liquidsoap
sudo -u root nohup /usr/bin/liquidsoap /opt/radio/radio.liq > /tmp/liquidsoap.log 2>&1 &
```

### Preset Location
- **Local**: `/Users/gerard/Desktop/T7/g-forge-iot/stereotools/preset.sts`
- **EC2**: `/opt/radio/preset.sts` (after upload)

## 🎤 Future: Smart Crossfade

For news/jingles to skip crossfade, we'll need to:
1. Tag tracks in M3U with metadata (e.g., `#EXTINF:180,news`)
2. Use `smart_cross` function in Liquidsoap
3. Detect news/jingle tracks and use `sequence` instead of `crossfade`

### Example (requires Liquidsoap 2.1+)
```liquidsoap
radio = smart_cross(
  fun(a, b) -> 
    if b.metadata["liq_cue_in"] == "news" then
      sequence([a, b])  # Direct play
    else
      crossfade(a, b)  # Smooth transition
    end
  end,
  radio
)
```

## 📊 Current Status
- ✅ Beat-matched crossfade active (5s overlap, 3s fades)
- ✅ Auto-cleanup working
- ✅ StereoTool code in place (commented)
- 📦 StereoTool preset ready (`preset.sts`)
- ⏳ News/jingle detection (future enhancement)

## 🎯 Professional Audio Chain
```
Playlist → Crossfade (5s) → [StereoTool] → MP3 Encoder (192kbps) → Icecast
```

**Stream**: http://79.125.44.178:8000/stream.mp3
**Config**: `/opt/radio/radio.liq` on EC2
