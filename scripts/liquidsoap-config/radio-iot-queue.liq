#!/usr/bin/liquidsoap
################################################################################
# G-FORGE RADIO - Liquidsoap Config (IoT Queue)
################################################################################
# Replaces SQS polling with IoT push + file-based queue
# Reads queue from: /tmp/iot-queue.json
# Reloads on: SIGUSR1 signal
################################################################################

# Set log level
settings.log.level := 3
settings.log.file := true
settings.log.file.path := "/var/log/liquidsoap/radio.log"

# Server configuration
settings.server.telnet := true
settings.server.telnet.bind_addr := "127.0.0.1"
settings.server.telnet.port := 1234

# Queue file
queue_file = "/tmp/iot-queue.json"
current_track_index = ref 0

# Function to read queue from file
def get_queue_tracks() =
  log("📖 Reading queue from #{queue_file}...")
  
  # Check if file exists
  result = process.run("test -f #{queue_file}")
  if result.status != 0 then
    log("⚠️  Queue file not found, returning empty")
    []
  else
    # Read file content
    content = file.contents(queue_file)
    
    # Parse JSON (simplified - get tracks array)
    # In production, use jq or proper JSON parsing
    log("✅ Queue file read successfully")
    log("Content length: #{string.length(content)} bytes")
    
    # For now, return empty and let external script handle parsing
    # Liquidsoap will use request.dynamic.list with external command
    []
  end
end

# Function to get next track URL from queue
def get_next_track() =
  log("🎵 Getting next track from IoT queue...")
  
  # Use jq to extract next track URL from queue file
  result = process.run("jq -r '.tracks[0].fileUrl // empty' #{queue_file}")
  
  if result.status == 0 and result.stdout != "" then
    track_url = string.trim(result.stdout)
    log("✅ Next track: #{track_url}")
    
    # Remove this track from queue (shift array)
    _ = process.run("jq '.tracks |= .[1:]' #{queue_file} > #{queue_file}.tmp && mv #{queue_file}.tmp #{queue_file}")
    
    track_url
  else
    log("⚠️  No tracks in queue")
    ""
  end
end

# Create dynamic playlist source
def next_track() =
  url = get_next_track()
  
  if url != "" then
    log("🎧 Loading track: #{url}")
    [request.create(url)]
  else
    log("⚠️  Queue empty, returning silence")
    []
  end
end

# Create radio source with dynamic queue
radio = request.dynamic.list(
  prefetch=1,
  next_track
)

# Fallback to silence if queue empty
radio = fallback(
  track_sensitive=false,
  [radio, blank()]
)

# Apply audio processing
radio = normalize(radio, target=-14.0)

# Crossfade between tracks
radio = crossfade(
  start_next=3.0,
  fade_in=2.0,
  fade_out=2.0,
  radio
)

# Setup signal handler for queue reload
# When receiving SIGUSR1, Liquidsoap will check for new tracks
def on_signal(s) =
  log("📢 Received signal #{s}, reloading queue...")
  # Liquidsoap will automatically call next_track() to get new tracks
end

thread.run(every=0.1, {ignore(server.signal("SIGUSR1", on_signal))})

# Output to Icecast
output.icecast(
  %mp3(bitrate=192, samplerate=44100),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="Techno & Electronic Music 24/7",
  genre="Techno",
  url="https://splashfm.nl",
  public=true,
  radio
)

log("✅ Liquidsoap started with IoT queue!")
log("📡 Queue file: #{queue_file}")
log("🎧 Stream: http://localhost:8000/stream.mp3")
