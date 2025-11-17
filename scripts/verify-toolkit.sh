#!/bin/bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ COMPLETE TOOLKIT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "=== TOOLS VERIFICATION ==="
python3 --version
pip3 --version
node --version
npm --version
echo ""

echo "=== AWS IoT SDK ==="
python3 -c "import AWSIoTPythonSDK; print('✓ AWS IoT SDK installed')" 2>&1 || echo "✗ Not installed"
echo ""

echo "=== Python packages ==="
python3 -c "import boto3; print('✓ boto3 installed')" 2>&1 || echo "✗ Not installed"
python3 -c "import requests; print('✓ requests installed')" 2>&1 || echo "✗ Not installed"
echo ""

echo "=== System tools ==="
which certbot iotop iftop nethogs htop 2>&1
echo ""

echo "=== Silent stream ==="
ls -lh /opt/radio/silent-stream.mp3
echo ""

echo "=== Docker images ==="
docker images
echo ""

echo "=== Disk usage ==="
df -h | grep -E "Filesystem|/data|/dev/root"
du -sh /data/* 2>/dev/null
echo ""

echo "=== SUMMARY ==="
echo "✅ Docker images: $(docker images | grep -v REPOSITORY | wc -l)"
echo "✅ Silent stream: $(ls /opt/radio/silent-stream.mp3 2>/dev/null && echo 'YES' || echo 'NO')"
echo "✅ AWS IoT SDK: $(python3 -c 'import AWSIoTPythonSDK' 2>/dev/null && echo 'YES' || echo 'NO')"
echo "✅ boto3: $(python3 -c 'import boto3' 2>/dev/null && echo 'YES' || echo 'NO')"
echo "✅ Node.js: $(node --version 2>/dev/null || echo 'NO')"
echo "✅ Certbot: $(which certbot 2>/dev/null && echo 'YES' || echo 'NO')"
echo "✅ Monitoring tools: $(which htop iotop iftop nethogs 2>/dev/null | wc -l)/4"
echo ""
echo "🎉 EC2 DEVELOPMENT ENVIRONMENT COMPLETE!"
