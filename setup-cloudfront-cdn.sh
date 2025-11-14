#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ☁️ CLOUDFRONT CDN SETUP FOR TRACK PRE-CACHING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sets up CloudFront distribution with optimized caching
# for audio tracks (first 10s pre-cached for instant startup)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

REGION="eu-west-1"
BUCKET_NAME="amplify-gforgeiot-gerard-storage-b8a3d9e89f05-staging"
STACK_NAME="gforge-cloudfront-cdn"

echo "☁️ CLOUDFRONT CDN SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will create:"
echo "  ✅ CloudFront distribution"
echo "  ✅ Cache policy for audio (10s pre-cache)"
echo "  ✅ Origin Access Identity (OAI)"
echo "  ✅ S3 bucket policy"
echo ""
read -p "Continue? (yes/no) " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Cancelled"
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Create Origin Access Identity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OAI_RESULT=$(aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config \
    CallerReference="gforge-tracks-$(date +%s)",Comment="Access for SplashFM tracks CDN" \
  --region us-east-1 \
  --output json)

OAI_ID=$(echo "$OAI_RESULT" | jq -r '.CloudFrontOriginAccessIdentity.Id')
OAI_CANONICAL=$(echo "$OAI_RESULT" | jq -r '.CloudFrontOriginAccessIdentity.S3CanonicalUserId')

echo "✅ OAI Created: $OAI_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Create Cache Policy"  
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CACHE_POLICY=$(aws cloudfront create-cache-policy \
  --cache-policy-config '{
    "Name": "SplashFM-Audio-10s-PreCache",
    "Comment": "Cache first 10s of audio tracks for instant startup",
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "MinTTL": 86400,
    "ParametersInCacheKeyAndForwardedToOrigin": {
      "EnableAcceptEncodingGzip": false,
      "EnableAcceptEncodingBrotli": false,
      "HeadersConfig": {
        "HeaderBehavior": "whitelist",
        "Headers": {
          "Quantity": 1,
          "Items": ["Range"]
        }
      },
      "CookiesConfig": {
        "CookieBehavior": "none"
      },
      "QueryStringsConfig": {
        "QueryStringBehavior": "none"
      }
    }
  }' \
  --region us-east-1 \
  --output json)

CACHE_POLICY_ID=$(echo "$CACHE_POLICY" | jq -r '.CachePolicy.Id')

echo "✅ Cache Policy Created: $CACHE_POLICY_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Create CloudFront Distribution"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DIST_CONFIG=$(cat <<EOF
{
  "CallerReference": "gforge-tracks-$(date +%s)",
  "Comment": "SplashFM Tracks CDN - Pre-cache first 10s",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-gforge-tracks",
        "DomainName": "${BUCKET_NAME}.s3.${REGION}.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/${OAI_ID}"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-gforge-tracks",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 3,
      "Items": ["GET", "HEAD", "OPTIONS"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "CachePolicyId": "${CACHE_POLICY_ID}",
    "Compress": false,
    "SmoothStreaming": false
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "public/audio/*",
        "TargetOriginId": "S3-gforge-tracks",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 3,
          "Items": ["GET", "HEAD", "OPTIONS"],
          "CachedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
          }
        },
        "CachePolicyId": "${CACHE_POLICY_ID}",
        "Compress": false,
        "SmoothStreaming": false
      }
    ]
  },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}
EOF
)

DIST_RESULT=$(aws cloudfront create-distribution \
  --distribution-config "$DIST_CONFIG" \
  --region us-east-1 \
  --output json)

DIST_ID=$(echo "$DIST_RESULT" | jq -r '.Distribution.Id')
DIST_DOMAIN=$(echo "$DIST_RESULT" | jq -r '.Distribution.DomainName')

echo "✅ CloudFront Distribution Created!"
echo "   ID: $DIST_ID"
echo "   Domain: $DIST_DOMAIN"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Update S3 Bucket Policy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontReadForGetBucketObjects",
      "Effect": "Allow",
      "Principal": {
        "CanonicalUser": "${OAI_CANONICAL}"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/public/*"
    }
  ]
}
EOF
)

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy "$BUCKET_POLICY" \
  --region "$REGION"

echo "✅ S3 Bucket Policy Updated"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SETUP COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo "   OAI ID:         $OAI_ID"
echo "   Cache Policy:   $CACHE_POLICY_ID"
echo "   Distribution:   $DIST_ID"
echo "   CDN Domain:     $DIST_DOMAIN"
echo ""
echo "⏳ CloudFront is deploying... (takes 15-20 minutes)"
echo ""
echo "🧪 Test when ready:"
echo "   curl -I https://$DIST_DOMAIN/public/audio/test.mp3"
echo ""
echo "📝 Update your app:"
echo "   CDN_BASE_URL=https://$DIST_DOMAIN"
echo ""
echo "🔗 CloudFront Console:"
echo "   https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DIST_ID"
echo ""

# Save config for later use
cat > /tmp/cloudfront-config.json <<EOF
{
  "distributionId": "$DIST_ID",
  "domainName": "$DIST_DOMAIN",
  "oaiId": "$OAI_ID",
  "cachePolicyId": "$CACHE_POLICY_ID",
  "bucketName": "$BUCKET_NAME",
  "region": "$REGION",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "💾 Config saved: /tmp/cloudfront-config.json"
echo ""
