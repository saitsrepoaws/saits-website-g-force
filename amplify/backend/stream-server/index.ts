/**
 * G-FORGE RADIO - EC2 Stream Server Stack
 * 
 * CLEAN PIPELINE DEPLOYMENT:
 * - EC2 instance only (NO UserData!)
 * - All software installed via CodeDeploy
 * - IAM roles with proper permissions
 * - Security groups
 * - Elastic IP
 * - CodeDeploy tags
 * 
 * Software installation handled by:
 * - pipeline/ami/ami-setup.sh (via CodeDeploy)
 * - scripts/deploy/* (CodeDeploy hooks)
 * - scripts/iot-queue-listener.sh (IoT queue)
 * - Docker containers (Icecast, Nginx)
 */

import { Stack, StackProps, CfnOutput, Duration, Tags } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export interface StreamServerStackProps extends StackProps {
  region: string
  accountId: string
}

export class StreamServerStack extends Stack {
  public readonly instance: ec2.Instance
  public readonly elasticIp: ec2.CfnEIP
  public readonly role: iam.Role

  constructor(scope: Construct, id: string, props: StreamServerStackProps) {
    super(scope, id, props)

    // ============================================================================
    // VPC - Use default VPC for cost savings
    // ============================================================================
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true
    })

    // ============================================================================
    // SECURITY GROUP
    // ============================================================================
    const securityGroup = new ec2.SecurityGroup(this, 'StreamServerSG', {
      vpc,
      description: 'G-Forge Radio Stream Server Security Group',
      allowAllOutbound: true
    })

    // SSH (for management)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'SSH access'
    )

    // HTTP/HTTPS (for Nginx)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP access'
    )
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS access'
    )

    // Icecast (streaming)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8000),
      'Icecast streaming'
    )

    // ============================================================================
    // IAM ROLE - Full permissions for stream server
    // ============================================================================
    this.role = new iam.Role(this, 'StreamServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'G-Forge Radio Stream Server Role',
      managedPolicies: [
        // SSM for remote management
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // CloudWatch for logs and metrics
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    })

    // S3 - Read access to storage buckets (amplify-* pattern)
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'S3StorageBucketAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        `arn:aws:s3:::amplify-*`,
        `arn:aws:s3:::amplify-*/*`,
        `arn:aws:s3:::g-forge-radio-*`,
        `arn:aws:s3:::g-forge-radio-*/*`
      ]
    }))

    // IoT - Publish and Subscribe for queue and metadata
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'IoTQueueAndMetadata',
      effect: iam.Effect.ALLOW,
      actions: [
        'iot:Connect',
        'iot:Publish',
        'iot:Subscribe',
        'iot:Receive'
      ],
      resources: [
        `arn:aws:iot:${props.region}:${this.account}:topic/radio/queue/*`,
        `arn:aws:iot:${props.region}:${this.account}:topic/radio/stream/*`,
        `arn:aws:iot:${props.region}:${this.account}:topic/radio/control/*`,
        `arn:aws:iot:${props.region}:${this.account}:topic/radio/response/*`,
        `arn:aws:iot:${props.region}:${this.account}:client/*`,
        `arn:aws:iot:${props.region}:${this.account}:topicfilter/radio/*`
      ]
    }))

    // IoT - Device Shadow access
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'IoTDeviceShadow',
      effect: iam.Effect.ALLOW,
      actions: [
        'iot:UpdateThingShadow',
        'iot:GetThingShadow'
      ],
      resources: [
        `arn:aws:iot:${props.region}:${this.account}:thing/splash-fm-radio`
      ]
    }))

    // SSM Parameter Store - Read configuration
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'SSMParameterStoreRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath'
      ],
      resources: [
        `arn:aws:ssm:${props.region}:${this.account}:parameter/gforge-radio/*`
      ]
    }))

    // CloudWatch Logs - Custom logs
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogsCustom',
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams'
      ],
      resources: [
        `arn:aws:logs:${props.region}:${this.account}:log-group:/g-forge-radio/*`,
        `arn:aws:logs:${props.region}:${this.account}:log-group:/g-forge-radio/*:*`
      ]
    }))

    // EC2 - Metadata access
    this.role.addToPolicy(new iam.PolicyStatement({
      sid: 'EC2MetadataAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:DescribeVolumes',
        'ec2:DescribeTags',
        'ec2:DescribeInstances',
        'ec2:DescribeAddresses'
      ],
      resources: ['*']
    }))

    // ============================================================================
    // EC2 INSTANCE - t3.small, Ubuntu 22.04, 20GB GP3
    // ============================================================================
    this.instance = new ec2.Instance(this, 'StreamServerInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      // Ubuntu 22.04 LTS
      machineImage: ec2.MachineImage.lookup({
        name: 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*',
        owners: ['099720109477'] // Canonical
      }),
      securityGroup,
      role: this.role,
      // 20GB GP3 root volume
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(20, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          deleteOnTermination: true
        })
      }],
      // SSH Key (optional - we use SSM)
      keyName: 'g-forge-radio', // Create this key manually if needed
      // NO UserData - all installation via CodeDeploy!
      // userDataCausesReplacement: false
    })

    // Tags for CodeDeploy
    Tags.of(this.instance).add('Name', 'G-Forge-Radio-Stream-Server')
    Tags.of(this.instance).add('Environment', 'production')
    Tags.of(this.instance).add('Application', 'g-forge-radio')
    Tags.of(this.instance).add('DeploymentGroup', 'radio-production')

    // ============================================================================
    // ELASTIC IP - Fixed IP address
    // ============================================================================
    this.elasticIp = new ec2.CfnEIP(this, 'StreamServerEIP', {
      domain: 'vpc',
      instanceId: this.instance.instanceId,
      tags: [{
        key: 'Name',
        value: 'G-Forge-Radio-Stream-Server-EIP'
      }]
    })

    // ============================================================================
    // SSM PARAMETERS - Managed by parent stack via createEC2Parameters()
    // ============================================================================
    // Note: Parameters are created in backend.ts after EC2 instance is deployed
    // This avoids conflicts with existing parameter store entries

    // ============================================================================
    // OUTPUTS
    // ============================================================================
    new CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      description: 'EC2 Instance ID',
      exportName: 'GForgeRadioInstanceId'
    })

    new CfnOutput(this, 'ElasticIP', {
      value: this.elasticIp.ref,
      description: 'Elastic IP Address',
      exportName: 'GForgeRadioElasticIP'
    })

    new CfnOutput(this, 'SecurityGroupId', {
      value: securityGroup.securityGroupId,
      description: 'Security Group ID',
      exportName: 'GForgeRadioSecurityGroupId'
    })

    new CfnOutput(this, 'IAMRoleArn', {
      value: this.role.roleArn,
      description: 'IAM Role ARN',
      exportName: 'GForgeRadioIAMRoleArn'
    })
  }
}
