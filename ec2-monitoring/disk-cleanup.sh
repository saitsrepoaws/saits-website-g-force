#!/bin/bash

# 🧹 Splash FM Disk Cleanup
# Automated disk space management

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOGFILE="/var/log/splash-cleanup.log"

log() {
    echo "[$TIMESTAMP] $1" | sudo tee -a $LOGFILE
}

log "╔════════════════════════════════════════╗"
log "║   🧹 Disk Cleanup Starting             ║"
log "╚════════════════════════════════════════╝"

# Check disk space before
BEFORE=$(df / | tail -1 | awk '{print $5}')
log "Disk usage before: $BEFORE"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Clean S3 cache files older than 7 days
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -d "/tmp/radio-cache" ]; then
    log "Cleaning S3 cache files older than 7 days..."
    DELETED=$(find /tmp/radio-cache -type f -mtime +7 -delete -print | wc -l)
    log "  Deleted $DELETED cache files"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Clean old compressed logs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Cleaning old compressed logs..."

# Nginx logs older than 30 days
if [ -d "/var/log/nginx" ]; then
    DELETED=$(sudo find /var/log/nginx -name "*.gz" -mtime +30 -delete -print | wc -l)
    log "  Deleted $DELETED old Nginx logs"
fi

# Icecast logs older than 14 days
if [ -d "/var/log/icecast2" ]; then
    DELETED=$(sudo find /var/log/icecast2 -name "*.log.*" -mtime +14 -delete -print | wc -l)
    log "  Deleted $DELETED old Icecast logs"
fi

# Splash logs older than 30 days
if [ -d "/var/log" ]; then
    DELETED=$(sudo find /var/log -name "splash-*.log.*" -mtime +30 -delete -print | wc -l)
    log "  Deleted $DELETED old Splash logs"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Clean /tmp files older than 3 days
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Cleaning old /tmp files..."
DELETED=$(sudo find /tmp -type f -mtime +3 ! -name "liquidsoap.log" ! -name "stereotool.log" -delete -print 2>/dev/null | wc -l)
log "  Deleted $DELETED old /tmp files"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Clean core dumps
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Cleaning core dumps..."
DELETED=$(sudo find / -name "core.*" -type f -delete -print 2>/dev/null | wc -l)
log "  Deleted $DELETED core dumps"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Clean old backups (older than 30 days)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -d "/tmp/config-backup-*" ]; then
    log "Cleaning old config backups..."
    DELETED=$(sudo find /tmp -type d -name "config-backup-*" -mtime +30 -exec rm -rf {} \; -print 2>/dev/null | wc -l)
    log "  Deleted $DELETED old backups"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Truncate large Liquidsoap log if needed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -f "/tmp/liquidsoap.log" ]; then
    LOG_SIZE=$(stat -f%z "/tmp/liquidsoap.log" 2>/dev/null || stat -c%s "/tmp/liquidsoap.log" 2>/dev/null)
    LOG_SIZE_MB=$((LOG_SIZE / 1024 / 1024))
    
    if [ $LOG_SIZE_MB -gt 200 ]; then
        log "Liquidsoap log too large (${LOG_SIZE_MB}MB), rotating..."
        sudo mv /tmp/liquidsoap.log /tmp/liquidsoap.log.old
        sudo touch /tmp/liquidsoap.log
        sudo chown liquidsoap:liquidsoap /tmp/liquidsoap.log 2>/dev/null || true
        log "  Log rotated"
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. Clean APT cache
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Cleaning APT cache..."
sudo apt-get clean 2>/dev/null || true
log "  APT cache cleaned"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check disk space after
AFTER=$(df / | tail -1 | awk '{print $5}')
log ""
log "Disk usage after: $AFTER"
log "Cleanup complete!"
log "╚════════════════════════════════════════╝"

# Send metric to CloudWatch
AFTER_NUM=$(echo $AFTER | sed 's/%//')
aws cloudwatch put-metric-data \
    --namespace "SplashFM" \
    --metric-name "DiskCleanupRan" \
    --value 1 \
    --dimensions Type=scheduled 2>/dev/null || true
