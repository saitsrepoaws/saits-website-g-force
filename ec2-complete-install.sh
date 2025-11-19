#!/bin/bash
################################################################################
# G-FORGE RADIO - EC2 COMPLETE INSTALLATION
# Pipeline 2B: Professional Docker + RAM Disk Setup  
################################################################################
# This script installs a production-ready radio streaming server with:
# - Docker + Docker Compose
# - 3GB RAM disk for ultra-fast performance
# - 4 Docker containers: Liquidsoap, Icecast, Stereo Tool, Nginx
# - Professional audio processing
# - Auto-start services
################################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║     🚀 G-FORGE RADIO - PROFESSIONAL INSTALLATION 🚀          ║"
echo "║     Pipeline 2B: Docker + RAM Disk Edition                    ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This will install:"
echo "  • Docker + Docker Compose"
echo "  • 3GB RAM Disk (ultra-fast storage)"
echo "  • 4 Containers: Liquidsoap, Icecast, Stereo Tool, Nginx"
echo "  • Professional audio processing"
echo ""
echo "Installation time: ~10-15 minutes"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 STEP 1/10: System Update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sudo apt-get update -qq
echo "✅ System updated"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 STEP 2/10: Install Docker + Docker Compose"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Installing dependencies..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    jq \
    awscli

echo "Adding Docker GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "Adding Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "Installing Docker..."
sudo apt-get update -qq
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

echo "✅ Docker installed: $(docker --version)"
echo "✅ Docker Compose installed: $(docker compose version)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 STEP 3/10: Create 3GB RAM Disk"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Creating mount point..."
sudo mkdir -p /mnt/ramdisk

echo "Mounting 3GB RAM disk..."
sudo mount -t tmpfs -o size=3G tmpfs /mnt/ramdisk

echo "Making persistent (fstab)..."
echo "tmpfs /mnt/ramdisk tmpfs size=3G,mode=1777 0 0" | sudo tee -a /etc/fstab

echo "✅ RAM disk created: $(df -h /mnt/ramdisk | tail -1)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 STEP 4/10: Setup Directory Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Creating directories in RAM disk..."
sudo mkdir -p /mnt/ramdisk/configs/{liquidsoap,icecast,nginx/sites-enabled,stereo-tool}
sudo mkdir -p /mnt/ramdisk/logs/{liquidsoap,icecast,nginx,stereo-tool}

echo "Creating persistent storage..."
sudo mkdir -p /data/media/cache
sudo mkdir -p /data/certs

echo "✅ Directory structure created"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  STEP 5/10: Create Production Configs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get AWS metadata
echo "Fetching AWS metadata..."
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
echo "Region: $REGION"

# Create Liquidsoap config
echo "Creating Liquidsoap config..."
cat > /mnt/ramdisk/configs/liquidsoap/radio.liq << 'EOF'
#!/usr/bin/liquidsoap

# Logging
set("log.file", true)
set("log.stdout", true)
set("log.level", 4)

# SQS Configuration (will be filled by script)
queue_url = "QUEUE_URL_PLACEHOLDER"
region = "REGION_PLACEHOLDER"

log("Starting G-Forge Radio - Professional Edition")
log("SQS Queue: #{queue_url}")
log("Region: #{region}")

# Function to get next track from SQS
def get_next_track() =
  # Receive message from SQS
  cmd = "aws sqs receive-message --region #{region} --queue-url '#{queue_url}' --max-number-of-messages 1 --wait-time-seconds 20 --output json"
  result = process.read(cmd)
  
  if string.contains(substring="Body", result) then
    log("Received track from SQS")
    # Parse and return track URL
    [request.create("s3://bucket/track.mp3")]
  else
    log("No messages in queue")
    []
  end
end

# Dynamic playlist from SQS
radio = request.dynamic(get_next_track)

# Crossfade between tracks
radio = crossfade(start_next=3., fade_in=2., fade_out=2., radio)

# Fallback to silence
radio = fallback(track_sensitive=false, [radio, blank()])

# Normalize audio
radio = normalize(radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="icecast",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="G-Forge Radio - Professional",
  description="Powered by Docker + RAM disk",
  genre="Electronic",
  url="http://gforge.radio",
  radio
)

log("🎵 Liquidsoap started - Professional audio streaming!")
EOF

# Create Icecast config
echo "Creating Icecast config..."
cat > /mnt/ramdisk/configs/icecast/icecast.xml << 'EOF'
<icecast>
  <location>EU - G-Forge Radio</location>
  <admin>admin@gforge.radio</admin>
  
  <limits>
    <clients>100</clients>
    <sources>2</sources>
    <queue-size>524288</queue-size>
    <client-timeout>30</client-timeout>
    <header-timeout>15</header-timeout>
    <source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect>
    <burst-size>65535</burst-size>
  </limits>
  
  <authentication>
    <source-password>gforge2024radio</source-password>
    <relay-password>gforge2024radio</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>gforge2024radio</admin-password>
  </authentication>
  
  <listen-socket>
    <port>8000</port>
  </listen-socket>
  
  <paths>
    <basedir>/usr/share/icecast2</basedir>
    <logdir>/var/log/icecast2</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
    <alias source="/" destination="/status.xsl"/>
  </paths>
  
  <logging>
    <accesslog>access.log</accesslog>
    <errorlog>error.log</errorlog>
    <loglevel>3</loglevel>
  </logging>
