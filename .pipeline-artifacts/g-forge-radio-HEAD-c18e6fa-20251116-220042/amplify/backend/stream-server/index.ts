/**
 * EC2 Icecast/Liquidsoap Stream Server
 * 
 * Deploys an EC2 instance with:
 * - Icecast2 server (MP3 streaming)
 * - Liquidsoap (playlist management + crossfade)
 * - Auto-scaling (optional)
 * - Security groups for HTTP/Icecast
 */
import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export class StreamServerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // VPC for EC2
    const vpc = new ec2.Vpc(this, 'StreamVPC', {
      maxAzs: 2,
      natGateways: 0, // Use public subnet only for cost savings
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        }
      ]
    })

    // Security Group
    const securityGroup = new ec2.SecurityGroup(this, 'StreamSG', {
      vpc,
      description: 'Security group for Icecast stream server',
      allowAllOutbound: true
    })

    // Allow Icecast port 8000
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8000),
      'Allow Icecast streaming'
    )

    // Allow SSH (for management)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access'
    )

    // Allow HTTP (for stats page)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP access'
    )

    // S3 Bucket for playlists
    const playlistBucket = new s3.Bucket(this, 'PlaylistBucket', {
      bucketName: `radio-playlists-${this.account}`,
      publicReadAccess: false,
      versioned: false,
      lifecycleRules: [
        {
          expiration: Duration.days(7),
          id: 'CleanupOldPlaylists'
        }
      ]
    })

    // IAM Role for EC2
    const role = new iam.Role(this, 'StreamServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    })

    // Grant S3 access to EC2
    playlistBucket.grantRead(role)

    // User data script for EC2 initialization
    const userData = ec2.UserData.forLinux()
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Update system',
      'apt-get update',
      'apt-get upgrade -y',
      '',
      '# Install dependencies',
      'apt-get install -y \\',
      '  icecast2 \\',
      '  liquidsoap \\',
      '  awscli \\',
      '  nginx \\',
      '  git \\',
      '  curl',
      '',
      '# Configure Icecast',
      'cat > /etc/icecast2/icecast.xml << EOF',
      '<icecast>',
      '  <location>Europe/Amsterdam</location>',
      '  <admin>admin@radio.fm</admin>',
      '  <limits>',
      '    <clients>100</clients>',
      '    <sources>5</sources>',
      '    <queue-size>524288</queue-size>',
      '    <client-timeout>30</client-timeout>',
      '    <header-timeout>15</header-timeout>',
      '    <source-timeout>10</source-timeout>',
      '    <burst-on-connect>1</burst-on-connect>',
      '    <burst-size>65535</burst-size>',
      '  </limits>',
      '  <authentication>',
      '    <source-password>gforge2024radio</source-password>',
      '    <relay-password>gforge2024relay</relay-password>',
      '    <admin-user>admin</admin-user>',
      '    <admin-password>gforge2024admin</admin-password>',
      '  </authentication>',
      '  <hostname>radio.g-forge.com</hostname>',
      '  <listen-socket>',
      '    <port>8000</port>',
      '  </listen-socket>',
      '  <mount-name>/stream.mp3</mount-name>',
      '  <fileserve>1</fileserve>',
      '  <paths>',
      '    <basedir>/usr/share/icecast2</basedir>',
      '    <logdir>/var/log/icecast2</logdir>',
      '    <webroot>/usr/share/icecast2/web</webroot>',
      '    <adminroot>/usr/share/icecast2/admin</adminroot>',
      '    <alias source="/" destination="/status.xsl"/>',
      '  </paths>',
      '  <logging>',
      '    <accesslog>access.log</accesslog>',
      '    <errorlog>error.log</errorlog>',
      '    <loglevel>3</loglevel>',
      '  </logging>',
      '</icecast>',
      'EOF',
      '',
      '# Enable Icecast',
      'sed -i "s/ENABLE=false/ENABLE=true/" /etc/default/icecast2',
      '',
      '# Create Liquidsoap script directory',
      'mkdir -p /opt/radio',
      'cd /opt/radio',
      '',
      '# Create Liquidsoap configuration',
      'cat > /opt/radio/radio.liq << EOF',
      '# G-Forge Radio - Liquidsoap Configuration',
      'set("log.file.path", "/var/log/liquidsoap/radio.log")',
      'set("log.level", 3)',
      '',
      '# Settings',
      's3_bucket = "' + playlistBucket.bucketName + '"',
      'playlist_file = "/tmp/current-playlist.m3u"',
      'fallback_track = "/opt/radio/fallback.mp3"',
      '',
      '# Function to download playlist from S3',
      'def fetch_playlist() =',
      '  log("Fetching playlist from S3...")',
      '  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")',
      '  log("S3 sync result: #{ret}")',
      '  playlist_file',
      'end',
      '',
      '# Initial playlist fetch',
      'ignore(fetch_playlist())',
      '',
      '# Reload playlist every 5 minutes',
      'add_timeout(300., fun () -> begin ignore(fetch_playlist()); -1. end)',
      '',
      '# Create playlist source with reload',
      'radio = playlist(',
      '  playlist_file,',
      '  mode="normal",',
      '  reload_mode="watch",',
      '  reload=300',
      ')',
      '',
      '# Fallback if playlist empty',
      'radio = fallback(',
      '  track_sensitive=false,',
      '  [radio, single(fallback_track)]',
      ')',
      '',
      '# Apply crossfade',
      'radio = crossfade(',
      '  start_next=3.,',
      '  fade_in=2.,',
      '  fade_out=2.,',
      '  radio',
      ')',
      '',
      '# Normalize audio',
      'radio = normalize(radio)',
      '',
      '# Output to Icecast',
      'output.icecast(',
      '  %mp3(bitrate=192, samplerate=44100),',
      '  host="localhost",',
      '  port=8000,',
      '  password="gforge2024radio",',
      '  mount="/stream.mp3",',
      '  name="G-Forge Radio",',
      '  description="Techno & Electronic Music 24/7",',
      '  genre="Techno",',
      '  url="https://radio.g-forge.com",',
      '  public=true,',
      '  radio',
      ')',
      'EOF',
      '',
      '# Create systemd service for Liquidsoap',
      'cat > /etc/systemd/system/liquidsoap-radio.service << EOF',
      '[Unit]',
      'Description=Liquidsoap Radio Stream',
      'After=network.target icecast2.service',
      'Requires=icecast2.service',
      '',
      '[Service]',
      'Type=simple',
      'User=root',
      'ExecStart=/usr/bin/liquidsoap /opt/radio/radio.liq',
      'Restart=always',
      'RestartSec=10',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '',
      '# Create log directory',
      'mkdir -p /var/log/liquidsoap',
      '',
      '# Download fallback track (silence or default track)',
      'echo "Creating fallback track..."',
      'ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -q:a 9 -acodec libmp3lame /opt/radio/fallback.mp3 || true',
      '',
      '# Create initial empty playlist',
      'touch /tmp/current-playlist.m3u',
      '',
      '# Start services',
      'systemctl daemon-reload',
      'systemctl enable icecast2',
      'systemctl start icecast2',
      'systemctl enable liquidsoap-radio',
      'systemctl start liquidsoap-radio',
      '',
      '# Configure nginx as reverse proxy (optional)',
      'cat > /etc/nginx/sites-available/radio << EOF',
      'server {',
      '  listen 80;',
      '  server_name _;',
      '',
      '  location / {',
      '    proxy_pass http://localhost:8000;',
      '    proxy_set_header Host \\$host;',
      '    proxy_set_header X-Real-IP \\$remote_addr;',
      '  }',
      '}',
      'EOF',
      '',
      'ln -sf /etc/nginx/sites-available/radio /etc/nginx/sites-enabled/',
      'rm -f /etc/nginx/sites-enabled/default',
      'systemctl restart nginx',
      '',
      '# Health check script',
      'cat > /opt/radio/healthcheck.sh << EOF',
      '#!/bin/bash',
      'curl -f http://localhost:8000/status-json.xsl > /dev/null 2>&1',
      'if [ \\$? -eq 0 ]; then',
      '  echo "Stream is healthy"',
      '  exit 0',
      'else',
      '  echo "Stream is down, restarting..."',
      '  systemctl restart icecast2',
      '  systemctl restart liquidsoap-radio',
      '  exit 1',
      'fi',
      'EOF',
      'chmod +x /opt/radio/healthcheck.sh',
      '',
      '# Add healthcheck cron',
      'echo "*/5 * * * * /opt/radio/healthcheck.sh >> /var/log/radio-health.log 2>&1" | crontab -',
      '',
      'echo "✅ Radio stream server setup complete!"',
      'echo "Stream URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000/stream.mp3"'
    )

    // EC2 Instance
    const instance = new ec2.Instance(this, 'StreamServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL
      ),
      machineImage: ec2.MachineImage.fromSsmParameter(
        '/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
        { os: ec2.OperatingSystemType.LINUX }
      ),
      securityGroup,
      role,
      userData,
      userDataCausesReplacement: true,
      requireImdsv2: true
    })

    // Elastic IP (optional - for fixed IP)
    const eip = new ec2.CfnEIP(this, 'StreamServerEIP', {
      instanceId: instance.instanceId
    })

    // Outputs
    new CfnOutput(this, 'StreamServerPublicIP', {
      value: eip.ref,
      description: 'Public IP of stream server'
    })

    new CfnOutput(this, 'StreamURL', {
      value: `http://${eip.ref}:8000/stream.mp3`,
      description: 'Radio stream URL'
    })

    new CfnOutput(this, 'IcecastAdminURL', {
      value: `http://${eip.ref}:8000/admin/`,
      description: 'Icecast admin interface'
    })

    new CfnOutput(this, 'PlaylistBucketName', {
      value: playlistBucket.bucketName,
      description: 'S3 bucket for playlists'
    })
  }
}
