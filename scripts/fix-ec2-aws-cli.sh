#!/bin/bash
# Fix AWS CLI op bestaande EC2 instance
# Run dit script op de EC2 instance zelf via SSH

set -e

echo "🔧 Fixing AWS CLI installation on EC2..."
echo ""

# Install AWS CLI v2
echo "📦 Installing AWS CLI v2..."
cd /tmp
curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

echo ""
echo "✅ AWS CLI installed:"
/usr/local/bin/aws --version

echo ""
echo "🧪 Testing S3 Access..."
echo ""

# Test IAM role
echo "1. IAM Role:"
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
echo ""
echo ""

# Test playlist bucket
echo "2. Playlist Bucket:"
/usr/local/bin/aws s3 ls s3://radio-playlists-035636364722/
echo ""

# Test download playlist
echo "3. Download Playlist:"
/usr/local/bin/aws s3 cp s3://radio-playlists-035636364722/current-playlist.m3u /tmp/test-playlist.m3u
if [ -f /tmp/test-playlist.m3u ]; then
    echo "✅ SUCCESS - Playlist downloaded"
    ls -lh /tmp/test-playlist.m3u
    echo ""
    echo "First 5 tracks:"
    head -15 /tmp/test-playlist.m3u | grep -E "^#EXTINF|^s3://"
else
    echo "❌ FAILED - Could not download playlist"
fi
echo ""

# Test storage bucket
echo "4. Storage Bucket (audio files):"
/usr/local/bin/aws s3 ls s3://amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr/public/audio/ | head -3
echo ""

# Test specific track
echo "5. Check Specific Track:"
/usr/local/bin/aws s3api head-object \
  --bucket amplify-gforgeiot-gerard--gforgeiotstoragebucketee-ezjbtc4ovwwr \
  --key public/audio/1762515063037-Ash_Roy__SyncSystm_-_Train_to_Berlin__Original_Mix___Soupherb_Records_.mp3 \
  --query '{Size:ContentLength,Type:ContentType,LastModified:LastModified}' \
  --output table

echo ""
echo "✅ All S3 access tests complete!"
echo ""
echo "EC2 kan nu bij beide buckets:"
echo "  - ✅ Playlist bucket"
echo "  - ✅ Storage bucket (audio files)"
