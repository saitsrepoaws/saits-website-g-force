#!/usr/bin/liquidsoap

# ============================================
# HYBRID SQS STREAMING - Just-in-Time Tracks
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
  
  result = process.read(
    "aws sqs get-queue-attributes \
      --queue-url #{queue_url} \
      --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
      --region #{region} \
      --output json 2>/dev/null | jq -r '.Attributes.ApproximateNumberOfMessages + \" \" + .Attributes.ApproximateNumberOfMessagesNotVisible'"
  )
  
  # Parse the two numbers
  parts = string.split(separator=" ", result)
  visible_count = int_of_string(default=0, list.nth(default="0", parts, 0))
  processing_count = int_of_string(default=0, list.nth(default="0", parts, 1))
  total = visible_count + processing_count
  
  print("   Visible: #{visible_count}, Processing: #{processing_count}, Total: #{total}")
  total
end

# Trigger Lambda to add next track
def trigger_lambda_add_track() =
  print("🔔 Queue < 2, triggering Lambda to add next track...")
  
  # Invoke Lambda asynchronously
  ignore(process.run(
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
  if now - !last_queue_check < 10.0 then
    print("⏱️  Skipping queue check (too soon, < 10s)")
    ""
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
    
    # Receive message from SQS
    print("🎵 Receiving track from SQS...")
  
    # Get the full message
    msg_result = process.read(
    "aws sqs receive-message \
      --queue-url #{queue_url} \
      --region #{region} \
      --max-number-of-messages 1 \
      --wait-time-seconds 20 \
      --output json 2>/dev/null"
  )
    
    # Check if we got a message
    receipt_handle = process.read("echo '#{msg_result}' | jq -r '.Messages[0].ReceiptHandle // \"\"' 2>/dev/null")
    
    if receipt_handle == "" then
      print("⚠️  No track in queue, waiting...")
      ""
    else
      
      # Parse track data
      track_id = process.read("echo '#{msg_result}' | jq -r '.Messages[0].Body | fromjson | .trackId // \"\"' 2>/dev/null")
  file_url = process.read("echo '#{msg_result}' | jq -r '.Messages[0].Body | fromjson | .fileUrl // \"\"' 2>/dev/null")
  title = process.read("echo '#{msg_result}' | jq -r '.Messages[0].Body | fromjson | .title // \"Unknown\"' 2>/dev/null")
  artist = process.read("echo '#{msg_result}' | jq -r '.Messages[0].Body | fromjson | .artist // \"Unknown\"' 2>/dev/null")
      
      if track_id == "" or file_url == "" then
        print("❌ Failed to parse message")
        ""
      else
        
        print("🎧 Got track: #{artist} - #{title}")
        print("   Track ID: #{track_id}")
        print("   File URL: #{file_url}")
        
        current_track_id := track_id
        
        # Download track (supports both HTTP URLs and S3 URLs)
        local_path = "/tmp/track-#{track_id}.mp3"
        
        print("📥 Downloading track...")
        
        download_result = ""
        
        # Download based on URL type (EC2 has S3 read permissions via IAM role)
        if string.contains(substring="s3://", file_url) then
          # S3 URL - use AWS CLI (EC2 has IAM role with S3 read permissions)
          print("📦 Downloading from S3 via IAM role...")
          download_result = process.read("aws s3 cp '#{file_url}' '#{local_path}' 2>&1")
        else
          # HTTP/HTTPS URL - use wget
          print("🌐 Downloading from HTTPS...")
          download_result = process.read("wget -q -O '#{local_path}' '#{file_url}' 2>&1")
        end
        
        if file.exists(local_path) then
          print("✅ Downloaded to: #{local_path}")
          
          # Delete message from SQS
          ignore(process.run(
            "aws sqs delete-message \
              --queue-url #{queue_url} \
              --region #{region} \
              --receipt-handle '#{receipt_handle}' > /dev/null 2>&1"
          ))
          print("✅ Deleted message from SQS")
          
          # Return annotated request with metadata
          "annotate:artist=\"#{artist}\",title=\"#{title}\",track_id=\"#{track_id}\":#{local_path}"
        else
          print("❌ Download failed: #{download_result}")
          ""
        end
      end
    end
  end
end

# ============================================
# SOURCE: Dynamic request list
# ============================================

radio = request.dynamic.list(
  prefetch=1,
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
    ignore(process.run("rm -f '#{filename}'"))
  end
end

source.on_track(radio, cleanup_track)

# ============================================
# CROSSFADE
# ============================================

radio = cue_cut(radio)

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
