# EC2 Stream Server CloudFormation Code - BACKUP

**Datum:** 16 November 2025, 14:50 CET  
**Reden:** Code verwijderd uit backend.ts - EC2 is manueel beheerd  
**Status:** BEWAARD VOOR REFERENTIE

---

## ⚠️ WAAROM VERWIJDERD?

1. **EC2 is al manueel opgezet:**
   - IP: 79.125.44.178
   - Services: Icecast, Liquidsoap, Nginx
   - Status: ✅ WERKEND

2. **CloudFormation conflict:**
   - Old stack: function1351588B (DELETE_FAILED)
   - VPC subnets in gebruik door NLBs
   - Blokkeert deployment

3. **Oplossing:**
   - EC2 blijft manueel beheerd
   - Code bewaard voor documentatie
   - Backend wordt cleaner

---

## 📝 VOLLEDIGE EC2 CLOUDFORMATION CODE

```typescript
// =============================================================================
// VPC for EC2 Stream Server
// =============================================================================

const vpc = new ec2.Vpc(streamPlaylistLambda.stack, 'StreamVPC', {
  maxAzs: 2,
  natGateways: 0, // Use public subnet only for cost
  subnetConfiguration: [
    {
      name: 'Public',
      subnetType: ec2.SubnetType.PUBLIC,
      cidrMask: 24
    }
  ]
})

// Security Group for Stream Server
const streamSG = new ec2.SecurityGroup(streamPlaylistLambda.stack, 'StreamSG', {
  vpc,
  description: 'Security group for Icecast stream server',
  allowAllOutbound: true
})

// Allow Icecast port 8000
streamSG.addIngressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(8000),
  'Allow Icecast streaming'
)

// Allow SSH
streamSG.addIngressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(22),
  'Allow SSH access'
)

// Allow HTTP
streamSG.addIngressRule(
  ec2.Peer.anyIpv4(),
  ec2.Port.tcp(80),
  'Allow HTTP access'
)

// =============================================================================
// IAM Role for EC2
// =============================================================================

const ec2Role = new iam.Role(streamPlaylistLambda.stack, 'StreamServerRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
  ]
})

// Grant S3 read access to EC2 (includes GetObject, ListBucket, GetBucketLocation)
playlistBucket.grantRead(ec2Role)
storageBucket.grantRead(ec2Role) // For reading audio files

// NOTE: SQS removed - EC2 now reads from local M3U file
// Liquidsoap uses playlist() operator with /var/radio/playlists/current.m3u

// =============================================================================
// User data script for EC2
// =============================================================================

const userData = ec2.UserData.forLinux()
userData.addCommands(
  '#!/bin/bash',
  'set -e',
  'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
  '',
  'echo "🎙️ G-Forge Radio Stream Server Setup Starting..."',
  '',
  '# Update system',
  'export DEBIAN_FRONTEND=noninteractive',
  'apt-get update',
  'apt-get upgrade -y',
  '',
  '# Pre-configure icecast2 to avoid interactive prompts',
  'echo "icecast2 icecast2/icecast-setup boolean false" | debconf-set-selections',
  '',
  '# Install basic dependencies',
  'apt-get install -y \\',
  '  icecast2 \\',
  '  liquidsoap \\',
  '  nginx \\',
  '  curl \\',
  '  unzip \\',
  '  ffmpeg',
  '',
  '# Install AWS CLI v2 (Ubuntu 24.04 compatible)',
  'echo "📦 Installing AWS CLI v2..."',
  'cd /tmp',
  'curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"',
  'unzip -q awscliv2.zip',
  'sudo ./aws/install',
  'rm -rf aws awscliv2.zip',
  '',
  '# Install SSM Agent via snap',
  'echo "📦 Installing SSM Agent..."',
  'snap install amazon-ssm-agent --classic',
  'systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service',
  'systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service',
  '',
  '# Configure Icecast',
  'cat > /etc/icecast2/icecast.xml << "ICECAST_EOF"',
  '<icecast>',
  '  <location>Europe/Amsterdam</location>',
  '  <admin>admin@g-forge.com</admin>',
  '  <limits>',
  '    <clients>100</clients>',
  '    <sources>5</sources>',
  '    <queue-size>524288</queue-size>',
  '  </limits>',
  '  <authentication>',
  '    <source-password>gforge2024radio</source-password>',
  '    <admin-password>gforge2024admin</admin-password>',
  '  </authentication>',
  '  <hostname>radio.g-forge.com</hostname>',
  '  <listen-socket>',
  '    <port>8000</port>',
  '  </listen-socket>',
  '  <paths>',
  '    <basedir>/usr/share/icecast2</basedir>',
  '    <logdir>/var/log/icecast2</logdir>',
  '    <webroot>/usr/share/icecast2/web</webroot>',
  '    <adminroot>/usr/share/icecast2/admin</adminroot>',
  '    <alias source="/" dest="/status.xsl"/>',
  '  </paths>',
  '</icecast>',
  'ICECAST_EOF',
  '',
  '# Enable Icecast',
  'sed -i "s/ENABLE=false/ENABLE=true/" /etc/default/icecast2',
  '',
  '# Configure Liquidsoap (SQS-based)',
  'mkdir -p /opt/radio /var/log/liquidsoap',
  '',
  '# Get SQS queue URL from CloudFormation export',
  'echo "📥 Getting SQS queue URL..."',
  'QUEUE_URL=$(/usr/local/bin/aws cloudformation list-exports --query "Exports[?Name==\'TrackQueueUrl\'].Value" --output text)',
  'echo "$QUEUE_URL" > /opt/radio/queue-url.txt',
  'echo "✅ Queue URL saved: $QUEUE_URL"',
  '',
  'cat > /opt/radio/radio.liq << \'LIQUIDSOAP_EOF\'',
  '# G-Forge Radio - SQS Queue Based',
  'set("log.file.path", "/var/log/liquidsoap/radio.log")',
  'set("log.level", 3)',
  '',
  'queue_url_file = "/opt/radio/queue-url.txt"',
  'queue_url = ref("")',
  '',
  '# Load queue URL',
  'def load_queue_url() =',
  '  if file.exists(queue_url_file) then',
  '    lines = file.lines(queue_url_file)',
  '    if list.length(lines) > 0 then',
  '      queue_url := list.hd(default="", lines)',
  '      log("Queue URL: #{!queue_url}")',
  '    end',
  '  end',
  'end',
  '',
  'load_queue_url()',
  '',
  '# Parse track URL from SQS message',
  'def parse_track_url(json_str) =',
  '  if string.contains(substring="fileUrl", json_str) then',
  '    start_pos = string.index(substring="\\"fileUrl\\":\\"", json_str)',
  '    if start_pos >= 0 then',
  '      url_start = start_pos + 11',
  '      url_part = string.sub(json_str, start=url_start)',
  '      url_end = string.index(substring="\\"", url_part)',
  '      if url_end > 0 then',
  '        string.sub(url_part, start=0, length=url_end)',
  '      else',
  '        ""',
  '      end',
  '    else',
  '      ""',
  '    end',
  '  else',
  '    ""',
  '  end',
  'end',
  '',
  '# Get next track from SQS',
  'def get_next_track() =',
  '  log("Polling SQS...")',
  '  cmd = "/usr/local/bin/aws sqs receive-message --queue-url \'#{!queue_url}\' --max-number-of-messages 1 --wait-time-seconds 20 --output json 2>&1"',
  '  result = process.read(cmd)',
  '  ',
  '  track_url = parse_track_url(result)',
  '  ',
  '  if track_url != "" then',
  '    log("Playing: #{track_url}")',
  '    ',
  '    # Extract receipt handle and delete message',
  '    handle_start = string.index(substring="\\"ReceiptHandle\\":\\"", result)',
  '    if handle_start >= 0 then',
  '      handle_part = string.sub(result, start=handle_start + 17)',
  '      handle_end = string.index(substring="\\"", handle_part)',
  '      if handle_end > 0 then',
  '        receipt = string.sub(handle_part, start=0, length=handle_end)',
  '        del_cmd = "/usr/local/bin/aws sqs delete-message --queue-url \'#{!queue_url}\' --receipt-handle \'#{receipt}\'"',
  '        ignore(process.read(del_cmd))',
  '      end',
  '    end',
  '    ',
  '    [request.create(track_url)]',
  '  else',
  '    []',
  '  end',
  'end',
  '',
  '# Dynamic request source',
  'radio = request.dynamic(get_next_track)',
  '',
  '# Crossfade',
  'radio = crossfade(start_next=3., fade_in=2., fade_out=2., radio)',
  '',
  '# Fallback to silence',
  'radio = fallback(track_sensitive=false, [radio, blank()])',
  'radio = normalize(radio)',
  '',
  'output.icecast(',
  '  %mp3(bitrate=192),',
  '  host="localhost",',
  '  port=8000,',
  '  password="gforge2024radio",',
  '  mount="/stream.mp3",',
  '  name="G-Forge Radio - SQS",',
  '  radio',
  ')',
  'LIQUIDSOAP_EOF',
  '',
  '# Create systemd service',
  'cat > /etc/systemd/system/liquidsoap-radio.service << "SERVICE_EOF"',
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
  'SERVICE_EOF',
  '',
  '# Start services',
  'systemctl daemon-reload',
  'systemctl enable icecast2',
  'systemctl start icecast2',
  'systemctl enable liquidsoap-radio',
  'systemctl start liquidsoap-radio',
  '',
  '# Download Splash FM player from S3',
  'echo "📥 Downloading Splash FM player..."',
  'mkdir -p /var/www/radio',
  '/usr/local/bin/aws s3 cp s3://radio-playlists-035636364722/player-homepage-v2.html /var/www/radio/index.html',
  '',
  '# Configure nginx with Splash FM player',
  'cat > /etc/nginx/sites-available/radio << "NGINX_EOF"',
  'server {',
  '  listen 80;',
  '  server_name _;',
  '',
  '  # Serve Splash FM player on root',
  '  location = / {',
  '    root /var/www/radio;',
  '    index index.html;',
  '    try_files /index.html =404;',
  '  }',
  '',
  '  # Proxy stream to Icecast',
  '  location /stream.mp3 {',
  '    proxy_pass http://localhost:8000/stream.mp3;',
  '    proxy_set_header Host $host;',
  '    proxy_buffering off;',
  '    add_header Cache-Control "no-cache, no-store, must-revalidate";',
  '  }',
  '',
  '  # Proxy admin interface to Icecast',
  '  location /admin/ {',
  '    proxy_pass http://localhost:8000/admin/;',
  '    proxy_set_header Host $host;',
  '  }',
  '',
  '  # Proxy status page to Icecast',
  '  location /status-json.xsl {',
  '    proxy_pass http://localhost:8000/status-json.xsl;',
  '    proxy_set_header Host $host;',
  '  }',
  '}',
  'NGINX_EOF',
  '',
  'ln -sf /etc/nginx/sites-available/radio /etc/nginx/sites-enabled/',
  'rm -f /etc/nginx/sites-enabled/default',
  'systemctl restart nginx',
  '',
  '# Health check script',
  'cat > /opt/radio/healthcheck.sh << "HEALTH_EOF"',
  '#!/bin/bash',
  'curl -f http://localhost:8000/status-json.xsl > /dev/null 2>&1',
  'if [ $? -ne 0 ]; then',
  '  systemctl restart icecast2',
  '  systemctl restart liquidsoap-radio',
  'fi',
  'HEALTH_EOF',
  'chmod +x /opt/radio/healthcheck.sh',
  '',
  '# Add healthcheck cron',
  'echo "*/5 * * * * /opt/radio/healthcheck.sh >> /var/log/radio-health.log 2>&1" | crontab -',
  '',
  'echo "✅ Radio stream server setup complete!"'
)

// =============================================================================
// EC2 Instance
// =============================================================================

const streamInstance = new ec2.Instance(streamPlaylistLambda.stack, 'StreamServer', {
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
  securityGroup: streamSG,
  role: ec2Role,
  userData,
  userDataCausesReplacement: true,
  requireImdsv2: true,
  blockDevices: [
    {
      deviceName: '/dev/sda1',
      volume: ec2.BlockDeviceVolume.ebs(20, {
        volumeType: ec2.EbsDeviceVolumeType.GP3
      })
    }
  ]
})

// =============================================================================
// Elastic IP for fixed stream URL
// =============================================================================

const eip = new ec2.CfnEIP(streamPlaylistLambda.stack, 'StreamServerEIP', {
  instanceId: streamInstance.instanceId,
  tags: [
    {
      key: 'Name',
      value: 'G-Forge-Radio-Stream-EIP'
    }
  ]
})

// =============================================================================
// CloudFormation Outputs
// =============================================================================

new CfnOutput(streamPlaylistLambda.stack, 'StreamServerPublicIP', {
  value: eip.ref,
  description: 'Elastic IP of stream server (fixed)',
})

new CfnOutput(streamPlaylistLambda.stack, 'StreamURL', {
  value: `http://${eip.ref}:8000/stream.mp3`,
  description: 'Radio stream URL',
})

