import { defineFunction } from '@aws-amplify/backend'

/**
 * 📦 BULK TRACK PROCESSOR
 * 
 * Purpose: Process audio files uploaded in bulk to S3
 * Trigger: SQS queue (receives S3 events)
 * Batch size: 10 tracks per invocation
 * 
 * Flow:
 * 1. S3 bulk upload → S3 event → SQS queue
 * 2. SQS batches events (10 max)
 * 3. Lambda processes batch
 * 4. For each track:
 *    - Extract metadata
 *    - Invoke audio-analyzer
 *    - Invoke waveform-generator
 *    - Save to DynamoDB
 * 
 * Features:
 * - Batch processing (no throttling)
 * - Audio file validation (.mp3, .wav, .flac, .m4a, .aac)
 * - Error handling per track
 * - CloudWatch metrics
 */

export const bulkTrackProcessor = defineFunction({
  name: 'bulk-track-processor',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 300, // 5 minutes for batch processing
  memoryMB: 2048, // More memory for batch processing
  environment: {
    // Will be set in backend.ts:
    // TRACK_TABLE_NAME
    // STORAGE_BUCKET
    // AUDIO_METADATA_LAMBDA
    // WAVEFORM_LAMBDA
    // AUDIO_ANALYZER_LAMBDA
  }
})
