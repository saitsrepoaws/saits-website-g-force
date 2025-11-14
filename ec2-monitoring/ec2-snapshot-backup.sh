#!/bin/bash

# 💾 EC2 Automated Snapshot Backup
# Creates daily snapshots of EC2 instance volume

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTANCE_ID="i-021451e919d39c898"
REGION="eu-west-1"
RETENTION_DAYS=7  # Keep snapshots for 7 days
TIMESTAMP=$(date +"%Y-%m-%d-%H%M")
TAG_NAME="SplashFM-Daily-Backup-${TIMESTAMP}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   💾 EC2 Snapshot Backup              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Get Volume ID
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📀 Step 1/4: Getting volume information...${NC}"

VOLUME_ID=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' \
    --output text)

if [ -z "$VOLUME_ID" ] || [ "$VOLUME_ID" = "None" ]; then
    echo -e "${RED}❌ Failed to get volume ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Volume ID: $VOLUME_ID${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Create Snapshot
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}📸 Step 2/4: Creating snapshot...${NC}"

SNAPSHOT_ID=$(aws ec2 create-snapshot \
    --volume-id $VOLUME_ID \
    --description "SplashFM EC2 Daily Backup - $TIMESTAMP" \
    --region $REGION \
    --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=$TAG_NAME},{Key=AutoBackup,Value=true},{Key=Instance,Value=$INSTANCE_ID},{Key=CreatedAt,Value=$TIMESTAMP}]" \
    --query 'SnapshotId' \
    --output text)

if [ -z "$SNAPSHOT_ID" ]; then
    echo -e "${RED}❌ Failed to create snapshot${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Snapshot created: $SNAPSHOT_ID${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Wait for snapshot completion (optional - can be async)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}⏳ Step 3/4: Waiting for snapshot to complete...${NC}"
echo -e "${YELLOW}   (This can take 5-15 minutes for an 8GB volume)${NC}"

# Check status every 30 seconds
MAX_WAIT=1800  # 30 minutes max
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws ec2 describe-snapshots \
        --snapshot-ids $SNAPSHOT_ID \
        --region $REGION \
        --query 'Snapshots[0].State' \
        --output text)
    
    PROGRESS=$(aws ec2 describe-snapshots \
        --snapshot-ids $SNAPSHOT_ID \
        --region $REGION \
        --query 'Snapshots[0].Progress' \
        --output text)
    
    if [ "$STATUS" = "completed" ]; then
        echo -e "${GREEN}✅ Snapshot completed (100%)${NC}"
        break
    elif [ "$STATUS" = "error" ]; then
        echo -e "${RED}❌ Snapshot failed${NC}"
        exit 1
    else
        echo -e "${YELLOW}   Progress: $PROGRESS - Status: $STATUS${NC}"
        sleep 30
        ELAPSED=$((ELAPSED + 30))
    fi
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}⚠️  Timeout waiting for snapshot, but it's still processing${NC}"
    echo -e "${YELLOW}   Check status later with: aws ec2 describe-snapshots --snapshot-ids $SNAPSHOT_ID${NC}"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Cleanup old snapshots
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${BLUE}🧹 Step 4/4: Cleaning up old snapshots...${NC}"

# Calculate date threshold
CUTOFF_DATE=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%d)

# Get old snapshots
OLD_SNAPSHOTS=$(aws ec2 describe-snapshots \
    --region $REGION \
    --owner-ids self \
    --filters "Name=tag:AutoBackup,Values=true" "Name=tag:Instance,Values=$INSTANCE_ID" \
    --query "Snapshots[?StartTime<='${CUTOFF_DATE}'].SnapshotId" \
    --output text)

if [ -n "$OLD_SNAPSHOTS" ]; then
    echo -e "${YELLOW}   Found old snapshots to delete:${NC}"
    
    for SNAP_ID in $OLD_SNAPSHOTS; do
        echo -e "${YELLOW}   Deleting: $SNAP_ID${NC}"
        aws ec2 delete-snapshot \
            --snapshot-id $SNAP_ID \
            --region $REGION 2>/dev/null || true
    done
    
    echo -e "${GREEN}✅ Old snapshots cleaned up${NC}"
else
    echo -e "${YELLOW}   No old snapshots to delete${NC}"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Send metrics to CloudWatch
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

aws cloudwatch put-metric-data \
    --namespace "SplashFM" \
    --metric-name "BackupCreated" \
    --value 1 \
    --dimensions Instance=$INSTANCE_ID 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ BACKUP COMPLETE!                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   Instance:      ${GREEN}$INSTANCE_ID${NC}"
echo -e "   Volume:        ${GREEN}$VOLUME_ID${NC}"
echo -e "   Snapshot:      ${GREEN}$SNAPSHOT_ID${NC}"
echo -e "   Timestamp:     ${GREEN}$TIMESTAMP${NC}"
echo -e "   Retention:     ${GREEN}$RETENTION_DAYS days${NC}"
echo ""
echo -e "${YELLOW}🔄 Restore command:${NC}"
echo "   aws ec2 create-volume --snapshot-id $SNAPSHOT_ID --availability-zone eu-west-1a"
echo ""
echo -e "${YELLOW}📋 List all backups:${NC}"
echo "   aws ec2 describe-snapshots --owner-ids self --filters \"Name=tag:AutoBackup,Values=true\""
echo ""
