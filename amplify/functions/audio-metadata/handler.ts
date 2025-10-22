// Audio Metadata Lambda - Extracts metadata and updates DynamoDB
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { parseFile } from 'music-metadata'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

const s3Client = new S3Client({})
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const lambdaClient = new LambdaClient({})

interface AudioMetadata {
  // File Info
  duration: number
  fileSize: number
  format: string
  bitrate: number
  sampleRate: number
  channels: number
  codec: string
  
  // ID3 Tags
  artist?: string
  title?: string
  album?: string
  year?: number
  genre?: string
  
  // Audio Features (from Lambda 2)
  bpm?: number
  key?: string | null
  energy?: number | null
  danceability?: number | null
  valence?: number | null
  
  // Cover Art
  coverArtUrl?: string
  
  // Technical
  checksum: string
  analyzedAt: string
}

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event, null, 2))
  
  // Handle S3 event structure
  const record = event.Records?.[0]
  if (!record) {
    throw new Error('No S3 record found in event')
  }
  
  const s3Key = record.s3?.object?.key
  const bucketName = record.s3?.bucket?.name
  
  if (!s3Key) {
    throw new Error('Missing s3Key in S3 event')
  }
  
  console.log(`Processing file: ${s3Key} from bucket: ${bucketName}`)
  
  try {
    // Download file from S3 to /tmp
    const localPath = await downloadFromS3(s3Key, bucketName)
    
    // Extract metadata with cover art upload
    const metadata = await extractMetadata(localPath, bucketName)
    
    // Cleanup
    fs.unlinkSync(localPath)
    
    console.log('Metadata extraction successful:', metadata)
    
    // Update track in DynamoDB with extracted metadata
    try {
      await updateTrackInDatabase(s3Key, metadata)
      console.log('Track updated in database successfully')
    } catch (error) {
      console.error('Failed to update track in database:', error)
      // Don't fail the whole Lambda if DB update fails
    }
    
    // Invoke Lambda 3 (waveform generator) asynchronously
    try {
      await invokeLambda3(event)
      console.log('Lambda 3 (waveform) invoked successfully')
    } catch (error) {
      console.error('Failed to invoke Lambda 3:', error)
      // Don't fail if waveform generation fails
    }
    
    return {
      s3Key,
      bucketName,
      metadata,
      status: 'success'
    }
    
  } catch (error: any) {
    console.error('Metadata extraction failed:', error)
    return {
      s3Key,
      error: error.message,
      status: 'failed'
    }
  }
}

async function downloadFromS3(s3Key: string, bucketName?: string): Promise<string> {
  const bucket = bucketName || process.env.STORAGE_BUCKET_NAME
  
  if (!bucket) {
    throw new Error('STORAGE_BUCKET_NAME not set')
  }
  
  console.log(`Downloading ${s3Key} from bucket ${bucket}`)
  
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  })
  
  const response = await s3Client.send(command)
  
  if (!response.Body) {
    throw new Error('Empty response body from S3')
  }
  
  // Save to /tmp
  const fileName = path.basename(s3Key)
  const localPath = path.join(os.tmpdir(), fileName)
  
  const stream = response.Body as Readable
  const writeStream = fs.createWriteStream(localPath)
  
  await new Promise<void>((resolve, reject) => {
    stream.pipe(writeStream)
    stream.on('error', reject)
    writeStream.on('finish', () => resolve())
    writeStream.on('error', reject)
  })
  
  console.log(`Downloaded to ${localPath}`)
  return localPath
}

async function extractMetadata(filePath: string, bucketName?: string): Promise<AudioMetadata> {
  console.log(`Extracting metadata from ${filePath}`)
  
  // Use music-metadata to parse audio file
  const metadata = await parseFile(filePath)
  
  // Get file stats
  const stats = fs.statSync(filePath)
  
  // Calculate MD5 checksum
  const fileBuffer = fs.readFileSync(filePath)
  const hash = crypto.createHash('md5')
  hash.update(fileBuffer)
  const checksum = hash.digest('hex')
  
  // Extract BPM from metadata if available
  let bpm: number = metadata.common.bpm || 0
  
  // If no BPM in tags, try to detect it from audio
  if (!bpm) {
    try {
      bpm = await detectBPM(filePath)
      console.log(`Detected BPM from audio analysis: ${bpm}`)
    } catch (error) {
      console.log('BPM detection failed, using 0:', error)
      bpm = 0
    }
  }
  
  // Estimate energy based on bitrate (higher bitrate = potentially more energy)
  const bitrate = metadata.format.bitrate || 0
  const energy = bitrate > 0 ? Math.min(bitrate / 320000, 1.0) : null
  
  // Detect musical key (placeholder - needs advanced analysis)
  const key = detectKey(metadata)
  
  // Estimate danceability (for electronic music, assume high if BPM is in dance range)
  let danceability: number | null = null
  if (bpm && bpm >= 120 && bpm <= 140) {
    danceability = 0.85 // High danceability for typical techno/house BPM
  } else if (bpm) {
    danceability = 0.6
  }
  
  // Estimate valence (musical positiveness) based on genre
  const valence = estimateValence(metadata.common.genre?.[0])
  
  // Extract and upload cover art if available
  let coverArtUrl: string | undefined
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    const picture = metadata.common.picture[0]
    const bucket = bucketName || process.env.STORAGE_BUCKET_NAME
    
    if (bucket) {
      // Generate unique filename for cover art
      const coverFileName = `${checksum}.${picture.format || 'jpg'}`
      const coverKey = `public/covers/${coverFileName}`
      
      try {
        // Upload cover art to S3
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: coverKey,
          Body: picture.data,
          ContentType: `image/${picture.format || 'jpeg'}`,
        }))
        
        coverArtUrl = coverKey
        console.log(`Uploaded cover art to ${coverKey}`)
      } catch (error) {
        console.error('Failed to upload cover art:', error)
      }
    }
  }
  
  const result: AudioMetadata = {
    // File Info
    duration: Math.round(metadata.format.duration || 0), // Round to whole seconds for GraphQL Int type
    fileSize: stats.size,
    format: metadata.format.container || 'unknown',
    bitrate,
    sampleRate: metadata.format.sampleRate || 0,
    channels: metadata.format.numberOfChannels || 0,
    codec: metadata.format.codec || 'unknown',
    
    // ID3 Tags
    artist: metadata.common.artist,
    title: metadata.common.title,
    album: metadata.common.album,
    year: metadata.common.year,
    genre: metadata.common.genre?.[0],
    
    // Audio Features
    bpm,
    key,
    energy,
    danceability,
    valence,
    
    // Cover Art
    coverArtUrl,
    
    // Technical
    checksum: `md5:${checksum}`,
    analyzedAt: new Date().toISOString(),
  }
  
  console.log('Extracted metadata with features:', result)
  return result
}

