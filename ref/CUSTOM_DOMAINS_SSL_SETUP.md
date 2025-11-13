# Custom Domains + SSL Setup voor SplashFM

**Setup Datum:** 13 November 2025  
**Status:** ✅ Configured & Deploying

---

## 📋 Overview

Complete custom domain setup met wildcard SSL certificaat voor SplashFM radio platform via CloudFront CDN.

---

## 🔒 SSL Certificaat (ACM)

### Certificate Details
```
ARN: arn:aws:acm:us-east-1:035636364722:certificate/1b3d915b-ad9f-498e-8b0a-6fe4b16a45da
Type: Wildcard SSL/TLS Certificate
Region: us-east-1 (required for CloudFront)
Status: ISSUED ✅
Validation: DNS (automatic via Route53)
Renewal: Automatic (ACM managed)
```

### Coverage
```
Primary Domain:
  • splashfm.nl

Wildcard:
  • *.splashfm.nl
  
Covers:
  • www.splashfm.nl
  • stream.splashfm.nl
  • api.splashfm.nl (future)
  • live.splashfm.nl (future)
  • admin.splashfm.nl (future)
  • Any other subdomain
```

### SSL/TLS Settings
```
Method: SNI (Server Name Indication)
Min Protocol: TLSv1.2_2021
Cipher Suite: Secure (CloudFront managed)
```

---

## 🌐 CloudFront Distribution

### Distribution Info
```
ID: E2VXYMID4ZAMSJ
CloudFront Domain: dw08x030u2vgz.cloudfront.net
Status: Deployed
```

### Custom Domains (Aliases)
```
1. splashfm.nl (apex/root domain)
   Purpose: Website/Player
   
2. www.splashfm.nl
   Purpose: Website/Player (www subdomain)
   
3. stream.splashfm.nl
   Purpose: Radio stream endpoint
```

### Origin Configuration
```
Origin: ec2-46-137-184-91.eu-west-1.compute.amazonaws.com
Port: 8000 (Icecast)
Protocol: HTTP
Timeout: 30s
```

---

## 🗺️ DNS Configuration (Route53)

### Hosted Zone
```
Zone: splashfm.nl
Zone ID: Z047697515CJEX2WUTUFW
Nameservers: AWS Route53
```

### DNS Records

#### 1. stream.splashfm.nl (CNAME)
```
Type: CNAME
Name: stream.splashfm.nl
Value: dw08x030u2vgz.cloudfront.net
TTL: 300 (5 minutes)
Purpose: Radio stream endpoint
```

#### 2. www.splashfm.nl (CNAME)
```
Type: CNAME
Name: www.splashfm.nl
Value: dw08x030u2vgz.cloudfront.net
TTL: 300 (5 minutes)
Purpose: Website/Player (www)
```

#### 3. splashfm.nl (A Alias)
```
Type: A (Alias)
Name: splashfm.nl
Value: dw08x030u2vgz.cloudfront.net
Alias Target Zone: Z2FDTNDATAQYW2 (CloudFront)
EvaluateTargetHealth: false
Purpose: Website/Player (root domain)
```

---

## 🎵 Final Stream URLs

### Radio Stream (RECOMMENDED)
```
HTTPS: https://stream.splashfm.nl/stream.mp3 ✅
HTTP:  http://stream.splashfm.nl/stream.mp3
```

### Website/Player
```
HTTPS: https://splashfm.nl ✅
HTTPS: https://www.splashfm.nl ✅
HTTP:  http://splashfm.nl
HTTP:  http://www.splashfm.nl
```

### Direct/Fallback (EC2)
```
HTTP: http://46.137.184.91:8000/stream.mp3
```

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Listeners     │
│   Worldwide     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  DNS (Route53)                      │
│  • splashfm.nl                      │ → CloudFront
│  • www.splashfm.nl                  │ → CloudFront
│  • stream.splashfm.nl               │ → CloudFront
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  CloudFront CDN                     │
│  • SSL/TLS Termination              │
│  • 450+ Edge Locations              │
│  • DDoS Protection                  │
│  • Global Performance               │
│  • Custom Domains                   │
└────────┬────────────────────────────┘
         │ (Origin: EC2:8000)
         ▼
