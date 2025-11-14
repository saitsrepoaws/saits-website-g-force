#!/bin/bash

# Genre Merger CLI Tool
# Quick interface for genre management

set -e

LAMBDA_NAME=""
REGION="eu-west-1"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Find Lambda function
find_lambda() {
  echo -e "${BLUE}🔍 Finding genre-merger Lambda...${NC}"
  LAMBDA_NAME=$(aws lambda list-functions --region $REGION --output json 2>/dev/null | \
    jq -r '.Functions[] | select(.FunctionName | contains("genreMerger") or contains("genre-merger")) | .FunctionName' | head -1)
  
  if [ -z "$LAMBDA_NAME" ]; then
    echo -e "${RED}❌ Lambda not found! Deploy first with: npx ampx sandbox${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Found: $LAMBDA_NAME${NC}"
}

# Get genre statistics
stats() {
  find_lambda
  
  echo -e "${BLUE}📊 Getting genre statistics...${NC}"
  
  aws lambda invoke \
    --function-name "$LAMBDA_NAME" \
    --region $REGION \
    --payload '{"sourceGenres":["__STATS__"]}' \
    /tmp/genre-stats.json > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Genre Statistics:${NC}"
    cat /tmp/genre-stats.json | jq -r '.genreStats | to_entries | sort_by(.value) | reverse | .[] | "  \(.key): \(.value) tracks"'
    
    TOTAL=$(cat /tmp/genre-stats.json | jq -r '.totalTracks')
    GENRES=$(cat /tmp/genre-stats.json | jq -r '.totalGenres')
    echo ""
    echo -e "${YELLOW}Total: $TOTAL tracks across $GENRES genres${NC}"
  else
    echo -e "${RED}❌ Failed to get stats${NC}"
    exit 1
  fi
}

# Preview merge
preview() {
  find_lambda
  
  if [ $# -lt 2 ]; then
    echo -e "${RED}Usage: $0 preview <source_genre1,source_genre2,...> <target_genre>${NC}"
    exit 1
  fi
  
  # Parse comma-separated genres
  IFS=',' read -ra SOURCE_GENRES <<< "$1"
  TARGET_GENRE="$2"
  
  # Build JSON array
  SOURCE_JSON=$(printf '%s\n' "${SOURCE_GENRES[@]}" | jq -R . | jq -s .)
  
  echo -e "${YELLOW}🔍 Preview Mode (Dry Run)${NC}"
  echo -e "   Source genres: ${SOURCE_GENRES[@]}"
  echo -e "   Target genre: $TARGET_GENRE"
  echo ""
  
  PAYLOAD=$(jq -n \
    --argjson sources "$SOURCE_JSON" \
    --arg target "$TARGET_GENRE" \
    '{sourceGenres: $sources, targetGenre: $target, dryRun: true}')
  
  aws lambda invoke \
    --function-name "$LAMBDA_NAME" \
    --region $REGION \
    --payload "$PAYLOAD" \
    /tmp/genre-preview.json > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    AFFECTED=$(cat /tmp/genre-preview.json | jq -r '.tracksAffected')
    PLAYLISTS=$(cat /tmp/genre-preview.json | jq -r '.playlistsAffected')
    
    echo -e "${GREEN}✅ Preview Results:${NC}"
    echo -e "   ${YELLOW}$AFFECTED tracks${NC} would be updated"
    echo -e "   ${YELLOW}$PLAYLISTS playlists${NC} would be updated"
    echo ""
    echo -e "${BLUE}Sample tracks:${NC}"
    cat /tmp/genre-preview.json | jq -r '.preview[]? | "  \(.artist) - \(.title) [\(.oldGenre) → \(.newGenre)]"' | head -10
    echo ""
    echo -e "${YELLOW}To execute: $0 merge $1 $2${NC}"
  else
    echo -e "${RED}❌ Preview failed${NC}"
    cat /tmp/genre-preview.json
    exit 1
  fi
}

# Execute merge
merge() {
  find_lambda
  
  if [ $# -lt 2 ]; then
    echo -e "${RED}Usage: $0 merge <source_genre1,source_genre2,...> <target_genre>${NC}"
    exit 1
  fi
  
  # Parse comma-separated genres
  IFS=',' read -ra SOURCE_GENRES <<< "$1"
  TARGET_GENRE="$2"
  
  # Build JSON array
  SOURCE_JSON=$(printf '%s\n' "${SOURCE_GENRES[@]}" | jq -R . | jq -s .)
  
  echo -e "${RED}⚠️  LIVE MERGE MODE${NC}"
  echo -e "   Source genres: ${SOURCE_GENRES[@]}"
  echo -e "   Target genre: $TARGET_GENRE"
  echo ""
  read -p "Are you sure? This will update tracks! (yes/no): " confirm
  
  if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Cancelled${NC}"
    exit 0
  fi
  
  echo -e "${BLUE}🔄 Executing merge...${NC}"
  
  PAYLOAD=$(jq -n \
    --argjson sources "$SOURCE_JSON" \
    --arg target "$TARGET_GENRE" \
    '{sourceGenres: $sources, targetGenre: $target, dryRun: false}')
  
  aws lambda invoke \
    --function-name "$LAMBDA_NAME" \
    --region $REGION \
    --payload "$PAYLOAD" \
    /tmp/genre-merge.json > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    UPDATED=$(cat /tmp/genre-merge.json | jq -r '.tracksUpdated')
    PLAYLISTS=$(cat /tmp/genre-merge.json | jq -r '.playlistsUpdated')
    
    echo -e "${GREEN}✅ Merge Complete!${NC}"
    echo -e "   ${GREEN}$UPDATED tracks${NC} updated"
    echo -e "   ${GREEN}$PLAYLISTS playlists${NC} updated"
  else
    echo -e "${RED}❌ Merge failed${NC}"
    cat /tmp/genre-merge.json
    exit 1
  fi
}

# Help
help() {
  echo -e "${BLUE}Genre Merger CLI Tool${NC}"
  echo ""
  echo "Usage:"
  echo "  $0 stats                                    Get genre statistics"
  echo "  $0 preview <sources> <target>               Preview merge (dry run)"
  echo "  $0 merge <sources> <target>                 Execute merge"
  echo ""
  echo "Examples:"
  echo "  $0 stats"
  echo "  $0 preview 'Techno (Peak Time),Peak Time Techno' 'Techno'"
  echo "  $0 merge 'Techno (Peak Time),Peak Time Techno' 'Techno'"
  echo ""
  echo "Notes:"
  echo "  - Source genres are comma-separated (no spaces!)"
  echo "  - Always preview before merging"
  echo "  - Merge is NOT reversible!"
}

# Main
case "$1" in
  stats)
    stats
    ;;
  preview)
    preview "$2" "$3"
    ;;
  merge)
    merge "$2" "$3"
    ;;
  help|--help|-h|"")
    help
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    help
    exit 1
    ;;
esac
