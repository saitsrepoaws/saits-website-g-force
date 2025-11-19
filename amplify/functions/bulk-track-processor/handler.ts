import { SQSEvent, SQSRecord } from 'aws-lambda'
import { S3Client, CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

/**
 * 📦 BULK TRACK PROCESSOR
 * 
 * Processes audio files uploaded in bulk to S3
 * Triggered by SQS queue with batch size of 10
 * 
 * Features:
 * - File validation (0 bytes check)
 * - Deduplication (title + artist)
 * - Post-processing backup to S3 Glacier
 * - Metadata JSON export
 * - Automatic cleanup of processed files
 */

const s3Client = new S3Client({ region: process.env.AWS_REGION })
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION })
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))

const TRACK_TABLE = process.env.TRACK_TABLE_NAME!
const STORAGE_BUCKET = process.env.STORAGE_BUCKET!
const AUDIO_METADATA_LAMBDA = process.env.AUDIO_METADATA_LAMBDA!

// Supported audio formats
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']

// Backup configuration
const BACKUP_PREFIX = 'backup/audio/' // S3 prefix for backups (will transition to Glacier)
const MIN_FILE_SIZE = 100 // Minimum 100 bytes (reject 0 byte files)

interface S3EventRecord {
  s3: {
    bucket: {
      name: string
    }
    object: {
      key: string
      size: number
    }
  }
  eventName: string
}

interface ProcessingResult {
  success: boolean
  key: string
  error?: string
}