┌─────────────────────────────────────┐
│  EC2: 46.137.184.91:8000            │
│  • Icecast2 Server                  │
│  • Liquidsoap Playout               │
│  • Advanced Crossfade               │
└─────────────────────────────────────┘
```

---

## ✅ Benefits

### 🔒 Security
- **SSL/TLS Encryption** voor alle traffic
- **Wildcard Certificate** automatisch managed
- **DDoS Protection** via AWS Shield Standard
- **SNI Support** voor moderne browsers
- **Automatic Certificate Renewal** door ACM

### 🌍 Performance
- **450+ CloudFront Edge Locations** wereldwijd
- **Lower Latency** door geografische distributie
- **Better Streaming Quality** door CDN caching
- **Bandwidth Offload** van EC2 server

### 🎯 Professional Setup
- **Custom Domains** (splashfm.nl ipv IP)
- **HTTPS Everywhere** voor veilig streamen
- **Branded URLs** voor marketing
- **SEO Benefits** door HTTPS

### 💰 Cost Efficiency
- **Gratis SSL Certificate** via ACM
- **No Additional Costs** voor wildcard
- **Reduced EC2 Bandwidth** kosten
- **Pay-as-you-go** CloudFront pricing

---

## 🧪 Testing

### DNS Resolution
```bash
# Check DNS propagation
dig stream.splashfm.nl
dig www.splashfm.nl
dig splashfm.nl

# Expected: CloudFront IP addresses
# Example: 18.155.64.125, 18.155.64.79, etc.
```

### HTTPS Stream Test
```bash
# Test HTTPS stream (recommended)
curl -I https://stream.splashfm.nl/stream.mp3

# Expected headers:
# HTTP/2 200
# content-type: audio/mpeg
# x-cache: Hit from cloudfront
# x-amz-cf-pop: AMS50-C1
```

### SSL Certificate Verification
```bash
# Check SSL certificate
openssl s_client -connect stream.splashfm.nl:443 -servername stream.splashfm.nl < /dev/null

# Expected:
# Subject: CN=*.splashfm.nl
# Issuer: Amazon
# Validity: ~1 year (auto-renews)
```

### Browser Test
```bash
# Open in browser
open https://stream.splashfm.nl/stream.mp3

# Should:
# 1. Show valid SSL certificate (padlock)
# 2. Start playing audio stream
# 3. No security warnings
```

### HTTP Test
```bash
# Test HTTP (non-SSL)
curl -I http://stream.splashfm.nl/stream.mp3

# Should work but recommend HTTPS
```

---

## 📊 Monitoring

### CloudWatch Metrics
```bash
# View CloudFront requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=E2VXYMID4ZAMSJ \
  --start-time 2025-11-13T00:00:00Z \
  --end-time 2025-11-13T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### ACM Certificate Status
```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:035636364722:certificate/1b3d915b-ad9f-498e-8b0a-6fe4b16a45da \
  --region us-east-1 \
  | jq -r '.Certificate.Status'

# Expected: ISSUED
```

### DNS Records Check
```bash
# List all records in zone
aws route53 list-resource-record-sets \
  --hosted-zone-id Z047697515CJEX2WUTUFW \
  | jq '.ResourceRecordSets[] | select(.Name | contains("splashfm.nl"))'
```

---

## 🔧 Management

### Update CloudFront Distribution
```bash
# Get current config
aws cloudfront get-distribution-config \
  --id E2VXYMID4ZAMSJ > /tmp/cf-config.json

# Edit config (update aliases, origins, etc.)
# ...

# Apply update
aws cloudfront update-distribution \
  --id E2VXYMID4ZAMSJ \
  --if-match $(cat /tmp/cf-config.json | jq -r '.ETag') \
  --distribution-config file:///tmp/cf-config-updated.json
```

### Invalidate Cache
```bash
# Invalidate all paths
aws cloudfront create-invalidation \
  --distribution-id E2VXYMID4ZAMSJ \
  --paths "/*"

# Invalidate specific path
aws cloudfront create-invalidation \
  --distribution-id E2VXYMID4ZAMSJ \
  --paths "/stream.mp3"
```

### Add New Subdomain
```bash
# Example: api.splashfm.nl

# 1. Subdomain already covered by *.splashfm.nl certificate ✅

# 2. Add DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z047697515CJEX2WUTUFW \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.splashfm.nl",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "dw08x030u2vgz.cloudfront.net"}]
      }
    }]
  }'

# 3. Add alias to CloudFront (if needed)
# Follow CloudFront update process above
```

---

## 🚨 Troubleshooting

### Issue: DNS Not Resolving
**Symptom:** `dig stream.splashfm.nl` returns old IP or NXDOMAIN

**Solution:**
```bash
# 1. Check Route53 record exists
aws route53 list-resource-record-sets \
  --hosted-zone-id Z047697515CJEX2WUTUFW \
  | grep stream.splashfm.nl

# 2. Wait for DNS propagation (up to 48h, usually 5-30min)

# 3. Clear local DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# 4. Test with different DNS server
dig @8.8.8.8 stream.splashfm.nl
```

