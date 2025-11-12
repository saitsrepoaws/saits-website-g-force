#!/usr/bin/liquidsoap

# G-Forge Radio - Simple working configuration
# Basic playlist with reload support

# Set log level
settings.log.level.set(3)
settings.log.stdout.set(true)

# Audio settings
settings.frame.audio.samplerate.set(44100)
settings.frame.audio.channels.set(2)

# Playlist with reload every 5 minutes (300 seconds)
playlist_source = playlist(
  reload=300,
  mode="normal",
  "/tmp/current-playlist.m3u"
)

# Simple crossfade (3 seconds)
radio = crossfade(duration=3.0, playlist_source)

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

# Log track changes
def on_track(m) =
  artist = m["artist"]
  title = m["title"]
  log("Now playing: #{artist} - #{title}")
end

playlist_source.on_track(on_track)

print("🎵 G-Forge Radio started!")
print("📋 Playlist reload: every 5 minutes")
