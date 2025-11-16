/**
 * EC2 Configuration via AWS Systems Manager Parameter Store
 * 
 * Centralized configuration management for EC2 stream server
 * All Lambda functions read from Parameter Store instead of hardcoded values
 */

import { Stack } from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as iam from 'aws-cdk-lib/aws-iam'

export interface EC2Config {
  instanceId: string
  publicIp: string
  elasticIp?: string
  region: string
  vpcId?: string
  subnetId?: string
  securityGroupId?: string
  iamRoleArn?: string
}

export interface EC2ParameterConfig {
  instanceId: ssm.IStringParameter
  publicIp: ssm.IStringParameter
  elasticIp?: ssm.IStringParameter
  region: ssm.IStringParameter
}

/**
 * Create or update EC2 configuration in Parameter Store
 */
export function createEC2Parameters(
  stack: Stack,
  config: EC2Config
): EC2ParameterConfig {
  
  // Parameter prefix for namespace isolation
  const prefix = '/gforge-radio/ec2'

  // EC2 Instance ID (REQUIRED)
  const instanceIdParam = new ssm.StringParameter(stack, 'EC2InstanceId', {
    parameterName: `${prefix}/instance-id`,
    stringValue: config.instanceId,
    description: 'EC2 Stream Server Instance ID',
    tier: ssm.ParameterTier.STANDARD
  })

  // Public IP (REQUIRED)
  const publicIpParam = new ssm.StringParameter(stack, 'EC2PublicIp', {
    parameterName: `${prefix}/public-ip`,
    stringValue: config.publicIp,
    description: 'EC2 Stream Server Public IP',
    tier: ssm.ParameterTier.STANDARD
  })

  // Region (REQUIRED)
  const regionParam = new ssm.StringParameter(stack, 'EC2Region', {
    parameterName: `${prefix}/region`,
    stringValue: config.region,
    description: 'EC2 Stream Server Region',
    tier: ssm.ParameterTier.STANDARD
  })

  // Elastic IP (OPTIONAL)
  let elasticIpParam: ssm.IStringParameter | undefined
  if (config.elasticIp) {
    elasticIpParam = new ssm.StringParameter(stack, 'EC2ElasticIp', {
      parameterName: `${prefix}/elastic-ip`,
      stringValue: config.elasticIp,
      description: 'EC2 Stream Server Elastic IP',
      tier: ssm.ParameterTier.STANDARD
    })
  }

  // VPC ID (OPTIONAL)
  if (config.vpcId) {
    new ssm.StringParameter(stack, 'EC2VpcId', {
      parameterName: `${prefix}/vpc-id`,
      stringValue: config.vpcId,
      description: 'VPC ID for EC2 Stream Server',
      tier: ssm.ParameterTier.STANDARD
    })
  }

  // Subnet ID (OPTIONAL)
  if (config.subnetId) {
    new ssm.StringParameter(stack, 'EC2SubnetId', {
      parameterName: `${prefix}/subnet-id`,
      stringValue: config.subnetId,
      description: 'Subnet ID for EC2 Stream Server',
      tier: ssm.ParameterTier.STANDARD
    })
  }

  // Security Group ID (OPTIONAL)
  if (config.securityGroupId) {
    new ssm.StringParameter(stack, 'EC2SecurityGroupId', {
      parameterName: `${prefix}/security-group-id`,
      stringValue: config.securityGroupId,
      description: 'Security Group ID for EC2 Stream Server',
      tier: ssm.ParameterTier.STANDARD
    })
  }

  // IAM Role ARN (OPTIONAL)
  if (config.iamRoleArn) {
    new ssm.StringParameter(stack, 'EC2IamRoleArn', {
      parameterName: `${prefix}/iam-role-arn`,
      stringValue: config.iamRoleArn,
      description: 'IAM Role ARN for EC2 Stream Server',
      tier: ssm.ParameterTier.STANDARD
    })
  }

  return {
    instanceId: instanceIdParam,
    publicIp: publicIpParam,
    region: regionParam,
    elasticIp: elasticIpParam
  }
}

/**
 * Grant Lambda read access to EC2 parameters
 */
export function grantEC2ParameterAccess(
  lambda: iam.IGrantable,
  stack: Stack
): void {
  const prefix = '/gforge-radio/ec2'
  
  lambda.grantPrincipal.addToPrincipalPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParameterHistory',
        'ssm:GetParametersByPath'
      ],
      resources: [
        `arn:aws:ssm:${stack.region}:${stack.account}:parameter${prefix}/*`
      ]
    })
  )
}

/**
 * Get EC2 configuration at runtime (for Lambda functions)
 */
export const getEC2ConfigFromParameterStore = `
// Get EC2 configuration from Parameter Store
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm')

const ssmClient = new SSMClient({})

async function getEC2Config() {
  const prefix = '/gforge-radio/ec2'
  
  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [
        \`\${prefix}/instance-id\`,
        \`\${prefix}/public-ip\`,
        \`\${prefix}/elastic-ip\`,
        \`\${prefix}/region\`
      ],
      WithDecryption: false
    })
  )
  
  const params = response.Parameters || []
  const config = {}
  
  for (const param of params) {
    const key = param.Name?.split('/').pop()
    if (key) {
      config[key.replace(/-/g, '_').toUpperCase()] = param.Value
    }
  }
  
  return {
    instanceId: config.INSTANCE_ID || '',
    publicIp: config.PUBLIC_IP || '',
    elasticIp: config.ELASTIC_IP || '',
    region: config.REGION || 'eu-west-1'
  }
}

module.exports = { getEC2Config }
`
