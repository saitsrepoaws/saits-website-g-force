// Waveform Generator Lambda - Generates visual waveform for audio tracks
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { parseFile } from 'music-metadata'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
// import sharp from 'sharp' // Removed: requires platform-specific binary

const s3Client = new S3Client({})
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

interface WaveformData {
  peaks: number[]
  duration: number
  waveformUrl?: string
}

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event, null, 2))
  
  try {
    const record = event.Records?.[0]
    if (!record) {
      throw new Error('No S3 record found in event')
    }
    
    const s3Key = record.s3?.object?.key
    const bucketName = record.s3?.bucket?.name
    
    if (!s3Key || !bucketName) {
      throw new Error('Missing S3 key or bucket name')
    }
    
    console.log(`Processing file: ${s3Key} from bucket: ${bucketName}`)
    
    // Download file from S3
    const localPath = await downloadFromS3(s3Key, bucketName)
    
    // Generate waveform
    const waveformData = await generateWaveform(localPath, bucketName, s3Key)
    
    console.log('Waveform generation successful:', waveformData)
    
    // Update track in DynamoDB
    try {
      await updateTrackInDatabase(s3Key, waveformData)
      console.log('Track updated with waveform data successfully')
    } catch (error) {
      console.error('Failed to update track in database:', error)
    }
    
    return {
      s3Key,
      bucketName,
      waveformData,
      status: 'success'
    }
  } catch (error) {
    console.error('Error processing waveform:', error)
    throw error
  }
}

async function downloadFromS3(s3Key: string, bucketName: string): Promise<string> {
  console.log(`Downloading ${s3Key} from bucket ${bucketName}`)
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  })
  
  const response = await s3Client.send(command)
  
  // Save to /tmp
  const fileName = path.basename(s3Key)
  const localPath = path.join(os.tmpdir(), fileName)
  
  const writeStream = fs.createWriteStream(localPath)
  const readableStream = response.Body as Readable
  
  await new Promise<void>((resolve, reject) => {
    readableStream.pipe(writeStream)
    writeStream.on('finish', () => resolve())
    writeStream.on('error', reject)
  })
  
  console.log(`Downloaded to ${localPath}`)
  return localPath
}

async function generateWaveform(filePath: string, bucketName: string, s3Key: string): Promise<WaveformData> {
  console.log('Generating waveform...')
  
  // Get audio metadata for duration
  const metadata = await parseFile(filePath)
  const duration = metadata.format.duration || 0
  
  // Generate simplified waveform peaks
  // For production: use proper audio decoding with ffmpeg or web-audio-api
  // For now: generate peaks based on file chunks
  const peaks = await extractSimplifiedPeaks(filePath, 200) // 200 data points
  
  // Generate waveform image
  const waveformImagePath = await createWaveformImage(peaks, duration)
  
  // Upload waveform to S3
  const waveformUrl = await uploadWaveformToS3(waveformImagePath, bucketName, s3Key)
  
  // Cleanup
  fs.unlinkSync(waveformImagePath)
  
  return {
    peaks,
    duration,
    waveformUrl,
  }
}

async function extractSimplifiedPeaks(filePath: string, sampleCount: number): Promise<number[]> {
  // Simplified peak extraction from file chunks
  // This is a placeholder - real implementation would decode audio
  
  const fileBuffer = fs.readFileSync(filePath)
  const chunkSize = Math.floor(fileBuffer.length / sampleCount)
  const peaks: number[] = []
  
  for (let i = 0; i < sampleCount; i++) {
    const chunkStart = i * chunkSize
    const chunk = fileBuffer.subarray(chunkStart, chunkStart + chunkSize)
    
    // Calculate pseudo-amplitude from chunk
    let sum = 0
    for (let j = 0; j < Math.min(chunk.length, 1000); j++) {
      sum += Math.abs(chunk[j] - 128) // Normalize around 128
    }
    const avgAmplitude = sum / Math.min(chunk.length, 1000) / 128
    peaks.push(Math.min(avgAmplitude, 1.0))
  }
  
  return peaks
}

async function createWaveformImage(peaks: number[], duration: number): Promise<string> {
  const width = 800
  const height = 120
  const barWidth = width / peaks.length
  
  // Create SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
  svg += `<rect width="${width}" height="${height}" fill="#1a1a1a"/>`
  
  peaks.forEach((peak, i) => {
    const barHeight = peak * height * 0.8
    const x = i * barWidth
    const y = (height - barHeight) / 2
    
    svg += `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" fill="#3b82f6" opacity="0.8"/>`
  })
  
  svg += '</svg>'
  
  // Save SVG directly (no PNG conversion needed)
  const outputPath = path.join(os.tmpdir(), `waveform-${Date.now()}.svg`)
  fs.writeFileSync(outputPath, svg)
  
  console.log(`Created waveform SVG: ${outputPath}`)
  return outputPath
}

async function uploadWaveformToS3(imagePath: string, bucketName: string, originalS3Key: string): Promise<string> {
  const svgContent = fs.readFileSync(imagePath, 'utf-8')
  
  // Generate waveform S3 key
  const basename = path.basename(originalS3Key, path.extname(originalS3Key))
  const waveformKey = `public/waveforms/${basename}.svg`
  
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: waveformKey,
    Body: svgContent,
    ContentType: 'image/svg+xml',
  }))
  
  console.log(`Uploaded waveform to ${waveformKey}`)
  return waveformKey
}

async function updateTrackInDatabase(s3Key: string, waveformData: WaveformData) {
  const tableName = process.env.TRACK_TABLE_NAME
  
  if (!tableName) {
    throw new Error('TRACK_TABLE_NAME environment variable not set')
  }
  
  console.log(`Finding track with fileUrl containing: ${s3Key}`)
  
  // Find track by fileUrl
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
  
  // Update track with waveform data
  await dynamoClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: track.id },
    UpdateExpression: 'SET waveformUrl = :waveformUrl, peaks = :peaks',
    ExpressionAttributeValues: {
      ':waveformUrl': waveformData.waveformUrl,
      ':peaks': waveformData.peaks,
    },
  }))
  
  console.log('Track updated with waveform data')
}
