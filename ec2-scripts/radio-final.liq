#!/usr/bin/liquidsoap

# G-Forge Radio - Final Working Configuration

# Settings
settings.log.level.set(3)
settings.log.stdout.set(true)

# Audio settings
settings.frame.audio.samplerate.set(44100)
settings.frame.audio.channels.set(2)

# Playlist source with reload every 5 minutes
playlist_source = playlist(
  reload=300,
  mode="normal",
  "/tmp/current-playlist.m3u"
)

# Make it safe (never silent)
safe_source = mksafe(playlist_source)

# Simple crossfade
radio = crossfade(duration=3.0, safe_source)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="g-forge-radio-2024",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="Electronic Music 24/7",
  genre="Electronic",
  url="http://gforge.nl",
  radio
)

print("🎵 G-Forge Radio is LIVE!")
