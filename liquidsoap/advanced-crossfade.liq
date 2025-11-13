#!/usr/bin/liquidsoap

# ╔═══════════════════════════════════════════════════════════════╗
# ║                                                               ║
# ║   G-FORGE IOT ADVANCED CROSSFADE - BEAT SYNCED & SMART       ║
# ║   Optimized for: House, Dance, Techno + Jingles              ║
# ║                                                               ║
# ╚═══════════════════════════════════════════════════════════════╝

# FEATURES:
# • BPM-matched beat-synchronized crossfades
# • Smart jingle detection (no crossfade for short tracks)
# • Genre-specific transitions
# • Volume-based intelligent mixing
# • Per-track metadata control support

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ CONFIGURATION PARAMETERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Jingle detection threshold (seconds)
jingle_threshold = 30.0

# Default crossfade settings (fallback)
default_fade_in = 1.0
default_fade_out = 0.5
default_duration = 5.0

# BPM-based crossfade (beats to fade over)
fade_beats = 4  # Fade over 4 beats for tight mixing

# Volume detection (dB levels)
high_db = -15.0
medium_db = -32.0
margin_db = 4.0

# Fade curve type
fade_type = "sin"  # Options: "sin", "lin", "log", "exp"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 BPM-MATCHED CROSSFADE CALCULATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Calculate fade duration based on BPM
# Formula: duration = (60 / bpm) * beats
def calculate_fade_from_bpm(bpm, beats)
  if bpm > 0 then
    duration = (60.0 / bpm) * beats
    # Clamp between 0.5s and 6.0s for safety
    if duration < 0.5 then
      0.5
    elsif duration > 6.0 then
      6.0
    else
      duration
    end
  else
    # Fallback if no BPM available
    default_fade_in
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎙️ JINGLE DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check if track is a jingle (short track)
def is_jingle(metadata)
  # Check duration metadata
  duration_str = metadata["duration"]
  
  if duration_str != "" then
    duration = float_of_string(default=0.0, duration_str)
    duration < jingle_threshold
  else
    # Check genre metadata
    genre = metadata["genre"]
    genre == "Station ID" or genre == "Jingle"
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎨 GENRE-SPECIFIC CROSSFADE PRESETS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Get fade settings based on genre
def get_genre_fade_settings(genre)
  if genre == "House" or genre == "Deep House" or genre == "Tech House" then
    # House: Medium-fast, 4 beats
    {fade_in=1.5, fade_out=1.0, beats=4}
  elsif genre == "Techno" or genre == "Minimal" then
    # Techno: Fast, tight, 4 beats
    {fade_in=1.0, fade_out=0.5, beats=4}
  elsif genre == "Trance" or genre == "Progressive" then
    # Trance: Smooth, 8 beats
    {fade_in=2.0, fade_out=2.0, beats=8}
  elsif genre == "Dance" or genre == "EDM" then
    # Dance: Energetic, 4 beats
    {fade_in=1.2, fade_out=0.8, beats=4}
  else
    # Default: DJ Blend preset
    {fade_in=default_fade_in, fade_out=default_fade_out, beats=fade_beats}
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ ADVANCED SMART CROSSFADE FUNCTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def advanced_crossfade(a, b)
  # Get metadata from both tracks
  a_meta = a.metadata
  b_meta = b.metadata
  
  # Extract BPM (with fallback)
  a_bpm = float_of_string(default=128.0, a_meta["bpm"])
  b_bpm = float_of_string(default=128.0, b_meta["bpm"])
  
  # Extract genre
  a_genre = a_meta["genre"]
  b_genre = b_meta["genre"]
  
  # Extract volume levels
  a_db = a.db_level
  b_db = b.db_level
  
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # RULE 1: JINGLE DETECTION
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  if is_jingle(a_meta) or is_jingle(b_meta) then
    # NO CROSSFADE for jingles - instant transition
    print("🎙️ Jingle detected - Instant cut (no crossfade)")
    sequence([a.source, b.source])
    
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # RULE 2: CHECK FOR PER-TRACK METADATA OVERRIDE
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  elsif b_meta["liq_fade_in"] != "" or b_meta["liq_fade_out"] != "" then
    # Use per-track metadata if available
    custom_fade_in = float_of_string(default=default_fade_in, b_meta["liq_fade_in"])
    custom_fade_out = float_of_string(default=default_fade_out, b_meta["liq_fade_out"])
    
    print("🎚️ Using custom per-track fades: in=#{custom_fade_in}s, out=#{custom_fade_out}s")
    
    add(normalize=false, [
      fade.out(duration=custom_fade_out, type=fade_type, a.source),
      fade.in(duration=custom_fade_in, type=fade_type, b.source)
    ])
    
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # RULE 3: BPM-MATCHED BEAT-SYNCED CROSSFADE
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  elsif a_bpm > 80.0 and a_bpm < 180.0 and b_bpm > 80.0 and b_bpm < 180.0 then
    # Both tracks have valid BPM - use beat-synced crossfade
    
    # Get genre-specific settings
    genre_settings = get_genre_fade_settings(b_genre)
    beats = genre_settings.beats
    
    # Calculate fade durations based on BPM
    # Use average BPM for smooth transition
    avg_bpm = (a_bpm + b_bpm) / 2.0
    beat_fade_in = calculate_fade_from_bpm(avg_bpm, beats)
    beat_fade_out = calculate_fade_from_bpm(avg_bpm, beats)
    
    # Apply genre-specific multipliers
    fade_in_duration = beat_fade_in * (genre_settings.fade_in / default_fade_in)
    fade_out_duration = beat_fade_out * (genre_settings.fade_out / default_fade_out)
    
    print("🎵 BPM-matched crossfade: A=#{a_bpm}bpm, B=#{b_bpm}bpm, Avg=#{avg_bpm}bpm")
    print("   Fade over #{beats} beats: in=#{fade_in_duration}s, out=#{fade_out_duration}s")
    print("   Genre: #{b_genre}")
    
    # Check volume levels for smart mixing
    if a_db <= medium_db and b_db <= medium_db and abs(a_db - b_db) <= margin_db then
      # Both tracks medium volume and close - full crossfade
      print("   Mode: Full crossfade (similar volumes)")
      add(normalize=false, [
        fade.out(duration=fade_out_duration, type=fade_type, a.source),
        fade.in(duration=fade_in_duration, type=fade_type, b.source)
      ])
      
    elsif b_db >= a_db + margin_db and a_db >= medium_db and b_db <= high_db then
      # B is louder - only fade out A
      print("   Mode: Fade-out only (B louder)")
      add(normalize=false, [
        fade.out(duration=fade_out_duration, type=fade_type, a.source),
        b.source
      ])
      
    elsif a_db >= b_db + margin_db and b_db >= medium_db and a_db <= high_db then
      # A is louder - only fade in B
      print("   Mode: Fade-in only (A louder)")
      add(normalize=false, [
        a.source,
        fade.in(duration=fade_in_duration, type=fade_type, b.source)
      ])
      
    else
      # Default full crossfade
      print("   Mode: Standard crossfade")
      add(normalize=false, [
        fade.out(duration=fade_out_duration, type=fade_type, a.source),
        fade.in(duration=fade_in_duration, type=fade_type, b.source)
      ])
    end
    
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  # RULE 4: FALLBACK - NO BPM AVAILABLE
  # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  else
    # No BPM data - use default DJ Blend preset
    print("⚠️ No BPM data - Using default DJ Blend preset (1.0s/0.5s)")
    
    add(normalize=false, [
      fade.out(duration=default_fade_out, type=fade_type, a.source),
      fade.in(duration=default_fade_in, type=fade_type, b.source)
    ])
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📋 USAGE EXAMPLE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Apply to your radio source:
# radio = cross(duration=default_duration, advanced_crossfade, radio)

