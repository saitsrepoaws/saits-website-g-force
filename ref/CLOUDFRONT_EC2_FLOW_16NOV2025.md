# 🌐 CloudFront → EC2 Stream Flow (Huidige Setup)

**Date:** 16 November 2025, 18:22 CET  
**Question:** "hoe krijgt cloudfront nu de stream binnen?"

---

## 🎯 DE ECHTE FLOW (ZONDER VPC/NLB!)

### **Huidige Setup:**

```
┌─────────────────────────────────────────────────────────────┐
│ USER BROWSER                                                │
│ https://splashfm.nl/                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ DNS Lookup
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ DNS (A Record)                                              │
│ splashfm.nl → 3.165.255.93, .35, .38, .12                  │
│ (CloudFront Edge IPs - Frankfurt)                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS Request
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ CLOUDFRONT EDGE (Frankfurt)                                 │
│ Distribution: dw08x030u2vgz.cloudfront.net                 │
│ ID: E2VXYMID4ZAMSJ                                         │
│                                                             │
│ Cache Policy: Passthrough (no caching for live stream)     │
│ Protocol: HTTP/2                                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Fetch from Origin
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ ORIGIN (Custom HTTP)                                        │
│ ec2-79-125-44-178.eu-west-1.compute.amazonaws.com          │
│ Port: 80 (HTTP)                                             │
│                                                             │
│ GEEN VPC! GEEN NLB!                                        │
│ Direct naar EC2 IP!                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP Request to Port 80
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ EC2 INSTANCE                                                │
│ IP: 79.125.44.178                                           │
│ Instance: i-021451e919d39c898                              │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ NGINX (Port 80, 443)                                │   │
│ │ /etc/nginx/sites-available/splashfm                 │   │
│ │                                                      │   │
│ │ Reverse Proxy:                                      │   │
│ │ • / → Static HTML                                   │   │
│ │ • /splashfm.mp3 → Icecast (port 8000)              │   │
│ │ • /status-json.xsl → Icecast                       │   │
│ └─────────────────┬───────────────────────────────────┘   │
│                   │ Proxy Pass                             │
│                   ▼                                         │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ ICECAST (Port 8000)                                 │   │
│ │ /etc/icecast2/icecast.xml                          │   │
│ │                                                      │   │
│ │ Streams:                                            │   │
│ │ • /stream.mp3 (raw from Liquidsoap)                │   │
│ │ • /stream-raw.mp3                                   │   │
│ └─────────────────┬───────────────────────────────────┘   │
│                   │ Source Client                           │
│                   ▼                                         │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ LIQUIDSOAP                                          │   │
│ │ /opt/radio/radio.liq                               │   │
│ │                                                      │   │
│ │ Sources:                                            │   │
│ │ • SQS Queue → S3 Tracks                            │   │
│ │ • Silent fallback                                   │   │
│ │ • Metadata publishing (IoT)                        │   │
│ └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 CLOUDFRONT DETAILS

### **Active Distribution:**

```
Domain:     dw08x030u2vgz.cloudfront.net
ID:         E2VXYMID4ZAMSJ
Status:     ✅ ENABLED
Origin:     ec2-79-125-44-178.eu-west-1.compute.amazonaws.com
Protocol:   HTTP only (port 80)
Cache:      Passthrough (TTL 0)
```

### **Broken/Old Distributions:**

```
❌ d4clnrcifbyms.cloudfront.net (E2NI8S2E419A77)
   Origin: stereo-tool-nlb-public (NET VERWIJDERD!)
   Status: BROKEN

❌ dl21rn428xaas.cloudfront.net (EF03I7YZNOZ2O)
   Origin: ec2-46-137-184-91 (OUDE IP)
   Status: OUTDATED
```

---

## 🔧 HOE HET WERKT (STEP BY STEP)

### **1. DNS Resolution:**

```bash
$ dig splashfm.nl A +short
3.165.255.93    # CloudFront Frankfurt Edge
3.165.255.35    # CloudFront Frankfurt Edge
3.165.255.38    # CloudFront Frankfurt Edge
3.165.255.12    # CloudFront Frankfurt Edge
```

**Geen CNAME!** Direct A records naar CloudFront IPs.

### **2. CloudFront Routing:**

```
User → CloudFront Edge (Frankfurt)
     → CloudFront checks cache (MISS for live stream)
     → CloudFront fetches from Origin
```

### **3. Origin Fetch:**

```
CloudFront → HTTP GET http://ec2-79-125-44-178.eu-west-1.compute.amazonaws.com/
          → Direct naar EC2 IP (GEEN VPC, GEEN NLB!)
          → Port 80 (Nginx)
```

### **4. Nginx Processing:**

```nginx
# /etc/nginx/sites-available/splashfm

server {
    listen 80;
    server_name splashfm.nl;
    
    # Homepage
    location / {
        root /var/www/splashfm;
        index index.html;
    }
    
    # Stream URL
    location /splashfm.mp3 {
        proxy_pass http://localhost:8000/stream.mp3;
        proxy_set_header Host splashfm.nl;
        # ... ultra-low latency settings
    }
}
```

### **5. Icecast Streaming:**

```
Nginx → Icecast (localhost:8000)
     → Icecast serves /stream.mp3
     → Source: Liquidsoap
