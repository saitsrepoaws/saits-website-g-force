#!/bin/bash
# Backup Current Deployment - CodeDeploy Hook
# G-Forge IoT Radio Platform

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 BACKING UP CURRENT DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BACKUP_DIR="/opt/g-forge/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup web files
if [ -d "/var/www/splashfm" ]; then
    echo "Backing up web files..."
    cp -r /var/www/splashfm "$BACKUP_DIR/web"
    echo "✅ Web files backed up"
fi

# Backup configs
if [ -d "/opt/g-forge/amplify" ]; then
    echo "Backing up amplify configs..."
    cp -r /opt/g-forge/amplify "$BACKUP_DIR/amplify"
    echo "✅ Amplify configs backed up"
fi

# Keep only last 5 backups
echo "Cleaning old backups..."
ls -t /opt/g-forge/backups/ | tail -n +6 | xargs -I {} rm -rf /opt/g-forge/backups/{}

echo "✅ Backup complete: $BACKUP_DIR"
