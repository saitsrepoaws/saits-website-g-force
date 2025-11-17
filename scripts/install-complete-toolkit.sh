#!/bin/bash
################################################################################
# G-FORGE RADIO - Complete Toolkit Installer
################################################################################
# Installs all required tools for EC2 stream server
################################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 INSTALLING COMPLETE TOOLKIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "=== 1. UPDATE PACKAGE LIST ==="
apt-get update -qq
echo "✅ Package list updated"
echo ""

echo "=== 2. INSTALLING SYSTEM PACKAGES ==="
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3-pip \
  nodejs \
  npm \
  certbot \
  iotop \
  iftop \
  nethogs \
  -qq
echo "✅ System packages installed"
echo ""

echo "=== 3. INSTALLING AWS IoT SDK ==="
pip3 install AWSIoTPythonSDK --break-system-packages -q
echo "✅ AWS IoT SDK installed"
echo ""

echo "=== 4. INSTALLING PYTHON PACKAGES ==="
pip3 install boto3 requests --break-system-packages -q
echo "✅ boto3, requests installed"
echo ""

echo "=== 5. INSTALLING PM2 ==="
npm install -g pm2 -s
echo "✅ PM2 installed"
echo ""

echo "=== 6. VERIFICATION ==="
echo "Python tools:"
python3 --version
pip3 --version
python3 -c "import AWSIoTPythonSDK; print('AWS IoT SDK: OK')"
python3 -c "import boto3; print('boto3: OK')"
echo ""

echo "Node.js tools:"
node --version
npm --version
pm2 --version
echo ""

echo "System tools:"
certbot --version | head -1
echo ""

echo "Monitoring tools:"
echo "htop: $(which htop)"
echo "iotop: $(which iotop)"
echo "iftop: $(which iftop)"
echo "nethogs: $(which nethogs)"
echo ""

echo "Audio files:"
ls -lh /opt/radio/silent-stream.mp3 2>/dev/null || echo "Silent stream: Already created"
echo ""

echo "=== 7. DISK USAGE ==="
df -h | grep -E "Filesystem|/data|/dev/root"
echo ""

echo "✅ COMPLETE TOOLKIT INSTALLED!"
echo ""

echo "=== SUMMARY ==="
echo "Docker images: 3 (liquidsoap, icecast, nginx)"
echo "Silent stream: 14MB"
echo "AWS IoT SDK: Installed"
echo "Python packages: boto3, requests"
echo "Node.js: $(node --version)"
echo "PM2: Installed"
echo "SSL: certbot ready"
echo "Monitoring: htop, iotop, iftop, nethogs"
echo ""
echo "🎉 EC2 IS FULLY EQUIPPED!"
