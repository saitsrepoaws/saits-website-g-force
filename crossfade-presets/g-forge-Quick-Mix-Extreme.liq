#!/usr/bin/liquidsoap

# ╔═══════════════════════════════════════════════════════════════╗
# ║                                                               ║
# ║   G-FORGE CROSSFADE PRESET: QUICK-MIX-EXTREME                ║
# ║   SLAM Style - Maximum Energy & Impact                       ║
# ║                                                               ║
# ╚═══════════════════════════════════════════════════════════════╝

# FEATURES:
# • NO fade-in (instant start next track)
# • Minimal fade-out (0.2s)
# • Minimal overlap (0.2s)
# • Linear fade (instant slam)
# • Perfect for: Dance radio, club style, extreme energy

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ CONFIGURATION PARAMETERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Jingle detection threshold (seconds)
# Anything under 1 minute = instant cut (no crossfade)
# Includes: jingles, sweepers, IDs, gap killers
jingle_threshold = 60.0

# Crossfade settings - EXTREME
default_fade_in = 0.0    # NO FADE-IN!
default_fade_out = 0.2   # Minimal (0.2s) - SLAM!
default_duration = 0.2   # Minimal overlap

# Fade curve type - LINEAR for instant slam
fade_type = "lin"

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
# 🎛️ G-FORGE QUICK-MIX-EXTREME CROSSFADE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def advanced_crossfade(a, b)
  a_meta = a.metadata
  b_meta = b.metadata
  
  # RULE 1: JINGLE DETECTION
  if is_jingle(a_meta) or is_jingle(b_meta) then
    print("🎙️ Jingle detected - Instant cut")
    sequence([a.source, b.source])
    
  # RULE 2: EXTREME SLAM TRANSITION
  else
    print("💥 G-Forge EXTREME: 0.2s SLAM fadeout, NO fadein!")
    
    add(normalize=false, [
      fade.out(duration=0.2, type="lin", a.source),
      b.source  # NO FADE-IN!
    ])
  end
end

print("✅ G-Forge Quick-Mix-Extreme Crossfade Loaded!")
print("   Settings: 0.2s out / 0s in / linear / SLAM STYLE - Maximum energy!")
