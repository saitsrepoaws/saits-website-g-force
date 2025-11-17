#!/bin/bash
################################################################################
# SETUP RAM DISK DOCKER ENVIRONMENT
################################################################################
# This script sets up the Docker containers in RAM disk
# Run once after EC2 deployment
################################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 SETTING UP RAM DISK DOCKER ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if RAM disk exists
if ! mountpoint -q /mnt/ramdisk; then
  echo "❌ RAM disk not mounted at /mnt/ramdisk"
  echo "   Run: mount -t tmpfs -o size=3G tmpfs /mnt/ramdisk"
  exit 1
fi

echo "✅ RAM disk detected: /mnt/ramdisk"
df -h | grep ramdisk
echo ""

# Copy docker-compose file to RAM disk
echo "📋 Copying docker-compose.yml to RAM disk..."
cp "$(dirname "$0")/docker-compose.ramdisk.yml" /mnt/ramdisk/docker-compose.yml
echo "✅ docker-compose.yml → /mnt/ramdisk/"
echo ""

# Create directory structure (already done, but make sure)
echo "📁 Creating directory structure..."
mkdir -p /mnt/ramdisk/configs/{liquidsoap,icecast,nginx/sites-enabled,stereo-tool}
mkdir -p /mnt/ramdisk/logs
echo "✅ Directory structure ready"
echo ""

# Create minimal configs (placeholders - will be managed by AWS Config Manager)
echo "📝 Creating minimal placeholder configs..."

# Liquidsoap minimal config
cat > /mnt/ramdisk/configs/liquidsoap/radio.liq << 'EOF'
# Minimal Liquidsoap config - Placeholder
# Managed by AWS Systems Manager Application Config

set("log.stdout", true)
set("log.level", 4)

# Silent audio fallback
silence = single("/opt/radio/silent-stream.mp3")

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="icecast", port=8000,
  password="hackme",
  mount="stream.mp3",
  name="G-Forge Radio",
  description="Powered by RAM disk!",
  silence
)

log("Liquidsoap started - waiting for config from AWS Config Manager")
EOF

# Icecast minimal config
cat > /mnt/ramdisk/configs/icecast/icecast.xml << 'EOF'
<icecast>
  <location>G-Forge Radio</location>
  <admin>admin@splashfm.nl</admin>

  <limits>
    <clients>100</clients>
    <sources>2</sources>
    <queue-size>524288</queue-size>
    <burst-size>65536</burst-size>
  </limits>

  <authentication>
    <source-password>hackme</source-password>
    <relay-password>hackme</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>hackme</admin-password>
  </authentication>

  <listen-socket>
    <port>8000</port>
  </listen-socket>

  <paths>
    <basedir>/usr/share/icecast2</basedir>
    <logdir>/var/log/icecast2</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
  </paths>

  <logging>
    <accesslog>access.log</accesslog>
    <errorlog>error.log</errorlog>
    <loglevel>3</loglevel>
  </logging>
</icecast>
EOF

# Nginx minimal config
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

# Nginx site config (proxy to Icecast)
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

echo "✅ Placeholder configs created"
echo ""

# Pull Docker images
echo "🐳 Pulling Docker images..."
cd /mnt/ramdisk
docker-compose pull
echo "✅ Docker images pulled"
echo ""

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d
echo "✅ Containers started"
echo ""

# Show status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RAM DISK DOCKER ENVIRONMENT READY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Status:"
docker-compose ps
echo ""
echo "📁 Location: /mnt/ramdisk"
echo "📋 Docker Compose: /mnt/ramdisk/docker-compose.yml"
echo "⚙️  Configs: /mnt/ramdisk/configs/"
echo "📝 Logs: /mnt/ramdisk/logs/"
echo ""
echo "🎯 Next Steps:"
echo "   1. Configure services via AWS Config Manager"
echo "   2. Test stream: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/stream.mp3"
echo "   3. Monitor: docker-compose logs -f"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
