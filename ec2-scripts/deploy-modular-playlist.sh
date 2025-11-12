#!/bin/bash
# Deploy modular playlist system to EC2
# Run this script to set up the new playlist structure

set -e

INSTANCE_ID="i-05fdb5a1aa2d90088"
S3_BUCKET="radio-playlists-035636364722"

echo "🚀 Deploying modular playlist system to EC2..."

# 1. Upload scripts to S3
echo "📤 Uploading scripts to S3..."
aws s3 cp sync-playlist.sh s3://$S3_BUCKET/scripts/sync-playlist.sh
aws s3 cp radio-reload.liq s3://$S3_BUCKET/scripts/radio-reload.liq

# 2. Deploy to EC2 via SSM
echo "📦 Deploying to EC2..."
aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "echo '\''🔧 Setting up modular playlist system...'\''",
    "",
    "# Download scripts from S3",
    "/usr/local/bin/aws s3 cp s3://'"$S3_BUCKET"'/scripts/sync-playlist.sh /opt/radio/sync-playlist.sh",
    "/usr/local/bin/aws s3 cp s3://'"$S3_BUCKET"'/scripts/radio-reload.liq /etc/liquidsoap/radio-reload.liq",
    "",
    "# Make sync script executable",
    "chmod +x /opt/radio/sync-playlist.sh",
    "",
    "# Create log directory",
    "mkdir -p /var/log/radio",
    "touch /var/log/playlist-sync.log",
    "",
    "# Add cron job for playlist sync (every 5 minutes)",
    "echo '\''*/5 * * * * /opt/radio/sync-playlist.sh'\'' | crontab -",
    "",
    "# Backup old config",
    "cp /etc/liquidsoap/radio.liq /etc/liquidsoap/radio.liq.backup.$(date +%Y%m%d)",
    "",
    "# Create playlist directory",
    "mkdir -p /tmp/playlist/tracks",
    "",
    "# Initial sync",
    "/opt/radio/sync-playlist.sh",
    "",
    "# Restart Liquidsoap with new config",
    "systemctl stop liquidsoap || true",
    "sleep 2",
    "",
    "# Update systemd service to use new config",
    "sed -i '\''s|/etc/liquidsoap/radio.liq|/etc/liquidsoap/radio-reload.liq|'\'' /etc/systemd/system/liquidsoap.service",
    "systemctl daemon-reload",
    "systemctl start liquidsoap",
    "",
    "echo '\''✅ Modular playlist system deployed!'\''",
    "echo '\''📋 Cron job installed: */5 * * * * /opt/radio/sync-playlist.sh'\''",
    "echo '\''🎵 Liquidsoap restarted with reload support'\''",
    "systemctl status liquidsoap --no-pager | head -10"
  ]' \
  --output text \
  --query 'Command.CommandId'

echo "✅ Deployment command sent!"
echo "⏳ Waiting for execution..."
