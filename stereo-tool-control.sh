#!/bin/bash
# Stereo Tool Remote Control Script
# Usage: ./stereo-tool-control.sh [start|stop|restart|status|logs]

SSH_HOST="radio-ec2"

case "$1" in
  start)
    echo "🟢 Starting Stereo Tool processing..."
    ssh $SSH_HOST "sudo systemctl start stereotool-relay.service"
    echo "✅ Started! Waiting for pipeline..."
    sleep 5
    ssh $SSH_HOST "systemctl is-active stereotool-relay.service && echo '✅ Stereo Tool is RUNNING' || echo '❌ Failed to start'"
    ;;
    
  stop)
    echo "🔴 Stopping Stereo Tool processing..."
    ssh $SSH_HOST "sudo systemctl stop stereotool-relay.service"
    echo "✅ Stopped!"
    ssh $SSH_HOST "systemctl is-active stereotool-relay.service && echo '⚠️  Still running?' || echo '✅ Stereo Tool is STOPPED'"
    ;;
    
  restart)
    echo "🔄 Restarting Stereo Tool processing..."
    ssh $SSH_HOST "sudo systemctl restart stereotool-relay.service"
    echo "✅ Restarted! Waiting for pipeline..."
    sleep 5
    ssh $SSH_HOST "systemctl is-active stereotool-relay.service && echo '✅ Stereo Tool is RUNNING' || echo '❌ Failed to restart'"
    ;;
    
  status)
    echo "📊 Stereo Tool Status:"
    echo ""
    ssh $SSH_HOST "systemctl status stereotool-relay.service --no-pager | head -15"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Available streams:"
    ssh $SSH_HOST "curl -s http://localhost:8000/status-json.xsl 2>/dev/null | jq -r '.icestats.source[] | \"  ✅ \(.server_name) - \(.listenurl)\"'"
    ;;
    
  logs)
    echo "📝 Live logs (Ctrl+C to exit):"
    echo ""
    ssh $SSH_HOST "tail -f /var/log/stereotool-relay.log"
    ;;
    
  *)
    cat << 'HELP'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎛️ STEREO TOOL CONTROL SCRIPT                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  ./stereo-tool-control.sh [command]

Commands:
  start      🟢 Start Stereo Tool processing
  stop       🔴 Stop Stereo Tool processing
  restart    🔄 Restart Stereo Tool processing
  status     📊 Check current status
  logs       📝 View live logs

Examples:
  ./stereo-tool-control.sh start
  ./stereo-tool-control.sh status
  ./stereo-tool-control.sh logs

Features:
  ✅ Zero downtime switching
  ✅ Raw stream blijft altijd werken
  ✅ Geen Liquidsoap restart nodig
  ✅ Remote control van lokaal

Stream URLs:
  Processed: http://46.137.184.91:8000/stream-processed.mp3
  Raw:       http://46.137.184.91:8000/stream-raw.mp3
  Main:      http://46.137.184.91:8000/stream.mp3
HELP
    ;;
esac
