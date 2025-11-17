#!/bin/bash
################################################################################
# G-FORGE RADIO - Pull Configs from Parameter Store
################################################################################
# CodeDeploy BeforeInstall Hook
# Pulls configuration files from AWS Systems Manager Parameter Store
################################################################################

set -e

# Determine environment from deployment group or default to development
ENV="${DEPLOYMENT_GROUP_NAME##*-}"
[ -z "$ENV" ] && ENV="development"

REGION="eu-west-1"
CONFIG_DIR="/mnt/ramdisk/configs"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 PULLING CONFIGS FROM PARAMETER STORE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENV"
echo "Region: $REGION"
echo "Config Directory: $CONFIG_DIR"
echo ""

# ============================================================================
# STEP 1: CREATE DIRECTORY STRUCTURE
# ============================================================================
echo "=== 1. CREATING DIRECTORY STRUCTURE ==="

mkdir -p $CONFIG_DIR/liquidsoap
mkdir -p $CONFIG_DIR/icecast
mkdir -p $CONFIG_DIR/nginx/sites-enabled
mkdir -p $CONFIG_DIR/../logs

echo "✅ Directories created"
echo ""

# ============================================================================
# STEP 2: PULL LIQUIDSOAP CONFIG
# ============================================================================
echo "=== 2. PULLING LIQUIDSOAP CONFIG ==="

PARAM_NAME="/g-forge-radio/$ENV/liquidsoap/config"

if aws ssm get-parameter \
  --name "$PARAM_NAME" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text > $CONFIG_DIR/liquidsoap/radio.liq 2>/dev/null; then
  echo "✅ Liquidsoap config pulled from Parameter Store"
else
  echo "⚠️  Parameter $PARAM_NAME not found in Parameter Store"
  echo "   Using fallback config..."
  
  # Fallback: Use existing config or create basic one
  if [ -f /opt/radio/radio.liq ]; then
    cp /opt/radio/radio.liq $CONFIG_DIR/liquidsoap/radio.liq
    echo "✅ Copied from /opt/radio/radio.liq"
  else
    cat > $CONFIG_DIR/liquidsoap/radio.liq << 'EOF'
# G-Forge Radio - Fallback Config
set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 4)

silence = single("/data/media/silent-stream.mp3")
radio = fallback(track_sensitive=false, [silence])

output.icecast(
  %mp3(bitrate=192),
  host="icecast",
  port=8000,
  password="hackme",
  mount="/stream.mp3",
  radio
)
EOF
    echo "✅ Created basic fallback config"
  fi
fi

echo ""

# ============================================================================
# STEP 3: PULL ICECAST CONFIG
# ============================================================================
echo "=== 3. PULLING ICECAST CONFIG ==="

PARAM_NAME="/g-forge-radio/$ENV/icecast/config"

if aws ssm get-parameter \
  --name "$PARAM_NAME" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text > $CONFIG_DIR/icecast/icecast.xml 2>/dev/null; then
  echo "✅ Icecast config pulled from Parameter Store"
else
  echo "⚠️  Parameter $PARAM_NAME not found in Parameter Store"
  echo "   Using fallback config..."
  
  if [ -f /etc/icecast2/icecast.xml ]; then
    cp /etc/icecast2/icecast.xml $CONFIG_DIR/icecast/icecast.xml
    echo "✅ Copied from /etc/icecast2/icecast.xml"
  fi
fi

echo ""

# ============================================================================
# STEP 4: PULL NGINX CONFIG
# ============================================================================
echo "=== 4. PULLING NGINX CONFIG ==="

PARAM_NAME="/g-forge-radio/$ENV/nginx/config"

if aws ssm get-parameter \
  --name "$PARAM_NAME" \
  --region $REGION \
  --query 'Parameter.Value' \
  --output text > $CONFIG_DIR/nginx/sites-enabled/splashfm 2>/dev/null; then
  echo "✅ Nginx config pulled from Parameter Store"
else
  echo "⚠️  Parameter $PARAM_NAME not found in Parameter Store"
  echo "   Using fallback config..."
  
  if [ -f /etc/nginx/sites-available/splashfm ]; then
    cp /etc/nginx/sites-available/splashfm $CONFIG_DIR/nginx/sites-enabled/splashfm
    echo "✅ Copied from /etc/nginx/sites-available/splashfm"
  fi
fi

echo ""

# ============================================================================
# STEP 5: SET PERMISSIONS
# ============================================================================
echo "=== 5. SETTING PERMISSIONS ==="

chmod -R 755 $CONFIG_DIR
chmod 644 $CONFIG_DIR/liquidsoap/radio.liq 2>/dev/null || true
chmod 644 $CONFIG_DIR/icecast/icecast.xml 2>/dev/null || true
chmod 644 $CONFIG_DIR/nginx/sites-enabled/* 2>/dev/null || true

echo "✅ Permissions set"
echo ""

# ============================================================================
# STEP 6: VERIFICATION
# ============================================================================
echo "=== 6. VERIFICATION ==="
echo ""

echo "Config files present:"
ls -lh $CONFIG_DIR/liquidsoap/radio.liq 2>/dev/null && echo "✅ Liquidsoap" || echo "❌ Liquidsoap"
ls -lh $CONFIG_DIR/icecast/icecast.xml 2>/dev/null && echo "✅ Icecast" || echo "❌ Icecast"
ls -lh $CONFIG_DIR/nginx/sites-enabled/splashfm 2>/dev/null && echo "✅ Nginx" || echo "❌ Nginx"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CONFIGS PULLED AND READY FOR DOCKER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
