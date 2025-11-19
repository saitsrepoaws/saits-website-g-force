/**
 * Audio file upload service using Amplify Storage (S3)
 */
import { uploadData, getUrl, remove, list } from 'aws-amplify/storage'

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg', // mp3
  'audio/mp4', // m4a
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/aac',
  'audio/webm',
  'audio/opus',
]

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  key: string
  url: string
  size: number
  format: string
}

export interface AudioFile {
  key: string
  size?: number
  lastModified?: Date
}

/**
 * Upload audio file to S3
 */
export async function uploadAudioFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Validate file type
  if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
    throw new Error(`Unsupported audio format: ${file.type}`)
  }

  // Generate unique filename
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  // UI uploads now go to audio/bulk/ for unified processing!
  // S3 trigger → SQS → Lambda → metadata extraction → DynamoDB
  // Same pipeline as CLI bulk uploads!
  const key = `audio/bulk/${timestamp}-${sanitizedName}`

  try {
    // Upload file with progress tracking
    const result = await uploadData({
      key,
      data: file,
      options: {
        contentType: file.type,
        onProgress: (event) => {
          if (onProgress && event.totalBytes) {
            onProgress({
              loaded: event.transferredBytes || 0,
              total: event.totalBytes,
              percentage: Math.round(((event.transferredBytes || 0) / event.totalBytes) * 100),
            })
          }
        },
      },
    }).result

    // Get public URL
    const urlResult = await getUrl({
      key: result.key,
      options: {
        expiresIn: 31536000, // 1 year
      },
    })

    return {
      key: result.key,
      url: urlResult.url.toString(),
      size: file.size,
      format: file.type,
    }
  } catch (error) {
    console.error('Upload failed:', error)
    throw new Error(`Failed to upload file: ${error}`)
  }
}

/**
 * Upload cover art image
 */
export async function uploadCoverArt(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Validate file type
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!validImageTypes.includes(file.type)) {
    throw new Error(`Unsupported image format: ${file.type}`)
  }

  // Generate unique filename
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const key = `covers/${timestamp}-${sanitizedName}`

  try {
    const result = await uploadData({
      key,
      data: file,
      options: {
        contentType: file.type,
        onProgress: (event) => {
          if (onProgress && event.totalBytes) {
            onProgress({
              loaded: event.transferredBytes || 0,
              total: event.totalBytes,
              percentage: Math.round(((event.transferredBytes || 0) / event.totalBytes) * 100),
            })
          }
        },
      },
    }).result

    const urlResult = await getUrl({
      key: result.key,
      options: {
        expiresIn: 31536000,
      },
    })

    return {
      key: result.key,
      url: urlResult.url.toString(),
      size: file.size,
      format: file.type,
    }
  } catch (error) {
    console.error('Cover art upload failed:', error)
    throw new Error(`Failed to upload cover art: ${error}`)
  }
}

/**
 * Delete file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    await remove({ key })
  } catch (error) {
    console.error('Delete failed:', error)
    throw new Error(`Failed to delete file: ${error}`)
  }
}

/**
 * List all audio files (UI uploads only)
 */
export async function listAudioFiles(): Promise<AudioFile[]> {
  try {
    // List from bulk/ folder (unified pipeline)
    // All uploads (UI + CLI) now go through same processing
    const result = await list({
      path: 'audio/bulk/',
      options: {
        listAll: true,
      },
    })

    return result.items.map((item) => ({
      key: item.path,
      size: item.size,
      lastModified: item.lastModified,
    }))
  } catch (error) {
    console.error('Failed to list audio files:', error)
    throw new Error(`Failed to list audio files: ${error}`)
  }
}

/**
 * Get audio file metadata from File object
 */
export async function getAudioMetadata(file: File): Promise<{
  duration?: number
  bitrate?: number
  sampleRate?: number
}> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)

    audio.addEventListener('loadedmetadata', () => {
      const duration = Math.floor(audio.duration)
      URL.revokeObjectURL(url)
      
      // Note: bitrate and sampleRate are not directly available from HTML5 Audio API
      // For full metadata, you'd need a library like music-metadata or jsmediatags
      resolve({
        duration,
      })
    })

    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      resolve({})
    })

    audio.src = url
  })
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