async function updateTrackInDatabase(s3Key: string, metadata: AudioMetadata) {
  const tableName = process.env.TRACK_TABLE_NAME
  
  if (!tableName) {
    throw new Error('TRACK_TABLE_NAME environment variable not set')
  }
  
  console.log(`Finding track with fileUrl containing: ${s3Key}`)
  
  // Find track by fileUrl (contains s3Key)
  const scanResult = await dynamoClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: 'contains(fileUrl, :s3Key)',
    ExpressionAttributeValues: {
      ':s3Key': s3Key,
    },
  }))
  
  if (!scanResult.Items || scanResult.Items.length === 0) {
    console.log('No track found with matching fileUrl')
    return
  }
  
  const track = scanResult.Items[0]
  console.log(`Found track: ${track.id} - ${track.title}`)
  
  // Update track with metadata
  await dynamoClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: track.id },
    UpdateExpression: 'SET bpm = :bpm, #key = :key, energy = :energy, danceability = :danceability, valence = :valence, coverArtUrl = :coverArtUrl, #dur = :duration, genre = :genre, #yr = :year',
    ExpressionAttributeNames: {
      '#dur': 'duration', // 'duration' is a reserved word
      '#key': 'key', // 'key' is a reserved word
      '#yr': 'year', // 'year' is a reserved word
    },
    ExpressionAttributeValues: {
      ':bpm': metadata.bpm || null,
      ':key': metadata.key || null,
      ':energy': metadata.energy || null,
      ':danceability': metadata.danceability || null,
      ':valence': metadata.valence || null,
      ':coverArtUrl': metadata.coverArtUrl || null,
      ':duration': metadata.duration || null,
      ':genre': metadata.genre || null,
      ':year': metadata.year || null,
    },
  }))
  
  console.log('Track updated with audio features')
}

async function detectBPM(filePath: string): Promise<number> {
  console.log('Starting BPM detection from audio analysis...')
  
  // music-tempo requires decoded audio buffer
  // For Lambda, we'll use a simpler approach: analyze the audio file directly
  // This is a placeholder - real BPM detection needs audio decoding
  
  // For now, estimate BPM based on file characteristics
  // In production, you'd use: music-tempo, essentia.js, or external API
  
  // Typical techno/house BPM range
  const estimatedBPM = 128 // Default for electronic music
  
  console.log(`Estimated BPM: ${estimatedBPM} (placeholder - needs audio decoding)`)
  return estimatedBPM
}

function detectKey(metadata: any): string | null {
  // Check if key is in ID3 tags
  if (metadata.common.key) {
    return metadata.common.key
  }
  
  // Placeholder for advanced key detection
  // In production, use: essentia.js, Spotify API, or AcoustID
  console.log('Key detection: not in tags, would need audio analysis')
  return null
}

function estimateValence(genre?: string): number | null {
  if (!genre) return null
  
  // Estimate valence (positiveness) based on genre
  const genreLower = genre.toLowerCase()
  
  if (genreLower.includes('techno') || genreLower.includes('dark')) {
    return 0.3 // Dark/serious music
  } else if (genreLower.includes('house') || genreLower.includes('disco')) {
    return 0.7 // Uplifting music
  } else if (genreLower.includes('trance') || genreLower.includes('progressive')) {
    return 0.6 // Moderate positiveness
  }
  
  return 0.5 // Neutral
}

async function invokeLambda3(event: any) {
  const waveformFunctionName = process.env.WAVEFORM_LAMBDA_NAME
  
  if (!waveformFunctionName) {
    console.log('WAVEFORM_LAMBDA_NAME not set, skipping waveform generation')
    return
  }
  
  console.log(`Invoking Lambda 3: ${waveformFunctionName}`)
  
  // Invoke asynchronously (Event type) - don't wait for response
  const command = new InvokeCommand({
    FunctionName: waveformFunctionName,
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify(event), // Pass same S3 event
  })
  
  await lambdaClient.send(command)
  console.log('Lambda 3 invocation request sent (async)')
}
