# 🎉 Beta Release 0.0.1 - "Stereo Tool Integration"

**Release Date:** 14 November 2025, 11:30 CET  
**Branch:** feature/multi-player-state-machine

---

## 🎵 **MAJOR FEATURES:**

### **1. Stereo Tool Professional Audio Processing**
- ✅ Dual stream setup: Raw + Processed
- ✅ Stream-raw.mp3: Unprocessed with metadata
- ✅ Stream-processed.mp3: Professional Stereo Tool processing
- ✅ Player uses processed audio + raw metadata
- ✅ SSH tunnel access to Stereo Tool web interface (port 9001)

### **2. Commercials Preparation**
- ✅ Track model extended with `trackType` field (music/jingle/commercial)
- ✅ Commercial categories: Product, Service, PSA, Promotion, etc.
- ✅ Auto-detection from filename in upload flow
- ✅ TypeScript types and helpers in `/apps/web/src/types/commercials.ts`
- ✅ Backend schema ready for future ad blocks

### **3. Metadata Solution**
- ✅ Metadata from stream-raw.mp3 (has track info)
- ✅ Audio from stream-processed.mp3 (Stereo Tool quality)
- ✅ Player displays correct track info while streaming processed audio
- ✅ Documented in `METADATA_SOLUTION_FINAL.md`

---

## 📊 **TECHNICAL DETAILS:**

### **Liquidsoap:**
```
✅ Triple output configuration
   - /stream.mp3 (main)
   - /stream-raw.mp3 (for Stereo Tool input)
   - /stream-processed.mp3 (Stereo Tool output)
```

### **Stereo Tool Pipeline:**
```
stream-raw.mp3 → curl → ffmpeg → Stereo Tool → ffmpeg → stream-processed.mp3
```

### **CDN URLs (via CloudFront):**
```
https://splashfm.nl/stream.mp3
https://splashfm.nl/stream-processed.mp3
https://splashfm.nl/stream-raw.mp3
```

---

## 🔧 **INFRASTRUCTURE:**

### **EC2 Server:**
- IP: 46.137.184.91
- Services: Liquidsoap, Icecast2, Stereo Tool, Nginx
- Region: eu-west-1

### **Nginx Proxy:**
- Proxies Icecast streams to public IP
- Serves player HTML
- CloudFront CDN enabled for HTTPS

---

## ⚠️ **KNOWN ISSUES:**

### **Metadata Timing:**
```
⏰ Metadata arrives 3-5 seconds BEFORE audio
   (due to Stereo Tool processing delay)

Current: Metadata from raw stream, audio from processed stream
Future: Consider delaying metadata by ~4 seconds to match audio

Status: NOTED, not critical, fix in future release
```

### **Stereo Tool Access:**
```
❌ Nginx HTTP proxy doesn't work (non-HTTP protocol)
✅ SSH tunnel works: ssh -N -L 9001:localhost:9001 radio-ec2
```

---

## 📁 **NEW FILES:**

```
/apps/web/src/types/commercials.ts          - Commercial types & helpers
/METADATA_SOLUTION_FINAL.md                 - Metadata fallback documentation
/COMMERCIALS_PREP_STATUS.md                 - Commercial feature status
/MULTI_TENANT_STATUS.md                     - Multi-tenant planning
/TODO_MULTI_STATION_FEATURE.md              - Future multi-station guide
```

---

## 🔄 **MODIFIED FILES:**

### **Backend:**
```
/amplify/data/resource.ts                   - Track model: trackType, commercialCategory
/amplify/backend.ts                         - Infrastructure updates
```

### **Frontend:**
```
/apps/web/src/pages/devices/Libery.tsx      - Commercial upload detection
/apps/web/src/App.tsx                       - Route updates
```

### **Lambda:**
```
/amplify/functions/stream-playlist-updater/handler.ts  - Playlist generation
```

---

## 🎯 **DEPLOYMENT STATUS:**

```
✅ Backend deployed to AWS
✅ EC2 stream server operational
✅ CloudFront CDN active
✅ HTTPS streams working
✅ Player live at https://splashfm.nl
✅ Stereo Tool processing active
```

---

## 📝 **DOCUMENTATION:**

All documentation in `/docs/` and root markdown files:
- Deployment guides
- API documentation
- Feature guides
- Troubleshooting

---

## 🚀 **NEXT STEPS (Future Releases):**

### **Beta 0.0.2:**
- [ ] Metadata timing adjustment (4 sec delay)
- [ ] Commercial block scheduling in planner
- [ ] Multi-station support (Cognito groups)

### **Beta 0.1.0:**
- [ ] Voice cloning integration (DJ Jurgen)
- [ ] Automated jingle insertion
- [ ] Advanced playlist scheduling

---

## 👥 **CONTRIBUTORS:**

- Gerard (@gerard) - Lead Developer
- Cascade AI - Development Assistant

---

## 📜 **LICENSE:**

Internal project - All rights reserved

---

**🎊 Ready for beta testing! Stream live at https://splashfm.nl**
