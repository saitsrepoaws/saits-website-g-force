#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎨 REACT PLAYER APP DEPLOYMENT SCRIPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Deploys the React player app (apps/web) to nginx on EC2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

APP_DIR="/Users/gerard/Desktop/T7/g-forge-iot/apps/web"
DIST_DIR="$APP_DIR/dist"
TARGET_PATH="/var/www/splashfm/player"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "🎨 REACT PLAYER APP DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if dist exists
if [ ! -d "$DIST_DIR" ]; then
    echo "❌ Error: dist folder not found at $DIST_DIR"
    echo ""
    echo "Please build the app first:"
    echo "  cd $APP_DIR"
    echo "  npm run build"
    exit 1
fi

echo "📦 Step 1: Creating tarball..."
cd "$APP_DIR"
tar -czf /tmp/player-app-$TIMESTAMP.tar.gz -C dist .
echo "   ✅ Created: /tmp/player-app-$TIMESTAMP.tar.gz"
echo ""

echo "⬆️  Step 2: Uploading to EC2..."
scp /tmp/player-app-$TIMESTAMP.tar.gz radio-ec2:/tmp/
echo "   ✅ Uploaded"
echo ""

echo "🔄 Step 3: Deploying on EC2..."
ssh radio-ec2 "
echo '📦 Backing up current version...'
if [ -d $TARGET_PATH ]; then
    sudo mv $TARGET_PATH ${TARGET_PATH}.backup-$TIMESTAMP
    echo '   ✅ Backup: ${TARGET_PATH}.backup-$TIMESTAMP'
fi
echo ''
echo '📂 Creating new directory...'
sudo mkdir -p $TARGET_PATH
echo ''
echo '📦 Extracting new version...'
sudo tar -xzf /tmp/player-app-$TIMESTAMP.tar.gz -C $TARGET_PATH/
echo ''
echo '🔑 Setting permissions...'
sudo chown -R www-data:www-data $TARGET_PATH
sudo chmod -R 755 $TARGET_PATH
echo '   ✅ Permissions set'
echo ''
echo '✅ Deployment complete!'
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Player URL: http://46.137.184.91/player/"
echo ""
echo "📊 Deployed files:"
ssh radio-ec2 "ls -lh $TARGET_PATH/"
echo ""
echo "🧪 Testing endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://46.137.184.91/player/)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ HTTP $HTTP_CODE - Player is live!"
else
    echo "   ⚠️  HTTP $HTTP_CODE - Check deployment"
fi

echo ""
echo "🔄 To rollback if needed:"
echo "   ssh radio-ec2 'sudo mv ${TARGET_PATH}.backup-$TIMESTAMP $TARGET_PATH'"
echo ""
