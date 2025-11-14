#!/usr/bin/liquidsoap

# ============================================
# HYBRID SQS STREAMING - Just-in-Time Tracks
# ============================================
# Maintains queue of 2 tracks:
# - Track 1: Currently playing
# - Track 2: Next up (buffered)
#
# When queue < 2, triggers Lambda to add next track
# ============================================

set("init.allow_root", true)
log.level.set(4)

# Configuration
queue_url = "https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
lambda_name = "amplify-gforgeiot-gerard-s-trackQueueManagerlambda-XXXXXXX"  # Will be output after deployment
region = "eu-west-1"

# Track current state
current_track_id = ref("")
last_queue_check = ref(0.0)

# ============================================
# HELPER FUNCTIONS
# ============================================

# Get queue size from SQS
def get_queue_size() =
  print("📊 Checking SQS queue size...")
  
  result = get_process_output(
    "aws sqs get-queue-attributes \
      --queue-url #{queue_url} \
      --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
      --region #{region} \
      --output json"
  )
  
  # Parse JSON to get queue size
  # This is a simplified version - in production, use proper JSON parsing with jq
  visible = system("echo '#{result}' | jq -r '.Attributes.ApproximateNumberOfMessages // \"0\"'")
  processing = system("echo '#{result}' | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // \"0\"'")
  
  visible_count = int_of_string(default=0, visible)
  processing_count = int_of_string(default=0, processing)
  total = visible_count + processing_count
  
  print("   Visible: #{visible_count}, Processing: #{processing_count}, Total: #{total}")
  total
end

# Trigger Lambda to add next track
def trigger_lambda_add_track() =
  print("🔔 Queue < 2, triggering Lambda to add next track...")
  
  # Invoke Lambda asynchronously (Event type)
  ignore(system(
    "aws lambda invoke \
      --function-name #{lambda_name} \
      --invocation-type Event \
      --region #{region} \
      --payload '{}' \
      /tmp/lambda-response.json > /dev/null 2>&1 &"
  ))
  
  print("✅ Lambda invoked asynchronously")
end

# Get next track from SQS
def get_next_track() =
  print("📥 Polling SQS for next track...")
  
  # Check current time (rate limit queue checks)
  now = time()
  if now - last_queue_check() < 10.0 then
    print("⏱️  Skipping queue check (too soon, < 10s)")
  else
    last_queue_check := now
    
    # Check queue size
    queue_size = get_queue_size()
    
    # If queue has fewer than 2 tracks, trigger Lambda
    if queue_size < 2 then
      print("⚠️  Queue low (#{queue_size} tracks) - Triggering Lambda")
      trigger_lambda_add_track()
    else
      print("✅ Queue healthy (#{queue_size} tracks)")
    end
  end
  
  # Receive message from SQS (long polling 20s)
  print("🎵 Receiving track from SQS...")
  result = get_process_output(
    "aws sqs receive-message \
      --queue-url #{queue_url} \
      --max-number-of-messages 1 \
      --wait-time-seconds 20 \
      --message-attribute-names All \
      --region #{region} \
      --output json"
  )
  
  # Parse JSON
  # Extract MessageBody using jq
  message_body = system("echo '#{result}' | jq -r '.Messages[0].Body // \"\"'")
  receipt_handle = system("echo '#{result}' | jq -r '.Messages[0].ReceiptHandle // \"\"'")
  
  if message_body != "" and message_body != "null" then
    # Parse track details from message body
    file_url = system("echo '#{message_body}' | jq -r '.fileUrl // \"\"'")
    track_id = system("echo '#{message_body}' | jq -r '.trackId // \"\"'")
    title = system("echo '#{message_body}' | jq -r '.title // \"Unknown\"'")
    artist = system("echo '#{message_body}' | jq -r '.artist // \"Unknown\"'")
    
    print("🎵 Got track: #{artist} - #{title}")
    print("   File: #{file_url}")
    current_track_id := track_id
    
    # Delete message from SQS (immediately after receiving)
    if receipt_handle != "" and receipt_handle != "null" then
      print("🗑️  Deleting message from queue...")
      ignore(system(
        "aws sqs delete-message \
          --queue-url #{queue_url} \
          --receipt-handle '#{receipt_handle}' \
          --region #{region}"
      ))
      print("✅ Message deleted")
    end
    
    # Return S3 URL for Liquidsoap to play
    file_url
  else
    print("❌ No track in queue - returning silence")
    "" # Return empty (will trigger fallback)
  end
end

# ============================================
# AUDIO SOURCE
# ============================================

# Request-based source with SQS polling
radio = request.dynamic.list(
  prefetch=1,  # Always fetch 1 track ahead (this is key!)
  get_next_track
)

# AUTO-CLEANUP function (delete track after playing)
def cleanup_track(m) =
  filename = m["filename"]
  if filename != "" and string.contains(substring="/tmp/", filename) then
    print("🧹 Deleting cached track: #{filename}")
    ignore(process.run("rm -f #{process.quote(filename)}"))
  end
end

# Attach cleanup callback
source.on_track(radio, cleanup_track)

# ============================================
# AUDIO PROCESSING
# ============================================

# Professional crossfade (5 seconds)
radio = crossfade(
  duration=5.0,
  radio
)

# Cue cut (remove silence at start/end)
radio = cue_cut(radio)

# Make safe (fallback to silence if no tracks)
radio = mksafe(radio)

# ============================================
# OUTPUT TO ICECAST
# ============================================

# OUTPUT 1: RAW STREAM (no Stereo Tool processing)
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream-raw.mp3",
  name="Splash FM - Raw (SQS Hybrid)",
  description="Hybrid SQS streaming with just-in-time tracks",
  genre="Dance/Pop",
  url="http://46.137.184.91",
  radio
)

# OUTPUT 2: MAIN STREAM
# (Stereo Tool will relay this separately)
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="Splash FM (SQS Hybrid)",
  description="Professional streaming with SQS queue",
  genre="Dance/Pop",
  url="http://46.137.184.91",
  radio
)

print("🚀 Hybrid SQS Streaming - ACTIVE!")
print("📊 Queue URL: #{queue_url}")
print("🔔 Lambda trigger: #{lambda_name}")
print("✅ Liquidsoap ready - Waiting for tracks...")
