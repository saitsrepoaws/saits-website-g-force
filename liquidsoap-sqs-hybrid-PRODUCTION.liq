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
lambda_name = "amplify-gforgeiot-gerard--trackqueuemanagerlambdaE-b213jZJczaRX"
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
    return ""
  end
  
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
  
  # Receive message from SQS (long polling 20s)
  print("🎵 Receiving track from SQS...")
  result = get_process_output(
    "aws sqs receive-message \
      --queue-url #{queue_url} \
      --region #{region} \
      --max-number-of-messages 1 \
      --wait-time-seconds 20 \
      --attribute-names All \
      --message-attribute-names All \
      --output json"
  )
  
  # Parse message
  receipt_handle = system("echo '#{result}' | jq -r '.Messages[0].ReceiptHandle // \"\"'")
  body = system("echo '#{result}' | jq -r '.Messages[0].Body // \"\"'")
  
  if receipt_handle == "" or body == "" then
    print("⚠️  No track in queue, waiting...")
    return ""
  end
  
  # Parse track data
  file_url = system("echo '#{body}' | jq -r '.fileUrl // \"\"'")
  track_id = system("echo '#{body}' | jq -r '.trackId // \"\"'")
  title = system("echo '#{body}' | jq -r '.title // \"Unknown\"'")
  artist = system("echo '#{body}' | jq -r '.artist // \"Unknown\"'")
  
  print("🎧 Got track: #{artist} - #{title}")
  print("   Track ID: #{track_id}")
  print("   File URL: #{file_url}")
  
  current_track_id := track_id
  
  # Convert S3 URL to downloadable path
  # file_url format: s3://bucket/path/to/file.mp3
  # Need to: aws s3 cp s3://... /tmp/track-{id}.mp3
  
  if string.contains(substring="s3://", file_url) then
    local_path = "/tmp/track-#{track_id}.mp3"
    
    print("📥 Downloading from S3...")
    download_result = system("aws s3 cp #{process.quote(file_url)} #{process.quote(local_path)} 2>&1")
    
    if file.exists(local_path) then
      print("✅ Downloaded to: #{local_path}")
      
      # Delete message from SQS (track is downloaded)
      ignore(system(
        "aws sqs delete-message \
          --queue-url #{queue_url} \
          --region #{region} \
          --receipt-handle #{process.quote(receipt_handle)} > /dev/null 2>&1 &"
      ))
      print("✅ Deleted message from SQS")
      
      # Return annotated request with metadata
      "annotate:artist=\"#{artist}\",title=\"#{title}\",track_id=\"#{track_id}\":#{local_path}"
    else
      print("❌ Download failed: #{download_result}")
      return ""
    end
  else
    print("❌ Invalid file URL format (expected s3://)")
    return ""
  end
end

# ============================================
# SOURCE: Dynamic request list
# ============================================

radio = request.dynamic.list(
  prefetch=1,  # Fetch 1 track ahead
  fun () -> [request.create(get_next_track())]
)

radio = mksafe(radio)

# ============================================
# AUTO-CLEANUP: Delete played tracks
# ============================================

def cleanup_track(m) =
  filename = m["filename"]
  if filename != "" and string.contains(substring="/tmp/track-", filename) then
    print("🧹 Deleting played track: #{filename}")
    ignore(process.run("rm -f #{process.quote(filename)}"))
  end
end

source.on_track(radio, cleanup_track)

# ============================================
# CROSSFADE (if needed)
# ============================================

# Simple crossfade - can be replaced with advanced version
radio = cue_cut(radio)
# radio = cross(duration=3.0, fun (a,b) -> add([fade.in(b), fade.out(a)]), radio)

# ============================================
# OUTPUTS: Icecast Streams
# ============================================

# OUTPUT 1: RAW STREAM (for Stereo Tool input)
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream-raw.mp3",
  name="Splash FM - Raw",
  description="SQS Hybrid Streaming (Raw)",
  genre="Dance/Pop",
  url="http://46.137.184.91",
  radio
)

# OUTPUT 2: MAIN STREAM
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="Splash FM",
  description="SQS Hybrid Streaming",
  genre="Dance/Pop",
  url="http://46.137.184.91",
  radio
)

print("🎵 Splash FM - SQS Hybrid Streaming Active!")
print("   Queue: #{queue_url}")
print("   Lambda: #{lambda_name}")
print("   2-track buffer system enabled")
