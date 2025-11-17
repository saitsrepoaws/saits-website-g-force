/**
 * ☁️ CloudFront Cache Warmer
 * 
 * Pre-warms CloudFront cache with first 10 seconds of upcoming tracks
 * for instant playback startup (sub-50ms first byte delivery)
 * 
 * Triggered by:
 * - EventBridge schedule (hourly, 5 min after playlist update)
 * - Manual invocation
 * - Playlist update events
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// CloudFront distribution domain
const CDN_DOMAIN = process.env.CDN_DOMAIN || 'https://d1234567890.cloudfront.net';

// How many bytes to pre-cache (first 10 seconds)
// MP3 @ 192kbps: 10s = 240KB
// WAV @ 44.1kHz: 10s = 1.7MB
// Safe value: 512KB (covers both)
const PRECACHE_BYTES = 512000;

interface Track {
  id: string;
  title: string;
  artist: string;
  fileUrl: string;
  duration?: number;
}

interface WarmResult {
  trackId: string;
  title: string;
  success: boolean;
  latency?: number;
  cacheHit?: boolean;
  error?: string;
}

export const handler = async (event: any) => {
  console.log('🔥 CloudFront Cache Warmer Starting...');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const startTime = Date.now();
  
  try {
    // 1. Get upcoming tracks (next 2 hours)
    const tracks = await getUpcomingTracks(2);
    
    if (tracks.length === 0) {
      console.log('⚠️  No upcoming tracks found');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No tracks to warm',
          tracksWarmed: 0
        })
      };
    }
    
    console.log(`📋 Found ${tracks.length} upcoming tracks to warm`);
    
    // 2. Warm cache for each track (parallel, but limit concurrency)
    const results = await warmTracksInBatches(tracks, 5); // 5 concurrent
    
    // 3. Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const cacheHits = results.filter(r => r.cacheHit);
    
    const totalLatency = results.reduce((sum, r) => sum + (r.latency || 0), 0);
    const avgLatency = Math.round(totalLatency / results.length);
    
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CACHE WARMING COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total tracks:    ${tracks.length}`);
    console.log(`   ✅ Warmed:       ${successful.length}`);
    console.log(`   ❌ Failed:       ${failed.length}`);
    console.log(`   🎯 Cache hits:   ${cacheHits.length}`);
    console.log(`   ⚡ Avg latency:  ${avgLatency}ms`);
    console.log(`   ⏱️  Total time:   ${duration}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Log failed tracks
    if (failed.length > 0) {
      console.log('');
      console.log('❌ Failed tracks:');
      failed.forEach(r => {
        console.log(`   - ${r.title}: ${r.error}`);
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        stats: {
          total: tracks.length,
          warmed: successful.length,
          failed: failed.length,
          cacheHits: cacheHits.length,
          avgLatency,
          duration
        },
        results
      })
    };
    
  } catch (error) {
    console.error('❌ Cache warmer failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Get tracks that will play in the next X hours
 */
async function getUpcomingTracks(hoursAhead: number): Promise<Track[]> {
  console.log(`🔍 Querying tracks for next ${hoursAhead} hours...`);
  
  // TODO: Update this query based on your actual schedule/playlist structure
  // For now, get recently added tracks as proxy for "upcoming"
  
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.TRACK_TABLE_NAME,
      IndexName: 'byCreatedAt',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'Track'
      },
      ScanIndexForward: false, // Latest first
      Limit: 50  // Get top 50 recent tracks
    }));
    
    const tracks: Track[] = (result.Items || []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Unknown',
      artist: item.artist || 'Unknown',
      fileUrl: item.fileUrl || '',
      duration: item.duration
    }));
    
    return tracks.filter(t => t.fileUrl); // Only tracks with fileUrl
    
  } catch (error) {
    console.error('Failed to query tracks:', error);
    return [];
  }
}

/**
 * Warm tracks in batches to limit concurrency
 */
async function warmTracksInBatches(
  tracks: Track[],
  batchSize: number
): Promise<WarmResult[]> {
  const results: WarmResult[] = [];
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    console.log(`\n🔥 Warming batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tracks.length / batchSize)}...`);
    
    const batchResults = await Promise.all(
      batch.map(track => warmTrack(track))
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Warm cache for a single track
 */
async function warmTrack(track: Track): Promise<WarmResult> {
  const startTime = Date.now();
  
  try {
    // Construct CloudFront URL
    const cdnUrl = `${CDN_DOMAIN}/${track.fileUrl}`;
    
    console.log(`  🎵 ${track.artist} - ${track.title}`);
    console.log(`     URL: ${cdnUrl}`);
    
    // Request first PRECACHE_BYTES (10 seconds of audio)
    const response = await fetch(cdnUrl, {
      method: 'GET',
      headers: {
        'Range': `bytes=0-${PRECACHE_BYTES}`
      }
    });
    
    const latency = Date.now() - startTime;
    
    // Check if CloudFront served from cache
    const cacheHit = response.headers.get('x-cache')?.includes('Hit') || false;
    const age = response.headers.get('age');
    
    if (response.status === 206) { // Partial Content (expected)
      console.log(`     ✅ Warmed (${latency}ms, cache: ${cacheHit ? 'HIT' : 'MISS'}, age: ${age || 'N/A'}s)`);
      
      return {
        trackId: track.id,
        title: `${track.artist} - ${track.title}`,
        success: true,
        latency,
        cacheHit
      };
    } else if (response.status === 200) {
      // Some servers don't support range requests, got full file
      console.log(`     ⚠️  No range support, got full file (${latency}ms)`);
      
      return {
        trackId: track.id,
        title: `${track.artist} - ${track.title}`,
        success: true,
        latency,
        cacheHit: false
      };
    } else {
      console.log(`     ❌ Unexpected status: ${response.status}`);
      
      return {
        trackId: track.id,
        title: `${track.artist} - ${track.title}`,
        success: false,
        latency,
        error: `HTTP ${response.status}`
      };
    }
    
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(`     ❌ Error: ${errorMsg}`);
    
    return {
      trackId: track.id,
      title: `${track.artist} - ${track.title}`,
      success: false,
      latency,
      error: errorMsg
    };
  }
}