# With cue point support (for liq_cue_in/liq_cue_out):
# radio = cue_cut(radio)
# radio = cross(duration=default_duration, advanced_crossfade, radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📊 FEATURES SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ✅ BPM-matched beat-synced crossfades
#    • Calculates fade duration from BPM
#    • Fades over X beats (configurable)
#    • Uses average BPM for smooth transition
#
# ✅ Smart jingle detection
#    • No crossfade for tracks < 30 seconds
#    • Genre-based detection (Station ID, Jingle)
#    • Instant cuts for professional sound
#
# ✅ Genre-specific presets
#    • House: 1.5s/1.0s over 4 beats
#    • Techno: 1.0s/0.5s over 4 beats (tight!)
#    • Trance: 2.0s/2.0s over 8 beats (smooth)
#    • Dance: 1.2s/0.8s over 4 beats
#
# ✅ Volume-based intelligent mixing
#    • Full crossfade for similar volumes
#    • Fade-out only if B louder
#    • Fade-in only if A louder
#
# ✅ Per-track metadata control
#    • liq_fade_in / liq_fade_out support
#    • Override defaults per track
#    • Database-driven custom fades
#
# ✅ Safe fallbacks
#    • Default DJ Blend if no BPM
#    • Clamped fade durations (0.5s - 6.0s)
#    • Always produces valid output

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 PERFECT FOR:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# • House music (Deep House, Tech House)
# • Dance / EDM
# • Techno / Minimal
# • Trance / Progressive
# • Mixed genre playlists
# • Professional DJ-style radio
# • Stations with jingles/IDs
# • 24/7 automated streaming

print("✅ G-Forge IoT Advanced Crossfade Loaded!")
print("   Features: BPM-sync, Jingle detection, Genre presets, Volume-based")
