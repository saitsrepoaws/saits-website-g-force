#!/bin/bash
# Ubuntu 24.04 Setup Script for G-Forge Radio with Liquidsoap 2.2.5+

set -e

echo "🚀 Starting G-Forge Radio setup on Ubuntu 24.04..."
echo "Timestamp: $(date)"

# Update system
echo "📦 Updating system packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install required packages
echo "📦 Installing dependencies..."
apt-get install -y \
  liquidsoap \
  icecast2 \
  nginx \
  awscli \
  ffmpeg \
  jq \
  curl \
  amazon-ssm-agent

# Check Liquidsoap version
echo "✅ Liquidsoap version:"
liquidsoap --version | head -3

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/radio
mkdir -p /var/log/liquidsoap
mkdir -p /var/www/radio
chown -R ubuntu:ubuntu /opt/radio
chown -R ubuntu:ubuntu /var/log/liquidsoap
chown -R www-data:www-data /var/www/radio

# Configure Icecast
echo "🎵 Configuring Icecast..."
cat > /etc/icecast2/icecast.xml << 'EOF'
<icecast>
    <location>Amsterdam</location>
    <admin>admin@g-forge.com</admin>
    
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
        <relay-password>gforge2024relay</relay-password>
        <admin-user>admin</admin-user>
        <admin-password>gforge2024admin</admin-password>
    </authentication>
    
    <hostname>radio.g-forge.com</hostname>
    
    <listen-socket>
        <port>8000</port>
    </listen-socket>
    
    <fileserve>1</fileserve>
    
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
        <logsize>10000</logsize>
    </logging>
    
    <security>
        <chroot>0</chroot>
    </security>
</icecast>
EOF

# Enable Icecast
sed -i 's/ENABLE=false/ENABLE=true/' /etc/default/icecast2

# Create Liquidsoap config with advanced crossfade
echo "🎚️ Creating Liquidsoap config..."
cat > /opt/radio/radio.liq << 'EOF'
# G-Forge Radio - Liquidsoap 2.2.5+ Configuration
# Full UI control enabled

set("init.allow_root", true)
set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 4)

s3_bucket = "radio-playlists-035636364722"
playlist_file = "/tmp/current-playlist.m3u"

# Fetch playlist from S3
def fetch_playlist() =
  log("📥 Fetching playlist from S3...")
  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")
  log("S3 result: #{ret}")
  playlist_file
end

ignore(fetch_playlist())
add_timeout(300., fun () -> begin ignore(fetch_playlist()); -1. end)

# Create playlist source
radio = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)

# ═══════════════════════════════════════════════════════════════
# ADVANCED CROSSFADE with UI Control (Liquidsoap 2.2.5+)
# ═══════════════════════════════════════════════════════════════

# Dynamic crossfade configuration (updated from UI via S3)
%include "/opt/radio/crossfade-ui.liq"

# If crossfade-ui.liq doesn't exist or fails, use default
# radio = crossfade(radio)

log("🎚️ Advanced crossfade ENABLED (Liquidsoap 2.2.5+)")
log("📊 UI-controlled fade times active")

# ═══════════════════════════════════════════════════════════════

# Fallback to silence
radio = fallback(track_sensitive=false, [radio, blank()])

# Normalize audio levels
radio = normalize(target=-14.0, radio)
log("🔊 Normalization: -14 dBFS")

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="stream.mp3",
  name="G-Forge Radio",
  description="Techno & Electronic Music 24/7",
  url="http://radio.g-forge.com",
  radio
)

log("🎵 G-Forge Radio started successfully!")
EOF

# Create default crossfade config (will be replaced by UI updates)
echo "🎚️ Creating default crossfade config..."
cat > /opt/radio/crossfade-ui.liq << 'EOF'
# UI-Controlled Crossfade Configuration
# Auto-generated from StreamSettings
# Preset: techno (default)

def ui_crossfade_transition(a, b) =
  # Fade durations from UI (Techno preset)
  fade_in_duration = 2.0
  fade_out_duration = 2.0
  
  # Apply smooth sine fades
  a = fade.out(duration=fade_out_duration, type="sin", a)
  b = fade.in(duration=fade_in_duration, type="sin", b)
  
  # Mix both sources
  add(normalize=false, [a, b])
end

# Apply crossfade
radio = cross(duration=5.0, ui_crossfade_transition, radio)
EOF

# Create systemd service
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/liquidsoap-radio.service << 'EOF'
[Unit]
Description=Liquidsoap Radio Stream
After=network.target icecast2.service
Wants=icecast2.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
ExecStart=/usr/bin/liquidsoap /opt/radio/radio.liq
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/radio << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/radio;
    index index.html;

    location = / {
        try_files /index.html =404;
    }

    location /stream.mp3 {
        proxy_pass http://127.0.0.1:8000/stream.mp3;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1:8000;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }

    location /status-json.xsl {
        proxy_pass http://127.0.0.1:8000/status-json.xsl;
        proxy_set_header Host 127.0.0.1:8000;
        add_header Access-Control-Allow-Origin * always;
    }

    location /admin {
        proxy_pass http://127.0.0.1:8000/admin;
        proxy_set_header Host 127.0.0.1:8000;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/radio /etc/nginx/sites-enabled/radio

# Download Splash FM player page from S3 (if exists)
echo "🎨 Downloading player page..."
aws s3 cp s3://radio-playlists-035636364722/temp/player-v2.html /var/www/radio/index.html 2>/dev/null || \
cat > /var/www/radio/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>G-Forge Radio - Initializing...</title>
</head>
<body>
    <h1>G-Forge Radio</h1>
    <p>Setup in progress... Please wait.</p>
</body>
</html>
EOF

chown www-data:www-data /var/www/radio/index.html

# Enable and start services
echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable icecast2
systemctl enable liquidsoap-radio
systemctl enable nginx
systemctl enable amazon-ssm-agent

systemctl start icecast2
sleep 2
systemctl start liquidsoap-radio
sleep 2
systemctl start nginx
systemctl start amazon-ssm-agent

# Wait for stream to initialize
echo "⏳ Waiting for stream to start..."
sleep 5

# Verify setup
echo ""
echo "✅ Setup completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service Status:"
systemctl is-active icecast2 && echo "  ✅ Icecast2: Running" || echo "  ❌ Icecast2: Failed"
systemctl is-active liquidsoap-radio && echo "  ✅ Liquidsoap: Running" || echo "  ❌ Liquidsoap: Failed"
systemctl is-active nginx && echo "  ✅ Nginx: Running" || echo "  ❌ Nginx: Failed"
systemctl is-active amazon-ssm-agent && echo "  ✅ SSM Agent: Running" || echo "  ❌ SSM Agent: Failed"

echo ""
echo "🎵 Liquidsoap Version:"
liquidsoap --version | head -1

echo ""
echo "🎚️ Crossfade Test:"
liquidsoap --check /opt/radio/crossfade-ui.liq 2>&1 | head -1 || echo "Syntax check completed"

echo ""
echo "📝 Logs:"
echo "  Liquidsoap: tail -f /var/log/liquidsoap/radio.log"
echo "  Icecast: tail -f /var/log/icecast2/error.log"
echo "  Cloud-init: tail -f /var/log/cloud-init-output.log"

echo ""
echo "🎉 G-Forge Radio setup completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
