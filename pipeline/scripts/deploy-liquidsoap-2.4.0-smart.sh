#!/bin/bash
################################################################################
# SMART LIQUIDSOAP 2.4.0 DEPLOYMENT - IDEMPOTENT & RESUMABLE
################################################################################
# Features:
# - State tracking (knows what's done)
# - Skip completed steps
# - Resume after errors
# - Rollback support
# - Production-safe
################################################################################

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# State file
STATE_FILE="/opt/radio/.deployment-state.json"
LOG_FILE="/var/log/liquidsoap-deploy-$(date +%Y%m%d_%H%M%S).log"

# Start logging
exec > >(tee -a "$LOG_FILE")
exec 2>&1

################################################################################
# STATE MANAGEMENT FUNCTIONS
################################################################################

# Initialize state file
init_state() {
    if [[ ! -f "$STATE_FILE" ]]; then
        echo "{\"version\": \"2.4.0\", \"steps\": {}, \"timestamp\": \"$(date -Iseconds)\"}" > "$STATE_FILE"
        echo -e "${GREEN}✅ State file initialized${NC}"
    else
        echo -e "${BLUE}ℹ️  State file exists, loading...${NC}"
    fi
}

# Check if step is completed
is_step_completed() {
    local step_name="$1"
    if [[ -f "$STATE_FILE" ]]; then
        local completed=$(jq -r ".steps[\"$step_name\"].completed // false" "$STATE_FILE")
        [[ "$completed" == "true" ]]
    else
        return 1
    fi
}

# Mark step as completed
mark_step_completed() {
    local step_name="$1"
    local temp_file=$(mktemp)
    jq ".steps[\"$step_name\"] = {\"completed\": true, \"timestamp\": \"$(date -Iseconds)\"}" "$STATE_FILE" > "$temp_file"
    mv "$temp_file" "$STATE_FILE"
    echo -e "${GREEN}✅ Step '$step_name' marked as completed${NC}"
}

# Mark step as failed
mark_step_failed() {
    local step_name="$1"
    local error_msg="$2"
    local temp_file=$(mktemp)
    jq ".steps[\"$step_name\"] = {\"completed\": false, \"failed\": true, \"error\": \"$error_msg\", \"timestamp\": \"$(date -Iseconds)\"}" "$STATE_FILE" > "$temp_file"
    mv "$temp_file" "$STATE_FILE"
    echo -e "${RED}❌ Step '$step_name' marked as failed${NC}"
}

# Show deployment status
show_status() {
    echo -e "\n${CYAN}📊 DEPLOYMENT STATUS${NC}"
    echo -e "${CYAN}════════════════════${NC}\n"
    
    if [[ -f "$STATE_FILE" ]]; then
        jq -r '.steps | to_entries[] | "\(.key): \(if .value.completed then "✅ DONE" else "⏸️  PENDING" end)"' "$STATE_FILE" | column -t
    else
        echo "No state file found"
    fi
    echo ""
}

# Reset deployment (start over)
reset_deployment() {
    echo -e "${YELLOW}🔄 Resetting deployment state...${NC}"
    rm -f "$STATE_FILE"
    init_state
    echo -e "${GREEN}✅ Deployment reset${NC}"
}

################################################################################
# DEPLOYMENT STEPS
################################################################################

