#!/usr/bin/liquidsoap

# G-Forge Radio - S3 Direct Reading Config

settings.log.level.set(3)
settings.log.stdout.set(true)

# Use external process to read S3 files via AWS CLI
def s3_protocol(~rlog,~maxtime,arg) =
  timeout = maxtime
  
  # Use aws s3 cp to stream file to stdout
  process = "aws s3 cp #{arg} -"
  
  [process]
end

# Register S3 protocol
add_protocol("s3", s3_protocol)

# Playlist with S3 protocol support
playlist_source = playlist(
  reload=300,
  mode="normal",
  "/tmp/current-playlist.m3u"
)

# Make safe and add crossfade
safe_source = mksafe(playlist_source)
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

print("🎵 G-Forge Radio LIVE with S3 support!")
