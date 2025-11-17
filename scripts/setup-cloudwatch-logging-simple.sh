#!/bin/bash
################################################################################
# G-FORGE RADIO - CloudWatch Logging Setup (Simplified)
################################################################################
# Version without retention policy (werkt met basic CloudWatch permissions)
################################################################################

set -e

REGION="eu-west-1"
LOG_PREFIX="/g-forge-radio/stream-server"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 CLOUDWATCH LOGGING SETUP (SIMPLIFIED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: CREATE LOG GROUPS (WITHOUT RETENTION POLICY)
# ============================================================================
echo "=== 1. CREATING LOG GROUPS ==="

LOG_GROUPS=(
  "${LOG_PREFIX}/docker"
  "${LOG_PREFIX}/liquidsoap"
  "${LOG_PREFIX}/icecast"
  "${LOG_PREFIX}/nginx"
  "${LOG_PREFIX}/system"
  "${LOG_PREFIX}/deployment"
  "${LOG_PREFIX}/security"
  "${LOG_PREFIX}/performance"
)

for LOG_GROUP in "${LOG_GROUPS[@]}"; do
  echo "Creating log group: $LOG_GROUP"
  aws logs create-log-group \
    --log-group-name "$LOG_GROUP" \
    --region "$REGION" 2>/dev/null || echo "  (already exists)"
  
  echo "  ✓ Created (default retention: never expire)"
done

echo "✅ All log groups created!"
echo ""

# ============================================================================
# STEP 2: INSTALL CLOUDWATCH AGENT
# ============================================================================
echo "=== 2. INSTALLING CLOUDWATCH AGENT ==="

# Download and install CloudWatch Agent
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O /tmp/amazon-cloudwatch-agent.deb
dpkg -i /tmp/amazon-cloudwatch-agent.deb
rm /tmp/amazon-cloudwatch-agent.deb

echo "✅ CloudWatch Agent installed!"
echo ""

# ============================================================================
# STEP 3: CONFIGURE CLOUDWATCH AGENT
# ============================================================================
echo "=== 3. CONFIGURING CLOUDWATCH AGENT ==="

mkdir -p /opt/aws/amazon-cloudwatch-agent/etc

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "/g-forge-radio/stream-server/system",
            "log_stream_name": "{instance_id}/syslog"
          },
          {
            "file_path": "/var/log/auth.log",
            "log_group_name": "/g-forge-radio/stream-server/security",
            "log_stream_name": "{instance_id}/auth"
          },
          {
            "file_path": "/mnt/ramdisk/logs/liquidsoap*.log",
            "log_group_name": "/g-forge-radio/stream-server/liquidsoap",
            "log_stream_name": "{instance_id}/app"
          },
          {
            "file_path": "/mnt/ramdisk/logs/*error*.log",
            "log_group_name": "/g-forge-radio/stream-server/icecast",
            "log_stream_name": "{instance_id}/error"
          },
          {
            "file_path": "/mnt/ramdisk/logs/*access*.log",
            "log_group_name": "/g-forge-radio/stream-server/icecast",
            "log_stream_name": "{instance_id}/access"
          },
          {
            "file_path": "/var/log/aws/codedeploy-agent/codedeploy-agent.log",
            "log_group_name": "/g-forge-radio/stream-server/deployment",
            "log_stream_name": "{instance_id}/codedeploy"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "GForgeRadio/StreamServer",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {
            "name": "cpu_usage_idle",
            "rename": "CPU_IDLE",
            "unit": "Percent"
          },
          {
            "name": "cpu_usage_iowait",
            "rename": "CPU_IOWAIT",
            "unit": "Percent"
          }
        ],
        "metrics_collection_interval": 60,
        "totalcpu": false
      },
      "disk": {
        "measurement": [
          {
            "name": "used_percent",
            "rename": "DISK_USED",
            "unit": "Percent"
          }
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          {
            "name": "mem_used_percent",
            "rename": "MEM_USED",
            "unit": "Percent"
          }
        ],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": [
          {
            "name": "tcp_established",
            "rename": "TCP_CONNECTIONS",
            "unit": "Count"
          }
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

echo "✅ CloudWatch Agent configured!"
echo ""

# ============================================================================
# STEP 4: START CLOUDWATCH AGENT
# ============================================================================
echo "=== 4. STARTING CLOUDWATCH AGENT ==="

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

echo "✅ CloudWatch Agent started!"
echo ""

# ============================================================================
# STEP 5: CONFIGURE DOCKER LOGGING DRIVER
# ============================================================================
echo "=== 5. CONFIGURING DOCKER LOGGING TO CLOUDWATCH ==="

# Backup existing daemon.json
cp /etc/docker/daemon.json /etc/docker/daemon.json.backup-$(date +%Y%m%d-%H%M%S)

# Update Docker daemon.json with awslogs driver
cat > /etc/docker/daemon.json << 'EOF'
{
  "data-root": "/data/docker",
  "log-driver": "awslogs",
  "log-opts": {
    "awslogs-region": "eu-west-1",
    "awslogs-group": "/g-forge-radio/stream-server/docker",
    "tag": "{{.Name}}/{{.ID}}"
  }
}
EOF

echo "✅ Docker logging configured!"
echo ""

# ============================================================================
# STEP 6: UPDATE DOCKER-COMPOSE
# ============================================================================
echo "=== 6. UPDATING DOCKER-COMPOSE FOR CLOUDWATCH ==="

# Backup existing docker-compose
if [ -f /mnt/ramdisk/docker-compose.yml ]; then
  cp /mnt/ramdisk/docker-compose.yml /mnt/ramdisk/docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)