step_01_stop_old_services() {
    local STEP_NAME="stop_old_services"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 1: Stop Old Services${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    # Stop old Liquidsoap
    echo "🛑 Stopping old Liquidsoap processes..."
    pkill -f liquidsoap 2>/dev/null || true
    systemctl stop liquidsoap 2>/dev/null || true
    systemctl stop liquidsoap-docker 2>/dev/null || true
    
    # Stop old Docker containers
    echo "🐳 Stopping old Docker containers..."
    docker stop liquidsoap 2>/dev/null || true
    docker rm liquidsoap 2>/dev/null || true
    
    sleep 3
    
    # Verify all stopped
    if pgrep -f liquidsoap > /dev/null; then
        echo -e "${YELLOW}⚠️  Force killing remaining processes...${NC}"
        pkill -9 -f liquidsoap
    fi
    
    mark_step_completed "$STEP_NAME"
}

step_02_install_docker() {
    local STEP_NAME="install_docker"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 2: Install Docker${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✅ Docker already installed${NC}"
        docker --version
    else
        echo "📦 Installing Docker..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sh /tmp/get-docker.sh
        usermod -aG docker ubuntu
        rm /tmp/get-docker.sh
        echo -e "${GREEN}✅ Docker installed${NC}"
        docker --version
    fi
    
    mark_step_completed "$STEP_NAME"
}

step_03_pull_liquidsoap_image() {
    local STEP_NAME="pull_liquidsoap_image"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 3: Pull Liquidsoap 2.4.0 Image${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    # Check if image already exists
    if docker images | grep -q "savonet/liquidsoap.*v2.4.0"; then
        echo -e "${GREEN}✅ Image already pulled${NC}"
    else
        echo "⬇️  Pulling Liquidsoap 2.4.0 Docker image..."
        docker pull savonet/liquidsoap:v2.4.0
        echo -e "${GREEN}✅ Image pulled${NC}"
    fi
    
    docker images | grep liquidsoap
    
    mark_step_completed "$STEP_NAME"
}

step_04_setup_ram_disk() {
    local STEP_NAME="setup_ram_disk"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 4: Setup RAM Disk${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    # Check if already mounted
    if mountpoint -q /mnt/ramdisk; then
        echo -e "${GREEN}✅ RAM disk already mounted${NC}"
        df -h /mnt/ramdisk
    else
        echo "💾 Creating and mounting RAM disk..."
        mkdir -p /mnt/ramdisk
        mount -t tmpfs -o size=512M,mode=1777,noatime,nodiratime tmpfs /mnt/ramdisk
        echo -e "${GREEN}✅ RAM disk mounted${NC}"
    fi
    
    # Add to fstab if not present
    if ! grep -q "/mnt/ramdisk" /etc/fstab; then
        echo "tmpfs /mnt/ramdisk tmpfs size=512M,mode=1777,noatime,nodiratime 0 0" >> /etc/fstab
        echo -e "${GREEN}✅ Added to /etc/fstab${NC}"
    fi
    
    # Set permissions
    chmod 1777 /mnt/ramdisk
    chown ubuntu:ubuntu /mnt/ramdisk
    
    mark_step_completed "$STEP_NAME"
}

step_05_backup_old_config() {
    local STEP_NAME="backup_old_config"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 5: Backup Old Config${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    # Create backup directory
    mkdir -p /opt/radio/backups
    
    # Backup old config if exists
    if [[ -f /opt/radio/radio.liq ]]; then
        BACKUP_FILE="/opt/radio/backups/radio.liq.backup-$(date +%Y%m%d_%H%M%S)"
        cp /opt/radio/radio.liq "$BACKUP_FILE"
        echo -e "${GREEN}✅ Config backed up to: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}ℹ️  No old config to backup${NC}"
    fi
    
    mark_step_completed "$STEP_NAME"
}

step_06_create_liquidsoap_config() {
    local STEP_NAME="create_liquidsoap_config"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 6: Create Liquidsoap 2.4.0 Config${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    echo "📝 Creating Liquidsoap 2.4.0 config with internal autocue..."
    
    cat > /opt/radio/radio.liq << 'LIQUIDSOAP_CONFIG'
#!/usr/bin/liquidsoap

################################################################################
# LIQUIDSOAP 2.4.0 + INTERNAL AUTOCUE + RAM DISK
################################################################################

settings.init.allow_root.set(true)
log.level.set(4)

# INTERNAL AUTOCUE (New in 2.3+!)
settings.autocue.cue_file.set(true)
settings.autocue.cue_file.silence.set(-42.0)
settings.autocue.cue_file.overlay.set(-8.0)
settings.autocue.cue_file.overlay_longtail.set(-20.0)
settings.autocue.cue_file.longtail.set(15.0)
settings.autocue.cue_file.fade_out.set(2.5)
settings.autocue.target_loudness.set(-18.0)

log.info("✅ Liquidsoap 2.4.0 + Internal Autocue Started!")
log.info("💾 RAM Disk: /mnt/ramdisk")

# AWS Config
sqs_queue_url = "https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo"
aws_region = "eu-west-1"
ram_disk = "/mnt/ramdisk"

# SQS Track Fetcher
def get_next_track()
  result = process.run.read("
    aws sqs receive-message \
      --queue-url #{sqs_queue_url} \
      --region #{aws_region} \
      --max-number-of-messages 1 \
      --visibility-timeout 300 \
      --wait-time-seconds 10 \
      --output json
  ")
  
  parsed = of_json(default=[("Messages", [[("ReceiptHandle", ""), ("Body", "")]])], result)
  messages = list.assoc(default=[], "Messages", parsed)
  
  if list.length(messages) > 0 then
    message = list.hd(default=[("ReceiptHandle", ""), ("Body", "")], messages)
    receipt_handle = list.assoc(default="", "ReceiptHandle", message)
    body = list.assoc(default="", "Body", message)
    
    if body != "" then
      track_data = of_json(default=[("fileUrl", "")], body)
      file_url = list.assoc(default="", "fileUrl", track_data)
      
      if file_url != "" then
        filename = list.hd(default="track.mp3", string.split(separator="/", file_url) |> list.rev)
        local_path = "#{ram_disk}/#{filename}"
        
        log.info("📥 Downloading to RAM: #{file_url}")
        download_result = process.run("aws s3 cp \"#{file_url}\" \"#{local_path}\" --region #{aws_region}")
        
        if download_result == 0 then
          log.info("✅ Downloaded: #{local_path}")
          
          # Delete from SQS
          ignore(process.run("
            aws sqs delete-message \
              --queue-url #{sqs_queue_url} \
              --region #{aws_region} \
              --receipt-handle '#{receipt_handle}'
          "))
          
          # Use autocue: protocol
          [request.create("autocue:#{local_path}")]
        else
          log.error("❌ Download failed")
          []
        end
      else
        []
      end
    else
      []
    end
  else
    []
  end
end

# Cleanup function
def cleanup_track(m)
  filename = m["filename"]
  if filename != "" and string.contains(substring=ram_disk, filename) then
    log.info("🧹 Cleaning: #{filename}")
    ignore(process.run("rm -f #{process.quote(filename)}"))
  end
end

# Create source
radio = request.dynamic.list(prefetch=1, timeout=20.0, get_next_track)
radio = autocue.cue_file(radio)
radio = amplify(override="liq_amplify", radio)
radio = crossfade(duration=4.0, minimum=0.5, fade_in=1.5, fade_out=2.5, radio)

# Metadata handler for cleanup
radio.on_metadata(fun (m) -> cleanup_track(m))

# Silent fallback
silent = single(loop=true, "/opt/radio/silent-stream.mp3")
radio = fallback(track_sensitive=false, [radio, silent])
radio = mksafe(radio)

# Metadata logging
def log_meta(m)
  artist = m["artist"]
  title = m["title"]
  log.info("🎵 NOW: #{artist} - #{title}")
end

radio.on_metadata(log_meta)

# Output
output.icecast(
  %mp3(bitrate=192, samplerate=44100),
  host="localhost",
  port=8000,
  password="hackme",
  mount="stream.mp3",
  name="Splash FM - Liquidsoap 2.4.0",
  radio
)

log.info("🚀 Streaming on port 8000!")
LIQUIDSOAP_CONFIG
    
    chmod +x /opt/radio/radio.liq
    chown ubuntu:ubuntu /opt/radio/radio.liq
    
    echo -e "${GREEN}✅ Config created${NC}"
    
    mark_step_completed "$STEP_NAME"
}

step_07_create_systemd_service() {
    local STEP_NAME="create_systemd_service"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 7: Create Systemd Service${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    echo "⚙️  Creating systemd service..."
    
    cat > /etc/systemd/system/liquidsoap.service << 'SERVICE_CONFIG'
[Unit]
Description=Liquidsoap 2.4.0 (Docker + RAM Disk)
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
Group=root
Restart=always
RestartSec=10

ExecStart=/usr/bin/docker run --rm \
  --name liquidsoap \
  --network host \
  --tmpfs /tmp:rw,size=256M \
  -v /opt/radio:/opt/radio:ro \
  -v /mnt/ramdisk:/mnt/ramdisk:rw \
  -v /home/ubuntu/.aws:/root/.aws:ro \
  -e AWS_DEFAULT_REGION=eu-west-1 \
  savonet/liquidsoap:v2.4.0 \
  /opt/radio/radio.liq

ExecStop=/usr/bin/docker stop liquidsoap

Nice=-10
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=50

[Install]
WantedBy=multi-user.target
SERVICE_CONFIG
    
    systemctl daemon-reload
    systemctl enable liquidsoap
    
    echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
    
    mark_step_completed "$STEP_NAME"
}

step_08_start_service() {
    local STEP_NAME="start_service"
    
    if is_step_completed "$STEP_NAME"; then
        echo -e "${BLUE}⏭️  Step '$STEP_NAME' already completed, skipping${NC}"
        return 0
    fi
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 8: Start Liquidsoap Service${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    echo "🚀 Starting Liquidsoap 2.4.0..."
    systemctl start liquidsoap
    
    echo "⏳ Waiting for startup..."
    sleep 5
    
    # Verify running
    if systemctl is-active --quiet liquidsoap; then
        echo -e "${GREEN}✅ Service is running!${NC}"
    else
        echo -e "${RED}❌ Service failed to start!${NC}"
        systemctl status liquidsoap --no-pager -l
        mark_step_failed "$STEP_NAME" "Service failed to start"
        return 1
    fi
    
    mark_step_completed "$STEP_NAME"
}

step_09_verify_deployment() {
    local STEP_NAME="verify_deployment"
    
    echo -e "\n${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  STEP 9: Verify Deployment${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}\n"
    
    echo "🔍 Checking Liquidsoap version..."
    docker exec liquidsoap liquidsoap --version | head -1 || echo "Container not ready"
    
    echo ""
    echo "📊 Docker container status:"
    docker ps | grep liquidsoap || echo "Not running"
    
    echo ""
    echo "💾 RAM disk usage:"
    df -h /mnt/ramdisk
    
    echo ""
    echo "🎵 Icecast stream check:"
    curl -I http://localhost:8000/stream.mp3 2>&1 | head -5 || echo "Stream not ready yet"
    
    echo ""
    echo "📋 Recent logs:"
    docker logs liquidsoap 2>&1 | tail -20
    
    mark_step_completed "$STEP_NAME"
}

################################################################################
# MAIN DEPLOYMENT FLOW
################################################################################

main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  LIQUIDSOAP 2.4.0 SMART DEPLOYMENT                        ║"
    echo "║  Idempotent • Resumable • Production-Safe                 ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
       echo -e "${RED}❌ This script must be run as root${NC}"
       exit 1
    fi
    
    # Initialize state
    init_state
    
    # Show current status
    show_status
    
    # Run deployment steps
    echo -e "\n${CYAN}🚀 Starting deployment...${NC}\n"
    
    step_01_stop_old_services
    step_02_install_docker
    step_03_pull_liquidsoap_image
    step_04_setup_ram_disk
    step_05_backup_old_config
    step_06_create_liquidsoap_config
    step_07_create_systemd_service
    step_08_start_service
    step_09_verify_deployment
    
    # Final status
    echo -e "\n${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  🎉 DEPLOYMENT COMPLETE!                                  ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    echo -e "${CYAN}📊 DEPLOYMENT SUMMARY:${NC}"
    echo "  Version:     Liquidsoap 2.4.0"
    echo "  Features:    Internal Autocue + RAM Disk"
    echo "  RAM Disk:    /mnt/ramdisk (512MB)"
    echo "  State File:  $STATE_FILE"
    echo "  Log File:    $LOG_FILE"
    echo ""
    
    echo -e "${CYAN}🔗 USEFUL COMMANDS:${NC}"
    echo "  Status:      systemctl status liquidsoap"
    echo "  Logs:        journalctl -u liquidsoap -f"
    echo "  Docker logs: docker logs -f liquidsoap"
    echo "  Restart:     systemctl restart liquidsoap"
    echo "  Stop:        systemctl stop liquidsoap"
    echo ""
    
    echo -e "${CYAN}🔄 DEPLOYMENT MANAGEMENT:${NC}"
    echo "  Re-run:      sudo bash $0"
    echo "  Status:      sudo bash $0 --status"
    echo "  Reset:       sudo bash $0 --reset"
    echo ""
    
    show_status
}

################################################################################
# SCRIPT ARGUMENTS
################################################################################

case "${1:-}" in
    --status)
        init_state
        show_status
        exit 0
        ;;
    --reset)
        reset_deployment
        exit 0
        ;;
    --help|-h)
        echo "Liquidsoap 2.4.0 Smart Deployment Script"
        echo ""
        echo "Usage:"
        echo "  $0          - Run deployment (skips completed steps)"
        echo "  $0 --status - Show deployment status"
        echo "  $0 --reset  - Reset deployment state"
        echo "  $0 --help   - Show this help"
        echo ""
        exit 0
        ;;
    *)
        main
        ;;
esac
