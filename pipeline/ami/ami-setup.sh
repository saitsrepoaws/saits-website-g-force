#!/bin/bash
# G-Forge Radio - AMI Setup Script
# Installs ALL dependencies for production radio streaming

set -e

# Log everything
exec > >(tee -a /var/log/ami-setup.log)
exec 2>&1

echo "🚀 Starting G-Forge Radio AMI Setup"
echo "Timestamp: $(date)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Update system
echo "📦 Step 1: Updating system packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
echo "✅ System updated"
echo ""

# Install base dependencies
echo "📦 Step 2: Installing base dependencies..."
apt-get install -y \
  curl \
  wget \
  git \
  jq \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release \
  software-properties-common
echo "✅ Base dependencies installed"
echo ""

# Install Docker
echo "🐳 Step 3: Installing Docker..."
if ! command -v docker &> /dev/null; then
  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  
  # Add Docker repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  # Install Docker
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  
  # Enable Docker
  systemctl enable docker
  systemctl start docker
  
  echo "✅ Docker installed: $(docker --version)"
else
  echo "✅ Docker already installed: $(docker --version)"
fi
echo ""

# Pull Liquidsoap 2.4.0 Docker image
echo "🎵 Step 4: Pulling Liquidsoap 2.4.0 Docker image..."
docker pull savonet/liquidsoap:v2.4.0
echo "✅ Liquidsoap image pulled"
docker images | grep liquidsoap
echo ""

# Install Icecast2
echo "🎵 Step 5: Installing Icecast2..."
apt-get install -y icecast2
systemctl disable icecast2  # Will be configured later
echo "✅ Icecast2 installed: $(icecast2 --version 2>&1 | head -1)"
echo ""

# Install Nginx
echo "🌐 Step 6: Installing Nginx..."
apt-get install -y nginx
systemctl disable nginx  # Will be configured later
echo "✅ Nginx installed: $(nginx -v 2>&1)"
echo ""

# Install audio tools
echo "🎵 Step 7: Installing audio tools..."
apt-get install -y \
  ffmpeg \
  sox \
  libsox-fmt-all \
  libsox-fmt-mp3 \
  lame
echo "✅ Audio tools installed"
echo "  ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
echo "  sox: $(sox --version 2>&1 | head -1)"
echo ""

# Install AWS CLI v2
echo "☁️  Step 8: Installing AWS CLI v2..."
if ! command -v aws &> /dev/null; then
  cd /tmp
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip -q awscliv2.zip
  ./aws/install
  rm -rf aws awscliv2.zip
  echo "✅ AWS CLI installed: $(aws --version)"
else
  echo "✅ AWS CLI already installed: $(aws --version)"
fi
echo ""

# Install AWS SSM Agent
echo "📡 Step 9: Installing AWS SSM Agent..."
if ! systemctl is-active --quiet amazon-ssm-agent; then
  cd /tmp
  wget https://s3.eu-west-1.amazonaws.com/amazon-ssm-eu-west-1/latest/debian_amd64/amazon-ssm-agent.deb
  dpkg -i amazon-ssm-agent.deb
  systemctl enable amazon-ssm-agent
  systemctl start amazon-ssm-agent
  echo "✅ SSM Agent installed and running"
else
  echo "✅ SSM Agent already running"
fi
echo ""

# Install CodeDeploy Agent
echo "🚀 Step 10: Installing AWS CodeDeploy Agent..."
if ! systemctl is-active --quiet codedeploy-agent; then
  cd /tmp
  wget https://aws-codedeploy-eu-west-1.s3.eu-west-1.amazonaws.com/latest/install
  chmod +x ./install
  ./install auto
  systemctl enable codedeploy-agent
  systemctl start codedeploy-agent
  echo "✅ CodeDeploy Agent installed and running"
else
  echo "✅ CodeDeploy Agent already running"
fi
echo ""

# Install CloudWatch Agent
echo "📊 Step 11: Installing CloudWatch Agent..."
if ! command -v /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl &> /dev/null; then
  cd /tmp
  wget https://s3.eu-west-1.amazonaws.com/amazoncloudwatch-agent-eu-west-1/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
  dpkg -i -E ./amazon-cloudwatch-agent.deb
  echo "✅ CloudWatch Agent installed"
else
  echo "✅ CloudWatch Agent already installed"
fi
echo ""

# Install security tools
echo "🔐 Step 12: Installing security tools..."
apt-get install -y \
  fail2ban \
  rkhunter \
  chkrootkit \
  ufw
echo "✅ Security tools installed"
echo ""

# Create directory structure
echo "📁 Step 13: Creating directory structure..."
mkdir -p /opt/radio
mkdir -p /opt/radio/backups
mkdir -p /var/log/liquidsoap
mkdir -p /mnt/ramdisk
chmod 755 /opt/radio
chmod 755 /var/log/liquidsoap
echo "✅ Directories created"
echo ""

# Configure RAM disk in fstab
echo "💾 Step 14: Configuring RAM disk..."
if ! grep -q "/mnt/ramdisk" /etc/fstab; then
  echo "tmpfs /mnt/ramdisk tmpfs defaults,size=512M,noatime,nodiratime 0 0" >> /etc/fstab
  mount /mnt/ramdisk
  echo "✅ RAM disk configured and mounted"
else
  echo "✅ RAM disk already configured"
fi
echo ""

# System optimizations for audio streaming
echo "⚡ Step 15: Applying system optimizations..."

# Swappiness (reduce swap usage)
echo "vm.swappiness=10" >> /etc/sysctl.conf

# Network optimizations
cat >> /etc/sysctl.conf << 'EOF'
# Network optimizations for streaming
net.core.rmem_max=26214400
net.core.wmem_max=26214400
net.ipv4.tcp_rmem=4096 87380 26214400
net.ipv4.tcp_wmem=4096 65536 26214400
net.ipv4.tcp_congestion_control=bbr
EOF

sysctl -p
echo "✅ System optimizations applied"
echo ""

# Clean up
echo "🧹 Step 16: Cleaning up..."
apt-get autoremove -y
apt-get clean
rm -rf /tmp/*
echo "✅ Cleanup complete"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 AMI SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Installed Software:"
echo "  ✅ Docker: $(docker --version)"
echo "  ✅ Liquidsoap: savonet/liquidsoap:v2.4.0"
echo "  ✅ Icecast2: $(icecast2 --version 2>&1 | head -1)"
echo "  ✅ Nginx: $(nginx -v 2>&1)"
echo "  ✅ ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
echo "  ✅ AWS CLI: $(aws --version)"
echo "  ✅ SSM Agent: Running"
echo "  ✅ CodeDeploy Agent: Running"
echo "  ✅ CloudWatch Agent: Installed"
echo ""
echo "📁 Directory Structure:"
echo "  ✅ /opt/radio"
echo "  ✅ /var/log/liquidsoap"
echo "  ✅ /mnt/ramdisk (tmpfs, 512MB)"
echo ""
echo "⚡ Optimizations:"
echo "  ✅ RAM disk configured"
echo "  ✅ Swappiness: 10"
echo "  ✅ Network: BBR + optimized buffers"
echo ""
echo "🔐 Security:"
echo "  ✅ fail2ban, rkhunter, chkrootkit installed"
echo ""
echo "🚀 AMI is ready for image creation!"
echo "Timestamp: $(date)"
echo "═══════════════════════════════════════════════════════════"
