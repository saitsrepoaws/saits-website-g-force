#!/bin/bash
################################################################################
# G-FORGE RADIO - Start Docker Containers
################################################################################
# CodeDeploy ApplicationStart Hook
# Starts Docker containers with configs from Parameter Store
################################################################################

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐳 STARTING DOCKER CONTAINERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: VERIFY CONFIGS EXIST
# ============================================================================
echo "=== 1. VERIFYING CONFIGS ==="

CONFIGS_OK=true

if [ ! -f /mnt/ramdisk/configs/liquidsoap/radio.liq ]; then
  echo "❌ Liquidsoap config missing!"
  CONFIGS_OK=false
fi

if [ ! -f /mnt/ramdisk/configs/icecast/icecast.xml ]; then
  echo "⚠️  Icecast config missing (optional)"
fi

if [ ! -f /mnt/ramdisk/configs/nginx/sites-enabled/splashfm ]; then
  echo "⚠️  Nginx config missing (optional)"
fi

if [ "$CONFIGS_OK" = false ]; then
  echo ""
  echo "❌ Critical configs missing! Cannot start containers."
  exit 1
fi

echo "✅ Required configs present"
echo ""

# ============================================================================
# STEP 2: UPDATE DOCKER-COMPOSE
# ============================================================================
echo "=== 2. UPDATING DOCKER-COMPOSE ==="

# Copy latest docker-compose file
if [ -f /opt/g-forge/docker/docker-compose-simple.yml ]; then
  cp /opt/g-forge/docker/docker-compose-simple.yml /mnt/ramdisk/docker-compose.yml
  echo "✅ Docker-compose.yml updated"
else
  echo "⚠️  docker-compose-simple.yml not found in /opt/g-forge/docker/"
  echo "   Using existing docker-compose.yml"
fi

echo ""

# ============================================================================
# STEP 3: STOP OLD CONTAINERS
# ============================================================================
echo "=== 3. STOPPING OLD CONTAINERS ==="

cd /mnt/ramdisk

docker-compose down 2>/dev/null || echo "No containers to stop"

# Give Docker time to cleanup
sleep 2

echo "✅ Old containers stopped"
echo ""

# ============================================================================
# STEP 4: PULL LATEST IMAGES (OPTIONAL)
# ============================================================================
echo "=== 4. CHECKING DOCKER IMAGES ==="

# Optional: Pull latest images
# docker-compose pull

echo "✅ Using existing images"
echo ""

# ============================================================================
# STEP 5: START CONTAINERS
# ============================================================================
echo "=== 5. STARTING CONTAINERS ==="

docker-compose up -d

# Wait for containers to start
sleep 5

echo "✅ Containers started"
echo ""

# ============================================================================
# STEP 6: VERIFY CONTAINERS
# ============================================================================
echo "=== 6. VERIFYING CONTAINERS ==="
echo ""

echo "Container status:"
docker-compose ps

echo ""

RUNNING=$(docker ps --filter "status=running" --format "{{.Names}}" | wc -l)
echo "Running containers: $RUNNING"

if [ $RUNNING -eq 0 ]; then
  echo "❌ No containers running!"
  echo ""
  echo "Container logs:"
  docker-compose logs --tail=50
  exit 1
fi

echo ""
echo "Container details:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""

# ============================================================================
# STEP 7: VERIFY CLOUDWATCH LOGGING
# ============================================================================
echo "=== 7. CHECKING CLOUDWATCH LOGGING ==="

# Check if containers are using awslogs driver
AWSLOGS_COUNT=$(docker inspect $(docker ps -q) 2>/dev/null | grep -c '"LogDriver": "awslogs"' || echo "0")

if [ $AWSLOGS_COUNT -gt 0 ]; then
  echo "✅ CloudWatch logging configured ($AWSLOGS_COUNT containers)"
else
  echo "⚠️  CloudWatch logging not detected"
  echo "   Logs will not stream to CloudWatch"
fi

echo ""

# ============================================================================
# STEP 8: HEALTH CHECKS
# ============================================================================
echo "=== 8. RUNNING HEALTH CHECKS ==="

# Check Icecast
if docker ps | grep -q icecast; then
  if curl -f http://localhost:8000/status-json.xsl > /dev/null 2>&1; then
    echo "✅ Icecast: Healthy"
  else
    echo "⚠️  Icecast: Not responding yet (may need more time)"
  fi
fi

# Check Nginx
if docker ps | grep -q nginx; then
  if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ Nginx: Healthy"
  else
    echo "⚠️  Nginx: Not responding yet"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DOCKER CONTAINERS STARTED SUCCESSFULLY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: Validate deployment with validate-deployment.sh"
echo ""

exit 0
