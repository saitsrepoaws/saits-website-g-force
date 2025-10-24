// Docker Lambda Container - FFmpeg is installed at /usr/local/bin/ffmpeg
// Set path before imports to prevent @ffmpeg-installer lookup
process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg'

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { Readable } from 'stream'
import fs from 'fs'
import path from 'path'
import os from 'os'
// CommonJS require for Essentia.js - need both modules
const { Essentia, EssentiaWASM } = require('essentia.js')
import ffmpeg from 'fluent-ffmpeg'
import wav from 'node-wav'

// Configure FFmpeg path for Docker container
const ffmpegPath = process.env.FFMPEG_PATH!
console.log(`🐳 Docker Lambda - FFmpeg path: ${ffmpegPath}`)

// Set FFmpeg path for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath)

// Verify FFmpeg binary
if (fs.existsSync(ffmpegPath)) {
  console.log(`✅ FFmpeg binary verified at: ${ffmpegPath}`)
  
  // Test FFmpeg
  try {
    const { execSync } = require('child_process')
    const version = execSync(`${ffmpegPath} -version`).toString().split('\n')[0]
    console.log(`📹 ${version}`)
  } catch (e) {
    console.error(`⚠️  FFmpeg test failed: ${e}`)
  }
} else {
  console.error(`❌ FFmpeg binary not found at: ${ffmpegPath}`)
  console.error(`📂 PATH: ${process.env.PATH}`)
}

const s3Client = new S3Client({})
const dynamoClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

/**
 * Lambda 5: Advanced Audio Analysis
 * Detects BPM and Musical Key using Essentia.js audio analysis
 * 
 * Triggered by: Manual invocation or Lambda 1
 * Input: { trackId, s3Key, bucket }
 * Output: Updates Track with real BPM and Key
 */
export const handler = async (event: any) => {
  console.log('🎵 Audio Analyzer Lambda 5 triggered', JSON.stringify(event, null, 2))
  
  const { trackId, s3Key, bucket } = event
  
  if (!trackId || !s3Key || !bucket) {
    throw new Error('Missing required parameters: trackId, s3Key, bucket')
  }
  
  try {
    // 1. Download audio file from S3 to /tmp
    console.log(`📥 Downloading ${s3Key} from S3...`)
    const filePath = await downloadFromS3(bucket, s3Key)
    
    // 2. Analyze audio for BPM and Key
    console.log('🔍 Analyzing audio...')
    const analysis = await analyzeAudio(filePath)
    
    // 3. Update track in DynamoDB
    console.log('💾 Updating track in database...')
    await updateTrack(trackId, analysis)
    
    // 4. Cleanup
    fs.unlinkSync(filePath)
    
    console.log('✅ Audio analysis complete', analysis)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        trackId,
        analysis,
      }),
    }
  } catch (error) {
    console.error('❌ Audio analysis failed:', error)
    throw error
  }
}

/**
 * Download file from S3 to /tmp
 */
async function downloadFromS3(bucket: string, key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await s3Client.send(command)
  
  // Stream to temp file
  const tmpDir = os.tmpdir()
  const fileName = path.basename(key)
  const filePath = path.join(tmpDir, fileName)
  
  const writeStream = fs.createWriteStream(filePath)
  const readStream = response.Body as Readable
  
  await new Promise<void>((resolve, reject) => {
    readStream.pipe(writeStream)
    writeStream.on('finish', () => resolve())
    writeStream.on('error', reject)
  })
  
  console.log(`✅ Downloaded to ${filePath}`)
  return filePath
}

/**
 * Analyze audio file for BPM and Key using Essentia.js
 * Full implementation with WASM and audio decoding
 */
async function analyzeAudio(filePath: string): Promise<AudioAnalysis> {
  console.log('🎵 Running Essentia.js audio analysis...')
  
  let bpm = 0
  let key: string | null = null
  
  try {
    // Decode audio to WAV PCM
    console.log('🔊 Decoding audio to WAV...')
    const audioBuffer = await decodeAudioToWav(filePath)
    console.log('✅ Audio decoded to WAV')
    
    // Initialize Essentia.js with WASM backend
    const essentia = new Essentia(EssentiaWASM)
    console.log('✅ Essentia.js initialized')
    
    // Analyze with Essentia.js
    const analysis = await analyzeWithEssentia(essentia, audioBuffer)
    
    if (analysis.bpm) {
      bpm = analysis.bpm
      console.log(`✅ Essentia BPM: ${bpm}`)
    }
    
    if (analysis.key) {
      key = analysis.key
      console.log(`✅ Essentia Key: ${key}`)
    }
  } catch (error) {
    console.error('❌ Essentia.js analysis failed:', error)
    throw error
  }
  
  return { bpm, key }
}

