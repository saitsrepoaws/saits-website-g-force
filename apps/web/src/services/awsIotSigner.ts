/**
 * AWS IoT WebSocket URL Signer
 * Generates signed WebSocket URL for MQTT over WebSocket
 * Using Cognito credentials
 * 
 * Based on AWS IoT documentation:
 * https://docs.aws.amazon.com/iot/latest/developerguide/protocols.html#mqtt-ws
 */

import { Sha256 } from '@aws-crypto/sha256-js'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import type { AwsCredentialIdentity } from '@aws-sdk/types'

/**
 * Generate signed WebSocket URL for AWS IoT
 * 
 * This creates a presigned URL that MQTT.js can use to connect
 */
export async function generateSignedIoTUrl(
  endpoint: string,
  credentials: AwsCredentialIdentity,
  region: string = 'eu-west-1'
): Promise<{ url: string }> {
  
  console.log('🔐 Starting URL signing...')
  console.log('  Endpoint:', endpoint)
  console.log('  Region:', region)
  console.log('  AccessKeyId:', credentials.accessKeyId.substring(0, 10) + '...')
  console.log('  Has SessionToken:', !!credentials.sessionToken)
  
  const signer = new SignatureV4({
    service: 'iotdevicegateway',
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    sha256: Sha256,
  })
  
  console.log('✅ SignatureV4 instance created')

  // Create request to presign
  const request = {
    method: 'GET' as const,
    protocol: 'wss:' as const,
    hostname: endpoint,
    path: '/mqtt',
    headers: {
      host: endpoint,
    },
  }

  // Presign the request (generates query string with signature)
  console.log('⏳ Calling presign()...')
  try {
    const presigned = await signer.presign(request, {
      expiresIn: 300, // 5 minutes
    })
    
    console.log('✅ Presign completed')
    console.log('  Query params:', Object.keys(presigned.query || {}).length)

    // Extract query params from presigned request
    const url = new URL(`wss://${endpoint}/mqtt`)
    
    // Add all query params from presigned request (QueryParameterBag is Record<string, string>)
    if (presigned.query) {
      for (const [key, value] of Object.entries(presigned.query)) {
        url.searchParams.set(key, String(value))
      }
    }
    
    console.log('🔐 Final signed URL:', url.toString().substring(0, 120) + '...')
    
    return { url: url.toString() }
  } catch (error) {
    console.error('❌ Presign failed:', error)
    throw error
  }
}

