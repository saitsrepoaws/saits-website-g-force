#!/bin/bash

# 🔇 Stream Silence Detector
# Detect if stream is down or broadcasting silence

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOGFILE="/var/log/splash-silence.log"
STREAM_URL="http://localhost:8000/stream.mp3"
TEMP_FILE="/tmp/stream-test-$$.mp3"

log() {
    echo "[$TIMESTAMP] $1" | sudo tee -a $LOGFILE
}

send_metric() {
    local name=$1
    local value=$2
    
    aws cloudwatch put-metric-data \
        --namespace "SplashFM" \
        --metric-name "$name" \
        --value $value \
        --timestamp "$TIMESTAMP" 2>/dev/null || true
}

send_alarm() {
    local message=$1
    log "🚨 ALARM: $message"
    
    # Send to CloudWatch as high-value metric for alarming
    aws cloudwatch put-metric-data \
        --namespace "SplashFM" \
        --metric-name "StreamSilenceAlarm" \
        --value 1 \
        --timestamp "$TIMESTAMP" 2>/dev/null || true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Check if stream is accessible
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "🔍 Checking stream accessibility..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $STREAM_URL)

if [ "$HTTP_CODE" != "200" ]; then
    log "❌ Stream not accessible (HTTP $HTTP_CODE)"
    send_metric "StreamAccessible" 0
    send_alarm "Stream HTTP endpoint returned $HTTP_CODE"
    exit 1
fi

log "✅ Stream accessible (HTTP 200)"
send_metric "StreamAccessible" 1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Download stream sample (5 seconds)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "📥 Downloading stream sample..."

# Download 5 seconds of stream
timeout 5 curl -s $STREAM_URL > $TEMP_FILE 2>/dev/null

if [ ! -f "$TEMP_FILE" ] || [ ! -s "$TEMP_FILE" ]; then
    log "❌ Failed to download stream sample"
    send_metric "StreamDataReceived" 0
    send_alarm "Stream download failed - no data received"
    rm -f $TEMP_FILE
    exit 1
fi

FILE_SIZE=$(stat -f%z "$TEMP_FILE" 2>/dev/null || stat -c%s "$TEMP_FILE" 2>/dev/null)
log "📊 Downloaded ${FILE_SIZE} bytes"
send_metric "StreamSampleSize" $FILE_SIZE

if [ $FILE_SIZE -lt 10000 ]; then
    log "⚠️  Sample size too small (${FILE_SIZE} bytes)"
    send_metric "StreamDataReceived" 0
    send_alarm "Stream sample too small - possible stream issue"
    rm -f $TEMP_FILE
    exit 1
fi

send_metric "StreamDataReceived" 1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Check for silence using ffmpeg
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if ! command -v ffmpeg &> /dev/null; then
    log "⚠️  ffmpeg not installed - skipping silence detection"
    rm -f $TEMP_FILE
    exit 0
fi

log "🔊 Analyzing audio for silence..."

# Detect silence (threshold: -50dB, duration: 3 seconds)
SILENCE_DETECT=$(ffmpeg -i $TEMP_FILE -af silencedetect=noise=-50dB:d=3 -f null - 2>&1 | grep "silence_duration")

if [ -z "$SILENCE_DETECT" ]; then
    log "✅ Audio detected - stream is broadcasting sound"
    send_metric "StreamHasAudio" 1
    send_metric "StreamIsSilent" 0
else
    # Parse silence duration
    SILENCE_DURATION=$(echo "$SILENCE_DETECT" | grep -oP 'silence_duration: \K[0-9.]+' | head -1)
    
    if [ -n "$SILENCE_DURATION" ]; then
        log "🔇 SILENCE DETECTED: ${SILENCE_DURATION}s of silence"
        send_metric "StreamHasAudio" 0
        send_metric "StreamIsSilent" 1
        send_metric "SilenceDuration" $SILENCE_DURATION
        send_alarm "Stream is broadcasting silence (${SILENCE_DURATION}s detected)"
    else
        log "✅ Audio detected - stream is broadcasting sound"
        send_metric "StreamHasAudio" 1
        send_metric "StreamIsSilent" 0
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Audio level analysis (optional - if sox installed)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if command -v sox &> /dev/null; then
    log "📊 Analyzing audio level..."
    
    # Convert to WAV and get stats
    TEMP_WAV="/tmp/stream-test-$$.wav"
    ffmpeg -i $TEMP_FILE -y $TEMP_WAV 2>/dev/null
    
    if [ -f "$TEMP_WAV" ]; then
        # Get maximum amplitude
        MAX_AMPLITUDE=$(sox $TEMP_WAV -n stat 2>&1 | grep "Maximum amplitude" | awk '{print $3}')
        
        if [ -n "$MAX_AMPLITUDE" ]; then
            log "📊 Max amplitude: $MAX_AMPLITUDE"
            
            # Check if amplitude is too low (< 0.01 = very quiet/silence)
            IS_TOO_QUIET=$(echo "$MAX_AMPLITUDE < 0.01" | bc -l)
            
            if [ "$IS_TOO_QUIET" = "1" ]; then
                log "⚠️  Audio level very low - possible silence"
                send_alarm "Audio level critically low (max: $MAX_AMPLITUDE)"
            else
                log "✅ Audio level normal"
            fi
        fi
        
        rm -f $TEMP_WAV
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cleanup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rm -f $TEMP_FILE

log "✅ Silence detection complete"

exit 0
