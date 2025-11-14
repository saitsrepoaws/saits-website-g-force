#!/usr/bin/liquidsoap

# ╔═══════════════════════════════════════════════════════════════╗
# ║                                                               ║
# ║   G-FORGE CROSSFADE PRESET: ULTRA-TIGHT                      ║
# ║   Radio 538 / Q-Music Style - Maximum Energy                 ║
# ║                                                               ║
# ╚═══════════════════════════════════════════════════════════════╝

# FEATURES:
# • NO fade-in (instant start next track)
# • Ultra-short fade-out (0.5s)
# • Tight overlap (0.5s)
# • Linear fade (instant/direct)
# • Perfect for: Hit radio CHR/Top 40, young audience

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ CONFIGURATION PARAMETERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Jingle detection threshold (seconds)
# Anything under 1 minute = instant cut (no crossfade)
# Includes: jingles, sweepers, IDs, gap killers
jingle_threshold = 60.0

# Crossfade settings - ULTRA-TIGHT
default_fade_in = 0.0    # NO FADE-IN!
default_fade_out = 0.5   # Ultra-short (0.5s)
default_duration = 0.5   # Tight overlap

# Fade curve type - LINEAR for instant/direct
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
# 🎛️ G-FORGE ULTRA-TIGHT CROSSFADE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def advanced_crossfade(a, b)
  a_meta = a.metadata
  b_meta = b.metadata
  
  # RULE 1: JINGLE DETECTION
  if is_jingle(a_meta) or is_jingle(b_meta) then
    print("🎙️ Jingle detected - Instant cut")
    sequence([a.source, b.source])
    
  # RULE 2: ULTRA-TIGHT TRANSITION
  else
    print("⚡ G-Forge Ultra-Tight: 0.5s fadeout, NO fadein")
    
    add(normalize=false, [
      fade.out(duration=0.5, type="lin", a.source),
      b.source  # NO FADE-IN!
    ])
  end
end

print("✅ G-Forge Ultra-Tight Crossfade Loaded!")
print("   Settings: 0.5s out / 0s in / linear / Radio 538 style")