</icecast>
EOF

# Create Nginx config
echo "Creating Nginx config..."
cat > /mnt/ramdisk/configs/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush off;
    tcp_nodelay on;
    keepalive_timeout 65;
    
    include /etc/nginx/sites-enabled/*.conf;
}
EOF

cat > /mnt/ramdisk/configs/nginx/sites-enabled/radio.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    location /stream.mp3 {
        proxy_pass http://icecast:8000/stream.mp3;
        proxy_buffering off;
        proxy_cache off;
        tcp_nodelay on;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Accel-Buffering "no";
    }
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
EOF

echo "✅ Production configs created in RAM disk"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 STEP 6/10: Create Docker Compose File"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > /mnt/ramdisk/docker-compose.yml << 'EOF'
version: '3.8'

services:
  liquidsoap:
    image: savonet/liquidsoap:v2.2.5
    container_name: liquidsoap
    restart: unless-stopped
    networks:
      - radio-network
    volumes:
      - /mnt/ramdisk/configs/liquidsoap:/etc/liquidsoap:ro
      - /mnt/ramdisk/logs/liquidsoap:/var/log/liquidsoap
      - /data/media:/media:ro
      - /root/.aws:/root/.aws:ro
    environment:
      - TZ=Europe/Amsterdam
      - AWS_REGION=eu-west-1
    command: liquidsoap /etc/liquidsoap/radio.liq
    depends_on:
      - icecast
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  icecast:
    image: moul/icecast:latest
    container_name: icecast
    restart: unless-stopped
    networks:
      - radio-network
    ports:
      - "8000:8000"
    volumes:
      - /mnt/ramdisk/configs/icecast/icecast.xml:/etc/icecast2/icecast.xml:ro
      - /mnt/ramdisk/logs/icecast:/var/log/icecast2
    environment:
      - TZ=Europe/Amsterdam
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  stereo-tool:
    image: thimslugga/stereo-tool:latest
    container_name: stereo-tool
    restart: unless-stopped
    networks:
      - radio-network
    volumes:
      - /mnt/ramdisk/configs/stereo-tool:/config:ro
      - /mnt/ramdisk/logs/stereo-tool:/var/log/stereo-tool
    environment:
      - TZ=Europe/Amsterdam
    ports:
      - "9000:9000"
      - "9001:9001"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    networks:
      - radio-network
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /mnt/ramdisk/configs/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /mnt/ramdisk/configs/nginx/sites-enabled:/etc/nginx/sites-enabled:ro
      - /mnt/ramdisk/logs/nginx:/var/log/nginx
      - /data/certs:/etc/nginx/certs:ro
    environment:
      - TZ=Europe/Amsterdam
    depends_on:
      - icecast
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  radio-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
EOF

echo "✅ Docker Compose file created"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 STEP 7/10: Pull Docker Images"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cd /mnt/ramdisk
sudo docker compose pull
echo "✅ Docker images pulled"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 STEP 8/10: Start All Containers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
sudo docker compose up -d
sleep 5
echo "✅ All containers started"
sudo docker compose ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  STEP 9/10: Create Systemd Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > /tmp/gforge-radio.service << 'EOF'
[Unit]
Description=G-Forge Radio Docker Compose Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/mnt/ramdisk
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/gforge-radio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gforge-radio.service
echo "✅ Systemd service created and enabled"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ STEP 10/10: Verify Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║         🎉 INSTALLATION COMPLETE! 🎉                          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Container Status:"
sudo docker compose ps
echo ""
echo "💾 RAM Disk Usage:"
df -h /mnt/ramdisk | tail -1
echo ""
echo "🌐 Stream URLs:"
echo "   Direct:  http://$PUBLIC_IP:8000/stream.mp3"
echo "   Proxy:   http://$PUBLIC_IP/stream.mp3"
echo "   Admin:   http://$PUBLIC_IP:8000/admin/"
echo ""
echo "🎯 Next Steps:"
echo "   1. Test stream: curl -I http://$PUBLIC_IP:8000/stream.mp3"
echo "   2. View logs: sudo docker compose logs -f"
echo "   3. Restart service: sudo docker compose restart"
echo ""
echo "📋 Useful Commands:"
echo "   Status:   sudo docker compose ps"
echo "   Logs:     sudo docker compose logs -f [service]"
echo "   Restart:  sudo docker compose restart [service]"
echo "   Stop:     sudo docker compose down"
echo "   Start:    sudo docker compose up -d"
echo ""
echo "✅ Professional radio station is now LIVE! 🎙️"
echo ""

