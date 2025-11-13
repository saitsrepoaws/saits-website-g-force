#!/bin/bash

# Update existing jingles from "WildFM Jingels" to "Station ID" genre and add "WildFM" tags

TABLE_NAME="Track-ksrqkyyu5fegnpzarwddkadlz4-prod"
REGION="eu-west-1"

echo "🔍 Scanning for WildFM Jingels..."
echo ""

# Get all jingles with "WildFM Jingels" genre
JINGLES=$(aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --filter-expression "genre = :genre" \
  --expression-attribute-values '{":genre":{"S":"WildFM Jingels"}}' \
  --output json)

COUNT=$(echo "$JINGLES" | jq -r '.Count')

if [ "$COUNT" -eq 0 ]; then
  echo "❌ No WildFM Jingels found in database"
  exit 0
fi

echo "✅ Found $COUNT jingles to update:"
echo ""

# Display jingles
echo "$JINGLES" | jq -r '.Items[] | "• " + (.title.S // "Untitled") + " (ID: " + .id.S + ")"'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 Updating jingles..."
echo ""

# Update each jingle
echo "$JINGLES" | jq -r '.Items[] | .id.S' | while read -r JINGLE_ID; do
  TITLE=$(echo "$JINGLES" | jq -r ".Items[] | select(.id.S == \"$JINGLE_ID\") | .title.S // \"Untitled\"")
  
  echo "🔄 Updating: $TITLE..."
  
  aws dynamodb update-item \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --key "{\"id\":{\"S\":\"$JINGLE_ID\"}}" \
    --update-expression "SET genre = :newGenre, tags = :tags" \
    --expression-attribute-values '{":newGenre":{"S":"Station ID"},":tags":{"S":"WildFM"}}' \
    --return-values UPDATED_NEW \
    --output json > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Updated to: Station ID, tags: WildFM"
  else
    echo "   ❌ Error updating $TITLE"
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Migration complete!"
echo ""
echo "Updated:"
echo "  • Genre: \"WildFM Jingels\" → \"Station ID\""
echo "  • Tags: null → \"WildFM\""
echo ""
echo "Jingles will now appear in playlist generator! 🎤"
