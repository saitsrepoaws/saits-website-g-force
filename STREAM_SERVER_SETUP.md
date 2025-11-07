# 🎙️ Live Stream Server Setup Guide

Complete guide voor het deployen van de Hybrid Radio Stream (Lambda + Icecast EC2).

---

## 📋 **Overzicht**

Dit systeem combineert:
- **EC2 (Icecast + Liquidsoap)**: Continuous MP3 streaming
- **Lambda**: Playlist scheduling en updates
- **S3**: Playlist opslag
- **EventBridge**: Automatische playlist updates

---

## 🚀 **Deployment Steps**

### **Step 1: Install Dependencies**

```bash
cd /Users/gerard/Desktop/T7/g-forge-iot

# Install Lambda dependencies
cd amplify/functions/stream-playlist-updater
npm install
cd ../../..
```

---

### **Step 2: Deploy EC2 Stream Server**

**Optie A: Manual EC2 Launch (Snelst)**

```bash
# 1. Launch EC2 instance via AWS Console
# - AMI: Ubuntu 22.04
# - Instance type: t3.small
# - Security group: Allow ports 22, 80, 8000
# - Key pair: Create or use existing

# 2. SSH into instance
ssh -i your-key.pem ubuntu@EC2-PUBLIC-IP

# 3. Run installation script
curl -fsSL https://gist.githubusercontent.com/YOUR-GIST/install-icecast.sh | sudo bash

# Or manual installation:
sudo apt-get update && sudo apt-get install -y icecast2 liquidsoap awscli

# 4. Configure Icecast
sudo nano /etc/icecast2/icecast.xml
# (See configuration below)

# 5. Start services
sudo systemctl enable icecast2
sudo systemctl start icecast2
```

**Icecast Configuration (`/etc/icecast2/icecast.xml`):**

```xml
<icecast>
  <location>Europe/Amsterdam</location>
  <admin>admin@g-forge.com</admin>
  
  <limits>
    <clients>100</clients>
    <sources>5</sources>
  </limits>
  
  <authentication>
    <source-password>gforge2024radio</source-password>
    <admin-password>gforge2024admin</admin-password>
  </authentication>
  
  <hostname>radio.g-forge.com</hostname>
  
  <listen-socket>
    <port>8000</port>
  </listen-socket>
</icecast>
```

---

### **Step 3: Configure Liquidsoap**

Create `/opt/radio/radio.liq`:

```ruby
# G-Forge Radio - Liquidsoap Configuration

set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 3)

# Settings
s3_bucket = "radio-playlists-YOUR-ACCOUNT-ID"
playlist_file = "/tmp/current-playlist.m3u"

# Function to download playlist from S3
def fetch_playlist() =
  log("📥 Fetching playlist from S3...")
  ret = get_process_output("aws s3 cp s3://#{s3_bucket}/current-playlist.m3u #{playlist_file} 2>&1")
  log("S3 result: #{ret}")
  playlist_file
end

# Initial fetch
ignore(fetch_playlist())

# Reload every 5 minutes  
add_timeout(300., fun () -> begin ignore(fetch_playlist()); -1. end)

# Create playlist source
radio = playlist(
  playlist_file,
  mode="normal",
  reload_mode="watch",
  reload=300
)

# Crossfade between tracks
radio = crossfade(
  start_next=3.,
  fade_in=2.,
  fade_out=2.,
  radio
)

# Normalize audio levels
radio = normalize(radio)

# Output to Icecast
output.icecast(
  %mp3(bitrate=192, samplerate=44100),
  host="localhost",
  port=8000,
  password="gforge2024radio",
  mount="/stream.mp3",
  name="G-Forge Radio",
  description="Techno & Electronic Music 24/7",
  genre="Techno",
  public=true,
  radio
)
```

**Create systemd service** (`/etc/systemd/system/liquidsoap-radio.service`):

```ini
[Unit]
Description=Liquidsoap Radio Stream
After=network.target icecast2.service
Requires=icecast2.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/liquidsoap /opt/radio/radio.liq
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Start Liquidsoap:**

```bash
sudo mkdir -p /var/log/liquidsoap
sudo systemctl daemon-reload
sudo systemctl enable liquidsoap-radio
sudo systemctl start liquidsoap-radio

# Check status
sudo systemctl status liquidsoap-radio
sudo tail -f /var/log/liquidsoap/radio.log
```

---

### **Step 4: Deploy Lambda Function**

Update `amplify/backend.ts`:

```typescript
import { streamPlaylistUpdater } from './functions/stream-playlist-updater/resource'

const backend = defineBackend({
  // ... existing
  streamPlaylistUpdater,
})

// Get table references
const scheduleTable = backend.data.resources.tables['Schedule']
const playlistTable = backend.data.resources.tables['Playlist']
const trackTable = backend.data.resources.tables['Track']

// Create S3 bucket for playlists
const playlistBucket = new s3.Bucket(
  backend.streamPlaylistUpdater,
  'PlaylistBucket',
  {
    bucketName: `radio-playlists-${Stack.of(backend.streamPlaylistUpdater).account}`,
  }
)

// Grant permissions
scheduleTable.grantReadData(backend.streamPlaylistUpdater)
playlistTable.grantReadData(backend.streamPlaylistUpdater)
trackTable.grantReadData(backend.streamPlaylistUpdater)
playlistBucket.grantWrite(backend.streamPlaylistUpdater)