interface AudioAnalysis {
  bpm: number
  key: string | null
}

/**
 * Decode audio file to WAV PCM format using FFmpeg
 * Essentia.js requires mono 44.1kHz PCM audio
 */
async function decodeAudioToWav(filePath: string): Promise<Float32Array> {
  console.log('🔊 Decoding audio to WAV...')
  
  const outputPath = filePath + '.wav'
  
  // Use FFmpeg to convert to mono 44.1kHz WAV
  await new Promise<void>((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        '-f', 'wav',        // WAV format
        '-acodec', 'pcm_s16le', // PCM 16-bit
        '-ar', '44100',     // 44.1kHz sample rate
        '-ac', '1'          // Mono
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
  
  console.log('✅ Audio decoded to WAV')
  
  // Read WAV file and decode to Float32Array
  const wavBuffer = fs.readFileSync(outputPath)
  const decoded = wav.decode(wavBuffer)
  
  // Convert to Float32Array (normalize to -1.0 to 1.0)
  const float32Data = new Float32Array(decoded.channelData[0].length)
  for (let i = 0; i < decoded.channelData[0].length; i++) {
    float32Data[i] = decoded.channelData[0][i] / 32768.0
  }
  
  // Cleanup
  fs.unlinkSync(outputPath)
  
  console.log(`✅ Audio buffer ready: ${float32Data.length} samples`)
  return float32Data
}

/**
 * Analyze audio with Essentia.js extractors
 * Correct API: essentia.algorithms.AlgorithmName(input).outputField
 */
async function analyzeWithEssentia(essentia: any, audioBuffer: Float32Array): Promise<{ bpm?: number, key?: string }> {
  const result: { bpm?: number, key?: string } = {}
  
  console.log('🎵 Analyzing with Essentia.js algorithms...')
  
  // BPM Detection using RhythmExtractor2013
  try {
    console.log('🥁 Running BPM detection with RhythmExtractor2013...')
    
    // RhythmExtractor2013(signal, method="degara", minTempo=40, maxTempo=208)
    const rhythm = essentia.algorithms.RhythmExtractor2013(
      audioBuffer,      // signal
      'degara',         // method: 'degara' or 'multifeature'
      40,               // minTempo
      208               // maxTempo
    )
    
    if (rhythm && rhythm.bpm > 0) {
      result.bpm = Math.round(rhythm.bpm)
      console.log(`✅ BPM detected: ${result.bpm}`)
      console.log(`   Confidence: ${rhythm.confidence || 'N/A'}`)
      console.log(`   Ticks: ${rhythm.ticks?.length || 0}`)
    } else {
      console.warn('⚠️ BPM detection returned 0 or invalid result')
    }
  } catch (error: any) {
    console.error('❌ BPM detection failed:', error?.message || error)
  }
  
  // Key Detection using KeyExtractor
  try {
    console.log('🎹 Running Key detection with KeyExtractor...')
    
    // KeyExtractor has 15 parameters - use defaults for most
    // KeyExtractor(signal, averageDetuningCorrection, frameSize, hopSize, hpcpSize, 
    //              maxFrequency, maxShifted, minFrequency, numHarmonics, pcpThreshold,
    //              profileType, sampleRate, spectralPeaksMax, spectralWhiteningType, windowType)
    const keyData = essentia.algorithms.KeyExtractor(
      audioBuffer,      // signal
      true,             // averageDetuningCorrection
      4096,             // frameSize  
      2048,             // hopSize
      12,               // hpcpSize
      5000,             // maxFrequency
      false,            // maxShifted
      25,               // minFrequency
      4,                // numHarmonics
      0.01,             // pcpThreshold
      'temperley',      // profileType: 'bgate', 'braw', 'edma', 'temperley', 'weichai', 'tonictriad'
      44100,            // sampleRate
      100,              // spectralPeaksMax
      'highpass',       // spectralWhiteningType
      'blackmanharris92' // windowType
    )
    
    if (keyData && keyData.key && keyData.scale) {
      result.key = `${keyData.key} ${keyData.scale}`
      console.log(`✅ Key detected: ${result.key}`)
      console.log(`   Strength: ${keyData.strength || 'N/A'}`)
    } else {
      console.warn('⚠️ Key detection returned invalid result')
    }
  } catch (error: any) {
    console.error('❌ Key detection failed:', error?.message || error)
  }
  
  console.log(`🎼 Analysis complete: BPM=${result.bpm || 'N/A'}, Key=${result.key || 'N/A'}`)
  return result
}

/**
 * Normalize key from Essentia.js output
 * Essentia outputs: key (C, C#, D, etc.) and scale (major, minor)
 */
function normalizeKeyFromEssentia(key: string, scale: string): string {
  const isMinor = scale.toLowerCase() === 'minor'
  return key + (isMinor ? 'm' : '')
}

/**
 * BPM Detection from filename (fallback)
 */
async function detectBPMFromFilename(filePath: string): Promise<number> {
  const fileName = path.basename(filePath)
  const bpmPatterns = [
    /(\d{2,3})\s*bpm/i,
    /bpm\s*(\d{2,3})/i,
    /[-_\s](\d{2,3})[-_\s]/,
    /\[(\d{2,3})\]/,
    /\((\d{2,3})\)/,
  ]
  
  for (const pattern of bpmPatterns) {
    const match = fileName.match(pattern)
    if (match) {
      const bpm = parseInt(match[1])
      if (bpm >= 60 && bpm <= 200) {
        console.log(`✅ BPM from filename: ${bpm}`)
        return bpm
      }
    }
  }
  
  return 0
}

/**
 * Key Detection from filename (fallback)
 */
async function detectKeyFromFilename(filePath: string): Promise<string | null> {
  const fileName = path.basename(filePath)
  const keyPatterns = [
    /[\(\[]([A-G][#b]?m?)[\)\]]/i,  // (Am) or [Cm]
    /\s-\s([A-G][#b]?m?)\b/i,        // - Am
    /\s([A-G][#b]?m?)\s*$/i,         // Am at end
  ]
  
  for (const pattern of keyPatterns) {
    const match = fileName.match(pattern)
    if (match) {
      const key = normalizeKey(match[1])
      console.log(`✅ Key from filename: ${key}`)
      return key
    }
  }
  
  return null
}

/**
 * Normalize key notation
 */
function normalizeKey(key: string): string {
  if (!key) return ''
  
  const keyStr = key.trim().toUpperCase()
  
  // Standard notation
  const match = keyStr.match(/^([A-G][#B]?)(M|MIN|MINOR)?$/i)
  if (match) {
    let root = match[1]
    const isMinor = match[2] ? 'm' : ''
    
    // Normalize sharps/flats
    root = root
      .replace('DB', 'C#/Db')
      .replace('EB', 'D#/Eb')
      .replace('GB', 'F#/Gb')
      .replace('AB', 'G#/Ab')
      .replace('BB', 'A#/Bb')
    
    return root + isMinor
  }
  
  return key
}

/**
 * Estimate energy from metadata
 */
function estimateEnergy(metadata: any): number | null {
  const bitrate = metadata.format.bitrate || 0
  if (bitrate > 0) {
    return Math.min(bitrate / 320000, 1.0)
  }
  return null
}

/**
 * Estimate danceability from BPM
 */
function estimateDanceability(bpm: number): number | null {
  if (!bpm) return null
  
  // Dance range: 120-140 BPM
  if (bpm >= 120 && bpm <= 140) {
    return 0.85
  } else if (bpm >= 110 && bpm <= 150) {
    return 0.7
  } else {
    return 0.5
  }
}

/**
 * Estimate valence from genre
 */
function estimateValence(genre?: string): number | null {
  if (!genre) return null
  
  const genreLower = genre.toLowerCase()
  
  if (genreLower.includes('techno') || genreLower.includes('dark')) {
    return 0.3
  } else if (genreLower.includes('house') || genreLower.includes('disco')) {
    return 0.7
  } else if (genreLower.includes('trance')) {
    return 0.6
  }
  
  return 0.5
}

/**
 * Update track in DynamoDB
 */
async function updateTrack(trackId: string, analysis: AudioAnalysis) {
  const tableName = process.env.TRACK_TABLE_NAME
  if (!tableName) {
    throw new Error('TRACK_TABLE_NAME not configured')
  }
  
  const updateCommand = new UpdateCommand({
    TableName: tableName,
    Key: { id: trackId },
    UpdateExpression: 'SET bpm = :bpm, #key = :key, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#key': 'key',
    },
    ExpressionAttributeValues: {
      ':bpm': analysis.bpm,
      ':key': analysis.key,
      ':updatedAt': new Date().toISOString(),
    },
  })
  
  await docClient.send(updateCommand)
  console.log('✅ Track updated in database')
}
