# SplashFM Web Player

**Live Player:** https://splashfm.nl/

Modern, professional radio player voor SplashFM stream.

---

## Features

### 🎨 Design
- Modern gradient design (purple theme)
- Smooth animations en transitions
- Responsive (desktop + mobile)
- Backdrop blur effects
- Professional branding

### 🎵 Player Functionaliteit
- **Play/Pause** - Large circular button met animatie
- **Volume Control** - Range slider (0-100%)
- **Now Playing** - Real-time track info van Icecast
- **Live Status** - Loading/Live/Error/Paused indicators
- **Listener Stats** - Current listeners weergave

### 📊 Real-time Updates
- Fetch stream info elke 10 seconden
- Update "Now Playing" automatisch
- Update listener count
- Icecast API integratie

### 🔧 Technical
- Pure HTML/CSS/JavaScript (no frameworks)
- HTML5 Audio API
- Fetch API voor stream info
- Responsive design (CSS Grid)
- Cross-browser compatible

---

## Deployment

### EC2 (Production)
```bash
# File location
/var/www/splashfm/index.html

# Nginx config
/etc/nginx/sites-available/splashfm

# Deploy command
scp web/splashfm-player.html radio-ec2:/tmp/
ssh radio-ec2 'sudo mv /tmp/splashfm-player.html /var/www/splashfm/index.html'
```

### CloudFront Cache Invalidation
```bash
aws cloudfront create-invalidation \
  --distribution-id E2VXYMID4ZAMSJ \
  --paths "/*"
```

---

## Architecture

```
Browser
   ↓
https://splashfm.nl/
   ↓
CloudFront CDN
   ↓
Nginx (:80)
   ├─ / → SplashFM Player (HTML)
   ├─ /stream.mp3 → Icecast :8000
   └─ /status-json.xsl → Icecast :8000
```

---

## Player Components

### 1. Logo & Branding
```html
<div class="logo">SPLASH FM</div>
<div class="tagline">🎵 Professional Beat-Matched Radio</div>
```

### 2. Now Playing Display
```javascript
// Updates every 10 seconds from Icecast
fetch('/status-json.xsl')
  .then(data => updateNowPlaying(data.icestats.source.title))
```

### 3. Play/Pause Button
- 100px circular button
- Gradient background
- Pulse animation when playing
- Play ▶️ / Pause ⏸️ icons

### 4. Volume Control
```javascript
audioPlayer.volume = slider.value / 100
```

### 5. Stats Grid
- Bitrate: 192 kbps
- Listeners: Real-time count
- Status: 24/7 Live

---

## Customization

### Colors
```css
/* Primary gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to custom colors */
background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
```

### Stream URL
```javascript
// Update in HTML
<source src="https://stream.splashfm.nl/stream.mp3" type="audio/mpeg">
```

### Branding
```html
<!-- Logo text -->
<div class="logo">YOUR STATION</div>

<!-- Tagline -->
<div class="tagline">🎵 Your Custom Tagline</div>
```

---

## Browser Support

✅ **Chrome/Edge** - Full support  
✅ **Firefox** - Full support  
✅ **Safari** - Full support  
✅ **Mobile browsers** - Responsive design  

---

## API Endpoints

### Stream Status
```
GET /status-json.xsl

Response:
{
  "icestats": {
    "source": {
      "title": "Artist - Track Name",
      "server_name": "Splash FM",
      "listeners": 5,
      "bitrate": 192
    }
  }
}
```

### Direct Stream
```
GET /stream.mp3

Content-Type: audio/mpeg
Bitrate: 192 kbps
```

---

## Development

### Local Testing
```bash
# Open HTML file directly
open web/splashfm-player.html

# Or use local server
python3 -m http.server 8080
open http://localhost:8080/web/splashfm-player.html
```

### Modify & Deploy
```bash
# 1. Edit HTML
vim web/splashfm-player.html

# 2. Test locally
open web/splashfm-player.html

# 3. Deploy to EC2
scp web/splashfm-player.html radio-ec2:/tmp/
ssh radio-ec2 'sudo mv /tmp/splashfm-player.html /var/www/splashfm/index.html'

# 4. Flush CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E2VXYMID4ZAMSJ \
  --paths "/*"
```

---

## Troubleshooting

### Player doesn't load
- Check CloudFront cache (invalidate if needed)
- Check Nginx is running: `ssh radio-ec2 'sudo systemctl status nginx'`
- Check file exists: `ssh radio-ec2 'ls -la /var/www/splashfm/'`

### Stream doesn't play
- Check Icecast is running: `ssh radio-ec2 'sudo systemctl status icecast2'`
- Test direct stream: `curl -I http://46.137.184.91:8000/stream.mp3`
- Check browser console for errors

### Now Playing not updating
- Check Icecast status endpoint: `curl http://46.137.184.91/status-json.xsl`
- Check CORS headers in Nginx config
- Check browser console for fetch errors

---

## Files

```
web/
├── splashfm-player.html  # Main player page (444 lines)
└── README.md            # This file

nginx/
└── splashfm.conf        # Nginx configuration

Production:
/var/www/splashfm/index.html  # EC2 deployed version
/etc/nginx/sites-available/splashfm  # Nginx config
```

---

## URLs

**Production:**
- Homepage: https://splashfm.nl/
- WWW: https://www.splashfm.nl/
- Stream: https://stream.splashfm.nl/stream.mp3
- Stats: https://splashfm.nl/status-json.xsl

**Direct (EC2):**
- Homepage: http://46.137.184.91/
- Stream: http://46.137.184.91:8000/stream.mp3

---

**Created:** 13 November 2025  
**Status:** ✅ Production Live  
**Tech:** HTML5, CSS3, Vanilla JavaScript  
**CDN:** CloudFront (E2VXYMID4ZAMSJ)
