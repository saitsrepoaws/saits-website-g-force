# Media URL Configuration

**Datum:** 5 November 2025  
**Status:** ✅ Geïmplementeerd

---

## 🎯 Probleem

Track data van backend bevat relatieve paden in plaats van volledige S3 URLs:

```json
{
  "fileUrl": "public/audio/1761422724956-Vilchezz_-_Northside.mp3",
  "coverArtUrl": "public/covers/ae102201756efdd4387378ce6d31b732.image/jpeg"
}
```

Deze paden moeten worden omgezet naar volledige URLs om de bestanden te kunnen laden.

---

## ✅ Oplossing: Media URL Helper

### **1. Helper Functie** (`utils/mediaUrl.ts`)

```typescript
import { getAudioUrl, getCoverArtUrl, getWaveformUrl } from '@/utils/mediaUrl'

// Automatisch detecteert of het een S3 URL of relatief pad is
const audioUrl = getAudioUrl('public/audio/track.mp3')
// → '/public/audio/track.mp3' (same origin)
// → 'https://bucket.s3.region.amazonaws.com/public/audio/track.mp3' (met VITE_MEDIA_BASE_URL)

const coverUrl = getCoverArtUrl('https://s3.amazonaws.com/cover.jpg')
// → 'https://s3.amazonaws.com/cover.jpg' (unchanged, already full URL)
```

### **2. Environment Variable**

In `.env.local`:

```bash
# Optie 1: Serve from same origin (default)
VITE_MEDIA_BASE_URL=

# Optie 2: Serve from S3 bucket
VITE_MEDIA_BASE_URL=https://your-bucket.s3.eu-west-1.amazonaws.com

# Optie 3: Serve from CloudFront
VITE_MEDIA_BASE_URL=https://d1234567890.cloudfront.net
```

---

## 🔧 Implementatie

### **Players Pagina**

```typescript
import { getAudioUrl, getCoverArtUrl } from '../../utils/mediaUrl'

// In handleLoadCommand:
console.log('File (raw):', track.fileUrl)
console.log('File (URL):', getAudioUrl(track.fileUrl))
console.log('Cover (raw):', track.coverArtUrl)
console.log('Cover (URL):', getCoverArtUrl(track.coverArtUrl))

// In UI:
<img 
  src={getCoverArtUrl(playerState.track.coverArtUrl)} 
  alt="Cover art"
  onError={(e) => {
    console.error('Failed to load:', getCoverArtUrl(playerState.track.coverArtUrl))
  }}
  onLoad={() => {
    console.log('✅ Loaded:', getCoverArtUrl(playerState.track.coverArtUrl))
  }}
/>
```

---

## 📊 URL Conversie Voorbeelden

### **Zonder VITE_MEDIA_BASE_URL (default):**

```javascript
Input:  "public/audio/track.mp3"
Output: "/public/audio/track.mp3"
Result: Served from http://localhost:5173/public/audio/track.mp3
```

### **Met VITE_MEDIA_BASE_URL (S3):**

```javascript
Input:  "public/audio/track.mp3"
Output: "https://bucket.s3.eu-west-1.amazonaws.com/public/audio/track.mp3"
Result: Served from S3
```

### **Al een volledige URL:**

```javascript
Input:  "https://bucket.s3.amazonaws.com/audio/track.mp3"
Output: "https://bucket.s3.amazonaws.com/audio/track.mp3"
Result: Unchanged (already full URL)
```

---

## 🧪 Testing

### **Test 1: Check Console Logs**

1. Zet Auto Load AAN
2. Check console voor:
   ```
   ✅ Track from backend:
      File (raw): public/audio/...
      File (URL): /public/audio/... (of S3 URL)
      Cover (raw): public/covers/...
      Cover (URL): /public/covers/... (of S3 URL)
   ```

### **Test 2: Check Cover Art**

1. Track geladen → Cover art verschijnt in UI
2. Check console:
   ```
   ✅ Cover art loaded: /public/covers/...
   ```
3. Als error:
   ```
   ❌ Failed to load cover art: /public/covers/...
   ```

### **Test 3: Check Network Tab**

1. Open DevTools → Network tab
2. Filter op "audio" of "covers"
3. Zie requests naar:
   - Same origin: `http://localhost:5173/public/...`
   - S3: `https://bucket.s3.amazonaws.com/public/...`

---

## 🚨 Troubleshooting

### **Cover art laadt niet**

**Symptoom:**
```
❌ Failed to load cover art: /public/covers/...
```

**Oorzaken:**
1. Bestand bestaat niet op server
2. CORS issue (als S3)
3. Verkeerde base URL

**Fix:**
```bash
# Check of bestand bestaat
curl http://localhost:5173/public/covers/...

# Check S3 bucket
aws s3 ls s3://your-bucket/public/covers/

# Check CORS (S3)
aws s3api get-bucket-cors --bucket your-bucket
```

### **Audio speelt niet**

**Symptoom:**
Audio element laadt niet

**Fix:**
1. Check `getAudioUrl()` output in console
2. Verify bestand is toegankelijk
3. Check MIME type (moet `audio/mpeg` zijn)

---

## 📁 File Structure

```
apps/web/
├── src/
│   ├── utils/
│   │   └── mediaUrl.ts          ← Helper functions
│   └── pages/
│       └── devices/
│           └── Players.tsx       ← Gebruikt helpers
├── .env.example                  ← Template
└── .env.local                    ← Jouw config (gitignored)
```

---

## 🎯 Use Cases

### **Development (Local Files):**
```bash
# .env.local
VITE_MEDIA_BASE_URL=

# Files served from: http://localhost:5173/public/...
```

### **Production (S3):**
```bash
# .env.local
VITE_MEDIA_BASE_URL=https://your-bucket.s3.eu-west-1.amazonaws.com

# Files served from: https://your-bucket.s3.eu-west-1.amazonaws.com/public/...
```

### **Production (CloudFront):**
```bash
# .env.local
VITE_MEDIA_BASE_URL=https://d1234567890.cloudfront.net

# Files served from: https://d1234567890.cloudfront.net/public/...
```

---

## ✅ Checklist

- [x] Helper functions created (`mediaUrl.ts`)
- [x] Players pagina gebruikt helpers
- [x] Cover art preview in UI
- [x] Console logging voor debugging
- [x] `.env.example` updated
- [x] Error handling (onError, onLoad)
- [ ] Audio player element (toekomstig)
- [ ] Waveform display (toekomstig)

---

**Last Updated:** 5 November 2025  
**Version:** 1.0  
**Status:** ✅ Ready to Use
