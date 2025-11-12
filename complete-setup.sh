#!/bin/bash
# Complete configuration setup for new instance

echo "🔧 Creating complete configuration..."

# Copy this entire script content to run on EC2
cat << 'SETUP_SCRIPT_END'
#!/bin/bash
set -e

echo "📁 Creating directories..."
mkdir -p /opt/radio
mkdir -p /var/log/liquidsoap
mkdir -p /var/www/radio
chown -R ubuntu:ubuntu /opt/radio /var/log/liquidsoap
chown -R www-data:www-data /var/www/radio

echo "🎵 Configuring Icecast..."
cat > /etc/icecast2/icecast.xml << 'ICECAST_EOF'
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
ICECAST_EOF

sed -i 's/ENABLE=false/ENABLE=true/' /etc/default/icecast2

echo "🎚️ Creating Liquidsoap crossfade config..."
cat > /opt/radio/crossfade-ui.liq << 'CROSSFADE_EOF'
# UI-Controlled Crossfade - Liquidsoap 2.2.4
# Preset: Techno (default)

def ui_crossfade_transition(a, b) =
  fade_in_duration = 2.0
  fade_out_duration = 2.0
  
  a = fade.out(duration=fade_out_duration, type="sin", a)
  b = fade.in(duration=fade_in_duration, type="sin", b)
  
  add(normalize=false, [a, b])
end

radio = cross(duration=5.0, ui_crossfade_transition, radio)
CROSSFADE_EOF

echo "🎵 Creating main Liquidsoap config..."
cat > /opt/radio/radio.liq << 'LIQUIDSOAP_EOF'
# G-Forge Radio - Liquidsoap 2.2.4
set("init.allow_root", true)
set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 4)

s3_bucket = "radio-playlists-035636364722"
playlist_file = "/tmp/current-playlist.m3u"

def fetch_playlist() =
  log("📥 Fetching playlist from S3...")
  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")
  log("S3 result: #{ret}")
  playlist_file
end

ignore(fetch_playlist())
thread.run(delay=300., {fetch_playlist(); ()})

radio = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)

# ADVANCED CROSSFADE (UI-Controlled)
%include "/opt/radio/crossfade-ui.liq"
log("🎚️ Advanced crossfade enabled (Liquidsoap 2.2.4)")

radio = fallback(track_sensitive=false, [radio, blank()])
radio = normalize(target=-14.0, radio)

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

log("🎵 G-Forge Radio started!")
LIQUIDSOAP_EOF

echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/liquidsoap-radio.service << 'SYSTEMD_EOF'
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
SYSTEMD_EOF

echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/radio << 'NGINX_EOF'
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
NGINX_EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/radio /etc/nginx/sites-enabled/radio

echo "🎨 Creating placeholder page..."
cat > /var/www/radio/index.html << 'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>G-Forge Radio - Loading...</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        h1 { font-size: 3em; margin-bottom: 20px; }
        .status { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body>
    <h1>🎵 G-Forge Radio</h1>
    <div class="status">
        <h2>Setup Complete!</h2>
        <p>Liquidsoap 2.2.4 with Advanced Crossfade</p>
        <p>Stream will be available shortly...</p>
    </div>
</body>
</html>
HTML_EOF

chown www-data:www-data /var/www/radio/index.html

echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable icecast2 liquidsoap-radio nginx
systemctl start icecast2
sleep 2
systemctl start liquidsoap-radio
sleep 2
systemctl start nginx

echo ""
echo "✅ Setup completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
systemctl is-active icecast2 && echo "✅ Icecast: Running" || echo "❌ Icecast: Failed"
systemctl is-active liquidsoap-radio && echo "✅ Liquidsoap: Running" || echo "❌ Liquidsoap: Failed"
systemctl is-active nginx && echo "✅ Nginx: Running" || echo "❌ Nginx: Failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SETUP_SCRIPT_END