export const handler = async (event: SQSEvent) => {
  console.log('📦 Bulk Track Processor started')
  console.log(`Processing batch of ${event.Records.length} SQS messages`)

  const results: ProcessingResult[] = []

  for (const record of event.Records) {
    try {
      const s3Event = JSON.parse(record.body) as { Records: S3EventRecord[] }
      
      for (const s3Record of s3Event.Records) {
        const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '))
        const result = await processTrack(key, s3Record.s3.object.size)
        results.push(result)
      }
    } catch (error) {
      console.error('❌ Error processing SQS record:', error)
      results.push({
        success: false,
        key: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Log summary
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  console.log(`\n📊 Batch Processing Summary:`)
  console.log(`   ✅ Successful: ${successful}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📦 Total: ${results.length}`)

  // If any failures, log them
  if (failed > 0) {
    console.log('\n❌ Failed tracks:')
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.key}: ${r.error}`)
    })
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: results.length,
      successful,
      failed,
      results
    })
  }
}

async function processTrack(key: string, size: number): Promise<ProcessingResult> {
  try {
    console.log(`\n🎵 Processing track: ${key}`)

    // 1. Validate audio file
    if (!isAudioFile(key)) {
      console.log(`⚠️  Skipping non-audio file: ${key}`)
      return { success: true, key } // Not an error, just skip
    }

    // 2. Validate file size (not 0 bytes and max 100MB)
    if (size < MIN_FILE_SIZE) {
      console.log(`   ❌ File too small: ${size} bytes (min ${MIN_FILE_SIZE} bytes)`)
      throw new Error(`File is empty or corrupted: ${size} bytes`)
    }

    const maxSize = 100 * 1024 * 1024 // 100MB
    if (size > maxSize) {
      throw new Error(`File too large: ${(size / 1024 / 1024).toFixed(2)}MB (max 100MB)`)
    }

    console.log(`   ✅ File size valid: ${(size / 1024 / 1024).toFixed(2)}MB`)

    // 3. Extract basic info from filename
    const filename = key.split('/').pop() || ''
    const trackId = generateTrackId(filename)
    const { title, artist } = extractMetadataFromFilename(filename)

    console.log(`   📝 Track ID: ${trackId}`)
    console.log(`   🎵 Title: ${title}`)
    console.log(`   👤 Artist: ${artist}`)

    // 4. Check for duplicates (same title + artist)
    const isDuplicate = await checkDuplicate(title, artist)
    if (isDuplicate) {
      console.log(`   ⚠️  Duplicate detected: "${artist} - ${title}"`)
      console.log(`   🗑️  Skipping duplicate and moving to backup...`)
      
      // Move duplicate to backup without processing
      await moveToBackup(key, {
        id: trackId,
        title,
        artist,
        filename,
        size,
        duplicate: true,
        processedAt: new Date().toISOString()
      })
      
      return { success: true, key, error: 'Duplicate (skipped)' }
    }

    console.log(`   ✅ No duplicate found`)

    // 5. Invoke audio-metadata Lambda for full processing
    // This Lambda will handle:
    // - Metadata extraction
    // - Cover art generation
    // - Invoking waveform-generator
    // - Invoking audio-analyzer
    // - Saving to DynamoDB
    const payload = {
      Records: [{
        s3: {
          bucket: { name: STORAGE_BUCKET },
          object: { key, size }
        }
      }]
    }

    console.log(`   🚀 Invoking audio-metadata Lambda...`)
    
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: AUDIO_METADATA_LAMBDA,
      InvocationType: 'Event', // Async invocation
      Payload: Buffer.from(JSON.stringify(payload))
    }))

    if (response.StatusCode === 202) {
      console.log(`   ✅ Successfully queued for processing`)
      
      // 6. Post-processing: Move to backup after successful processing
      // Note: This happens async, actual metadata will be added by audio-metadata Lambda
      console.log(`   📦 Scheduling backup after processing...`)
      
      // We'll create a basic metadata record now, full metadata added later
      const basicMetadata = {
        id: trackId,
        title,
        artist,
        filename,
        size,
        originalKey: key,
        processedAt: new Date().toISOString(),
        status: 'processing'
      }
      
      // Schedule backup (will happen after metadata extraction)
      // For now, just log - actual backup happens in audio-metadata Lambda
      console.log(`   ℹ️  Backup will occur after metadata extraction`)
      
      return { success: true, key }
    } else {
      throw new Error(`Lambda invocation failed with status: ${response.StatusCode}`)
    }

  } catch (error) {
    console.error(`   ❌ Error processing track:`, error)
    return {
      success: false,
      key,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function isAudioFile(key: string): boolean {
  const extension = key.toLowerCase().substring(key.lastIndexOf('.'))
  return AUDIO_EXTENSIONS.includes(extension)
}

function generateTrackId(filename: string): string {
  // Remove extension and special chars
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-')
  const timestamp = Date.now()
  return `${base}-${timestamp}`.toLowerCase()
}

function extractMetadataFromFilename(filename: string): { title: string; artist: string } {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Try to extract artist and title from common patterns:
  // "Artist - Title.mp3"
  // "Artist_-_Title.mp3"
  // "01 - Artist - Title.mp3"
  // "Title.mp3" (no artist)
  
  let artist = 'Unknown Artist'
  let title = nameWithoutExt
  
  // Pattern: "Artist - Title" or "Artist_-_Title"
  const dashPattern = /^(.+?)\s*[-–—]\s*(.+)$/
  const match = nameWithoutExt.match(dashPattern)
  
  if (match) {
    // Remove track numbers if present (e.g., "01 - Artist")
    const possibleArtist = match[1].replace(/^\d+\s*[-.]?\s*/, '')
    artist = possibleArtist.trim()
    title = match[2].trim()
  }
  
  // Clean up underscores and extra spaces
  artist = artist.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  title = title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  
  return { title, artist }
}

async function checkDuplicate(title: string, artist: string): Promise<boolean> {
  try {
    // Normalize for comparison (lowercase, remove special chars)
    const normalizeString = (str: string) => 
      str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    
    const normalizedTitle = normalizeString(title)
    const normalizedArtist = normalizeString(artist)
    
    // Query DynamoDB for tracks with same artist
    // Note: This requires a GSI on artist field for efficient querying
    // For now, we'll do a scan with filter (not ideal for large datasets)
    // TODO: Add GSI on artist field for better performance
    
    const result = await dynamoClient.send(new QueryCommand({
      TableName: TRACK_TABLE,
      IndexName: 'tracksByArtistAndTitle', // GSI: artist (HASH) + title (RANGE)
      KeyConditionExpression: 'artist = :artist AND title = :title',
      ExpressionAttributeValues: {
        ':artist': artist,
        ':title': title
      },
      Limit: 1
    }))
    
    return (result.Items?.length || 0) > 0
  } catch (error) {
    // If GSI doesn't exist or query fails, log warning and continue
    console.warn(`   ⚠️  Duplicate check failed (GSI may not exist):`, error)
    return false // Don't block processing if duplicate check fails
  }
}

async function moveToBackup(
  sourceKey: string, 
  metadata: {
    id: string
    title: string
    artist: string
    filename: string
    size: number
    duplicate?: boolean
    processedAt: string
    [key: string]: any
  }
): Promise<void> {
  try {
    const filename = sourceKey.split('/').pop() || 'unknown.mp3'
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    // Backup paths
    const backupAudioKey = `${BACKUP_PREFIX}${timestamp}/${filename}`
    const backupMetadataKey = `${BACKUP_PREFIX}${timestamp}/${filename}.json`
    
    console.log(`   📦 Moving to backup: ${backupAudioKey}`)
    
    // 1. Copy audio file to backup location
    await s3Client.send(new CopyObjectCommand({
      Bucket: STORAGE_BUCKET,
      CopySource: `${STORAGE_BUCKET}/${sourceKey}`,
      Key: backupAudioKey,
      StorageClass: 'GLACIER_IR', // Instant Retrieval Glacier (cheap, fast access when needed)
      Metadata: {
        'original-key': sourceKey,
        'processed-at': metadata.processedAt,
        'duplicate': String(metadata.duplicate || false)
      }
    }))
    
    console.log(`   ✅ Audio file backed up`)
    
    // 2. Save metadata JSON alongside audio file
    await s3Client.send(new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: backupMetadataKey,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json',
      StorageClass: 'GLACIER_IR'
    }))
    
    console.log(`   ✅ Metadata JSON saved`)
    
    // 3. Delete original file from bulk upload folder
    await s3Client.send(new DeleteObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: sourceKey
    }))
    
    console.log(`   🗑️  Original file deleted from bulk folder`)
    
  } catch (error) {
    console.error(`   ❌ Backup failed:`, error)
    throw error
  }
}
