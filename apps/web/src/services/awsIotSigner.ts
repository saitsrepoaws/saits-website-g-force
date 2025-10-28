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
  const presignedUrl = await signer.presign(request, {
    expiresIn: 300, // 5 minutes
  })

  // Build WebSocket URL
  const url = `wss://${presignedUrl.hostname}${presignedUrl.path}?${presignedUrl.query || ''}`
  
  return { url }
}