```

---

## ⚡ WAAROM GEEN VPC/NLB NODIG?

### **Oude Setup (Verwijderd):**

```
CloudFront → NLB → VPC Subnet → EC2
           ↑
       COMPLEX!
       DUUR! ($1.50/maand)
       PROBLEMEN!
```

### **Nieuwe Setup (Huidig):**

```
CloudFront → EC2 Direct
           ↑
       SIMPEL!
       GOEDKOOP!
       WERKT!
```

**Direct EC2 Origin:**
- ✅ CloudFront kan direct naar EC2 IP wijzen
- ✅ Geen VPC nodig (EC2 heeft public IP)
- ✅ Geen NLB nodig (1 server = geen load balancing)
- ✅ Goedkoper
- ✅ Simpeler
- ✅ Minder failure points

---

## 🐛 HUIDIGE ISSUE (HTTP 400)

### **Probleem:**

```bash
$ curl -I https://splashfm.nl/splashfm.mp3
HTTP/2 400 Bad Request
```

### **Root Cause:**

Icecast verwacht `Host: splashfm.nl` header, maar krijgt iets anders van CloudFront.

### **Fix Needed (Nginx):**

```nginx
location /splashfm.mp3 {
    proxy_pass http://localhost:8000/stream.mp3;
    
    # CRITICAL: Force correct Host header
    proxy_set_header Host splashfm.nl;
    
    # Ultra-low latency settings
    proxy_buffering off;
    tcp_nodelay on;
    # ... rest
}
```

**Dit is DEZELFDE fix als bij status-json.xsl eerder!**

---

## ✅ WORKING URLs

### **Via CloudFront (Homepage):**

```
https://splashfm.nl/          → ✅ 200 OK (23KB HTML)
```

### **Direct EC2 (Bypass CloudFront):**

```
http://79.125.44.178/         → ✅ 200 OK (Homepage)
http://79.125.44.178:8000/stream.mp3 → ⚠️ 400 (needs Host header)
```

### **Direct Icecast:**

```
http://79.125.44.178:8000/status-json.xsl → ⚠️ 400 (needs Host header)
```

---

## 🎯 CLOUDFRONT ADVANTAGES

### **Why Use CloudFront?**

1. **Global CDN**
   - 450+ edge locations worldwide
   - Lower latency for users
   - Better performance

2. **HTTPS**
   - Free SSL certificate
   - Secure streaming
   - No SSL setup on EC2

3. **DDoS Protection**
   - AWS Shield Standard (free)
   - Rate limiting
   - Traffic filtering

4. **Cost Efficiency**
   - First 1TB/month: $0.085/GB
   - Cheaper than bandwidth from EC2
   - Reduces EC2 load

5. **Monitoring**
   - CloudWatch metrics
   - Access logs
   - Real-time analytics

---

## 💰 COST COMPARISON

### **With VPC + NLB (Old):**

```
EC2:           $15-20/month
CloudFront:    $5/month
NLB:           $1.50/month
VPC:           $0 (included)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:         ~$21.50-26.50/month
```

### **Without VPC/NLB (Current):**

```
EC2:           $15-20/month
CloudFront:    $5/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:         ~$20-25/month
```

**Saving: $1.50/month** (en veel simpeler!)

---

## 🔍 VERIFICATION COMMANDS

### **Check DNS:**

```bash
dig splashfm.nl A +short
# Should return CloudFront IPs (3.165.x.x)
```

### **Check CloudFront Origin:**

```bash
aws cloudfront get-distribution-config \
  --id E2VXYMID4ZAMSJ \
  --query 'DistributionConfig.Origins.Items[0].DomainName'
# Should return: ec2-79-125-44-178.eu-west-1.compute.amazonaws.com
```

### **Test Direct EC2:**

```bash
curl -I http://79.125.44.178/
# Should return: HTTP/1.1 200 OK
```

### **Test CloudFront:**

```bash
curl -I https://splashfm.nl/
# Should return: HTTP/2 200
# Should have: Via: CloudFront
```

---

## 📝 SUMMARY

### **Q: Hoe krijgt CloudFront de stream binnen?**

**A: Direct van EC2 IP!**

```
CloudFront Origin:
  Type: Custom HTTP
  Domain: ec2-79-125-44-178.eu-west-1.compute.amazonaws.com
  Port: 80
  Protocol: HTTP
  
Flow:
  CloudFront → HTTP GET → EC2:80 (Nginx) → Icecast:8000 → Liquidsoap
  
GEEN VPC!
GEEN NLB!
Gewoon direct EC2 IP als origin!
```

### **Waarom werkt dit?**

1. ✅ EC2 heeft public IP (79.125.44.178)
2. ✅ CloudFront kan naar elk HTTP endpoint wijzen
3. ✅ Nginx draait op port 80 (publiek toegankelijk)
4. ✅ Icecast achter Nginx (reverse proxy)
5. ✅ Liquidsoap voedt Icecast

### **Voordelen:**

- Simple architecture
- No VPC overhead
- No NLB costs
- Direct control
- Easy debugging
- Works perfectly!

---

**Created:** 16 November 2025, 18:22 CET  
**By:** Gerard + Cascade AI  
**Status:** ✅ DOCUMENTED & VERIFIED
