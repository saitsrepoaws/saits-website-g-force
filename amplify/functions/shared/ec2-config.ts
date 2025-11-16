/**
 * EC2 Configuration Helper for Lambda Functions
 * 
 * Reads EC2 configuration from AWS Systems Manager Parameter Store
 * Used by all Lambda functions that need to interact with EC2 stream server
 */

import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm'

const ssmClient = new SSMClient({})

export interface EC2Config {
  instanceId: string
  publicIp: string
  elasticIp?: string
  region: string
}

// Cache configuration (valid for Lambda execution context lifetime)
let cachedConfig: EC2Config | null = null

/**
 * Get EC2 configuration from Parameter Store
 * 
 * Uses caching to avoid multiple SSM calls within same Lambda execution
 * 
 * @param prefix - Parameter Store prefix (default: /gforge-radio/ec2)
 * @returns EC2 configuration object
 */
export async function getEC2Config(prefix = '/gforge-radio/ec2'): Promise<EC2Config> {
  // Return cached config if available
  if (cachedConfig) {
    console.log('📦 Using cached EC2 config')
    return cachedConfig
  }

  console.log('📡 Fetching EC2 config from Parameter Store...')

  try {
    const response = await ssmClient.send(
      new GetParametersCommand({
        Names: [
          `${prefix}/instance-id`,
          `${prefix}/public-ip`,
          `${prefix}/elastic-ip`,
          `${prefix}/region`
        ],
        WithDecryption: false
      })
    )

    const params = response.Parameters || []
    
    // Build config object from parameters
    const config: Partial<EC2Config> = {}
    
    for (const param of params) {
      const key = param.Name?.split('/').pop()
      
      if (key === 'instance-id') {
        config.instanceId = param.Value || ''
      } else if (key === 'public-ip') {
        config.publicIp = param.Value || ''
      } else if (key === 'elastic-ip') {
        config.elasticIp = param.Value
      } else if (key === 'region') {
        config.region = param.Value || 'eu-west-1'
      }
    }

    // Validate required fields
    if (!config.instanceId || !config.publicIp) {
      throw new Error('Missing required EC2 configuration: instanceId and publicIp are required')
    }

    // Cache for future calls
    cachedConfig = config as EC2Config

    console.log('✅ EC2 config loaded:', {
      instanceId: config.instanceId,
      publicIp: config.publicIp,
      region: config.region
    })

    return cachedConfig
  } catch (error) {
    console.error('❌ Failed to load EC2 config from Parameter Store:', error)
    throw error
  }
}

/**
 * Clear cached configuration (useful for testing)
 */
export function clearEC2ConfigCache(): void {
  cachedConfig = null
}

/**
 * Get EC2 instance ID directly from environment variable or Parameter Store
 * 
 * Backwards compatible with old hardcoded EC2_INSTANCE_ID
 */
export async function getEC2InstanceId(): Promise<string> {
  // Legacy: Check environment variable first (backwards compatibility)
  const envInstanceId = process.env.EC2_INSTANCE_ID
  if (envInstanceId) {
    console.log('⚠️  Using legacy EC2_INSTANCE_ID from environment variable')
    return envInstanceId
  }

  // Modern: Read from Parameter Store
  const config = await getEC2Config()
  return config.instanceId
}

/**
 * Get EC2 public IP
 */
export async function getEC2PublicIp(): Promise<string> {
  const config = await getEC2Config()
  return config.publicIp
}
