#!/usr/bin/liquidsoap

# ╔═══════════════════════════════════════════════════════════════╗
# ║                                                               ║
# ║   G-FORGE CROSSFADE PRESET: QUICK-MIX                        ║
# ║   Commercial Hit Radio - Professional & Tight                ║
# ║                                                               ║
# ╚═══════════════════════════════════════════════════════════════╝

# FEATURES:
# • NO fade-in (instant start next track)
# • Quick fade-out (1.0s)
# • Short overlap (1.0s)
# • Exponential fade (natural decay)
# • Perfect for: Commercial hit radio, broad audience

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ CONFIGURATION PARAMETERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Jingle detection threshold (seconds)
jingle_threshold = 30.0

# Crossfade settings - QUICK-MIX
default_fade_in = 0.0    # NO FADE-IN!
default_fade_out = 1.0   # Quick but smooth (1.0s)
default_duration = 1.0   # Short overlap

# Fade curve type - EXPONENTIAL for natural decay
fade_type = "exp"

# Volume detection (dB levels)
high_db = -15.0
medium_db = -32.0
margin_db = 4.0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎙️ JINGLE DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def is_jingle(metadata)
  duration_str = metadata["duration"]
  
  if duration_str != "" then
    duration = float_of_string(default=0.0, duration_str)
    duration < jingle_threshold
  else
    genre = metadata["genre"]
    genre == "Station ID" or genre == "Jingle"
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ G-FORGE QUICK-MIX CROSSFADE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def advanced_crossfade(a, b)
  a_meta = a.metadata
  b_meta = b.metadata
  
  # RULE 1: JINGLE DETECTION
  if is_jingle(a_meta) or is_jingle(b_meta) then
    print("🎙️ Jingle detected - Instant cut")
    sequence([a.source, b.source])
    
  # RULE 2: QUICK-MIX TRANSITION
  else
    print("🎵 G-Forge Quick-Mix: 1.0s fadeout, NO fadein")
    
    add(normalize=false, [
      fade.out(duration=1.0, type="exp", a.source),
      b.source  # NO FADE-IN!
    ])
  end
end

print("✅ G-Forge Quick-Mix Crossfade Loaded!")
print("   Settings: 1.0s out / 0s in / exponential / Commercial radio style")
