#!/usr/bin/liquidsoap

set("init.allow_root",true)
log.level.set(4)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK EVENT LOGGING TO CLOUDWATCH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Log file for track events
track_log = "/var/log/liquidsoap-tracks.log"

# Get track ID from filename
def get_track_id(m) =
  filename = m["filename"]
  if filename != "" then
    # Extract basename without extension
    parts = string.split(separator="/", filename)
    basename = list.nth(default="unknown", parts, list.length(parts) - 1)
    string.replace(pattern="\\.mp3$", fun(_) -> "", 
      string.replace(pattern="\\.wav$", fun(_) -> "", basename))
  else
    "unknown"
  end
end

# Get display name (artist - title or filename)
def get_track_display(m) =
  artist = m["artist"]
  title = m["title"]
  
  if artist != "" and title != "" then
    "#{artist} - #{title}"
  else
    filename = m["filename"]
    if filename != "" then
      parts = string.split(separator="/", filename)
      basename = list.nth(default="Unknown", parts, list.length(parts) - 1)
      string.replace(pattern="\\.mp3$", fun(_) -> "", 
        string.replace(pattern="\\.wav$", fun(_) -> "", basename))
    else
      "Unknown Track"
    end
  end
end

# Get current timestamp
def get_timestamp() =
  time_parts = time()
  year = string_of(time_parts.year)
  month = string_of(time_parts.mon)
  day = string_of(time_parts.mday)
  hour = string_of(time_parts.hour)
  min = string_of(time_parts.min)
  sec = string_of(time_parts.sec)
  
  # Pad with zeros
  month = if string.length(month) == 1 then "0#{month}" else month end
  day = if string.length(day) == 1 then "0#{day}" else day end
  hour = if string.length(hour) == 1 then "0#{hour}" else hour end
  min = if string.length(min) == 1 then "0#{min}" else min end
  sec = if string.length(sec) == 1 then "0#{sec}" else sec end
  
  "#{year}-#{month}-#{day} #{hour}:#{min}:#{sec}"
end

# Log track event (structured format)
def log_track_event(event_type, m) =
  timestamp = get_timestamp()
  trackId = get_track_id(m)
  track_display = get_track_display(m)
  
  # Structured log format: [timestamp] | EVENT | trackId | display
  message = "[#{timestamp}] | #{event_type} | #{trackId} | #{track_display}"
  
  # Log to file
  system("echo '#{process.quote(message)}' >> #{track_log}")
  
  # Also log to console
  log.info("TRACK_EVENT: #{event_type} - #{track_display}")
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK LIFECYCLE HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Track counter
track_counter = ref(0)

# On track start
def on_track_start(m) =
  # Increment counter
  track_counter := !track_counter + 1
  count = !track_counter
  
  log_track_event("STARTED", m)
  log.info("Track ##{count} started")
  
  # Cleanup previous track
  filename = m["filename"]
  if filename != "" and string.contains(substring="/var/radio/tracks/", filename) then
    if not string.contains(substring="news-latest.mp3", filename) then
      log.info("🧹 Cleaning up: #{filename}")
      ignore(process.run("rm -f #{process.quote(filename)}"))
    end
  end
end

# On track end  
def on_track_end(m) =
  log_track_event("ENDED", m)
  
  # Log duration if available
  duration = m["duration"]
  if duration != "" then
    timestamp = get_timestamp()
    trackId = get_track_id(m)
    dur_message = "[#{timestamp}] | DURATION | #{trackId} | #{duration}s"
    system("echo '#{process.quote(dur_message)}' >> #{track_log}")
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 RADIO SOURCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# File-based playlist
radio = playlist(
  mode="normal",
  reload_mode="watch",
  reload=3600,
  "/var/radio/playlists/current.m3u"
)

# PROFESSIONAL CROSSFADE WITH SMART FADE-OUT
%include "/opt/radio/advanced-crossfade.liq"

# Apply cue cutting
radio = cue_cut(radio)

# Apply crossfade
radio = cross(duration=5.0, advanced_crossfade, radio)

# COVER ART METADATA
%include "/opt/radio/cover-support.liq"

# Make source safe
radio = mksafe(radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 APPLY TRACK LIFECYCLE HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Hook: On track starts
radio = source.on_track(radio, on_track_start)

# Hook: On track ends
radio = source.on_end(radio, delay=1.0, on_track_end)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎚️ OUTPUTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# OUTPUT 1: MAIN STREAM
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

# OUTPUT 2: RAW STREAM (for Stereo Tool input)
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
print("📊 Track logging enabled → /var/log/liquidsoap-tracks.log")
print("✅ CloudWatch integration active!")
