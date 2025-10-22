import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { parseFile } from 'music-metadata'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const s3Client = new S3Client({})

interface AudioFeatures {
  // Tempo & Rhythm
  bpm: number | null
  bpmConfidence: number | null
  timeSignature: string | null
  
  // Key Detection
  key: string | null
  scale: string | null
  camelotKey: string | null
  keyConfidence: number | null
  
  // Energy & Dynamics
  energy: number | null
  danceability: number | null
  valence: number | null
  
  // Loudness
  loudnessLUFS: number | null
  loudnessRange: number | null
  truePeak: number | null
  
  // Audio Characteristics
  acousticness: number | null
  instrumentalness: number | null
  liveness: number | null
  speechiness: number | null
  
  // Spectral Features
  spectralCentroid: number | null
  spectralRolloff: number | null
  zeroCrossingRate: number | null
  
  // Metadata
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
    
    // Extract audio features
    const features = await extractAudioFeatures(localPath)
    
    // Cleanup
    fs.unlinkSync(localPath)
    
    console.log('Audio features extraction successful:', features)
    
    return {
      s3Key,
      bucketName,
      features,
      status: 'success'
    }
    
  } catch (error: any) {
    console.error('Audio features extraction failed:', error)
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

async function extractAudioFeatures(filePath: string): Promise<AudioFeatures> {
  console.log(`Extracting audio features from ${filePath}`)
  
  // Use music-metadata to parse audio file
  const metadata = await parseFile(filePath)
  
  // For now, we'll extract what we can from music-metadata
  // In the future, we can add more sophisticated analysis libraries
  
  // Estimate BPM from metadata if available
  let bpm: number | null = null
  let bpmConfidence: number | null = null
  
  // Some files have BPM in tags
  if (metadata.common.bpm) {
    bpm = metadata.common.bpm
    bpmConfidence = 0.8 // Assume moderate confidence for tagged BPM
  }
  
  // Calculate basic audio characteristics from format info
  const sampleRate = metadata.format.sampleRate || 44100
  const bitrate = metadata.format.bitrate || 0
  const duration = metadata.format.duration || 0
  
  // Estimate energy based on bitrate (higher bitrate = potentially more energy)
  const energy = bitrate > 0 ? Math.min(bitrate / 320000, 1.0) : null
  
  // Estimate danceability (for electronic music, assume high if BPM is in dance range)
  let danceability: number | null = null
  if (bpm && bpm >= 120 && bpm <= 140) {
    danceability = 0.85 // High danceability for typical techno/house BPM
  } else if (bpm) {
    danceability = 0.6
  }
  
  const features: AudioFeatures = {
    // Tempo & Rhythm
    bpm,
    bpmConfidence,
    timeSignature: '4/4', // Default assumption for electronic music
    
    // Key Detection (not available without advanced analysis)
    key: null,
    scale: null,
    camelotKey: null,
    keyConfidence: null,
    
    // Energy & Dynamics (estimated)
    energy,
    danceability,
    valence: null, // Requires advanced analysis
    
    // Loudness (not available without advanced analysis)
    loudnessLUFS: null,
    loudnessRange: null,
    truePeak: null,
    
    // Audio Characteristics (estimated)
    acousticness: 0.1, // Assume low for electronic music
    instrumentalness: 0.95, // Assume high for tracks without vocals
    liveness: 0.1, // Assume studio recording
    speechiness: 0.05, // Assume minimal speech
    
    // Spectral Features (would need FFT analysis)
    spectralCentroid: null,
    spectralRolloff: null,
    zeroCrossingRate: null,
    
    // Metadata
    analyzedAt: new Date().toISOString(),
  }
  
  console.log('Extracted audio features:', features)
  return features
}
