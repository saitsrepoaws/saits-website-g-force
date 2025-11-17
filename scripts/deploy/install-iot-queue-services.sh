#!/bin/bash
################################################################################
# G-FORGE RADIO - Install IoT Queue Services
################################################################################
# CodeDeploy AfterInstall Hook
# Installs and configures IoT queue listener + Liquidsoap
################################################################################

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 INSTALLING IOT QUEUE SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: INSTALL DEPENDENCIES
# ============================================================================
echo "=== 1. INSTALLING DEPENDENCIES ==="
echo ""

# Install mosquitto-clients (for mosquitto_sub)
if ! command -v mosquitto_sub &> /dev/null; then
    echo "Installing mosquitto-clients..."
    apt-get update -qq
    apt-get install -y mosquitto-clients
    echo "✅ mosquitto-clients installed"
else
    echo "✅ mosquitto-clients already installed"
fi

# Install jq (for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo "Installing jq..."
    apt-get install -y jq
    echo "✅ jq installed"
else
    echo "✅ jq already installed"
fi

echo ""

# ============================================================================
# STEP 2: SETUP DIRECTORIES
# ============================================================================
echo "=== 2. SETTING UP DIRECTORIES ==="
echo ""

# Radio directory
mkdir -p /opt/radio
mkdir -p /opt/radio/certs
mkdir -p /var/log/liquidsoap

# Set permissions
chmod 755 /opt/radio
chmod 700 /opt/radio/certs

echo "✅ Directories created"
echo ""

# ============================================================================
# STEP 3: COPY IOT QUEUE LISTENER
# ============================================================================
echo "=== 3. INSTALLING IOT QUEUE LISTENER ==="
echo ""

# Copy script
cp /opt/g-forge-iot/scripts/iot-queue-listener.sh /opt/radio/
chmod +x /opt/radio/iot-queue-listener.sh

echo "✅ IoT queue listener installed"
echo ""

# ============================================================================
# STEP 4: INSTALL SYSTEMD SERVICE
# ============================================================================
echo "=== 4. INSTALLING SYSTEMD SERVICE ==="
echo ""

# Copy service file
cp /opt/g-forge-iot/scripts/systemd/iot-queue-listener.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable service (but don't start yet - needs certs first)
systemctl enable iot-queue-listener.service

echo "✅ Systemd service installed and enabled"
echo ""

# ============================================================================
# STEP 5: INITIALIZE QUEUE FILE
# ============================================================================
echo "=== 5. INITIALIZING QUEUE FILE ==="
echo ""

# Create empty queue file
echo '{"tracks":[],"updated":null,"action":"init"}' > /tmp/iot-queue.json
chmod 644 /tmp/iot-queue.json

echo "✅ Queue file initialized"
echo ""

# ============================================================================
# STEP 6: COPY LIQUIDSOAP CONFIG
# ============================================================================
echo "=== 6. INSTALLING LIQUIDSOAP CONFIG ==="
echo ""

# Copy config (but don't activate yet)
if [ -f /opt/g-forge-iot/scripts/liquidsoap-config/radio-iot-queue.liq ]; then
    cp /opt/g-forge-iot/scripts/liquidsoap-config/radio-iot-queue.liq /opt/radio/
    chmod 644 /opt/radio/radio-iot-queue.liq
    echo "✅ Liquidsoap config installed at /opt/radio/radio-iot-queue.liq"
else
    echo "⚠️  Liquidsoap IoT config not found, skipping"
fi

echo ""

# ============================================================================
# STEP 7: VERIFICATION
# ============================================================================
echo "=== 7. VERIFICATION ==="
echo ""

echo "Installed components:"
echo ""
echo "  📄 Script: /opt/radio/iot-queue-listener.sh"
ls -lh /opt/radio/iot-queue-listener.sh

echo ""
echo "  📄 Service: /etc/systemd/system/iot-queue-listener.service"
ls -lh /etc/systemd/system/iot-queue-listener.service

echo ""
echo "  📄 Queue: /tmp/iot-queue.json"
ls -lh /tmp/iot-queue.json

echo ""
echo "  📄 Liquidsoap: /opt/radio/radio-iot-queue.liq"
ls -lh /opt/radio/radio-iot-queue.liq 2>/dev/null || echo "  (not installed)"

echo ""
echo "Service status:"
systemctl is-enabled iot-queue-listener.service && echo "  ✅ Enabled" || echo "  ⚠️  Not enabled"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ IOT QUEUE SERVICES INSTALLED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  NOTE: IoT certificates required before starting service!"
echo "   Certificates should be at: /opt/radio/certs/"
echo "   - certificate.pem.crt"
echo "   - private.pem.key"
echo ""
echo "To start service after certs are in place:"
echo "  systemctl start iot-queue-listener.service"
echo ""

exit 0
