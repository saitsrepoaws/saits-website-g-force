# EC2 IAM Role Setup voor S3 Toegang

## Overzicht
De EC2 Stream Server heeft een IAM rol nodig om toegang te krijgen tot S3 buckets voor:
- **Playlist Bucket**: Ophalen van `current-playlist.m3u` bestanden
- **Storage Bucket**: Ophalen van audio bestanden en configuratie

## IAM Rol Configuratie

### Rol: StreamServerRole
**Locatie**: `amplify/backend.ts` (regel 690-717)

```typescript
const ec2Role = new iam.Role(streamPlaylistLambda.stack, 'StreamServerRole', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
  ]
})
```

### Managed Policies
- **AmazonSSMManagedInstanceCore**: Voor AWS Systems Manager toegang (remote management)

### S3 Permissions

#### Via CDK Grant Methods
```typescript
playlistBucket.grantRead(ec2Role)
storageBucket.grantRead(ec2Role)
```

#### Expliciete IAM Policy
```typescript
ec2Role.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      's3:GetObject',        // Download bestanden
      's3:ListBucket',       // Lijst van bestanden in bucket
      's3:GetBucketLocation' // Bucket regio opvragen
    ],
    resources: [
      playlistBucket.bucketArn,
      `${playlistBucket.bucketArn}/*`,
      storageBucket.bucketArn,
      `${storageBucket.bucketArn}/*`
    ]
  })
)
```

## S3 Buckets

### 1. Playlist Bucket
- **Naam**: `radio-playlists-{account-id}`
- **Doel**: Opslag van dynamische playlists voor Liquidsoap
- **Bestanden**: `current-playlist.m3u`
- **Update frequentie**: Elke 5 minuten via Lambda

### 2. Storage Bucket
- **Naam**: Amplify storage bucket
- **Doel**: Audio bestanden en cover art
- **Structuur**:
  - `public/audio/*.mp3` - Track bestanden
  - `public/covers/*.jpeg` - Cover art
  - `public/waveforms/*.svg` - Waveform visualisaties

## EC2 Instance Configuratie

De IAM rol wordt automatisch gekoppeld aan de EC2 instance via een **Instance Profile**:

```typescript
const streamInstance = new ec2.Instance(streamPlaylistLambda.stack, 'StreamServer', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.SMALL
  ),
  machineImage: ec2.MachineImage.fromSsmParameter(...),
  securityGroup: streamSG,
  role: ec2Role, // ← IAM rol wordt hier gekoppeld
  userData,
  requireImdsv2: true
})
```

## AWS CLI Gebruik op EC2

De EC2 instance kan nu AWS CLI gebruiken zonder credentials:

```bash
# Download playlist van S3
aws s3 cp s3://radio-playlists-{account}/current-playlist.m3u /tmp/

# List bestanden in bucket
aws s3 ls s3://radio-playlists-{account}/

# Download audio bestand
aws s3 cp s3://amplify-storage-bucket/public/audio/track.mp3 /tmp/
```

## Liquidsoap Configuratie

Liquidsoap haalt automatisch de playlist op:

```liquidsoap
s3_bucket = "radio-playlists-{account}"
playlist_file = "/tmp/current-playlist.m3u"

def fetch_playlist() =
  log("📥 Fetching playlist from S3...")
  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")
  log("S3 result: #{ret}")
  playlist_file
end

# Initial fetch
ignore(fetch_playlist())

# Reload elke 5 minuten
add_timeout(300., fun () -> begin ignore(fetch_playlist()); -1. end)
```

## Deployment

Na het updaten van de IAM configuratie:

```bash
# Deploy backend wijzigingen
npx ampx sandbox

# Of voor productie
npx ampx pipeline-deploy
```

## Verificatie

### 1. Check IAM Rol op EC2
```bash
# SSH naar EC2
ssh ubuntu@{ec2-public-ip}

# Check attached IAM role
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Test S3 toegang
aws s3 ls s3://radio-playlists-{account}/
```

### 2. Check Liquidsoap Logs
```bash
tail -f /var/log/liquidsoap/radio.log
```

Verwachte output:
```
[2024-11-10 20:10:00] 📥 Fetching playlist from S3...
[2024-11-10 20:10:01] S3 result: download: s3://radio-playlists-xxx/current-playlist.m3u to /tmp/current-playlist.m3u
```

### 3. Check IAM Policy in AWS Console
1. EC2 → Instances → Select stream server
2. Security → IAM Role → "StreamServerRole"
3. Permissions → Verify S3 permissions

## Troubleshooting

### Error: "Access Denied" bij S3 download
**Oorzaak**: IAM permissions ontbreken
**Oplossing**: Verify role permissions in AWS Console

### Error: "Unable to locate credentials"
**Oorzaak**: Instance Profile niet gekoppeld
**Oplossing**: Herstart EC2 of check role attachment

### Playlist wordt niet geüpdatet
**Oorzaak**: Lambda schrijft niet naar S3
**Oplossing**: Check stream-playlist-updater Lambda logs

## Security Best Practices

✅ **Principe van Least Privilege**: Alleen read-only toegang voor EC2
✅ **IMDSv2**: Verplicht voor enhanced security
✅ **SSM Access**: Remote management zonder SSH keys
✅ **Bucket Encryption**: S3 buckets zijn encrypted at rest

## Gerelateerde Documentatie

- Stream Server Setup: `ref/STREAM_SERVER_SETUP.md`
- Playlist Generator: Lambda functie die playlists schrijft
- Stream Status Publisher: Lambda die status published

