# CloudFront CDN Setup voor G-Forge Radio Stream

**Setup Datum:** 13 November 2025  
**Status:** ✅ Deployed

---

## 📋 Overview

CloudFront CDN distributie voor Icecast radio stream om global streaming performance te verbeteren, HTTPS support toe te voegen, en EC2 bandwidth te offloaden.

---

## 🌐 CloudFront Details

### Distribution Info
```
ID:     E2VXYMID4ZAMSJ
Domain: dw08x030u2vgz.cloudfront.net
ARN:    arn:aws:cloudfront::035636364722:distribution/E2VXYMID4ZAMSJ
Status: Deployed
```

### Origin Configuration
```
Type:       Custom HTTP Origin
Domain:     ec2-46-137-184-91.eu-west-1.compute.amazonaws.com
Port:       8000 (Icecast)
Protocol:   HTTP only
Timeout:    30 seconds
Keepalive:  5 seconds
```

### Cache Behavior
```
Methods:        GET, HEAD
Compression:    Disabled (audio stream)
Cache Policy:   Managed-CachingOptimized
HTTP Version:   HTTP/2
Price Class:    PriceClass_100 (US, Canada, Europe)
```

---

## 🎵 Stream URLs

### Direct (EC2)
```
http://46.137.184.91:8000/stream.mp3
```

### Via CloudFront (HTTP)
```
http://dw08x030u2vgz.cloudfront.net/stream.mp3
```

### Via CloudFront (HTTPS)
```
https://dw08x030u2vgz.cloudfront.net/stream.mp3
```

### Status Page
```
http://dw08x030u2vgz.cloudfront.net/status-json.xsl
```

---

## ✅ Voordelen

### 🌍 Global Performance
- **450+ Edge Locations** wereldwijd
- Automatische **geo-routing** naar nearest edge
- **Lagere latency** voor listeners wereldwijd
- **Betere streaming kwaliteit**

### 🔒 Security
- **Gratis SSL/TLS certificaat** (AWS Certificate Manager)
- **HTTPS streaming** enabled
- **DDoS Protection** via AWS Shield Standard
- **Better reliability** en uptime

### 💰 Cost Efficiency
- **Bandwidth offload** van EC2 server
- **Lagere EC2 bandwidth kosten**
- Pay-as-you-go pricing
- No monthly minimum

### 📊 Analytics
- **CloudWatch metrics** integratie
- Access logs beschikbaar
- Viewer insights
- Request analytics

---

## 🧪 Testing

### Check CloudFront Status
```bash
aws cloudfront get-distribution \
  --id E2VXYMID4ZAMSJ \
  | jq -r '.Distribution.Status'
```

### Test HTTP Stream
```bash
curl -I http://dw08x030u2vgz.cloudfront.net/stream.mp3
```

### Test HTTPS Stream
```bash
curl -I https://dw08x030u2vgz.cloudfront.net/stream.mp3
```

### Check CloudFront Headers
```bash
curl -I http://dw08x030u2vgz.cloudfront.net/stream.mp3 | grep -i cloudfront
```

Expected Headers:
```
x-cache: Hit from cloudfront
x-amz-cf-pop: AMS50-C1
x-amz-cf-id: ...
via: 1.1 ... (CloudFront)
```

---

## 🎨 Frontend Integration

### Update Stream URL

**Before:**
```typescript
const STREAM_URL = 'http://46.137.184.91:8000/stream.mp3'
```

**After (met CloudFront):**
```typescript
// Primary: CloudFront HTTPS
const STREAM_URL = 'https://dw08x030u2vgz.cloudfront.net/stream.mp3'

// Fallback: Direct EC2 (als CloudFront down)
const FALLBACK_URL = 'http://46.137.184.91:8000/stream.mp3'
```

### Example Player Code
```typescript
const player = new Audio(STREAM_URL)

player.addEventListener('error', () => {
  console.warn('CloudFront failed, switching to direct EC2')
  player.src = FALLBACK_URL
  player.play()
})
```

---

## 📊 Cost Estimate

### CloudFront Pricing (PriceClass_100)

**Data Transfer:**
- First 10 TB/month: **$0.085 per GB**
- 10-50 TB/month: $0.080 per GB
- 50-150 TB/month: $0.060 per GB

**HTTP/HTTPS Requests:**
- $0.0075 per 10,000 requests

