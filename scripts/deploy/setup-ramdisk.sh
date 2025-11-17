#!/bin/bash
################################################################################
# G-FORGE RADIO - Setup RAM Disk
################################################################################
# CodeDeploy BeforeInstall Hook
# Creates and mounts RAM disk for optimal performance
################################################################################

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 SETTING UP RAM DISK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# STEP 1: CREATE MOUNT POINT
# ============================================================================
echo "=== 1. CREATING MOUNT POINT ==="

mkdir -p /mnt/ramdisk
echo "✅ Mount point created: /mnt/ramdisk"
echo ""

# ============================================================================
# STEP 2: CHECK IF ALREADY MOUNTED
# ============================================================================
echo "=== 2. CHECKING IF ALREADY MOUNTED ==="

if mountpoint -q /mnt/ramdisk; then
  echo "⚠️  RAM disk already mounted"
  echo "   Unmounting..."
  umount /mnt/ramdisk
  echo "✅ Unmounted"
fi

echo ""

# ============================================================================
# STEP 3: MOUNT RAM DISK
# ============================================================================
echo "=== 3. MOUNTING RAM DISK ==="

# Mount 3GB tmpfs
mount -t tmpfs -o size=3G,mode=1777 tmpfs /mnt/ramdisk

echo "✅ RAM disk mounted (3GB)"
echo ""

# ============================================================================
# STEP 4: ADD TO FSTAB (PERSISTENT)
# ============================================================================
echo "=== 4. ADDING TO FSTAB ==="

# Remove old entry if exists
sed -i '/\/mnt\/ramdisk/d' /etc/fstab

# Add new entry
echo "tmpfs /mnt/ramdisk tmpfs size=3G,mode=1777 0 0" >> /etc/fstab

echo "✅ Added to /etc/fstab (persistent on reboot)"
echo ""

# ============================================================================
# STEP 5: CREATE DIRECTORY STRUCTURE
# ============================================================================
echo "=== 5. CREATING DIRECTORY STRUCTURE ==="

mkdir -p /mnt/ramdisk/configs/liquidsoap
mkdir -p /mnt/ramdisk/configs/icecast
mkdir -p /mnt/ramdisk/configs/nginx/sites-enabled
mkdir -p /mnt/ramdisk/logs
mkdir -p /mnt/ramdisk/tmp

# Set permissions
chmod -R 777 /mnt/ramdisk

echo "✅ Directory structure created"
echo ""

# ============================================================================
# STEP 6: VERIFICATION
# ============================================================================
echo "=== 6. VERIFICATION ==="
echo ""

echo "Mount status:"
df -h /mnt/ramdisk

echo ""
echo "Directory structure:"
ls -la /mnt/ramdisk

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ RAM DISK SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "RAM disk ready at: /mnt/ramdisk (3GB)"
echo "Next: Pull configs from Parameter Store"
echo ""

exit 0
