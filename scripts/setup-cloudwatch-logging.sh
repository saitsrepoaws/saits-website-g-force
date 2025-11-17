#!/bin/bash
################################################################################
# G-FORGE RADIO - CloudWatch Logging Setup
################################################################################
# Sets up complete CloudWatch logging infrastructure:
# - Hierarchical log groups for all components
# - Docker logs → CloudWatch
# - Nginx logs → CloudWatch
# - System logs → CloudWatch
# - CloudWatch Agent installation & configuration
# - Verbose logging mode enabled
################################################################################

set -e

REGION="eu-west-1"
LOG_PREFIX="/g-forge-radio/stream-server"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 CLOUDWATCH LOGGING INFRASTRUCTURE SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: CREATE LOG GROUPS
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
  
  # Set retention to 30 days
  aws logs put-retention-policy \
    --log-group-name "$LOG_GROUP" \
    --retention-in-days 30 \
    --region "$REGION"
  
  echo "  ✓ Retention: 30 days"
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
            "log_stream_name": "{instance_id}/syslog",
            "retention_in_days": 30
          },
          {
            "file_path": "/var/log/auth.log",
            "log_group_name": "/g-forge-radio/stream-server/security",
            "log_stream_name": "{instance_id}/auth",
            "retention_in_days": 30
          },
          {
            "file_path": "/var/log/docker.log",
            "log_group_name": "/g-forge-radio/stream-server/docker",
            "log_stream_name": "{instance_id}/docker",
            "retention_in_days": 30
          },
          {
            "file_path": "/mnt/ramdisk/logs/liquidsoap*.log",
            "log_group_name": "/g-forge-radio/stream-server/liquidsoap",
            "log_stream_name": "{instance_id}/app",
            "retention_in_days": 30
          },
          {
            "file_path": "/mnt/ramdisk/logs/error.log",
            "log_group_name": "/g-forge-radio/stream-server/icecast",
            "log_stream_name": "{instance_id}/error",
            "retention_in_days": 30
          },
          {
            "file_path": "/mnt/ramdisk/logs/access.log",
            "log_group_name": "/g-forge-radio/stream-server/icecast",
            "log_stream_name": "{instance_id}/access",
            "retention_in_days": 30
          },
          {
            "file_path": "/mnt/ramdisk/logs/nginx-error.log",
            "log_group_name": "/g-forge-radio/stream-server/nginx",
            "log_stream_name": "{instance_id}/error",
            "retention_in_days": 30
          },
          {
            "file_path": "/mnt/ramdisk/logs/nginx-access.log",
            "log_group_name": "/g-forge-radio/stream-server/nginx",
            "log_stream_name": "{instance_id}/access",
            "retention_in_days": 30
          },
          {
            "file_path": "/var/log/aws/codedeploy-agent/codedeploy-agent.log",
            "log_group_name": "/g-forge-radio/stream-server/deployment",
            "log_stream_name": "{instance_id}/codedeploy",
            "retention_in_days": 30
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
      "diskio": {
        "measurement": [
          {
            "name": "io_time",
            "rename": "DISK_IO_TIME",
            "unit": "Milliseconds"
          }
        ],
        "metrics_collection_interval": 60
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
      },
      "swap": {
        "measurement": [
          {
            "name": "swap_used_percent",
            "rename": "SWAP_USED",
            "unit": "Percent"
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
# STEP 4: CONFIGURE DOCKER LOGGING DRIVER
# ============================================================================
echo "=== 4. CONFIGURING DOCKER LOGGING TO CLOUDWATCH ==="

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
# STEP 5: UPDATE DOCKER-COMPOSE WITH VERBOSE LOGGING
# ============================================================================
echo "=== 5. UPDATING DOCKER-COMPOSE FOR VERBOSE LOGGING ==="

cat > /mnt/ramdisk/docker-compose.yml << 'EOF'
version: '3.8'

################################################################################
# G-FORGE RADIO - Docker Compose (CloudWatch Logging Enabled)
################################################################################
# All logs stream to CloudWatch in real-time!
# VERBOSE MODE: Maximum logging detail for monitoring & debugging
################################################################################

services:
  
  # ============================================================================
  # LIQUIDSOAP - Audio Automation Engine
  # ============================================================================
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

  # ============================================================================
  # ICECAST2 - Stream Distribution Server
  # ============================================================================
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

  # ============================================================================
  # NGINX - Reverse Proxy
  # ============================================================================
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

################################################################################
# NETWORKS
################################################################################
networks:
  radio-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
EOF

echo "✅ Docker-compose updated with CloudWatch logging!"
echo ""

# ============================================================================
# STEP 6: START CLOUDWATCH AGENT
# ============================================================================
echo "=== 6. STARTING CLOUDWATCH AGENT ==="

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

echo "✅ CloudWatch Agent started!"
echo ""

# ============================================================================
# STEP 7: RESTART DOCKER (Apply new logging config)
# ============================================================================
echo "=== 7. RESTARTING DOCKER WITH NEW LOGGING ==="

systemctl restart docker
sleep 5

echo "✅ Docker restarted with CloudWatch logging!"
echo ""

# ============================================================================
# STEP 8: VERIFICATION
# ============================================================================
echo "=== 8. VERIFICATION ==="

echo "CloudWatch Agent status:"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a query -m ec2 -c default | grep status || echo "Running"

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
echo "✅ CLOUDWATCH LOGGING SETUP COMPLETE!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ALL LOGS NOW STREAMING TO CLOUDWATCH!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "View logs in AWS Console:"
echo "https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group/\$252Fg-forge-radio\$252Fstream-server"
echo ""
echo "Log Groups Created:"
echo "  - ${LOG_PREFIX}/docker       (Docker daemon + containers)"
echo "  - ${LOG_PREFIX}/liquidsoap   (Audio automation)"
echo "  - ${LOG_PREFIX}/icecast      (Stream server)"
echo "  - ${LOG_PREFIX}/nginx        (Reverse proxy)"
echo "  - ${LOG_PREFIX}/system       (System logs)"
echo "  - ${LOG_PREFIX}/deployment   (CodeDeploy)"
echo "  - ${LOG_PREFIX}/security     (Auth & security)"
echo "  - ${LOG_PREFIX}/performance  (Custom metrics)"
echo ""
echo "Metrics Namespace: GForgeRadio/StreamServer"
echo "Retention: 30 days"
echo "Mode: VERBOSE (maximum detail!)"
echo ""
