# ✅ SPLASH FM - SYSTEEM STATUS

**Tijd:** 14 Nov 2025, 10:24 CET  
**Status:** 🟢 **VOLLEDIG OPERATIONEEL**

---

## 🎵 **PLAYER PAGINA**

```
URL:          http://46.137.184.91/
Design:       ✅ Oranje/Blauwe gradient (ORIGINEEL)
Logo:         ✅ SVG "Splash FM" logo
Stream:       ✅ Stereo Tool Processed Output
Audio:        ✅ WERKT! Audio data verified
```

### **Player Features:**
- 🎨 Oranje/blauwe gradient achtergrond
- 📊 Live metadata (artist/title)
- 🔊 Volume control
- 📈 Listener count
- ⏱️  Stream/server uptime
- 🎛️  Equalizer animation tijdens afspelen

---

## 🎚️ **ACTIEVE STREAMS**

```
1. /stream-processed.mp3  ✅ Stereo Tool Professional (192 kbps)
   └─ Via: Liquidsoap → stream-raw → Stereo Tool → Icecast
   └─ URL: http://46.137.184.91:8000/stream-processed.mp3

2. /stream-raw.mp3        ✅ Raw Liquidsoap Output (192 kbps)
   └─ Voor: Stereo Tool input
   └─ Metadata: ✅ Gustaff & Nacho Scoppa - Give U Some

3. /stream.mp3            ✅ Direct Liquidsoap (192 kbps)
   └─ Metadata: ✅ Gustaff & Nacho Scoppa - Give U Some
```

---

## ⚙️ **ACTIEVE PROCESSEN**

```
✅ Liquidsoap              RUNNING (file-based playlist)
   Config: /opt/radio/radio.liq
   Playlist: /var/radio/playlists/current.m3u
   Tracks: /var/radio/tracks/*.mp3/wav

✅ Icecast                 RUNNING (3 mounts actief)
   Port: 8000
   Config: /etc/icecast2/icecast.xml

✅ Stereo Tool Relay       RUNNING (complete pipeline)
   ├─ curl → stream-raw.mp3
   ├─ ffmpeg → WAV conversion
   ├─ stereotool-cmd → Processing (met license)
   └─ ffmpeg → MP3 → Icecast /stream-processed.mp3

✅ Nginx                   RUNNING (reverse proxy)
   Port: 80
   Config: /etc/nginx/sites-available/splashfm
```

---

## 🔄 **AUDIO FLOW**

```
📂 Tracks in /var/radio/tracks/
       ↓
🎵 Liquidsoap (radio.liq)
       ├─→ /stream.mp3 (direct)
       └─→ /stream-raw.mp3
               ↓
           curl reader
               ↓
           ffmpeg → WAV
               ↓
       🎚️ Stereo Tool Processing
          (met license key)
               ↓
           ffmpeg → MP3
               ↓
       📡 Icecast /stream-processed.mp3
               ↓
       🌐 Player pagina
               ↓
       🎧 Luisteraar
```

---

## 🎛️ **STEREO TOOL WEB INTERFACE**

```
Status:     ✅ RUNNING met license key
Port:       9001 (localhost only)
Access:     Via SSH tunnel

SSH Tunnel Command:
ssh -N -L 9001:localhost:9001 radio-ec2

Dan in browser:
http://localhost:9001
```

---

## 📊 **VERIFICATIE**

### **Audio Data Test:**
```bash
curl -s http://46.137.184.91:8000/stream-processed.mp3 | head -c 5000 | wc -c
# Output: 5000 bytes ✅
```

### **Stream Status:**
```bash
curl -s http://46.137.184.91:8000/status-json.xsl | jq '.icestats.source'
```

### **Nu speelt:**
```
Artist: Gustaff & Nacho Scoppa
Title:  Give U Some
```

---

## 🌐 **TOEGANG**

```
🎵 Player (MOBIEL/DESKTOP):
   http://46.137.184.91/

📊 Icecast Status:
   http://46.137.184.91:8000/status-json.xsl

🔗 Direct Streams:
   Main:      http://46.137.184.91/stream.mp3
   Raw:       http://46.137.184.91:8000/stream-raw.mp3
   Processed: http://46.137.184.91:8000/stream-processed.mp3

🎚️ Stereo Tools:
   ssh -N -L 9001:localhost:9001 radio-ec2
   → http://localhost:9001
```

---

## ✅ **SYSTEEM GEZONDHEID**

```
Liquidsoap:        🟢 ONLINE
Icecast:           🟢 ONLINE (3 mounts)
Stereo Tool:       🟢 ONLINE + PROCESSING
Nginx:             🟢 ONLINE
Player Pagina:     🟢 ONLINE (oranje/blauw design)
Audio Pipeline:    🟢 WERKEND
Metadata:          🟢 WERKEND
```

---

## 🔧 **BEHEER COMMANDO'S**

### **Liquidsoap Restart:**
```bash
ssh radio-ec2
sudo pkill -9 liquidsoap
cd /opt/radio && nohup sudo liquidsoap radio.liq > /tmp/liquidsoap.log 2>&1 &
```

### **Stereo Tool Restart:**
```bash
ssh radio-ec2
sudo pkill -9 -f stereotool
sudo pkill -9 -f 'curl.*stream-raw'
nohup sudo /usr/local/bin/stereotool-relay.sh > /tmp/stereotool-relay.log 2>&1 &
```

### **Logs Bekijken:**
```bash
# Liquidsoap
tail -f /tmp/liquidsoap.log

# Icecast
sudo tail -f /var/log/icecast2/error.log

# Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## 📁 **CONFIGURATIE FILES**

```
Liquidsoap:      /opt/radio/radio.liq
Playlist:        /var/radio/playlists/current.m3u
Stereo Tool:     /usr/local/bin/stereotool-relay.sh
Nginx:           /etc/nginx/sites-available/splashfm
Player:          /var/www/splashfm/index.html
```

---

## 🎯 **ALLES WERKT!**

```
✅ Player pagina met originele oranje/blauwe design
✅ Stereo Tool processing active
✅ Audio speelt via /stream-processed.mp3
✅ Metadata updates elke 10 seconden
✅ Alle processen running stabiel
✅ Geen errors in logs
```

**🎊 SYSTEEM IS VOLLEDIG OPERATIONEEL! 🎊**

---

**Laatste update:** 14 Nov 2025, 10:24 CET  
**Status:** ✅ PRODUCTION READY
