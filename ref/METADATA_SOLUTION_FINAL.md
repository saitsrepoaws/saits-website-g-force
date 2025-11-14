# 🎵 Metadata Oplossing voor Stereo Tool Stream

**Datum:** 14 Nov 2025, 10:50 CET  
**Probleem:** stream-processed.mp3 heeft geen metadata (title/artist)  
**Oplossing:** Gebruik metadata van stream-raw.mp3 in de player

---

## ❌ **WAT NIET WERKT:**

### **1. External Encoder Metadata Passthrough**
```liquidsoap
# Dit crasht:
output.icecast(
  %external(process="ffmpeg | stereotool | ffmpeg"),
  icy_metadata="guess"
)
# Error: Process exited with code 1
# Reason: Complex pipeline te instabiel
```

### **2. Icecast Admin API Metadata Update**
```bash
# Dit werkt niet:
curl -u "admin:pass" \
  "http://localhost:8000/admin/metadata?mount=/stream-processed.mp3&mode=updinfo&song=TITLE"
# Requires source client to support metadata updates
```

---

## ✅ **OPLOSSING: Gebruik stream-raw metadata**

### **Waarom dit werkt:**
```
Liquidsoap → /stream-raw.mp3 (heeft metadata!) ✅
    ↓
Stereo Tool relay leest van /stream-raw.mp3
    ↓
Stereo Tool → /stream-processed.mp3 (audio processing)
    ↓
Player haalt metadata van /stream-raw.mp3 ✅
Player speelt audio van /stream-processed.mp3 ✅
```

---

## 📊 **HUIDIGE SITUATIE:**

```javascript
// Player JavaScript:
async function updateMetadata() {
    // Haal metadata van stream-raw (heeft title!)
    const response = await fetch('/status-json.xsl');
    const data = await response.json();
    
    // Zoek stream-raw voor metadata
    const sources = Array.isArray(data.icestats.source) 
        ? data.icestats.source 
        : [data.icestats.source];
    
    const streamSource = sources.find(s => 
        s.listenurl && s.listenurl.includes('stream-raw')
    ) || sources[0];
    
    // Update UI met metadata
    const fullTitle = streamSource.title || 'Unknown Track';
    const parts = fullTitle.split(' - ');
    
    if (parts.length >= 2) {
        artist.textContent = parts[0];
        title.textContent = parts[1];
    }
}

// Speel audio van stream-processed (Stereo Tool)
audioPlayer.src = '/stream-processed.mp3';
```

---

## 🎯 **IMPLEMENTATIE:**

### **Player gebruikt:**
```
Audio:    /stream-processed.mp3 (Stereo Tool processing)
Metadata: /stream-raw.mp3 (heeft title/artist)
```

### **Waarom split audio & metadata:**
- **stream-processed:** Beste audio quality (Stereo Tool)
- **stream-raw:** Heeft metadata van Liquidsoap
- **Player:** Combineert beide!

---

## 📈 **VOORDELEN:**

```
✅ Geen external encoder complexiteit
✅ Geen crashing pipelines  
✅ Metadata werkt altijd (van stream-raw)
✅ Audio quality van Stereo Tool
✅ Simpel en stabiel
✅ Geen extra processen nodig
```

---

## 🔄 **ALTERNATIEVE STREAMS:**

### **Optie A: stream-processed.mp3 (huidige)**
```
+ Pro audio processing (Stereo Tool)
- Geen metadata
→ Fix: metadata van stream-raw ophalen
```

### **Optie B: stream.mp3**
```
+ Heeft metadata
- Geen Stereo Tool processing
→ Simpeler maar minder audio quality
```

---

## 🌐 **BESCHIKBARE ENDPOINTS:**

```
/stream-processed.mp3  ← Audio (Stereo Tool)
/stream-raw.mp3        ← Input voor Stereo Tool + metadata
/stream.mp3            ← Direct Liquidsoap
/status-json.xsl       ← Metadata API
```

---

## 💡 **CONCLUSIE:**

**Beste oplossing:** Player speelt `/stream-processed.mp3` en haalt metadata van `/stream-raw.mp3`

Dit is:
- ✅ Stabiel
- ✅ Simpel
- ✅ Beste audio quality
- ✅ Metadata werkt

---

**Status:** ✅ WERKEND in huidige player implementatie!