// Add environment variables
backend.streamPlaylistUpdater.addEnvironment('SCHEDULE_TABLE', scheduleTable.tableName)
backend.streamPlaylistUpdater.addEnvironment('PLAYLIST_TABLE', playlistTable.tableName)
backend.streamPlaylistUpdater.addEnvironment('TRACK_TABLE', trackTable.tableName)
backend.streamPlaylistUpdater.addEnvironment('PLAYLIST_BUCKET', playlistBucket.bucketName)

// EventBridge rule - Run every 5 minutes
new events.Rule(backend.streamPlaylistUpdater, 'StreamSchedulerRule', {
  schedule: events.Schedule.rate(Duration.minutes(5)),
  targets: [
    new targets.LambdaFunction(backend.streamPlaylistUpdater.resources.lambda)
  ],
})
```

**Deploy:**

```bash
npx amplify sandbox
# Or
npx amplify push
```

---

### **Step 5: Configure EC2 IAM Role for S3**

```bash
# On EC2 instance, configure AWS CLI
aws configure

# Or attach IAM role to EC2 with S3 read permissions
# Policy: AmazonS3ReadOnlyAccess (or custom policy)
```

**Test S3 access:**

```bash
aws s3 ls s3://radio-playlists-YOUR-ACCOUNT-ID/
aws s3 cp s3://radio-playlists-YOUR-ACCOUNT-ID/current-playlist.m3u /tmp/test.m3u
```

---

### **Step 6: Test the Stream**

```bash
# 1. Check Icecast is running
curl http://localhost:8000/status-json.xsl

# 2. Check Liquidsoap is running
sudo systemctl status liquidsoap-radio

# 3. Test stream URL
# Visit: http://EC2-PUBLIC-IP:8000/stream.mp3
```

**Test in browser:**

```html
<audio controls>
  <source src="http://EC2-PUBLIC-IP:8000/stream.mp3" type="audio/mpeg">
</audio>
```

---

### **Step 7: Update Frontend**

Add to `.env.local`:

```bash
VITE_STREAM_URL=http://YOUR-EC2-IP:8000/stream.mp3
```

**Test frontend:**

```bash
cd apps/web
npm run dev

# Visit: http://localhost:5173/stream/live
```

---

## 📊 **Monitoring**

### **Check Stream Status**

```bash
# Icecast stats
curl http://EC2-IP:8000/status-json.xsl | jq

# Liquidsoap logs
sudo tail -f /var/log/liquidsoap/radio.log

# System resources
htop
```

### **Listener Count**

```bash
curl -s http://EC2-IP:8000/status-json.xsl | \
  jq '.icestats.source.listeners'
```

---

## 🔧 **Troubleshooting**

### **Stream not playing**

```bash
# Check if Icecast is running
sudo systemctl status icecast2

# Check if Liquidsoap is running
sudo systemctl status liquidsoap-radio

# Check logs
sudo journalctl -u liquidsoap-radio -f
sudo tail -f /var/log/icecast2/error.log
```

### **Playlist not updating**

```bash
# Check S3 bucket
aws s3 ls s3://radio-playlists-YOUR-ACCOUNT-ID/

# Check Lambda logs
aws logs tail /aws/lambda/stream-playlist-updater --follow

# Manually trigger Lambda
aws lambda invoke \
  --function-name stream-playlist-updater \
  response.json

# Check playlist file
cat /tmp/current-playlist.m3u
```

### **No audio / silence**

```bash
# Check if tracks exist in S3
aws s3 ls s3://YOUR-BUCKET/public/audio/

# Test track URL
curl -I https://YOUR-BUCKET.s3.amazonaws.com/public/audio/track.mp3

# Check Liquidsoap is reading playlist
sudo tail -f /var/log/liquidsoap/radio.log | grep -i "playlist"
```

---

## 💰 **Cost Estimate**

**Monthly costs:**

- **EC2 t3.small**: $15/month (730 hours × $0.0208/hour)
- **S3 Storage**: $0.50/month (assuming 20GB tracks + playlists)
- **S3 Requests**: $0.10/month
- **Data Transfer**: ~$1-5/month (depends on listeners)
- **Lambda**: $0.20/month (8,640 invocations)

**Total**: ~$17-20/month

---

## 🎯 **Next Steps**

1. ✅ **CloudFront CDN** (optional): Global distribution
2. ✅ **Domain Name**: `radio.g-forge.com`
3. ✅ **SSL Certificate**: HTTPS streaming
4. ✅ **Auto-scaling**: Multiple EC2 instances
5. ✅ **Monitoring**: CloudWatch dashboards
6. ✅ **Backup**: Automated snapshots

---

## 📝 **Quick Reference**

**Stream URLs:**
- Main stream: `http://EC2-IP:8000/stream.mp3`
- Admin page: `http://EC2-IP:8000/admin/`
- Stats JSON: `http://EC2-IP:8000/status-json.xsl`

**Credentials:**
- Source password: `gforge2024radio`
- Admin password: `gforge2024admin`

**Log Files:**
- Icecast: `/var/log/icecast2/`
- Liquidsoap: `/var/log/liquidsoap/radio.log`
- Playlist: `/tmp/current-playlist.m3u`

---

✅ **READY TO STREAM!** 🎙️
