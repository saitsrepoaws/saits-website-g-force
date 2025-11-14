#!/usr/bin/liquidsoap

set("init.allow_root",true)
log.level.set(4)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 SIMPLE TRACK EVENT LOGGING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

track_log = "/var/log/liquidsoap-tracks.log"

# Simple log function - just use system date command
def log_track_event(event_type, m) =
  filename = m["filename"]
  artist = m["artist"]
  title = m["title"]
  
  # Get track display name
  track_display = if artist != "" and title != "" then
    "#{artist} - #{title}"
  elsif filename != "" then
    # Get basename
    parts = string.split(separator="/", filename)
    list.nth(default="Unknown", parts, list.length(parts) - 1)
  else
    "Unknown Track"
  end
  
  # Get trackId from filename
  trackId = if filename != "" then
    parts = string.split(separator="/", filename)
    basename = list.nth(default="unknown", parts, list.length(parts) - 1)
    string.replace(pattern="\\.mp3$", fun(_) -> "", 
      string.replace(pattern="\\.wav$", fun(_) -> "", basename))
  else
    "unknown"
  end
  
  # Use system date command for timestamp (simple & reliable)
  cmd = "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] | #{event_type} | #{trackId} | #{track_display}\" >> #{track_log}"
  ignore(system(cmd))
  
  # Also log to console
  log.info("🎵 TRACK_EVENT: #{event_type} - #{track_display}")
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK LIFECYCLE HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

track_counter = ref(0)

def on_track_start(m) =
  track_counter := !track_counter + 1
  count = !track_counter
  
  log_track_event("STARTED", m)
  log.info("Track ##{count} started playing")
  
  # Auto-cleanup
  filename = m["filename"]
  if filename != "" and string.contains(substring="/var/radio/tracks/", filename) then
    if not string.contains(substring="news-latest.mp3", filename) then
      log.info("🧹 Scheduled cleanup: #{filename}")
      ignore(process.run("rm -f #{process.quote(filename)}"))
    end
  end
end

def on_track_end(m) =
  log_track_event("ENDED", m)
  
  # Log duration if available
  duration = m["duration"]
  if duration != "" then
    filename = m["filename"]
    parts = string.split(separator="/", filename)
    trackId = list.nth(default="unknown", parts, list.length(parts) - 1)
    cmd = "echo \"[$(date '+%Y-%m-%d %H:%M:%S')] | DURATION | #{trackId} | #{duration}s\" >> #{track_log}"
    ignore(system(cmd))
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 RADIO SOURCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

radio = playlist(
  mode="normal",
  reload_mode="watch",
  reload=3600,
  "/var/radio/playlists/current.m3u"
)

# CROSSFADE
%include "/opt/radio/advanced-crossfade.liq"
radio = cue_cut(radio)
radio = cross(duration=5.0, advanced_crossfade, radio)

# COVER ART
%include "/opt/radio/cover-support.liq"

# Make safe
radio = mksafe(radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 APPLY HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

radio = source.on_track(radio, on_track_start)
radio = source.on_end(radio, delay=1.0, on_track_end)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎚️ OUTPUTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

print("🎚️ Splash FM - Professional Audio + WildFM Jingels!")
print("🎚️ Dual Output Active (Main + Raw)")
print("📊 Track logging → /var/log/liquidsoap-tracks.log")
print("✅ Ready!")
