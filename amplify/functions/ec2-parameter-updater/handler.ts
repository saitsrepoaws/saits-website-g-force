/**
 * EC2 Parameter Store Auto-Updater
 * 
 * Automatically updates Parameter Store when EC2 instance launches.
 * Triggered by EC2 user data script via SNS topic.
 * 
 * Updates:
 * - /gforge-radio/ec2/instance-id
 * - /gforge-radio/ec2/public-ip
 * - /gforge-radio/ec2/private-ip
 * - /gforge-radio/ec2/dns-full
 */

import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'
import { Route53Client, ChangeResourceRecordSetsCommand } from '@aws-sdk/client-route-53'

const ec2Client = new EC2Client({})
const ssmClient = new SSMClient({})
const route53Client = new Route53Client({})

const PARAM_PREFIX = '/gforge-radio/ec2'
const HOSTED_ZONE_ID = 'Z0394495QU2ORJXX04VZ' // g-force.cloud
const AWS_ACCOUNT = '035636364722'
const REGION = 'eu-west-1'

interface EC2Metadata {
  instanceId: string
  publicIp: string
  privateIp: string
  vpcId: string
  elasticIp?: string
}

/**
 * Main handler - Updates Parameter Store with EC2 metadata
 */
export const handler = async (event: any) => {
  console.log('🔄 EC2 Parameter Store Auto-Updater started')
  console.log('Event:', JSON.stringify(event, null, 2))
  
  try {
    // Get instance ID from event
    const instanceId = extractInstanceId(event)
    
    if (!instanceId) {
      throw new Error('No instance ID found in event')
    }
    
    console.log(`📋 Processing instance: ${instanceId}`)
    
    // Get EC2 metadata
    const metadata = await getEC2Metadata(instanceId)
    console.log('Metadata:', metadata)
    
    // Update Parameter Store
    await updateParameterStore(metadata)
    
    // Update DNS (CNAME with full metadata)
    await updateDNS(metadata)
    
    console.log('✅ Parameter Store and DNS updated successfully!')
    
    return {
      statusCode: 200,
      body: {
        message: 'EC2 parameters updated',
        instanceId: metadata.instanceId,
        publicIp: metadata.publicIp,
        privateIp: metadata.privateIp
      }
    }
  } catch (error) {
    console.error('❌ Error updating parameters:', error)
    throw error
  }
}

/**
 * Extract instance ID from various event sources
 */
function extractInstanceId(event: any): string | null {
  // From SNS message
  if (event.Records?.[0]?.Sns?.Message) {
    try {
      const message = JSON.parse(event.Records[0].Sns.Message)
      if (message.instanceId) return message.instanceId
    } catch {}
  }
  
  // From EventBridge
  if (event.detail?.['instance-id']) {
    return event.detail['instance-id']
  }
  
  // Direct invocation
  if (event.instanceId) {
    return event.instanceId
  }
  
  // From SNS subject
  if (event.Records?.[0]?.Sns?.Subject) {
    const match = event.Records[0].Sns.Subject.match(/i-[a-f0-9]+/)
    if (match) return match[0]
  }
  
  return null
}

/**
 * Get EC2 instance metadata
 */
async function getEC2Metadata(instanceId: string): Promise<EC2Metadata> {
  const response = await ec2Client.send(
    new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    })
  )
  
  const instance = response.Reservations?.[0]?.Instances?.[0]
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`)
  }
  
  const publicIp = instance.PublicIpAddress || ''
  const privateIp = instance.PrivateIpAddress || ''
  const vpcId = instance.VpcId || ''
  
  // Check if it's an Elastic IP
  const elasticIp = instance.NetworkInterfaces?.[0]?.Association?.PublicIp || publicIp
  
  return {
    instanceId,
    publicIp,
    privateIp,
    vpcId,
    elasticIp: elasticIp === publicIp ? elasticIp : undefined
  }
}

/**
 * Update Parameter Store with EC2 metadata
 */
async function updateParameterStore(metadata: EC2Metadata): Promise<void> {
  const parameters = [
    {
      name: `${PARAM_PREFIX}/instance-id`,
      value: metadata.instanceId,
      description: 'EC2 Stream Server Instance ID (auto-updated)'
    },
    {
      name: `${PARAM_PREFIX}/public-ip`,
      value: metadata.publicIp,
      description: 'EC2 Public IP (auto-updated)'
    },
    {
      name: `${PARAM_PREFIX}/private-ip`,
      value: metadata.privateIp,
      description: 'EC2 Private IP (auto-updated)'
    },
    {
      name: `${PARAM_PREFIX}/vpc-id`,
      value: metadata.vpcId,
      description: 'VPC ID (auto-updated)'
    }
  ]
  
  if (metadata.elasticIp) {
    parameters.push({
      name: `${PARAM_PREFIX}/elastic-ip`,
      value: metadata.elasticIp,
      description: 'Elastic IP (auto-updated)'
    })
  }
  
  // Create full metadata DNS name
  const privateIpDashed = metadata.privateIp.replace(/\./g, '-')
  const vpcShort = metadata.vpcId.replace('vpc-', 'vpc')
  const dnsFull = `${privateIpDashed}.${vpcShort}.${REGION}.${metadata.instanceId}.g-force.cloud`
  
  parameters.push({
    name: `${PARAM_PREFIX}/dns-full`,
    value: dnsFull,
    description: 'Full metadata DNS name (auto-updated)'
  })
  
  // Update all parameters
  for (const param of parameters) {
    try {
      await ssmClient.send(
        new PutParameterCommand({
          Name: param.name,
          Value: param.value,
          Description: param.description,
          Type: 'String',
          Overwrite: true
        })
      )
      console.log(`✅ Updated: ${param.name} = ${param.value}`)
    } catch (error) {
      console.error(`❌ Failed to update ${param.name}:`, error)
      throw error
    }
  }
}

/**
 * Update Route53 DNS with full metadata CNAME
 */
async function updateDNS(metadata: EC2Metadata): Promise<void> {
  // Create full metadata DNS name
  const privateIpDashed = metadata.privateIp.replace(/\./g, '-')
  const vpcShort = metadata.vpcId.replace('vpc-', 'vpc')
  const dnsFull = `${privateIpDashed}.${vpcShort}.${REGION}.${metadata.instanceId}.g-force.cloud.`
  
  try {
    await route53Client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: HOSTED_ZONE_ID,
        ChangeBatch: {
          Changes: [
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: dnsFull,
                Type: 'A',
                TTL: 300,
                ResourceRecords: [{ Value: metadata.publicIp }]
              }
            },
            {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: 'stream.g-force.cloud.',
                Type: 'A',
                TTL: 300,
                ResourceRecords: [{ Value: metadata.publicIp }]
              }
            }
          ]
        }
      })
    )
    
    console.log(`✅ DNS updated: ${dnsFull} → ${metadata.publicIp}`)
    console.log(`✅ DNS updated: stream.g-force.cloud → ${metadata.publicIp}`)
  } catch (error) {
    console.error('❌ Failed to update DNS:', error)
    // Don't throw - DNS update is not critical
  }
}
