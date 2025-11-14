#!/bin/bash

# 🐕 Splash FM Watchdog
# Auto-restart crashed services

LOGFILE="/var/log/splash-watchdog.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

log() {
    echo "[$TIMESTAMP] $1" | sudo tee -a $LOGFILE
}

restart_service() {
    local service=$1
    log "⚠️  $service is down! Auto-restarting..."
    
    case $service in
        liquidsoap)
            cd /opt/radio
            nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 </dev/null & disown
            sleep 3
            if pgrep -f "liquidsoap radio.liq" > /dev/null; then
                log "✅ $service restarted successfully"
                # Send CloudWatch metric
                aws cloudwatch put-metric-data \
                    --namespace "SplashFM" \
                    --metric-name "ServiceRestart" \
                    --value 1 \
                    --dimensions Service=$service 2>/dev/null || true
            else
                log "❌ Failed to restart $service"
            fi
            ;;
        
        icecast)
            sudo systemctl start icecast2
            sleep 2
            if systemctl is-active --quiet icecast2; then
                log "✅ $service restarted successfully"
            else
                log "❌ Failed to restart $service"
            fi
            ;;
        
        nginx)
            sudo systemctl start nginx
            sleep 1
            if systemctl is-active --quiet nginx; then
                log "✅ $service restarted successfully"
            else
                log "❌ Failed to restart $service"
            fi
            ;;
    esac
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check critical services
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check Liquidsoap
if ! pgrep -f "liquidsoap radio.liq" > /dev/null; then
    restart_service "liquidsoap"
fi

# Check Icecast
if ! systemctl is-active --quiet icecast2; then
    restart_service "icecast"
fi

# Check Nginx
if ! systemctl is-active --quiet nginx; then
    restart_service "nginx"
fi

# Check ports (using ss, fallback to netstat)
if command -v ss &> /dev/null; then
    if ! ss -tuln | grep -q ":8000 "; then
        log "⚠️  Port 8000 not listening - Icecast may be down"
        restart_service "icecast"
    fi
    
    if ! ss -tuln | grep -q ":80 "; then
        log "⚠️  Port 80 not listening - Nginx may be down"
        restart_service "nginx"
    fi
elif command -v netstat &> /dev/null; then
    if ! netstat -tuln | grep -q ":8000 "; then
        log "⚠️  Port 8000 not listening - Icecast may be down"
        restart_service "icecast"
    fi
    
    if ! netstat -tuln | grep -q ":80 "; then
        log "⚠️  Port 80 not listening - Nginx may be down"
        restart_service "nginx"
    fi
fi

# Send alive metric to CloudWatch
aws cloudwatch put-metric-data \
    --namespace "SplashFM" \
    --metric-name "WatchdogAlive" \
    --value 1 \
    --dimensions Instance=radio-ec2 2>/dev/null || true
