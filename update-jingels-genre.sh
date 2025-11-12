#!/bin/bash

# Script to update jingels genre to "WildFM Jingels"

TABLE_NAME="Track-ksrqkyyu5fegnpzarwddkadlz4-prod"

echo "🎵 Update Jingels Genre Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to update a single track
update_track() {
  local track_id="$1"
  local artist="$2"
  local title="$3"
  
  echo "Updating: $artist - $title"
  
  aws dynamodb update-item \
    --table-name "$TABLE_NAME" \
    --key "{\"id\":{\"S\":\"$track_id\"}}" \
    --update-expression "SET genre = :genre, updatedAt = :now" \
    --expression-attribute-values "{\":genre\":{\"S\":\"WildFM Jingels\"},\":now\":{\"S\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" \
    --return-values UPDATED_NEW \
    > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "  ✅ Updated"
  else
    echo "  ❌ Failed"
  fi
}

# OPTIE 1: Update op basis van track IDs
# Als je de exacte track IDs hebt, uncomment en vul in:
# update_track "track-id-1" "Artist" "Title"
# update_track "track-id-2" "Artist" "Title"

# OPTIE 2: Search en update tracks met specifieke keywords
echo "Searching for potential jingels..."
echo ""

# Get all tracks and filter locally
aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --query 'Items[*].{ID:id.S, Artist:artist.S, Title:title.S, FileUrl:fileUrl.S}' \
  --output json > /tmp/all_tracks.json

# Show tracks for manual review
echo "All tracks (first 10):"
cat /tmp/all_tracks.json | jq -r '.[:10] | .[] | "\(.ID) | \(.Artist) - \(.Title)"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "OPTIONS TO UPDATE JINGELS:"
echo ""
echo "1. Provide Track IDs manually"
echo "   Edit this script and add:"
echo "   update_track \"TRACK_ID\" \"Artist\" \"Title\""
echo ""
echo "2. Update by filename pattern (if jingels have specific naming)"
echo "   Example: files containing 'jingle' or 'wild'"
echo ""
echo "3. List all tracks and you tell me which 7 to update"
echo ""
echo "Run this to see all tracks:"
echo "  cat /tmp/all_tracks.json | jq -r '.[] | \"\\(.ID) | \\(.Artist) - \\(.Title)\"'"
echo ""
echo "Then update specific ones by ID:"
echo "  ./update-jingels-genre.sh TRACK_ID_1 TRACK_ID_2 ... TRACK_ID_7"
echo ""

# If track IDs provided as arguments
if [ $# -gt 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Updating provided track IDs..."
  echo ""
  
  for track_id in "$@"; do
    # Get track info
    TRACK_INFO=$(cat /tmp/all_tracks.json | jq -r ".[] | select(.ID == \"$track_id\") | \"\\(.Artist) - \\(.Title)\"")
    
    if [ ! -z "$TRACK_INFO" ]; then
      ARTIST=$(echo "$TRACK_INFO" | cut -d'-' -f1 | xargs)
      TITLE=$(echo "$TRACK_INFO" | cut -d'-' -f2- | xargs)
      update_track "$track_id" "$ARTIST" "$TITLE"
    else
      echo "Track ID not found: $track_id"
    fi
  done
  
  echo ""
  echo "✅ Update complete!"
fi
