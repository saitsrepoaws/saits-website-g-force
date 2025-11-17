#!/usr/bin/liquidsoap

################################################################################
# LIQUIDSOAP 2.4.0 - SIMPLE TEST CONFIG
################################################################################

settings.init.allow_root.set(true)
log.level.set(4)

# INTERNAL AUTOCUE (New in 2.3+!)
settings.autocue.cue_file.set(true)
settings.autocue.cue_file.silence.set(-42.0)
settings.autocue.cue_file.overlay.set(-8.0)
settings.autocue.target_loudness.set(-18.0)

log.info("✅ Liquidsoap 2.4.0 with INTERNAL AUTOCUE started!")

# Simple silent stream for testing
radio = single(loop=true, "/opt/radio/silent-stream.mp3")
radio = mksafe(radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192, samplerate=44100),
  host="localhost",
  port=8000,
  password="hackme",
  mount="stream.mp3",
  name="Splash FM - Liquidsoap 2.4.0 TEST",
  description="Testing Liquidsoap 2.4.0 with internal autocue",
  radio
)

log.info("🚀 Liquidsoap 2.4.0 streaming on port 8000!")
