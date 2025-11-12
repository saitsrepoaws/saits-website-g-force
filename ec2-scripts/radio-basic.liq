#!/usr/bin/liquidsoap

# G-Forge Radio - Basic working configuration

settings.log.level.set(3)
settings.log.stdout.set(true)

# Playlist with reload
playlist_source = playlist(
  reload=300,
  mode="normal",
  "/tmp/current-playlist.m3u"
)

# Make fallible source infallible with mksafe
safe_source = mksafe(playlist_source)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="g-forge-radio-2024",
  mount="/stream.mp3",
  name="G-Forge Radio",
  safe_source
)

print("🎵 G-Forge Radio started (basic mode)!")