new CfnOutput(streamPlaylistLambda.stack, 'IcecastAdminURL', {
  value: `http://${eip.ref}:8000/admin/`,
  description: 'Icecast admin interface',
})

new CfnOutput(streamPlaylistLambda.stack, 'PlaylistBucketName', {
  value: playlistBucket.bucketName,
  description: 'S3 bucket for playlists',
})

new CfnOutput(streamPlaylistLambda.stack, 'StreamServerInstanceId', {
  value: streamInstance.instanceId,
  description: 'EC2 instance ID for stream server',
})
```

---

## 📊 FEATURES VAN DEZE CODE

### VPC Setup
- 2 Availability Zones
- Public subnets only (cost optimization)
- No NAT Gateway (saves ~$30/month)

### Security Group
- Port 8000: Icecast streaming
- Port 22: SSH access
- Port 80: HTTP/Nginx

### IAM Role
- SSM for remote management
- S3 read access (playlist + audio files)

### User Data (Auto Setup)
1. Install Icecast2 + Liquidsoap + Nginx
2. Configure Icecast with SQS queue
3. Setup Liquidsoap with dynamic SQS polling
4. Configure Nginx proxy
5. Health check script (cron every 5 min)
6. Systemd services for auto-restart

### EC2 Instance
- Type: t3.small
- OS: Ubuntu 22.04 LTS
- Storage: 20GB GP3
- IMDSv2: Required (security)

### Elastic IP
- Fixed IP for stream URL
- DNS friendly

---

## ✅ HUIDIGE MANUELE SETUP

**In plaats van CloudFormation gebruiken we:**

**EC2:** 79.125.44.178
- Handmatig opgezet
- Alle services draaien perfect
- Geen CloudFormation overhead

**Voordelen:**
- Volledige controle
- Geen stack dependencies
- Sneller debuggen
- Geen CloudFormation limits

**Nadelen:**
- Handmatig beheer
- Geen auto-scaling
- Manual backup strategy

---

## 🎯 GEBRUIK VAN DEZE CODE

**Voor toekomstige referentie:**
1. Nieuwe EC2 setup in andere AWS account
2. Disaster recovery
3. Multi-region deployment
4. Testing environment

**Niet voor:**
- Huidige productie (blijft manueel)
- Amplify deployment (removed)

---

**Opgeslagen:** 16 November 2025, 14:50 CET  
**Door:** Cascade AI  
**Reden:** CloudFormation conflict cleanup
