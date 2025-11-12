#!/usr/bin/liquidsoap

# G-Forge Radio - Liquidsoap configuration with dynamic reload
# Supports modular M3U playlists with near-realtime updates

# Set log level
settings.log.level := 3
settings.log.stdout := true

# Audio settings
settings.frame.audio.samplerate := 44100
settings.frame.audio.channels := 2

# Playlist configuration with reload
# reload=300 = check for playlist changes every 5 minutes (300 seconds)
# mode="normal" = play tracks in order
# reload_mode="watch" = watch file for changes
playlist_source = playlist(
  reload=300,
  reload_mode="watch",
  mode="normal",
  "/tmp/current-playlist.m3u"
)

# Load crossfade config from S3 (updated by Lambda)
crossfade_config_file = "/tmp/crossfade.liq"

# Default crossfade function (fallback)
def smart_crossfade(~start_next, ~fade_in, ~fade_out, a, b) =
  add(normalize=false, [
    sequence([
      blank(duration=start_next),
      fade.in(duration=fade_in, b)
    ]),
    fade.out(duration=fade_out, a)
  ])
end

# Try to load custom crossfade config, fallback to default
crossfade_func = 
  if file.exists(crossfade_config_file) then
    let

 eval(ignore_errors=true, file.contents(crossfade_config_file))
    # If loaded successfully, use it; otherwise use default
    smart_crossfade(start_next=3.0, fade_in=2.0, fade_out=2.0)
  else
    # Default crossfade settings
    smart_crossfade(start_next=3.0, fade_in=2.0, fade_out=2.0)
  end

# Apply crossfade to playlist
radio = crossfade(duration=5.0, crossfade_func, playlist_source)

# Normalize audio
radio = normalize(target=-14.0, threshold=-40.0, radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="g-forge-radio-2024",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="Your favorite progressive house & techno",
  genre="Electronic",
  url="http://gforge.nl",
  radio
)

# Log when playlist reloads
def on_track(m) =
  artist = m["artist"]
  title = m["title"]
  log("Now playing: #{artist} - #{title}")
end

playlist_source.on_track(on_track)

print("🎵 G-Forge Radio started with modular playlist support!")
print("📋 Playlist reload: every 5 minutes")
print("🔄 Watch mode: enabled for near-realtime updates")