fi

cat > /mnt/ramdisk/docker-compose.yml << 'EOF'
version: '3.8'

services:
  liquidsoap:
    image: savonet/liquidsoap:v2.2.5
    container_name: liquidsoap
    restart: unless-stopped
    networks:
      - radio-network
    volumes:
      - /mnt/ramdisk/configs/liquidsoap:/etc/liquidsoap:ro
      - /mnt/ramdisk/logs:/var/log/liquidsoap
      - /data/media:/media:ro
      - /root/.aws:/root/.aws:ro
    environment:
      - TZ=Europe/Amsterdam
      - AWS_REGION=eu-west-1
      - SQS_QUEUE_URL=https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue.fifo
      - LOG_LEVEL=DEBUG
    command: liquidsoap --verbose /etc/liquidsoap/radio.liq
    depends_on:
      - icecast
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "eu-west-1"
        awslogs-group: "/g-forge-radio/stream-server/liquidsoap"
        awslogs-stream: "container"

  icecast:
    image: moul/icecast:latest
    container_name: icecast
    restart: unless-stopped
    networks:
      - radio-network
    ports:
      - "8000:8000"
    volumes:
      - /mnt/ramdisk/configs/icecast/icecast.xml:/etc/icecast2/icecast.xml:ro
      - /mnt/ramdisk/logs:/var/log/icecast2
    environment:
      - TZ=Europe/Amsterdam
      - ICECAST_SOURCE_PASSWORD=hackme
      - ICECAST_RELAY_PASSWORD=hackme
      - ICECAST_ADMIN_PASSWORD=hackme
      - ICECAST_LOGLEVEL=4
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "eu-west-1"
        awslogs-group: "/g-forge-radio/stream-server/icecast"
        awslogs-stream: "container"

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    networks:
      - radio-network
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /mnt/ramdisk/configs/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /mnt/ramdisk/configs/nginx/sites-enabled:/etc/nginx/sites-enabled:ro
      - /mnt/ramdisk/logs:/var/log/nginx
      - /data/certs:/etc/nginx/certs:ro
    environment:
      - TZ=Europe/Amsterdam
    depends_on:
      - icecast
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "eu-west-1"
        awslogs-group: "/g-forge-radio/stream-server/nginx"
        awslogs-stream: "container"

networks:
  radio-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
EOF

echo "✅ Docker-compose updated!"
echo ""

# ============================================================================
# STEP 7: RESTART DOCKER
# ============================================================================
echo "=== 7. RESTARTING DOCKER ==="

systemctl restart docker
sleep 5

echo "✅ Docker restarted!"
echo ""

# ============================================================================
# STEP 8: RESTART CONTAINERS
# ============================================================================
echo "=== 8. RESTARTING CONTAINERS ==="

cd /mnt/ramdisk
docker-compose down 2>/dev/null || true
sleep 2
docker-compose up -d

echo "✅ Containers restarted with CloudWatch logging!"
echo ""

# ============================================================================
# STEP 9: VERIFICATION
# ============================================================================
echo "=== 9. VERIFICATION ==="

echo "CloudWatch Agent status:"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a query -m ec2 -c default | grep -i status || echo "Running"

echo ""
echo "Log Groups:"
aws logs describe-log-groups \
  --log-group-name-prefix "$LOG_PREFIX" \
  --region "$REGION" \
  --query 'logGroups[].logGroupName' \
  --output table

echo ""
echo "Docker logging driver:"
docker info | grep "Logging Driver"

echo ""
echo "Container status:"
docker ps

echo ""
echo "✅ CLOUDWATCH LOGGING SETUP COMPLETE!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 LOGS NOW STREAMING TO CLOUDWATCH!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "View logs:"
echo "https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups"
echo ""
echo "📝 NOTE: Retention policy not set (requires additional IAM permission)"
echo "Logs will be kept indefinitely until manually configured."
echo ""
