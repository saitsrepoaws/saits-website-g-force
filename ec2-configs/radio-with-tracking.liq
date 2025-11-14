#!/usr/bin/liquidsoap

set("init.allow_root",true)
log.level.set(4)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK EVENT LOGGING TO CLOUDWATCH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Log file for track events
track_log = "/var/log/liquidsoap-tracks.log"

# Helper: Get current timestamp in CET
def get_timestamp() =
  # Get current time
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

# Helper: Extract track info from metadata
def get_track_info(m) =
  # Try to get track ID (from filename or metadata)
  filename = m["filename"]
  trackId = if filename != "" then
    # Extract basename without extension
    parts = string.split(separator="/", filename)
    basename = list.nth(default="unknown", parts, list.length(parts) - 1)
    string.replace(pattern="\\.mp3$", fun(_) -> "", basename)
  else
    "unknown"
  end
  
  # Get artist and title
  artist = m["artist"]
  title = m["title"]
  
  # Fallback: parse from filename if metadata missing
  track_display = if artist != "" and title != "" then
    "#{artist} - #{title}"
  else if filename != "" then
    # Try to parse "Artist - Title" from filename
    parts = string.split(separator="/", filename)
    basename = list.nth(default="Unknown", parts, list.length(parts) - 1)
    string.replace(pattern="\\.mp3$", fun(_) -> "", basename)
  else
    "Unknown Track"
  end
  
  (trackId, track_display, artist, title)
end

# Log track event (structured format)
def log_track_event(event_type, m) =
  timestamp = get_timestamp()
  (trackId, track_display, artist, title) = get_track_info(m)
  
  # Structured log format: [timestamp] | EVENT | trackId | display
  message = "[#{timestamp}] | #{event_type} | #{trackId} | #{track_display}"
  
  # Log to file
  system("echo '#{process.quote(message)}' >> #{track_log}")
  
  # Also log to Liquidsoap console
  log.info("TRACK_EVENT: #{event_type} - #{track_display}")
  
  # Send metric to CloudWatch (async, non-blocking)
  if event_type == "STARTED" then
    system("aws cloudwatch put-metric-data --namespace SplashFM --metric-name TrackStarted --value 1 --region eu-west-1 2>/dev/null &")
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 TRACK LIFECYCLE HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Track counter (for tracking)
track_counter = ref(0)

# On track start
def on_track_start(m) =
  # Increment counter
  track_counter := !track_counter + 1
  count = !track_counter
  
  log_track_event("STARTED", m)
  log.info("Track ##{count} started")
  
  # Cleanup previous track
  cleanup_track(m)
end

# On track end  
def on_track_end(m) =
  log_track_event("ENDED", m)
  
  # Log duration if available
  duration = m["duration"]
  if duration != "" then
    timestamp = get_timestamp()
    (trackId, _, _, _) = get_track_info(m)
    dur_message = "[#{timestamp}] | DURATION | #{trackId} | #{duration}s"
    system("echo '#{process.quote(dur_message)}' >> #{track_log}")
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧹 AUTO-CLEANUP FUNCTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def cleanup_track(m) =
  filename = m["filename"]
  if filename != "" and string.contains(substring="/var/radio/tracks/", filename) then
    if not string.contains(substring="news-latest.mp3", filename) then
      log.info("🧹 Cleaning up: #{filename}")
      ignore(process.run("rm -f #{process.quote(filename)}"))
    end
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

# Make source safe (fallback on errors)
radio = mksafe(radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎯 APPLY TRACK LIFECYCLE HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Hook: On track starts
radio = source.on_track(radio, on_track_start)

# Hook: On track ends (using metadata)
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
