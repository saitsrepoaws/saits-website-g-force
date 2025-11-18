#!/bin/bash

###############################################################################
# 📦 G-FORGE RADIO - BULK AUDIO UPLOAD SCRIPT
###############################################################################
#
# Purpose: Upload thousands of audio files to G-Forge Radio library
# Usage:   ./scripts/bulk-upload.sh [local-music-folder]
#
# Example: ./scripts/bulk-upload.sh ~/Music/MyLibrary
#
# Features:
# - Automatic bucket detection
# - Progress monitoring
# - Error handling
# - Audio file filtering
# - Dry-run mode
#
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="eu-west-1"
S3_PREFIX="public/audio/bulk/"

###############################################################################
# Functions
###############################################################################

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  📦 G-FORGE RADIO - BULK AUDIO UPLOAD${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

get_bucket_name() {
  if [ -f "amplify_outputs.json" ]; then
    BUCKET=$(cat amplify_outputs.json | jq -r '.storage.bucket_name' 2>/dev/null)
    if [ "$BUCKET" != "null" ] && [ -n "$BUCKET" ]; then
      echo -e "${GREEN}✓${NC} Found bucket: ${BUCKET}"
      return 0
    fi
  fi
  
  echo -e "${RED}✗${NC} Could not find bucket name in amplify_outputs.json"
  echo -e "${YELLOW}⚠${NC}  Please run: npx ampx sandbox"
  exit 1
}

count_audio_files() {
  local folder=$1
  local count=0
  
  for ext in mp3 wav flac m4a aac ogg; do
    local ext_count=$(find "$folder" -type f -iname "*.$ext" 2>/dev/null | wc -l | tr -d ' ')
    count=$((count + ext_count))
  done
  
  echo "$count"
}

estimate_cost() {
  local file_count=$1
  local s3_cost=$(echo "scale=2; $file_count * 0.000005" | bc)
  local sqs_cost=$(echo "scale=2; $file_count * 0.0000004" | bc)
  local lambda_cost=$(echo "scale=2; ($file_count / 10) * 0.0025" | bc)
  local total_cost=$(echo "scale=2; $s3_cost + $sqs_cost + $lambda_cost" | bc)
  
  echo "$total_cost"
}

###############################################################################
# Main Script
###############################################################################

print_header

# Check arguments
if [ $# -eq 0 ]; then
  echo -e "${RED}✗${NC} No music folder specified"
  echo ""
  echo "Usage: $0 [local-music-folder] [options]"
  echo ""
  echo "Options:"
  echo "  --dry-run     Show what would be uploaded without uploading"
  echo "  --help        Show this help message"
  echo ""
  echo "Example:"
  echo "  $0 ~/Music/MyLibrary"
  echo "  $0 ~/Music/MyLibrary --dry-run"
  echo ""
  exit 1
fi

if [ "$1" == "--help" ]; then
  echo "📦 G-Forge Radio - Bulk Audio Upload"
  echo ""
  echo "Usage: $0 [local-music-folder] [options]"
  echo ""
  echo "Arguments:"
  echo "  local-music-folder    Path to folder containing audio files"
  echo ""
  echo "Options:"
  echo "  --dry-run             Show what would be uploaded without uploading"
  echo "  --help                Show this help message"
  echo ""
  echo "Supported formats: .mp3, .wav, .flac, .m4a, .aac, .ogg"
  echo ""
  exit 0
fi

MUSIC_FOLDER=$1
DRY_RUN=false

if [ "$2" == "--dry-run" ]; then
  DRY_RUN=true
  echo -e "${YELLOW}⚠${NC}  DRY RUN MODE - No files will be uploaded"
  echo ""
fi

# Validate music folder
if [ ! -d "$MUSIC_FOLDER" ]; then
  echo -e "${RED}✗${NC} Folder not found: $MUSIC_FOLDER"
  exit 1
fi

echo -e "${GREEN}✓${NC} Music folder: $MUSIC_FOLDER"

# Count audio files
echo -n "  Counting audio files... "
FILE_COUNT=$(count_audio_files "$MUSIC_FOLDER")
echo -e "${GREEN}$FILE_COUNT${NC} files"

if [ "$FILE_COUNT" -eq 0 ]; then
  echo -e "${RED}✗${NC} No audio files found!"
  echo -e "${YELLOW}⚠${NC}  Supported formats: .mp3, .wav, .flac, .m4a, .aac, .ogg"
  exit 1
fi

# Get bucket name
get_bucket_name

# Estimate cost
ESTIMATED_COST=$(estimate_cost "$FILE_COUNT")
echo -e "${BLUE}ℹ${NC}  Estimated AWS cost: ~\$$ESTIMATED_COST"

# Calculate estimated time
BATCHES=$((FILE_COUNT / 10))
ESTIMATED_MINUTES=$((BATCHES / 2))  # ~2 batches per minute
echo -e "${BLUE}ℹ${NC}  Estimated processing time: ~${ESTIMATED_MINUTES} minutes"

# Confirm upload
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  READY TO UPLOAD${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Files:      $FILE_COUNT"
echo "  Bucket:     $BUCKET"
echo "  Prefix:     $S3_PREFIX"
echo "  Cost:       ~\$$ESTIMATED_COST"
echo "  Time:       ~$ESTIMATED_MINUTES minutes"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}  DRY RUN - Showing files that would be uploaded:${NC}"
  echo ""
  
  aws s3 sync "$MUSIC_FOLDER" "s3://$BUCKET/$S3_PREFIX" \
    --dryrun \
    --exclude "*" \
    --include "*.mp3" \
    --include "*.MP3" \
    --include "*.wav" \
    --include "*.WAV" \
    --include "*.flac" \
    --include "*.FLAC" \
    --include "*.m4a" \
    --include "*.M4A" \
    --include "*.aac" \
    --include "*.AAC" \
    --include "*.ogg" \
    --include "*.OGG" \
    --region "$REGION"
  
  echo ""
  echo -e "${GREEN}✓${NC} Dry run complete"
  echo -e "${BLUE}ℹ${NC}  Run without --dry-run to upload files"
  exit 0
fi

read -p "Proceed with upload? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo -e "${YELLOW}⚠${NC}  Upload cancelled"
  exit 0
fi

# Start upload
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🚀 UPLOADING...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

START_TIME=$(date +%s)

aws s3 sync "$MUSIC_FOLDER" "s3://$BUCKET/$S3_PREFIX" \
  --exclude "*" \
  --include "*.mp3" \
  --include "*.MP3" \
  --include "*.wav" \
  --include "*.WAV" \
  --include "*.flac" \
  --include "*.FLAC" \
  --include "*.m4a" \
  --include "*.M4A" \
  --include "*.aac" \
  --include "*.AAC" \
  --include "*.ogg" \
  --include "*.OGG" \
  --region "$REGION"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Upload complete
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ UPLOAD COMPLETE!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Files uploaded: $FILE_COUNT"
echo "  Upload time:    ${MINUTES}m ${SECONDS}s"
echo ""

# Get queue URL
QUEUE_URL=$(aws ssm get-parameter \
  --name /gforge-radio/bulk-upload/queue-url \
  --query Parameter.Value \
  --output text \
  --region "$REGION" 2>/dev/null || echo "")

if [ -n "$QUEUE_URL" ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  📊 MONITORING${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  Files are now being processed in batches of 10"
  echo "  Processing time: ~30-60 seconds per track"
  echo ""
  
  # Check queue
  QUEUE_DEPTH=$(aws sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names ApproximateNumberOfMessages \
    --query 'Attributes.ApproximateNumberOfMessages' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "0")
  
  echo "  Queue depth: $QUEUE_DEPTH messages"
  echo ""
  echo -e "${BLUE}ℹ${NC}  Monitor processing:"
  echo "     aws logs tail /aws/lambda/bulk-track-processor* --follow"
  echo ""
  echo -e "${BLUE}ℹ${NC}  Check queue:"
  echo "     aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names All"
  echo ""
fi

echo -e "${GREEN}✓${NC} Done!"
echo ""
