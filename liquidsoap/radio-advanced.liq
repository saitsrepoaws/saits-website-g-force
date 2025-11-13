#!/usr/bin/liquidsoap

# ╔═══════════════════════════════════════════════════════════════╗
# ║                                                               ║
# ║           G-FORGE IOT RADIO - ADVANCED CONFIGURATION          ║
# ║          With BPM-Synced Crossfades & Smart Jingles          ║
# ║                                                               ║
# ╚═══════════════════════════════════════════════════════════════╝

# Enable logging
settings.log.level := 3

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📡 AWS SQS CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

sqs_queue_url = "https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
aws_region = "eu-west-1"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 GET NEXT TRACK FROM SQS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_next_track()
  try
    # Download track URL from SQS using AWS CLI
    result = list.hd(
      default="",
      get_process_lines(
        "aws sqs receive-message --queue-url #{sqs_queue_url} --region #{aws_region} --max-number-of-messages 1 --wait-time-seconds 5 | jq -r '.Messages[0] | .Body + \"|\" + .ReceiptHandle'"
      )
    )
    
    if result != "" then
      parts = string.split(separator="|", result)
      url = list.hd(default="", parts)
      receipt_handle = list.nth(default="", parts, 1)
      
      if url != "" and receipt_handle != "" then
        print("✅ Got track from SQS: #{url}")
        
        # Delete message from SQS
        ignore(
          get_process_output(
            "aws sqs delete-message --queue-url #{sqs_queue_url} --region #{aws_region} --receipt-handle '#{receipt_handle}'"
          )
        )
        
        url
      else
        print("⚠️ No track URL in SQS message")
        ""
      end
    else
      print("📭 No messages in SQS queue, waiting...")
      ""
    end
  catch err do
    print("❌ Error getting track from SQS: #{err}")
    ""
  end
end

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ CREATE DYNAMIC PLAYLIST SOURCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def next_track()
  path = get_next_track()
  if path != "" then
    [request.create(path)]
  else
    []
  end
end

# Create request.dynamic.list source
radio = request.dynamic.list(prefetch=1, next_track)

# Make it safe (never fails)
radio = mksafe(radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎛️ LOAD ADVANCED CROSSFADE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%include "/opt/radio/advanced-crossfade.liq"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎵 APPLY CUE CUTTING & CROSSFADE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Apply cue cut (supports liq_cue_in, liq_cue_out)
radio = cue_cut(radio)

# Apply advanced crossfade with BPM sync
radio = cross(duration=5.0, advanced_crossfade, radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔊 AUDIO PROCESSING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Volume normalization (consistent loudness)
radio = normalize(target=-14.0, threshold=-40.0, radio)

# Make safe again after processing
radio = mksafe(radio)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📡 ICECAST OUTPUT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Stream to Icecast
output.icecast(
  %mp3(bitrate=128),
  host="localhost",
  port=8000,
  password="hackme",
  mount="/stream",
  name="G-Forge IoT Radio",
  description="Professional 24/7 Dance, House & Techno",
  genre="Electronic",
  url="http://46.137.184.91",
  radio
)

print("🎵 G-Forge IoT Radio - ADVANCED MODE")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("✅ BPM-Synced Crossfades")
print("✅ Smart Jingle Detection")
print("✅ Genre-Specific Mixing")
print("✅ Volume-Based Transitions")
print("✅ Per-Track Metadata Control")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("🚀 Stream URL: http://46.137.184.91/stream.mp3")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
