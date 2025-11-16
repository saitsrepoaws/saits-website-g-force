# 🎨 React Player App - Nginx Deployment

**Datum:** 14 November 2025, 17:10 CET  
**Status:** ✅ DEPLOYED  
**URL:** http://79.125.44.178/player/

---

## 📍 **DEPLOYMENT INFO:**

### **Locatie op EC2:**
```
Path: /var/www/splashfm/player/
Ownership: www-data:www-data
Permissions: 755
```

### **Nginx Config:**
```nginx
server {
    listen 80;
    server_name 79.125.44.178 radio.g-forge.com splashfm.nl;
    root /var/www/splashfm;
    
    # React Player App
    location /player {
        root /var/www/splashfm;
        index index.html;
        try_files $uri $uri/ /player/index.html =404;
    }
    
    # ... other locations
}
```

**Config file:** `/etc/nginx/sites-available/radio`

---

## 🏗️ **APP STRUCTURE:**

### **Source:**
```
/Users/gerard/Desktop/T7/g-forge-iot/apps/web/
├── src/
│   ├── components/
│   │   ├── PlayerCard.tsx
│   │   ├── PlayerControls/
│   │   ├── PlayerDisplay/
│   │   └── LiveStreamPlayer.tsx
│   ├── pages/
│   │   └── devices/Players.tsx
│   └── ...
├── dist/              ← Build output
│   ├── index.html
│   ├── assets/
│   └── vite.svg
├── package.json
└── vite.config.ts
```

### **Deployed (dist):**
```
/var/www/splashfm/player/
├── index.html         (450 bytes)
├── assets/
│   ├── index-xxx.js   (React app bundle)
│   └── index-xxx.css  (Styles)
└── vite.svg          (1.5KB)
```

---

## 🚀 **DEPLOYMENT PROCESS:**

### **Manual Steps:**
```bash
# 1. Build app
cd /Users/gerard/Desktop/T7/g-forge-iot/apps/web
npm run build

# 2. Create tarball
tar -czf /tmp/player-app.tar.gz -C dist .

# 3. Upload to EC2
scp /tmp/player-app.tar.gz radio-ec2:/tmp/

# 4. Extract on EC2
ssh radio-ec2
sudo tar -xzf /tmp/player-app.tar.gz -C /var/www/splashfm/player/
sudo chown -R www-data:www-data /var/www/splashfm/player
sudo chmod -R 755 /var/www/splashfm/player
```

### **Automated Script:**
```bash
# Use deployment script
./deploy-player-app.sh

# Features:
✅ Auto build check
✅ Timestamp-based backup
✅ Upload to EC2
✅ Extract & permissions
✅ HTTP verification
✅ Rollback instructions
```

---

## 🔄 **UPDATE WORKFLOW:**

### **Development:**
```bash
# 1. Make changes in apps/web/src/
# 2. Test locally
cd apps/web
npm run dev
# Open http://localhost:5173

# 3. Build for production
npm run build

# 4. Deploy
./deploy-player-app.sh
```

### **Rollback:**
```bash
# If deployment failed:
ssh radio-ec2
sudo mv /var/www/splashfm/player.backup-20251114-171000 /var/www/splashfm/player
```

---

## 🎨 **PLAYER FEATURES:**

### **Huidige Build (van screenshot):**
```
✅ Album art display
✅ Waveform visualization  
✅ Track info (Artist, Title)
✅ Playback controls
✅ Time progress
✅ Playlist view
✅ Real-time updates
```

### **Tech Stack:**
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **State:** useState + useEffect
- **API:** Icecast status JSON
- **IoT:** AWS IoT Core (MQTT)

---

## 📡 **API ENDPOINTS USED:**

### **Stream Status:**
```javascript
fetch('http://79.125.44.178:8000/status-json.xsl')
  .then(res => res.json())
  .then(data => {
    const track = data.icestats.source.title
    // Parse "Artist - Title"
  })
```

