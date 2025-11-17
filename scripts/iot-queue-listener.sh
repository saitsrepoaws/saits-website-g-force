#!/bin/bash
################################################################################
# G-FORGE RADIO - IoT Queue Listener
################################################################################
# Replaces SQS FIFO polling with IoT PUSH notifications
# Subscribes to: radio/queue/tracks
# Writes to: /tmp/iot-queue.json
# Signals Liquidsoap: SIGUSR1
################################################################################

set -e

REGION="eu-west-1"
TOPIC="radio/queue/tracks"
QUEUE_FILE="/tmp/iot-queue.json"
LOG_FILE="/var/log/iot-queue.log"
LIQUIDSOAP_PID_FILE="/var/run/liquidsoap/liquidsoap.pid"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🎵 IoT Queue Listener - Starting"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "Topic: $TOPIC"
log "Queue File: $QUEUE_FILE"
log "Region: $REGION"
log ""

# Initialize empty queue file
if [ ! -f "$QUEUE_FILE" ]; then
    echo '{"tracks":[],"updated":null}' > "$QUEUE_FILE"
    chmod 644 "$QUEUE_FILE"
    log "✅ Initialized queue file"
fi

# Get IoT endpoint
IOT_ENDPOINT=$(aws iot describe-endpoint \
    --endpoint-type iot:Data-ATS \
    --region "$REGION" \
    --query 'endpointAddress' \
    --output text)

log "IoT Endpoint: $IOT_ENDPOINT"
log ""
log "📡 Subscribing to topic: $TOPIC"
log "Waiting for messages (CTRL+C to stop)..."
log ""

# Subscribe to IoT topic using mosquitto_sub
# Message format: {"tracks": [...], "action": "add|replace|clear"}
mosquitto_sub \
    -h "$IOT_ENDPOINT" \
    -p 8883 \
    -t "$TOPIC" \
    --cafile /etc/ssl/certs/ca-certificates.crt \
    --cert /opt/radio/certs/certificate.pem.crt \
    --key /opt/radio/certs/private.pem.key \
    -q 1 | while read -r message; do
    
    log "📥 Received IoT message"
    
    # Parse message
    action=$(echo "$message" | jq -r '.action // "add"')
    tracks=$(echo "$message" | jq -r '.tracks // []')
    
    log "Action: $action"
    log "Tracks: $(echo "$tracks" | jq length) items"
    
    case "$action" in
        "replace")
            # Replace entire queue
            log "🔄 Replacing queue..."
            echo "{\"tracks\":$tracks,\"updated\":\"$(date -Iseconds)\",\"action\":\"replace\"}" > "$QUEUE_FILE"
            log "✅ Queue replaced"
            ;;
            
        "add")
            # Add tracks to existing queue
            log "➕ Adding tracks to queue..."
            current_tracks=$(cat "$QUEUE_FILE" | jq -r '.tracks // []')
            merged_tracks=$(jq -n --argjson current "$current_tracks" --argjson new "$tracks" '$current + $new')
            echo "{\"tracks\":$merged_tracks,\"updated\":\"$(date -Iseconds)\",\"action\":\"add\"}" > "$QUEUE_FILE"
            log "✅ Tracks added (total: $(echo "$merged_tracks" | jq length))"
            ;;
            
        "clear")
            # Clear queue
            log "🧹 Clearing queue..."
            echo '{"tracks":[],"updated":"'"$(date -Iseconds)"'","action":"clear"}' > "$QUEUE_FILE"
            log "✅ Queue cleared"
            ;;
            
        *)
            log "⚠️  Unknown action: $action"
            ;;
    esac
    
    # Signal Liquidsoap to reload queue
    if [ -f "$LIQUIDSOAP_PID_FILE" ]; then
        liquidsoap_pid=$(cat "$LIQUIDSOAP_PID_FILE")
        if ps -p "$liquidsoap_pid" > /dev/null 2>&1; then
            log "📢 Signaling Liquidsoap (PID: $liquidsoap_pid)..."
            kill -USR1 "$liquidsoap_pid" 2>/dev/null || log "⚠️  Failed to signal Liquidsoap"
            log "✅ Signal sent"
        else
            log "⚠️  Liquidsoap not running (PID file stale)"
        fi
    else
        log "⚠️  Liquidsoap PID file not found"
    fi
    
    log ""
    log "Ready for next message..."
    log ""
done

# Cleanup on exit
trap 'log "🛑 IoT Queue Listener stopped"; exit 0' SIGTERM SIGINT

# Keep alive
wait
