import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { promisify } from 'util'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)
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
  
  // Technical
  checksum: string
  analyzedAt: string
}

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event, null, 2))
  
  const { s3Key, trackId } = event
  
  if (!s3Key) {
    throw new Error('Missing s3Key in event')
  }
  
  try {
    // Download file from S3 to /tmp
    const localPath = await downloadFromS3(s3Key)
    
    // Extract metadata using ffprobe
    const metadata = await extractMetadata(localPath)
    
    // Cleanup
    fs.unlinkSync(localPath)
    
    return {
      trackId,
      metadata,
      status: 'success'
    }
    
  } catch (error: any) {
    console.error('Metadata extraction failed:', error)
    return {
      trackId,
      error: error.message,
      status: 'failed'
    }
  }
}

async function downloadFromS3(s3Key: string): Promise<string> {
  const bucketName = process.env.STORAGE_BUCKET_NAME
  
  if (!bucketName) {
    throw new Error('STORAGE_BUCKET_NAME not set')
  }
  
  console.log(`Downloading ${s3Key} from bucket ${bucketName}`)
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
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

async function extractMetadata(filePath: string): Promise<AudioMetadata> {
  console.log(`Extracting metadata from ${filePath}`)
  
  // Use ffprobe to get metadata
  const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
  
  const { stdout } = await execAsync(command)
  const data = JSON.parse(stdout)
  
  const format = data.format
  const audioStream = data.streams.find((s: any) => s.codec_type === 'audio')
  
  if (!audioStream) {
    throw new Error('No audio stream found in file')
  }
  
  // Extract ID3 tags
  const tags = format.tags || {}
  
  // Calculate checksum
  const checksumCommand = `md5sum "${filePath}" | awk '{print $1}'`
  const { stdout: checksumOutput } = await execAsync(checksumCommand)
  const checksum = checksumOutput.trim()
  
  const metadata: AudioMetadata = {
    // File Info
    duration: parseFloat(format.duration) || 0,
    fileSize: parseInt(format.size) || 0,
    format: format.format_name || 'unknown',
    bitrate: parseInt(format.bit_rate) || 0,
    sampleRate: parseInt(audioStream.sample_rate) || 0,
    channels: audioStream.channels || 0,
    codec: audioStream.codec_name || 'unknown',
    
    // ID3 Tags (case-insensitive)
    artist: tags.artist || tags.ARTIST || tags.Artist,
    title: tags.title || tags.TITLE || tags.Title,
    album: tags.album || tags.ALBUM || tags.Album,
    year: tags.date ? parseInt(tags.date.substring(0, 4)) : undefined,
    genre: tags.genre || tags.GENRE || tags.Genre,
    
    // Technical
    checksum: `md5:${checksum}`,
    analyzedAt: new Date().toISOString(),
  }
  
  console.log('Extracted metadata:', metadata)
  return metadata
}