### **IoT Messages:**
```javascript
// Subscribe to player state updates
iot.subscribe('player/+/state', (message) => {
  // Update UI with current track info
})
```

---

## 🧪 **TESTING:**

### **Local Development:**
```bash
cd apps/web
npm run dev
# → http://localhost:5173
```

### **Production Check:**
```bash
# HTTP status
curl -I http://79.125.44.178/player/

# Load HTML
curl -s http://79.125.44.178/player/ | head -20

# Assets loading
curl -I http://79.125.44.178/player/assets/index-xxx.js
```

### **Browser Test:**
```
1. Open: http://79.125.44.178/player/
2. Check console for errors
3. Verify stream playing
4. Test controls (play/pause)
5. Check waveform rendering
```

---

## 🔧 **TROUBLESHOOTING:**

### **404 Error:**
```bash
# Check file existence
ssh radio-ec2 "ls -la /var/www/splashfm/player/"

# Check nginx config
ssh radio-ec2 "sudo cat /etc/nginx/sites-available/radio | grep -A 5 player"

# Check permissions
ssh radio-ec2 "ls -ld /var/www/splashfm/player"
# Should be: drwxr-xr-x www-data:www-data
```

### **Assets Not Loading:**
```bash
# Check relative paths in HTML
ssh radio-ec2 "cat /var/www/splashfm/player/index.html | grep assets"

# Should be: <script type="module" src="/player/assets/...">
# NOT: <script type="module" src="/assets/...">
```

### **Fix: Update vite base path:**
```typescript
// vite.config.ts
export default defineConfig({
  base: '/player/',  // Important!
  // ...
})
```

---

## 📦 **BUILD OPTIMIZATION:**

### **Current Build Size:**
```
index.html: 450 bytes
assets/: ~50KB total
Total: ~51KB
```

### **Production Optimizations:**
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  }
})
```

---

## 🌐 **CORS CONFIGURATION:**

**Already configured in nginx:**
```nginx
location /player {
    # CORS not needed - same origin!
    # Player served from 79.125.44.178
    # API also from 79.125.44.178
}
```

**For external access:**
```nginx
# If needed later
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods 'GET, OPTIONS';
```

---

## 🔐 **SECURITY:**

### **Current Setup:**
```
✅ Files owned by www-data
✅ Read-only (755 permissions)
✅ No user uploads
✅ Static files only
✅ No server-side execution
```

### **Future Enhancements:**
```
- Add HTTPS (Let's Encrypt)
- Add CSP headers
- Rate limiting
- DDoS protection (Cloudflare)
```

---

## 📝 **NGINX CONFIG BACKUP:**

```bash
# Backup location:
/etc/nginx/sites-available/radio.backup-20251114-170700

# Restore if needed:
sudo cp /etc/nginx/sites-available/radio.backup-20251114-170700 \
       /etc/nginx/sites-available/radio
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🎯 **URLs OVERZICHT:**

```
Main Site:       http://79.125.44.178/
Player App:      http://79.125.44.178/player/
Stream:          http://79.125.44.178/stream.mp3
Status API:      http://79.125.44.178/status-json.xsl
Admin (old):     http://79.125.44.178/admin.html
```

---

## ✅ **DEPLOYMENT CHECKLIST:**

```
Before Deploy:
☐ npm run build (no errors)
☐ Check dist/ folder exists
☐ Verify assets in dist/assets/
☐ Test locally first

Deploy:
☐ Run deploy-player-app.sh
☐ Wait for upload complete
☐ Check extraction success
☐ Verify permissions

After Deploy:
☐ Test URL: http://79.125.44.178/player/
☐ Check browser console (no errors)
☐ Test stream playback
☐ Verify waveform renders
☐ Test on mobile
```

---

**STATUS: ✅ FULLY DEPLOYED & WORKING**

**Next:** Build nieuwe features in React app en re-deploy!
