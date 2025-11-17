import type { S3Handler } from 'aws-lambda'
import { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { parseFile } from 'music-metadata'
import { Readable } from 'stream'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({ region: process.env.AWS_REGION })
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))

const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET!
const MAIN_BUCKET = process.env.MAIN_BUCKET!
const TRACKS_TABLE = process.env.TRACKS_TABLE!

/**
 * UPLOAD PROCESSOR LAMBDA
 * 
 * Triggered when file uploaded to: s3://gforce-upload-zone/uploads/*
 * 
 * Workflow:
 * 1. Get uploaded file
 * 2. Extract metadata (artist, title, BPM, genre, etc.)
 * 3. Create Track record in DynamoDB
 * 4. Move file to main storage (public/audio/)
 * 5. Trigger waveform generation (via existing Lambda)
 * 6. Cleanup upload zone
 */
export const handler: S3Handler = async (event) => {
  console.log('🎵 Upload Processor triggered', JSON.stringify(event, null, 2))
  
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))
    
    console.log(`Processing upload: s3://${bucket}/${key}`)
    
    try {
      // 1. Get file from upload zone
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
      
      const s3Object = await s3Client.send(getCommand)
      
      if (!s3Object.Body) {
        throw new Error('No file body')
      }
      
      // Convert stream to buffer
      const stream = s3Object.Body as Readable
      const chunks: Uint8Array[] = []
      
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      
      const buffer = Buffer.concat(chunks)
      
      console.log(`File size: ${buffer.length} bytes`)
      
      // 2. Parse metadata
      console.log('Extracting metadata...')
      const metadata = await parseFile(buffer, {
        mimeType: s3Object.ContentType,
        size: buffer.length
      })
      
      console.log('Metadata extracted:', {
        title: metadata.common.title,
        artist: metadata.common.artist,
        duration: metadata.format.duration
      })
      
      // 3. Parse filename (fallback if no metadata)
      const filename = key.split('/').pop()!
      const filenameParts = parseFilename(filename)
      
      const trackData = {
        artist: metadata.common.artist || filenameParts.artist || 'Unknown Artist',
        title: metadata.common.title || filenameParts.title || filename,
        genre: metadata.common.genre?.[0] || filenameParts.genre || 'Unknown',
        year: metadata.common.year || new Date().getFullYear(),
        bpm: metadata.common.bpm || 0,
        key: metadata.common.key || '',
        duration: Math.round(metadata.format.duration || 0),
        sampleRate: metadata.format.sampleRate || 44100,
        bitrate: metadata.format.bitrate || 320000,
        version: filenameParts.version || '',
        label: filenameParts.label || ''
      }
      
      console.log('Track data prepared:', trackData)
      
      // 4. Generate new filename
      const trackId = uuidv4()
      const ext = filename.split('.').pop()
      const newFilename = `${trackData.artist} - ${trackData.title}.${ext}`
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Sanitize
      
      const destinationKey = `public/audio/${newFilename}`
      
      console.log(`Moving to: s3://${MAIN_BUCKET}/${destinationKey}`)
      
      // 5. Copy to main storage
      const copyCommand = new CopyObjectCommand({
        CopySource: `${bucket}/${key}`,
        Bucket: MAIN_BUCKET,
        Key: destinationKey,
        MetadataDirective: 'REPLACE',
        Metadata: {
          'artist': trackData.artist,
          'title': trackData.title,
          'genre': trackData.genre,
          'duration': trackData.duration.toString()
        }
      })
      
      await s3Client.send(copyCommand)
      console.log('✅ File copied to main storage')
      
      // 6. Create Track record in DynamoDB
      const track = {
        id: trackId,
        ...trackData,
        s3Key: destinationKey,
        uploadedAt: new Date().toISOString(),
        uploadedVia: 'drop-zone',
        status: 'processing', // Will be updated by metadata Lambda
        processingStage: 'uploaded'
      }
      
      const putCommand = new PutCommand({
        TableName: TRACKS_TABLE,
        Item: track
      })
      
      await dynamoClient.send(putCommand)
      console.log('✅ Track record created in DynamoDB')
      
      // 7. Delete from upload zone
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })
      
      await s3Client.send(deleteCommand)
      console.log('✅ File deleted from upload zone')
      
      // 8. Trigger metadata extraction (existing Lambda will handle it)
      console.log('🎯 Metadata Lambda will be triggered by S3 event on main bucket')
      
      console.log('✅ Upload processing complete!', {
        trackId,
        filename: newFilename,
        destination: destinationKey
      })
      
    } catch (error) {
      console.error('❌ Error processing upload:', error)
      
      // Move to error folder for manual inspection
      const errorKey = key.replace('uploads/', 'errors/')
      
      try {
        await s3Client.send(new CopyObjectCommand({
          CopySource: `${bucket}/${key}`,
          Bucket: bucket,
          Key: errorKey
        }))
        
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: key
        }))
        
        console.log(`Moved to error folder: ${errorKey}`)
      } catch (moveError) {
        console.error('Failed to move to error folder:', moveError)
      }
      
      throw error
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Upload processed successfully' })
  }
}

/**
 * Parse filename for metadata
 * Expected format: "Artist - Title (Version) [Label]"
 */
function parseFilename(filename: string): {
  artist?: string
  title?: string
  version?: string
  label?: string
  genre?: string
} {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  
  const result: ReturnType<typeof parseFilename> = {}
  
  // Extract label [Label]
  const labelMatch = nameWithoutExt.match(/\[([^\]]+)\]/)
  if (labelMatch) {
    result.label = labelMatch[1].trim()
  }
  
  // Extract version (Version)
  const versionMatch = nameWithoutExt.match(/\(([^)]+)\)/)
  if (versionMatch) {
    result.version = versionMatch[1].trim()
  }
  
  // Extract artist - title
  const cleanName = nameWithoutExt
    .replace(/\[([^\]]+)\]/, '') // Remove label
    .replace(/\(([^)]+)\)/, '')  // Remove version
    .trim()
  
  const parts = cleanName.split('-').map(p => p.trim())
  
  if (parts.length >= 2) {
    result.artist = parts[0]
    result.title = parts.slice(1).join(' - ')
  } else if (parts.length === 1) {
    result.title = parts[0]
  }
  
  return result
}
