import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { parseFile } from 'music-metadata'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

const s3Client = new S3Client({})

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
  energy?: number | null
  danceability?: number | null
  
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
  
  // Extract BPM from metadata if available, default to 0
  let bpm: number = metadata.common.bpm || 0
  
  // Estimate energy based on bitrate (higher bitrate = potentially more energy)
  const bitrate = metadata.format.bitrate || 0
  const energy = bitrate > 0 ? Math.min(bitrate / 320000, 1.0) : null
  
  // Estimate danceability (for electronic music, assume high if BPM is in dance range)
  let danceability: number | null = null
  if (bpm && bpm >= 120 && bpm <= 140) {
    danceability = 0.85 // High danceability for typical techno/house BPM
  } else if (bpm) {
    danceability = 0.6
  }
  
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
    duration: metadata.format.duration || 0,
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
    energy,
    danceability,
    
    // Cover Art
    coverArtUrl,
    
    // Technical
    checksum: `md5:${checksum}`,
    analyzedAt: new Date().toISOString(),
  }
  
  console.log('Extracted metadata with features:', result)
  return result
}