**Shield Standard:**
- Free (DDoS protection)

### Example Scenario
**100 concurrent listeners × 24/7:**
- Bandwidth: ~3.5 TB/month
- Cost: ~$300/month CloudFront
- EC2 bandwidth saved: ~$350/month
- **Net savings:** $50/month + better performance

---

## 🔧 Management

### Get Distribution Info
```bash
aws cloudfront get-distribution --id E2VXYMID4ZAMSJ
```

### List All Distributions
```bash
aws cloudfront list-distributions
```

### Invalidate Cache (force refresh)
```bash
aws cloudfront create-invalidation \
  --distribution-id E2VXYMID4ZAMSJ \
  --paths "/stream.mp3" "/status-json.xsl"
```

### Disable Distribution
```bash
# First get current config
aws cloudfront get-distribution-config \
  --id E2VXYMID4ZAMSJ > /tmp/config.json

# Edit: Set "Enabled": false
# Then update
aws cloudfront update-distribution \
  --id E2VXYMID4ZAMSJ \
  --if-match $(jq -r '.ETag' /tmp/config.json) \
  --distribution-config file:///tmp/config-disabled.json
```

### Delete Distribution
```bash
# Must be disabled first and deployed
aws cloudfront delete-distribution \
  --id E2VXYMID4ZAMSJ \
  --if-match <ETag>
```

---

## 📈 Monitoring

### CloudWatch Metrics
```bash
# Requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=E2VXYMID4ZAMSJ \
  --start-time 2025-11-13T00:00:00Z \
  --end-time 2025-11-13T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Available Metrics
- `Requests` - Total requests
- `BytesDownloaded` - Data transfer
- `BytesUploaded` - Upload data
- `4xxErrorRate` - Client errors
- `5xxErrorRate` - Server errors

---

## 🔒 Optional: Custom Domain

### Step 1: Request ACM Certificate
```bash
aws acm request-certificate \
  --domain-name stream.g-forge.com \
  --validation-method DNS \
  --region us-east-1
```

### Step 2: Add CNAME Record
```
Type:  CNAME
Name:  stream.g-forge.com
Value: dw08x030u2vgz.cloudfront.net
TTL:   300
```

### Step 3: Update CloudFront Alias
```bash
# Update distribution config with:
# "Aliases": {
#   "Quantity": 1,
#   "Items": ["stream.g-forge.com"]
# },
# "ViewerCertificate": {
#   "ACMCertificateArn": "arn:aws:acm:...",
#   "SSLSupportMethod": "sni-only"
# }
```

---

## 🚨 Troubleshooting

### Issue: 502 Bad Gateway
**Cause:** Origin (EC2) not responding  
**Fix:** Check Icecast is running on EC2:8000

```bash
ssh radio-ec2
sudo systemctl status icecast2
curl -I http://localhost:8000/stream.mp3
```

### Issue: 403 Forbidden
**Cause:** Origin access denied  
**Fix:** Check Icecast config allows requests from CloudFront IPs

### Issue: High Latency
**Cause:** Cache not hitting  
**Fix:** Check cache policy, may need custom policy for streaming

### Issue: Stream Stops/Buffers
**Cause:** Origin timeout too short  
**Fix:** Increase OriginReadTimeout from 30s to 60s

---

## 📝 Change Log

### 2025-11-13: Initial Setup
- ✅ CloudFront distributie aangemaakt
- ✅ HTTP origin naar EC2 Icecast:8000
- ✅ HTTPS enabled automatisch
- ✅ PriceClass_100 (US/CA/EU)
- ✅ Deployed and tested

### Future Improvements
- [ ] Custom domain (stream.g-forge.com)
- [ ] Access logging enabled
- [ ] Custom cache policy voor streaming
- [ ] CloudWatch alarms
- [ ] Geo-restrictions indien nodig

---

## 🎯 Summary

✅ **CloudFront CDN active**  
✅ **HTTPS streaming enabled**  
✅ **Global edge locations**  
✅ **DDoS protection**  
✅ **Bandwidth offload**  
✅ **Better performance**

**Primary Stream URL:**  
`https://dw08x030u2vgz.cloudfront.net/stream.mp3`

**Distribution ID:**  
`E2VXYMID4ZAMSJ`

---

**Setup by:** Gerard  
**Date:** 13 November 2025  
**Status:** ✅ Production Ready
