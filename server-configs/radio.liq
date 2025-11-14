#!/usr/bin/liquidsoap

set("init.allow_root",true)
log.level.set(4)

# AUTO-CLEANUP function
def cleanup_track(m) =
  filename = m["filename"]
  if filename != "" and string.contains(substring="/var/radio/tracks/", filename) then
    if not string.contains(substring="news-latest.mp3", filename) then
      print("🧹 Deleting: #{filename}")
      ignore(process.run("rm -f #{process.quote(filename)}"))
    end
  end
end

# File-based playlist
radio = playlist(
  mode="normal",
  reload_mode="watch",
  reload=3600,
  "/var/radio/playlists/current.m3u"
)

# PROFESSIONAL CROSSFADE WITH SMART FADE-OUT
# For jingles/news: NO crossfade, smart fade-out
# For music: Beat-matched crossfade
# Load advanced crossfade
%include "/opt/radio/advanced-crossfade.liq"

# Apply cue cutting (for liq_cue_in/liq_cue_out support)
radio = cue_cut(radio)

# Apply advanced BPM-synced crossfade
radio = cross(duration=5.0, advanced_crossfade, radio)
# COVER ART METADATA
%include "/opt/radio/cover-support.liq"

# STEREOTOOL PROCESSING - Professional Audio Enhancement
# 
# Features when enabled:
# • Multiband compression (punchier sound)
# • EQ optimization (balanced frequencies)  
# • Loudness maximization (competitive volume)
# • Stereo enhancement (wider soundstage)
# • Bass boost (deeper low-end)
#
# Install: wget https://www.thimeo.com/stereo-tool/download/linux64/st
#          sudo mv st /usr/local/bin/stereotool-cmd
#          sudo chmod +x /usr/local/bin/stereotool-cmd
#
# Upload preset: scp stereotools/preset.sts radio-ec2:/opt/radio/preset.sts
#
# Then uncomment:
# radio = stereotool(preset="/opt/radio/preset.sts", radio)

radio = mksafe(radio)

# Cleanup callback  
source.on_track(radio, cleanup_track)

output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="Splash FM",
  description="Professional - Beat-Matched + WildFM Jingels",
  genre="Dance/Pop",
  url="http://46.137.184.91",
  radio
)

print("🎚️ Splash FM - Professional Audio + WildFM Jingels!")

# OUTPUT 1: RAW STREAM (for Stereo Tool input)
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream-raw.mp3",
  name="Splash FM - Raw",
  description="Unprocessed stream (for Stereo Tool input)",
  genre="Dance/Pop",
  url="http://46.137.184.91",
  radio
)

print("🎚️ Splash FM - Dual Output Active (Main + Raw for Stereo Tool)")
