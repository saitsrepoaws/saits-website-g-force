#!/bin/bash
################################################################################
# DEPLOY LIQUIDSOAP 2.3+ VIA DOCKER - FASTEST METHOD!
################################################################################

set -e

echo "🐳 LIQUIDSOAP 2.3+ DOCKER DEPLOYMENT"
echo "======================================"
echo ""

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    rm get-docker.sh
    echo "✅ Docker installed!"
else
    echo "✅ Docker already installed"
fi

# Pull latest Liquidsoap image
echo ""
echo "⬇️ Pulling Liquidsoap 2.3.x image..."
sudo docker pull savonet/liquidsoap:v2.3.x

# Create systemd service for Docker Liquidsoap
echo ""
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/liquidsoap-docker.service > /dev/null <<'SERVICE_EOF'
[Unit]
Description=Liquidsoap 2.3.x (Docker)
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
Restart=always
RestartSec=10

# Docker run command
ExecStart=/usr/bin/docker run --rm \
  --name liquidsoap \
  --network host \
  -v /opt/radio:/radio:ro \
  -v /mnt/ramdisk:/mnt/ramdisk:rw \
  -v /var/radio/tracks:/var/radio/tracks:rw \
  -e AWS_DEFAULT_REGION=eu-west-1 \
  -e HOME=/home/ubuntu \
  savonet/liquidsoap:v2.3.x \
  /radio/radio.liq

ExecStop=/usr/bin/docker stop liquidsoap

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Reload systemd
echo ""
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

# Enable service
echo "✅ Enabling service..."
sudo systemctl enable liquidsoap-docker

echo ""
echo "🎉 Liquidsoap 2.3.x Docker deployment complete!"
echo ""
echo "To start: sudo systemctl start liquidsoap-docker"
echo "To check: sudo systemctl status liquidsoap-docker"
echo "To logs:  sudo journalctl -u liquidsoap-docker -f"
echo ""
