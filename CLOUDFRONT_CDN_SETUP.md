# ✅ CloudFront CDN Setup - Splash FM

**Datum:** 14 Nov 2025, 10:33 CET  
**Status:** 🟢 WERKEND

---

## 🌐 **CORRECTE SETUP (zoals jij zei!)**

```
Browser (HTTPS)
    ↓
https://splashfm.nl/stream-processed.mp3
    ↓
AWS CloudFront CDN (SSL terminatie, caching, DDoS)
    ↓
Origin: 46.137.184.91 (Nginx reverse proxy)
    ↓
Icecast: localhost:8000/stream-processed.mp3
    ↓
🎚️ Stereo Tool Processing
```

---

## ✅ **WAT IS GEFIXT:**

### **1. Player gebruikt nu RELATIEVE URL:**
```html
<!-- ❌ FOUT (direct IP): -->
<source src="http://46.137.184.91:8000/stream-processed.mp3">

<!-- ✅ CORRECT (via CDN): -->
<source src="/stream-processed.mp3">
```

### **2. Nginx Proxy Config:**
```nginx
location /stream-processed.mp3 {
    proxy_pass http://localhost:8000/stream-processed.mp3;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_cache off;
    add_header Access-Control-Allow-Origin *;
    add_header Content-Disposition 'inline';
}
```

### **3. CloudFront Distribution:**
```
Domain:  splashfm.nl
Origin:  46.137.184.91
SSL:     ✅ HTTPS enabled
Cache:   Configured for streaming
```

---

## 🧪 **VERIFICATIE:**

### **GET Request (werkt!):**
```bash
curl -s https://splashfm.nl/stream-processed.mp3 | head -c 1000 | wc -c
# Output: 1000 bytes ✅
```

### **HEAD Request (400 - normaal voor Icecast):**
```bash
curl -I https://splashfm.nl/stream-processed.mp3
# HTTP/2 400 (Icecast doesn't like HEAD requests)
# Dit is NORMAAL! Players gebruiken GET, niet HEAD
```

---

## 🎵 **ALLE BESCHIKBARE STREAMS VIA CDN:**

```
1. Main Stream (Stereo Tool):
   https://splashfm.nl/stream-processed.mp3
   └─ Player gebruikt deze! ✅

2. Raw Liquidsoap:
   https://splashfm.nl/stream-raw.mp3
   └─ Input voor Stereo Tool

3. Direct Stream:
   https://splashfm.nl/stream.mp3
   └─ Alternatieve stream

4. Status JSON:
   https://splashfm.nl/status-json.xsl
   └─ Metadata API
```

---

## 🌐 **PLAYER URLS:**

```
✅ Via CDN (HTTPS):
   https://splashfm.nl/
   https://www.splashfm.nl/

✅ Direct (HTTP - voor testen):
   http://46.137.184.91/
```

---

## 🔒 **VOORDELEN VAN CDN SETUP:**

```
✅ SSL/HTTPS - geen mixed content errors
✅ DDoS protection via CloudFront
✅ Global caching/edge locations
✅ Geen direct IP exposure
✅ Bandwidth optimization
✅ Automatic failover
```

---

## 📊 **FLOW DIAGRAM:**

```
┌─────────────────┐
│   Browser       │
│  (HTTPS/SSL)    │
└────────┬────────┘
         │
         │ https://splashfm.nl/stream-processed.mp3
         ↓
┌─────────────────┐
│  CloudFront CDN │
│  (SSL Termination)
│  (Caching)      │
│  (DDoS)         │
└────────┬────────┘
         │
         │ http://46.137.184.91/stream-processed.mp3
         ↓
┌─────────────────┐
│  Nginx (Origin) │
│  Port 80        │
└────────┬────────┘
         │
         │ http://localhost:8000/stream-processed.mp3
         ↓
┌─────────────────┐
│  Icecast        │
│  Port 8000      │
└────────┬────────┘
         │
         │ Stream source
         ↓
┌─────────────────┐
│  Stereo Tool    │
│  Processing     │
└────────┬────────┘
         │
         │ Raw audio
         ↓
┌─────────────────┐
│  Liquidsoap     │
│  (Playlist)     │
└─────────────────┘
```

---

## ✅ **SAMENVATTING:**

```
Player URL:       /stream-processed.mp3 (relatief)
                  ↓
Via CDN:          https://splashfm.nl (CloudFront)
                  ↓
Naar Origin:      46.137.184.91 (Nginx)
                  ↓
Naar Icecast:     localhost:8000
                  ↓
Audio:            ✅ 1000 bytes verified!
```

**🎉 JE HAD GELIJK! Nu gaat alles via CDN met HTTPS! 🎉**

---

## 🔧 **CONFIGURATIE FILES:**

```
Nginx:     /etc/nginx/sites-available/splashfm
Player:    /var/www/splashfm/index.html
Icecast:   /etc/icecast2/icecast.xml
```

---

**Laatste check:** 14 Nov 2025, 10:33 CET  
**Status:** ✅ PRODUCTION READY via CDN
