#!/bin/bash
################################################################################
# SETUP DATA VOLUME ON EC2 INSTANCE
################################################################################
# Purpose: Format, mount, and configure persistent data volume
# Usage: ./setup-data-volume.sh <instance-id>
################################################################################

set -e

INSTANCE_ID="$1"
REGION="eu-west-1"

if [ -z "$INSTANCE_ID" ]; then
  echo "Usage: $0 <instance-id>"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 SETTING UP DATA VOLUME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create setup script
cat > /tmp/setup-data-volume-remote.sh << 'EOFSCRIPT'
#!/bin/bash
set -e

DEVICE="/dev/xvdf"
MOUNT_POINT="/data"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "🔍 Checking if volume exists..."
if [ ! -b "$DEVICE" ]; then
  echo "❌ Device $DEVICE not found!"
  echo "   Make sure volume is attached first"
  exit 1
fi

echo "✅ Device found: $DEVICE"
echo ""

# Check if filesystem exists
if ! blkid "$DEVICE" > /dev/null 2>&1; then
  echo "📝 Creating filesystem (ext4)..."
  mkfs.ext4 -L g-forge-data "$DEVICE"
  echo "✅ Filesystem created"
else
  echo "✅ Filesystem already exists"
fi
echo ""

# Create mount point
echo "📁 Creating mount point: $MOUNT_POINT"
mkdir -p "$MOUNT_POINT"

# Check if already mounted
if mountpoint -q "$MOUNT_POINT"; then
  echo "✅ Already mounted"
else
  echo "🔗 Mounting volume..."
  mount "$DEVICE" "$MOUNT_POINT"
  echo "✅ Mounted"
fi
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p "$MOUNT_POINT/logs"
mkdir -p "$MOUNT_POINT/logs/archive"
mkdir -p "$MOUNT_POINT/media"
mkdir -p "$MOUNT_POINT/playlists"
mkdir -p "$MOUNT_POINT/backups"

# Set permissions
chown -R root:root "$MOUNT_POINT"
chmod 755 "$MOUNT_POINT"
chmod 755 "$MOUNT_POINT/logs"
chmod 755 "$MOUNT_POINT/logs/archive"
chmod 755 "$MOUNT_POINT/media"
chmod 755 "$MOUNT_POINT/playlists"
chmod 755 "$MOUNT_POINT/backups"

echo "✅ Directory structure created"
echo ""

# Backup existing logs if any
if [ -d /var/log/liquidsoap ] && [ "$(ls -A /var/log/liquidsoap 2>/dev/null)" ]; then
  echo "📦 Backing up existing logs..."
  BACKUP_DIR="$MOUNT_POINT/logs/archive/backup-$TIMESTAMP"
  mkdir -p "$BACKUP_DIR"
  cp -r /var/log/liquidsoap/* "$BACKUP_DIR/" 2>/dev/null || true
  echo "✅ Logs backed up to: $BACKUP_DIR"
  echo ""
fi

# Create symlinks
echo "🔗 Creating symlinks..."
rm -rf /var/log/liquidsoap
ln -sf "$MOUNT_POINT/logs" /var/log/liquidsoap

rm -rf /opt/radio/media
mkdir -p /opt/radio
ln -sf "$MOUNT_POINT/media" /opt/radio/media

rm -rf /opt/radio/playlists
ln -sf "$MOUNT_POINT/playlists" /opt/radio/playlists

echo "✅ Symlinks created"
echo ""

# Get UUID for fstab
UUID=$(blkid -s UUID -o value "$DEVICE")
echo "📝 Volume UUID: $UUID"
echo ""

# Update fstab
if ! grep -q "$UUID" /etc/fstab; then
  echo "📝 Adding to /etc/fstab for automatic mount..."
  echo "UUID=$UUID  $MOUNT_POINT  ext4  defaults,nofail  0  2" >> /etc/fstab
  echo "✅ Added to fstab"
else
  echo "✅ Already in fstab"
fi
echo ""

# Create backup script
cat > /usr/local/bin/backup-logs-on-mount.sh << 'EOF'
#!/bin/bash
# Backup logs on mount
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
MOUNT_POINT="/data"
LOG_DIR="$MOUNT_POINT/logs"
ARCHIVE_DIR="$MOUNT_POINT/logs/archive/mount-$TIMESTAMP"

if [ -d "$LOG_DIR" ] && [ "$(ls -A $LOG_DIR/*.log 2>/dev/null)" ]; then
  mkdir -p "$ARCHIVE_DIR"
  mv $LOG_DIR/*.log "$ARCHIVE_DIR/" 2>/dev/null || true
  echo "Logs backed up to: $ARCHIVE_DIR"
fi
EOF

chmod +x /usr/local/bin/backup-logs-on-mount.sh
echo "✅ Backup script created"
echo ""

# Create systemd service for mount
cat > /etc/systemd/system/g-forge-data-mount.service << 'EOF'
[Unit]
Description=G-Forge Radio Data Volume Mount
After=local-fs.target
Before=liquidsoap.service
Before=icecast2.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/bin/sleep 5
ExecStart=/bin/mount -a
ExecStart=/usr/local/bin/backup-logs-on-mount.sh
ExecStop=/bin/umount /data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable g-forge-data-mount.service
echo "✅ Systemd service created and enabled"
echo ""

# Display summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DATA VOLUME SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Mount point: $MOUNT_POINT"
echo "Device: $DEVICE"
echo "UUID: $UUID"
echo ""
echo "Directory structure:"
echo "  $MOUNT_POINT/logs         → /var/log/liquidsoap"
echo "  $MOUNT_POINT/logs/archive → archived logs"
echo "  $MOUNT_POINT/media        → /opt/radio/media"
echo "  $MOUNT_POINT/playlists    → /opt/radio/playlists"
echo "  $MOUNT_POINT/backups      → system backups"
echo ""
echo "💾 Disk usage:"
df -h "$MOUNT_POINT"
echo ""
EOFSCRIPT

# Upload and execute script
echo "Uploading setup script to instance..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Setup data volume" \
  --parameters file:///dev/stdin \
  --region "$REGION" \
  --query 'Command.CommandId' \
  --output text << EOF
{
  "commands": [
    "$(cat /tmp/setup-data-volume-remote.sh | sed 's/"/\\"/g')"
  ]
}
EOF
)

echo "Command ID: $COMMAND_ID"
echo "Waiting for execution..."
sleep 10

# Get results
OUTPUT=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' \
  --output text)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$OUTPUT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Setup complete on instance!"
echo ""

# Cleanup
rm /tmp/setup-data-volume-remote.sh
