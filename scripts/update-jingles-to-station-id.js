#!/usr/bin/env node

/**
 * Update existing jingles from "WildFM Jingels" to "Station ID" genre
 * and add "WildFM" tags
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'Track-ksrqkyyu5fegnpzarwddkadlz4-prod';

async function updateJingles() {
  console.log('🔍 Scanning for WildFM Jingels...\n');

  // 1. Scan for all tracks with "WildFM Jingels" genre
  const scanResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'genre = :genre',
    ExpressionAttributeValues: {
      ':genre': 'WildFM Jingels'
    }
  }));

  const jingles = scanResult.Items || [];
  
  if (jingles.length === 0) {
    console.log('❌ No WildFM Jingels found in database');
    return;
  }

  console.log(`✅ Found ${jingles.length} jingles to update:\n`);
  jingles.forEach((j, i) => {
    console.log(`${i + 1}. ${j.title || 'Untitled'} (ID: ${j.id})`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 2. Update each jingle
  for (const jingle of jingles) {
    console.log(`🔄 Updating: ${jingle.title || 'Untitled'}...`);
    
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: jingle.id },
        UpdateExpression: 'SET genre = :newGenre, tags = :tags',
        ExpressionAttributeValues: {
          ':newGenre': 'Station ID',
          ':tags': 'WildFM'
        }
      }));
      
      console.log(`   ✅ Updated to: Station ID, tags: WildFM\n`);
    } catch (error) {
      console.error(`   ❌ Error updating ${jingle.title}:`, error.message, '\n');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Migration complete!\n');
  console.log('Updated:');
  console.log('  • Genre: "WildFM Jingels" → "Station ID"');
  console.log('  • Tags: null → "WildFM"');
  console.log('\nJingles will now appear in playlist generator! 🎤');
}

updateJingles().catch(console.error);
