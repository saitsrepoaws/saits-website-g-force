#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🔄 PLAYER RESTORE SCRIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Restore SplashFM player to previous version
# Usage: ./player-restore.sh [backup-file]
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

PLAYER_PATH="/var/www/splashfm/index.html"
BACKUP_DIR="/var/www/splashfm"

echo "🔄 PLAYER RESTORE UTILITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show available backups
echo "📋 Available backups:"
ssh radio-ec2 "ls -lht $BACKUP_DIR/*.backup* | head -10" | awk '{print NR". " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}'
echo ""

# If backup file provided as argument
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
    echo "Using specified backup: $BACKUP_FILE"
else
    # Interactive selection
    echo "Enter backup number (or full path), or 'latest' for most recent:"
    read -r SELECTION
    
    if [ "$SELECTION" = "latest" ]; then
        BACKUP_FILE=$(ssh radio-ec2 "ls -t $BACKUP_DIR/*.backup* | head -1")
        echo "Selected: $BACKUP_FILE"
    elif [[ "$SELECTION" =~ ^[0-9]+$ ]]; then
        BACKUP_FILE=$(ssh radio-ec2 "ls -t $BACKUP_DIR/*.backup* | sed -n ${SELECTION}p")
        echo "Selected: $BACKUP_FILE"
    else
        BACKUP_FILE="$SELECTION"
    fi
fi

# Verify backup exists
if ! ssh radio-ec2 "test -f $BACKUP_FILE"; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  WARNING: This will replace the current player!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Current player: $PLAYER_PATH"
echo "Restore from:   $BACKUP_FILE"
echo ""
echo "Continue? (yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "🔄 Restoring player..."
echo ""

# Create backup of current version before restore
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo "1. Backing up current version..."
ssh radio-ec2 "sudo cp $PLAYER_PATH ${PLAYER_PATH}.before-restore-$TIMESTAMP"
echo "   ✅ Backup: ${PLAYER_PATH}.before-restore-$TIMESTAMP"
echo ""

# Restore from backup
echo "2. Restoring from backup..."
ssh radio-ec2 "sudo cp $BACKUP_FILE $PLAYER_PATH"
echo "   ✅ Player restored"
echo ""

# Verify
echo "3. Verifying..."
if ssh radio-ec2 "test -f $PLAYER_PATH"; then
    SIZE=$(ssh radio-ec2 "stat -f%z $PLAYER_PATH 2>/dev/null || stat -c%s $PLAYER_PATH")
    echo "   ✅ File exists ($SIZE bytes)"
else
    echo "   ❌ Verification failed!"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RESTORE COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Player URL: http://46.137.184.91/"
echo "Test the player and verify it works correctly."
echo ""
echo "If you need to rollback this restore:"
echo "  ./player-restore.sh ${PLAYER_PATH}.before-restore-$TIMESTAMP"
echo ""
