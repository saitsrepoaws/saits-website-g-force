# G-Forge Radio - Liquidsoap SQS Configuration
# Polls SQS queue for next track to play

set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 3)

# Get queue URL from CloudFormation output or environment
queue_url_file = "/opt/radio/queue-url.txt"
queue_url = ref("")

# Load queue URL
def load_queue_url() =
  if file.exists(queue_url_file) then
    lines = file.lines(queue_url_file)
    if list.length(lines) > 0 then
      queue_url := list.hd(default="", lines)
      log("✅ Queue URL loaded: #{!queue_url}")
    else
      log("❌ Queue URL file is empty")
    end
  else
    log("❌ Queue URL file not found: #{queue_url_file}")
  end
end

# Initial load
load_queue_url()

# Function to receive message from SQS
def receive_sqs_message() =
  if !queue_url == "" then
    log("⚠️ Queue URL not set, cannot receive messages")
    ""
  else
    # AWS CLI to receive one message (long polling 20 sec)
    cmd = "aws sqs receive-message --queue-url '#{!queue_url}' --max-number-of-messages 1 --wait-time-seconds 20 --output json 2>&1"
    result = process.read(cmd)
    result
  end
end

# Function to delete message from SQS
def delete_sqs_message(receipt_handle) =
  if !queue_url == "" then
    cmd = "aws sqs delete-message --queue-url '#{!queue_url}' --receipt-handle '#{receipt_handle}' 2>&1"
    result = process.read(cmd)
    log("🗑️ Message deleted: #{result}")
  end
end

# Parse JSON and extract track URL
def parse_track_from_json(json_str) =
  # This is a simplified parser - in production use proper JSON parsing
  # For now, we extract fileUrl using regex
  
  # Check if there are any messages
  if string.contains(substring="Messages", json_str) then
    # Try to extract Body field
    body_start = string.index(substring='"Body":', json_str)
    if body_start >= 0 then
      body_substr = string.sub(json_str, start=body_start + 8)
      
      # Extract fileUrl from body
      file_url_start = string.index(substring='"fileUrl":"', body_substr)
      if file_url_start >= 0 then
        url_start = file_url_start + 11
        url_substr = string.sub(body_substr, start=url_start)
        url_end = string.index(substring='"', url_substr)
        
        if url_end > 0 then
          file_url = string.sub(url_substr, start=0, length=url_end)
          log("✅ Extracted track URL: #{file_url}")
          file_url
        else
          log("❌ Could not find end quote for fileUrl")
          ""
        end
      else
        log("❌ Could not find fileUrl in body")
        ""
      end
    else
      log("❌ Could not find Body in message")
      ""
    end
  else
    log("ℹ️ No messages in queue")
    ""
  end
end

# Extract receipt handle for deletion
def parse_receipt_handle(json_str) =
  handle_start = string.index(substring='"ReceiptHandle":"', json_str)
  if handle_start >= 0 then
    handle_substr = string.sub(json_str, start=handle_start + 17)
    handle_end = string.index(substring='"', handle_substr)
    if handle_end > 0 then
      string.sub(handle_substr, start=0, length=handle_end)
    else
      ""
    end
  else
    ""
  end
end

# Request function: gets next track from SQS
def get_next_track_from_sqs() =
  log("📥 Polling SQS for next track...")
  
  json_response = receive_sqs_message()
  
  if json_response == "" then
    log("⚠️ No response from SQS")
    []
  else
    track_url = parse_track_from_json(json_response)
    
    if track_url == "" then
      log("⚠️ No track found in SQS message")
      []
    else
      receipt_handle = parse_receipt_handle(json_response)
      
      log("🎵 Playing track: #{track_url}")
      
      # Delete message after extracting (track is playing)
      if receipt_handle != "" then
        delete_sqs_message(receipt_handle)
      end
      
      # Return request
      [request.create(track_url)]
    end
  end
end

# Create request-based source (pulls from SQS)
radio = request.dynamic(get_next_track_from_sqs)

# Add crossfade between tracks
radio = crossfade(
  start_next=3.,
  fade_in=2.,
  fade_out=2.,
  radio
)

# Normalize audio levels
radio = normalize(radio)

# Fallback to silence if queue is empty
radio = fallback(track_sensitive=false, [radio, blank()])

# Output to Icecast
output.icecast(
  %mp3(bitrate=192, samplerate=44100),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="Live Streaming from SQS Queue",
  genre="Electronic",
  public=true,
  radio
)

log("🎙️ Liquidsoap started - polling SQS queue for tracks")
