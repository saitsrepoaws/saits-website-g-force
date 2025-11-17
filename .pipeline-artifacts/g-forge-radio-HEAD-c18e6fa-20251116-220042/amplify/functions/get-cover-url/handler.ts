/**
 * Get Cover URL Lambda
 * Returns a signed S3 URL for a cover art image
 * Public endpoint for player page (no auth required)
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({})
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || ''

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    }
  }

  try {
    // Get coverArtPath from query params
    const coverArtPath = event.queryStringParameters?.path

    if (!coverArtPath) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing path parameter' })
      }
    }

    // Generate signed URL (valid for 1 hour)
    const command = new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: coverArtPath
    })

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600 // 1 hour
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: signedUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      })
    }
  } catch (error: any) {
    console.error('Error generating cover URL:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
