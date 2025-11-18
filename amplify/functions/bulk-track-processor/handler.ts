import { SQSEvent, SQSRecord } from 'aws-lambda'
import { S3Client } from '@aws-sdk/client-s3'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

/**
 * 📦 BULK TRACK PROCESSOR
 * 
 * Processes audio files uploaded in bulk to S3
 * Triggered by SQS queue with batch size of 10
 */

const s3Client = new S3Client({ region: process.env.AWS_REGION })
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION })
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))

const TRACK_TABLE = process.env.TRACK_TABLE_NAME!
const STORAGE_BUCKET = process.env.STORAGE_BUCKET!
const AUDIO_METADATA_LAMBDA = process.env.AUDIO_METADATA_LAMBDA!

// Supported audio formats
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']

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

    // 2. Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (size > maxSize) {
      throw new Error(`File too large: ${(size / 1024 / 1024).toFixed(2)}MB (max 100MB)`)
    }

    // 3. Extract basic info from filename
    const filename = key.split('/').pop() || ''
    const trackId = generateTrackId(filename)

    console.log(`   📝 Track ID: ${trackId}`)
    console.log(`   📏 Size: ${(size / 1024 / 1024).toFixed(2)}MB`)

    // 4. Invoke audio-metadata Lambda for full processing
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
