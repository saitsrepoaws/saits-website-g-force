#!/bin/bash

# 🏥 Splash FM Health Check
# Comprehensive system health monitoring

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOGFILE="/var/log/splash-health.log"

# Initialize health score
HEALTH_SCORE=100

log() {
    echo "[$TIMESTAMP] $1" | sudo tee -a $LOGFILE
}

send_metric() {
    local name=$1
    local value=$2
    local unit=${3:-None}
    
    aws cloudwatch put-metric-data \
        --namespace "SplashFM" \
        --metric-name "$name" \
        --value $value \
        --unit $unit \
        --timestamp "$TIMESTAMP" 2>/dev/null || true
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Process Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_processes() {
    log "🔍 Checking processes..."
    
    # Liquidsoap
    if pgrep -f "liquidsoap radio.liq" > /dev/null; then
        log "  ✅ Liquidsoap running"
        send_metric "LiquidsoapRunning" 1
        
        # Check CPU usage
        CPU=$(ps aux | grep "[l]iquidsoap radio.liq" | awk '{print $3}')
        if (( $(echo "$CPU > 90" | bc -l) )); then
            log "  ⚠️  Liquidsoap CPU high: ${CPU}%"
            HEALTH_SCORE=$((HEALTH_SCORE - 10))
        fi
    else
        log "  ❌ Liquidsoap NOT running"
        send_metric "LiquidsoapRunning" 0
        HEALTH_SCORE=$((HEALTH_SCORE - 30))
    fi
    
    # Icecast
    if systemctl is-active --quiet icecast2; then
        log "  ✅ Icecast2 running"
        send_metric "IcecastRunning" 1
        
        # Check connections
        CONNECTIONS=$(curl -s http://localhost:8000/admin/stats | grep -o "<clients>[0-9]*</clients>" | grep -o "[0-9]*" || echo 0)
        log "  📊 Icecast connections: $CONNECTIONS"
        send_metric "IcecastConnections" $CONNECTIONS "Count"
    else
        log "  ❌ Icecast2 NOT running"
        send_metric "IcecastRunning" 0
        HEALTH_SCORE=$((HEALTH_SCORE - 30))
    fi
    
    # Nginx
    if systemctl is-active --quiet nginx; then
        log "  ✅ Nginx running"
        send_metric "NginxRunning" 1
    else
        log "  ❌ Nginx NOT running"
        send_metric "NginxRunning" 0
        HEALTH_SCORE=$((HEALTH_SCORE - 20))
    fi
    
    # Stereo Tool (optional)
    if pgrep -f "stereotool-relay.sh" > /dev/null; then
        log "  ✅ Stereo Tool running"
        send_metric "StereoToolRunning" 1
    else
        log "  ⚠️  Stereo Tool not running"
        send_metric "StereoToolRunning" 0
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Disk Space Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_disk() {
    log "💾 Checking disk space..."
    
    # Root filesystem
    ROOT_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    log "  Root (/): ${ROOT_USAGE}%"
    send_metric "DiskUsageRoot" $ROOT_USAGE "Percent"
    
    if [ $ROOT_USAGE -gt 80 ]; then
        log "  ⚠️  Root disk usage high!"
        HEALTH_SCORE=$((HEALTH_SCORE - 15))
    fi
    
    if [ $ROOT_USAGE -gt 90 ]; then
        log "  🚨 Root disk usage CRITICAL!"
        HEALTH_SCORE=$((HEALTH_SCORE - 20))
    fi
    
    # /tmp
    TMP_USAGE=$(df /tmp | tail -1 | awk '{print $5}' | sed 's/%//')
    log "  /tmp: ${TMP_USAGE}%"
    send_metric "DiskUsageTmp" $TMP_USAGE "Percent"
    
    # /var/log
    LOG_USAGE=$(df /var/log | tail -1 | awk '{print $5}' | sed 's/%//')
    log "  /var/log: ${LOG_USAGE}%"
    send_metric "DiskUsageLog" $LOG_USAGE "Percent"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. S3 Cache Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_s3_cache() {
    log "📦 Checking S3 cache..."
    
    CACHE_DIR="/tmp/radio-cache"
    if [ -d "$CACHE_DIR" ]; then
        FILE_COUNT=$(find $CACHE_DIR -type f | wc -l)
        log "  Cache files: $FILE_COUNT"
        send_metric "S3CacheFiles" $FILE_COUNT "Count"
        
        if [ $FILE_COUNT -gt 1000 ]; then
            log "  ⚠️  Cache file count high"
            HEALTH_SCORE=$((HEALTH_SCORE - 5))
        fi
        
        if [ $FILE_COUNT -gt 5000 ]; then
            log "  🚨 Cache file count CRITICAL - cleanup needed"
            HEALTH_SCORE=$((HEALTH_SCORE - 10))
            
            # Auto cleanup old files
            log "  🧹 Auto-cleaning files older than 7 days..."
            find $CACHE_DIR -type f -mtime +7 -delete
        fi
    else
        log "  ℹ️  Cache directory not found"
        send_metric "S3CacheFiles" 0 "Count"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Playlist Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_playlist() {
    log "📜 Checking playlist..."
    
    PLAYLIST_FILE="/tmp/current-playlist.txt"
    
    if [ ! -f "$PLAYLIST_FILE" ]; then
        log "  ❌ Playlist file not found!"
        send_metric "PlaylistEntries" 0 "Count"
        HEALTH_SCORE=$((HEALTH_SCORE - 25))
        return
    fi
    
    # Check file size
    FILE_SIZE=$(stat -f%z "$PLAYLIST_FILE" 2>/dev/null || stat -c%s "$PLAYLIST_FILE" 2>/dev/null || echo 0)
    if [ $FILE_SIZE -eq 0 ]; then
        log "  ❌ Playlist file is empty!"
        send_metric "PlaylistEntries" 0 "Count"
        HEALTH_SCORE=$((HEALTH_SCORE - 25))
        return
    fi
    
    # Check last modified time
    MODIFIED=$(stat -f "%m" "$PLAYLIST_FILE" 2>/dev/null || stat -c "%Y" "$PLAYLIST_FILE" 2>/dev/null)
    NOW=$(date +%s)
    AGE=$((NOW - MODIFIED))
    
    if [ $AGE -gt 600 ]; then
        log "  ⚠️  Playlist not updated in last 10 minutes"
        HEALTH_SCORE=$((HEALTH_SCORE - 10))
    fi
    
    # Count entries
    ENTRY_COUNT=$(wc -l < "$PLAYLIST_FILE")
    log "  Playlist entries: $ENTRY_COUNT"
    send_metric "PlaylistEntries" $ENTRY_COUNT "Count"
    
    if [ $ENTRY_COUNT -eq 0 ]; then
        log "  ❌ Playlist has no entries!"
        HEALTH_SCORE=$((HEALTH_SCORE - 20))
    elif [ $ENTRY_COUNT -lt 5 ]; then
        log "  ⚠️  Playlist has few entries"
        HEALTH_SCORE=$((HEALTH_SCORE - 5))
    else
        log "  ✅ Playlist OK"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Stream Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_stream() {
    log "🌊 Checking stream..."
    
    # Check Nginx endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
    if [ "$HTTP_CODE" = "200" ]; then
        log "  ✅ Nginx endpoint: HTTP $HTTP_CODE"
        send_metric "StreamAccessible" 1
    else
        log "  ❌ Nginx endpoint: HTTP $HTTP_CODE"
        send_metric "StreamAccessible" 0
        HEALTH_SCORE=$((HEALTH_SCORE - 20))
    fi
    
    # Check Icecast endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/)
    if [ "$HTTP_CODE" = "200" ]; then
        log "  ✅ Icecast endpoint: HTTP $HTTP_CODE"
    else
        log "  ❌ Icecast endpoint: HTTP $HTTP_CODE"
        HEALTH_SCORE=$((HEALTH_SCORE - 15))
    fi
    
    # Check stream content
    STREAM_TEST=$(curl -s --max-time 2 http://localhost:8000/stream.mp3 | head -c 100 | wc -c)
    if [ $STREAM_TEST -gt 0 ]; then
        log "  ✅ Stream delivering data"
    else
        log "  ❌ Stream not delivering data"
        HEALTH_SCORE=$((HEALTH_SCORE - 25))
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Log File Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

check_logs() {
    log "📝 Checking log files..."
    
    # Check Liquidsoap log
    if [ -f "/tmp/liquidsoap.log" ]; then
        LOG_SIZE=$(stat -f%z "/tmp/liquidsoap.log" 2>/dev/null || stat -c%s "/tmp/liquidsoap.log" 2>/dev/null)
        LOG_SIZE_MB=$((LOG_SIZE / 1024 / 1024))
        log "  Liquidsoap log: ${LOG_SIZE_MB}MB"
        
        if [ $LOG_SIZE_MB -gt 100 ]; then
            log "  ⚠️  Liquidsoap log size large"
        fi
        
        # Check for recent errors
        ERROR_COUNT=$(grep -c "ERROR" /tmp/liquidsoap.log | tail -100 || echo 0)
        if [ $ERROR_COUNT -gt 10 ]; then
            log "  ⚠️  $ERROR_COUNT errors in recent logs"
            HEALTH_SCORE=$((HEALTH_SCORE - 5))
        fi
    fi
    
    # Check log rotation is working
    if [ -f "/var/log/nginx/access.log.1.gz" ]; then
        log "  ✅ Log rotation working"
    else
        log "  ⚠️  Log rotation may not be configured"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Run All Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "╔════════════════════════════════════════╗"
log "║   🏥 Health Check Starting             ║"
log "╚════════════════════════════════════════╝"

check_processes
check_disk
check_s3_cache
check_playlist
check_stream
check_logs

# Ensure health score is within bounds
if [ $HEALTH_SCORE -lt 0 ]; then
    HEALTH_SCORE=0
fi

log ""
log "📊 Final Health Score: $HEALTH_SCORE/100"
send_metric "HealthScore" $HEALTH_SCORE "None"

if [ $HEALTH_SCORE -ge 80 ]; then
    log "✅ System Health: GOOD"
elif [ $HEALTH_SCORE -ge 50 ]; then
    log "⚠️  System Health: WARNING"
else
    log "🚨 System Health: CRITICAL"
fi

log "╚════════════════════════════════════════╝"

# Return exit code based on health
if [ $HEALTH_SCORE -ge 50 ]; then
    exit 0
else
    exit 1
fi