### Issue: SSL Certificate Error
**Symptom:** Browser shows "Not Secure" or certificate warning

**Solution:**
```bash
# 1. Check certificate status
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:035636364722:certificate/1b3d915b-ad9f-498e-8b0a-6fe4b16a45da \
  --region us-east-1

# 2. Verify CloudFront is using certificate
aws cloudfront get-distribution --id E2VXYMID4ZAMSJ \
  | jq '.Distribution.DistributionConfig.ViewerCertificate'

# 3. Wait for CloudFront deployment (5-15 min)
```

### Issue: 403 Forbidden
**Symptom:** Stream returns 403 error

**Solution:**
```bash
# 1. Check origin (EC2) is accessible
curl -I http://46.137.184.91:8000/stream.mp3

# 2. Verify Icecast is running
ssh radio-ec2 "sudo systemctl status icecast2"

# 3. Check CloudFront origin settings
aws cloudfront get-distribution --id E2VXYMID4ZAMSJ \
  | jq '.Distribution.DistributionConfig.Origins'
```

### Issue: Stream Not Playing
**Symptom:** URL loads but no audio

**Solution:**
```bash
# 1. Test direct EC2 URL first
curl http://46.137.184.91:8000/stream.mp3 | head -c 1000

# 2. Check CloudFront is passing through correctly
curl https://stream.splashfm.nl/stream.mp3 | head -c 1000

# 3. Verify content-type header
curl -I https://stream.splashfm.nl/stream.mp3 | grep content-type
# Expected: content-type: audio/mpeg
```

---

## 📝 Frontend Integration

### React/TypeScript Example
```typescript
// config/stream.ts
export const STREAM_CONFIG = {
  // Primary: HTTPS via CloudFront (recommended)
  primaryUrl: 'https://stream.splashfm.nl/stream.mp3',
  
  // Fallback: Direct EC2 (if CloudFront fails)
  fallbackUrl: 'http://46.137.184.91:8000/stream.mp3',
  
  // Status page
  statusUrl: 'https://stream.splashfm.nl/status-json.xsl'
}

// components/Player.tsx
import { STREAM_CONFIG } from '../config/stream'

const Player = () => {
  const [streamUrl, setStreamUrl] = useState(STREAM_CONFIG.primaryUrl)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const handleError = () => {
    console.warn('Primary stream failed, switching to fallback')
    setStreamUrl(STREAM_CONFIG.fallbackUrl)
  }
  
  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      onError={handleError}
      controls
    />
  )
}
```

### HTML5 Player Example
```html
<audio id="radio-player" controls>
  <source src="https://stream.splashfm.nl/stream.mp3" type="audio/mpeg">
  Your browser does not support the audio element.
</audio>

<script>
  const player = document.getElementById('radio-player');
  const fallbackUrl = 'http://46.137.184.91:8000/stream.mp3';
  
  player.addEventListener('error', () => {
    console.warn('Switching to fallback stream');
    player.src = fallbackUrl;
    player.load();
  });
</script>
```

---

## 📈 Future Enhancements

### Additional Subdomains (Already Covered!)
```
✅ api.splashfm.nl → API endpoints
✅ admin.splashfm.nl → Admin panel
✅ live.splashfm.nl → Live events stream
✅ mobile.splashfm.nl → Mobile app endpoint
✅ stats.splashfm.nl → Analytics dashboard
```

### Regional Streams
```
nl.stream.splashfm.nl → Netherlands stream
be.stream.splashfm.nl → Belgium stream
de.stream.splashfm.nl → Germany stream
```

### Quality Variants
```
hq.stream.splashfm.nl → High Quality (320kbps)
lq.stream.splashfm.nl → Low Quality (64kbps)
mobile.stream.splashfm.nl → Mobile Optimized (128kbps)
```

---

## 🎯 Summary

✅ **SSL Certificate:** Wildcard (splashfm.nl + *.splashfm.nl)  
✅ **CloudFront:** Custom domains configured  
✅ **DNS:** Route53 records created  
✅ **HTTPS:** Enabled for all domains  
✅ **Security:** DDoS protected, SSL encrypted  
✅ **Performance:** Global CDN, 450+ edge locations  

**Primary Stream URL:**  
`https://stream.splashfm.nl/stream.mp3`

**Website URLs:**  
`https://splashfm.nl`  
`https://www.splashfm.nl`

**Certificate ARN:**  
`arn:aws:acm:us-east-1:035636364722:certificate/1b3d915b-ad9f-498e-8b0a-6fe4b16a45da`

**Distribution ID:**  
`E2VXYMID4ZAMSJ`

---

**Setup by:** Gerard  
**Date:** 13 November 2025  
**Status:** ✅ Deployed & Production Ready
