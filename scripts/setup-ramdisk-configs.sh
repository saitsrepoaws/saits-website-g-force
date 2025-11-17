#!/bin/bash
################################################################################
# G-FORGE RADIO - Setup Ramdisk Configs for Docker Containers
################################################################################
# Fixes container crashloop by populating /mnt/ramdisk/configs/
# with working configurations
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 SETUP RAMDISK CONFIGS FOR DOCKER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: CREATE DIRECTORY STRUCTURE
# ============================================================================
echo "=== 1. CREATING DIRECTORY STRUCTURE ==="

mkdir -p /mnt/ramdisk/configs/liquidsoap
mkdir -p /mnt/ramdisk/configs/icecast
mkdir -p /mnt/ramdisk/configs/nginx/sites-enabled
mkdir -p /mnt/ramdisk/logs
mkdir -p /data/media

echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# ============================================================================
# STEP 2: COPY WORKING CONFIGS
# ============================================================================
echo "=== 2. COPYING WORKING CONFIGS ==="

# Liquidsoap
if [ -f /opt/radio/radio.liq ]; then
  echo "Copying Liquidsoap config..."
  cp /opt/radio/radio.liq /mnt/ramdisk/configs/liquidsoap/radio.liq
  echo -e "${GREEN}✅ Liquidsoap config copied${NC}"
else
  echo -e "${YELLOW}⚠️  Liquidsoap config not found at /opt/radio/radio.liq${NC}"
  echo "Creating basic config..."
  cat > /mnt/ramdisk/configs/liquidsoap/radio.liq << 'EOF'
# G-Forge Radio - Basic Liquidsoap Config
set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 4)

# Silent fallback
silence = single("/data/media/silent-stream.mp3")
radio = fallback(track_sensitive=false, [silence])

# Output to Icecast
output.icecast(
  %mp3(bitrate=192),
  host="icecast",
  port=8000,
  password="hackme",
  mount="/stream.mp3",
  radio
)
EOF
  echo -e "${GREEN}✅ Basic Liquidsoap config created${NC}"
fi

# Icecast
if [ -f /etc/icecast2/icecast.xml ]; then
  echo "Copying Icecast config..."
  cp /etc/icecast2/icecast.xml /mnt/ramdisk/configs/icecast/icecast.xml
  echo -e "${GREEN}✅ Icecast config copied${NC}"
else
  echo -e "${YELLOW}⚠️  Icecast config not found${NC}"
fi

# Nginx
if [ -f /etc/nginx/nginx.conf ]; then
  echo "Copying Nginx main config..."
  cp /etc/nginx/nginx.conf /mnt/ramdisk/configs/nginx/nginx.conf
  echo -e "${GREEN}✅ Nginx main config copied${NC}"
fi

if [ -f /etc/nginx/sites-available/splashfm ]; then
  echo "Copying Nginx site config..."
  cp /etc/nginx/sites-available/splashfm /mnt/ramdisk/configs/nginx/sites-enabled/splashfm
  echo -e "${GREEN}✅ Nginx site config copied${NC}"
elif [ -f /etc/nginx/sites-enabled/default ]; then
  echo "Copying default Nginx config..."
  cp /etc/nginx/sites-enabled/default /mnt/ramdisk/configs/nginx/sites-enabled/default
  echo -e "${GREEN}✅ Nginx default config copied${NC}"
fi

echo ""

# ============================================================================
# STEP 3: COPY SILENT STREAM TO ACCESSIBLE LOCATION
# ============================================================================
echo "=== 3. COPYING SILENT STREAM ==="

if [ -f /opt/radio/silent-stream.mp3 ]; then
  echo "Copying silent stream to /data/media/..."
  cp /opt/radio/silent-stream.mp3 /data/media/silent-stream.mp3
  echo -e "${GREEN}✅ Silent stream copied${NC}"
else
  echo -e "${YELLOW}⚠️  Silent stream not found, creating one...${NC}"
  # Create 10-second silent MP3
  ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -q:a 9 -acodec libmp3lame \
    /data/media/silent-stream.mp3 2>/dev/null || \
    echo -e "${RED}❌ Could not create silent stream (ffmpeg not installed?)${NC}"
  
  if [ -f /data/media/silent-stream.mp3 ]; then
    echo -e "${GREEN}✅ Silent stream created${NC}"
  fi
fi

echo ""

# ============================================================================
# STEP 4: SET PERMISSIONS
# ============================================================================
echo "=== 4. SETTING PERMISSIONS ==="

chmod -R 755 /mnt/ramdisk/configs
chmod -R 777 /mnt/ramdisk/logs
chmod 644 /mnt/ramdisk/configs/liquidsoap/radio.liq 2>/dev/null || true
chmod 644 /mnt/ramdisk/configs/icecast/icecast.xml 2>/dev/null || true

echo -e "${GREEN}✅ Permissions set${NC}"
echo ""

# ============================================================================
# STEP 5: VERIFY STRUCTURE
# ============================================================================
echo "=== 5. VERIFYING STRUCTURE ==="
echo ""
echo "Directory tree:"
tree -L 3 /mnt/ramdisk 2>/dev/null || ls -laR /mnt/ramdisk

echo ""
echo -e "${GREEN}✅ Ramdisk structure ready!${NC}"
echo ""

# ============================================================================
# STEP 6: UPDATE DOCKER-COMPOSE (IF EXISTS)
# ============================================================================
echo "=== 6. CHECKING DOCKER-COMPOSE ==="

if [ -f /mnt/ramdisk/docker-compose.yml ]; then
  echo "Docker-compose.yml already exists"
  echo "Creating backup..."
  cp /mnt/ramdisk/docker-compose.yml /mnt/ramdisk/docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)
  echo -e "${GREEN}✅ Backup created${NC}"
else
  echo "Docker-compose.yml not found"
  if [ -f /opt/g-forge/docker/docker-compose-simple.yml ]; then
    echo "Copying from repository..."
    cp /opt/g-forge/docker/docker-compose-simple.yml /mnt/ramdisk/docker-compose.yml
    echo -e "${GREEN}✅ Docker-compose.yml copied${NC}"
  fi
fi

echo ""

# ============================================================================
# STEP 7: RESTART CONTAINERS
# ============================================================================
echo "=== 7. RESTARTING DOCKER CONTAINERS ==="
echo ""
echo "Stopping containers..."
cd /mnt/ramdisk
docker-compose down 2>/dev/null || echo "No containers to stop"

echo ""
echo "Starting containers with new configs..."
docker-compose up -d

echo ""
echo "Container status:"
docker ps

echo ""

# ============================================================================
# STEP 8: VERIFY CONTAINERS
# ============================================================================
echo "=== 8. VERIFICATION ==="
echo ""

sleep 5

echo "Checking container status:"
RUNNING=$(docker ps --filter "status=running" --format "{{.Names}}" | wc -l)
echo "Running containers: $RUNNING"

if [ $RUNNING -gt 0 ]; then
  echo -e "${GREEN}✅ Containers are running!${NC}"
  echo ""
  echo "Container details:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
  echo -e "${RED}❌ No containers running!${NC}"
  echo ""
  echo "Check logs:"
  echo "docker-compose logs"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RAMDISK CONFIG SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Check container logs: docker-compose logs -f"
echo "2. Verify CloudWatch logs streaming"
echo "3. Test stream: curl http://localhost:8000/stream.mp3"
echo ""

exit 0
