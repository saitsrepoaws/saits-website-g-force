#!/bin/bash

# 🎛️ Splash FM Service Manager
# Manages all radio services (start/stop/restart/status)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔧 Service Control Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

start_icecast() {
    echo -e "${BLUE}Starting Icecast2...${NC}"
    if systemctl is-active --quiet icecast2; then
        echo -e "${YELLOW}  Already running${NC}"
    else
        sudo systemctl start icecast2
        sleep 2
        if systemctl is-active --quiet icecast2; then
            echo -e "${GREEN}  ✅ Started${NC}"
        else
            echo -e "${RED}  ❌ Failed to start${NC}"
            return 1
        fi
    fi
}

start_liquidsoap() {
    echo -e "${BLUE}Starting Liquidsoap...${NC}"
    if pgrep -f "liquidsoap radio.liq" > /dev/null; then
        echo -e "${YELLOW}  Already running${NC}"
    else
        cd /opt/radio
        nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 </dev/null & disown
        sleep 3
        if pgrep -f "liquidsoap radio.liq" > /dev/null; then
            echo -e "${GREEN}  ✅ Started${NC}"
        else
            echo -e "${RED}  ❌ Failed to start${NC}"
            return 1
        fi
    fi
}

start_stereotool() {
    echo -e "${BLUE}Starting Stereo Tool...${NC}"
    if pgrep -f "stereotool-relay.sh" > /dev/null; then
        echo -e "${YELLOW}  Already running${NC}"
    else
        nohup sudo /usr/local/bin/stereotool-relay.sh > /tmp/stereotool.log 2>&1 </dev/null & disown
        sleep 2
        if pgrep -f "stereotool-relay.sh" > /dev/null; then
            echo -e "${GREEN}  ✅ Started${NC}"
        else
            echo -e "${YELLOW}  ⚠️  Check if needed${NC}"
        fi
    fi
}

start_nginx() {
    echo -e "${BLUE}Starting Nginx...${NC}"
    if systemctl is-active --quiet nginx; then
        echo -e "${YELLOW}  Already running${NC}"
    else
        sudo systemctl start nginx
        sleep 1
        if systemctl is-active --quiet nginx; then
            echo -e "${GREEN}  ✅ Started${NC}"
        else
            echo -e "${RED}  ❌ Failed to start${NC}"
            return 1
        fi
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

stop_nginx() {
    echo -e "${BLUE}Stopping Nginx...${NC}"
    if systemctl is-active --quiet nginx; then
        sudo systemctl stop nginx
        echo -e "${GREEN}  ✅ Stopped${NC}"
    else
        echo -e "${YELLOW}  Not running${NC}"
    fi
}

stop_stereotool() {
    echo -e "${BLUE}Stopping Stereo Tool...${NC}"
    if pgrep -f "stereotool-relay.sh" > /dev/null; then
        sudo pkill -f "stereotool-relay.sh"
        sleep 1
        echo -e "${GREEN}  ✅ Stopped${NC}"
    else
        echo -e "${YELLOW}  Not running${NC}"
    fi
}

stop_liquidsoap() {
    echo -e "${BLUE}Stopping Liquidsoap...${NC}"
    if pgrep -f "liquidsoap radio.liq" > /dev/null; then
        sudo pkill -9 -f "liquidsoap radio.liq"
        sleep 2
        echo -e "${GREEN}  ✅ Stopped${NC}"
    else
        echo -e "${YELLOW}  Not running${NC}"
    fi
}

stop_icecast() {
    echo -e "${BLUE}Stopping Icecast2...${NC}"
    if systemctl is-active --quiet icecast2; then
        sudo systemctl stop icecast2
        echo -e "${GREEN}  ✅ Stopped${NC}"
    else
        echo -e "${YELLOW}  Not running${NC}"
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

status_all() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     🎙️  Service Status Check         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    local all_ok=true
    
    # Icecast
    echo -n "Icecast2:      "
    if systemctl is-active --quiet icecast2; then
        echo -e "${GREEN}✅ Running${NC}"
    else
        echo -e "${RED}❌ Stopped${NC}"
        all_ok=false
    fi
    
    # Liquidsoap
    echo -n "Liquidsoap:    "
    if pgrep -f "liquidsoap radio.liq" > /dev/null; then
        PID=$(pgrep -f "liquidsoap radio.liq")
        echo -e "${GREEN}✅ Running (PID: $PID)${NC}"
    else
        echo -e "${RED}❌ Stopped${NC}"
        all_ok=false
    fi
    
    # Stereo Tool
    echo -n "Stereo Tool:   "
    if pgrep -f "stereotool-relay.sh" > /dev/null; then
        PID=$(pgrep -f "stereotool-relay.sh")
        echo -e "${GREEN}✅ Running (PID: $PID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Stopped${NC}"
    fi
    
    # Nginx
    echo -n "Nginx:         "
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Running${NC}"
    else
        echo -e "${RED}❌ Stopped${NC}"
        all_ok=false
    fi
    
    echo ""
    
    # Port checks
    echo -e "${BLUE}Port Status:${NC}"
    echo -n "  Port 8000:   "
    if netstat -tuln | grep -q ":8000 "; then
        echo -e "${GREEN}✅ Listening${NC}"
    else
        echo -e "${RED}❌ Not listening${NC}"
        all_ok=false
    fi
    
    echo -n "  Port 80:     "
    if netstat -tuln | grep -q ":80 "; then
        echo -e "${GREEN}✅ Listening${NC}"
    else
        echo -e "${RED}❌ Not listening${NC}"
        all_ok=false
    fi
    
    echo ""
    
    if $all_ok; then
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║     ✅ ALL SERVICES HEALTHY           ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        return 0
    else
        echo -e "${RED}╔════════════════════════════════════════╗${NC}"
        echo -e "${RED}║     ⚠️  SOME SERVICES DOWN            ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════╝${NC}"
        return 1
    fi
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🚀 Main
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMAND=${1:-status}

case $COMMAND in
    start)
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║     🚀 Starting All Services          ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        echo ""
        
        start_icecast
        echo ""
        start_liquidsoap
        echo ""
        start_stereotool
        echo ""
        start_nginx
        
        echo ""
        echo -e "${GREEN}✅ Startup sequence complete${NC}"
        echo ""
        
        sleep 2
        status_all
        ;;
    
    stop)
        echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║     🛑 Stopping All Services          ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
        echo ""
        
        stop_nginx
        echo ""
        stop_stereotool
        echo ""
        stop_liquidsoap
        echo ""
        stop_icecast
        
        echo ""
        echo -e "${GREEN}✅ Shutdown sequence complete${NC}"
        ;;
    
    restart)
        echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║     🔄 Restarting All Services        ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
        echo ""
        
        $0 stop
        echo ""
        sleep 3
        $0 start
        ;;
    
    status)
        status_all
        ;;
    
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo ""
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Check service status"
        exit 1
        ;;
esac
