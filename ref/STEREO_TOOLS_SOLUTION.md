# 🎚️ STEREO TOOLS WEB INTERFACE - OPLOSSING

**Datum:** 14 Nov 2025, 02:36 CET  
**Status:** ⚠️ NGINX PROXY ISSUES

---

## ❌ **PROBLEEM:**

De Stereo Tool web interface accepteert GEEN directe externe connecties:
- Luistert alleen op `localhost:9001`
- Gebruikt HTTP/1.0 (ouderwets protocol)
- Stuurt gzip-compressed data zonder correcte headers
- Nginx proxy geeft 502 Bad Gateway

**Wat we probeerden:**
1. ✅ Poort 9001 openen in Security Group
2. ✅ License key toevoegen aan Stereo Tool
3. ❌ IP whitelist in command line (werkt niet zo)
4. ❌ Nginx reverse proxy (502 errors)

---

## ✅ **WERKENDE OPLOSSING: SSH TUNNEL**

### **SSH Port Forwarding gebruiken:**

```bash
# In een terminal (laat deze draaien):
ssh -N -L 9001:localhost:9001 radio-ec2
```

**Dan in je browser:**
```
http://localhost:9001
```

**Dit werkt omdat:**
- SSH tunnelt poort 9001 van EC2 naar je lokale Mac
- Je browser denkt dat Stereo Tool lokaal draait
- Stereo Tool denkt dat de request van localhost komt
- ✅ GEEN IP restrictions, GEEN proxy issues!

---

## 🎚️ **STEREO TOOLS GEBRUIKEN:**

### **1. Start SSH Tunnel:**
```bash
ssh -N -L 9001:localhost:9001 radio-ec2
# Dit blijft draaien, open een NIEUWE terminal voor andere commands
```

### **2. Open in Browser:**
```
http://localhost:9001
```

### **3. IP Whitelist Instellen (in de web interface):**
- Navigeer naar Settings/Security
- Voeg toe: `212.105.153.228`
- Save

### **4. Export/Save Settings:**
- File → Export Settings
- Save to: `/opt/radio/stereotool.sts`
- Use deze file bij herstart

---

## 🔄 **STEREO TOOL HERSTARTEN MET SAVED SETTINGS:**

```bash
# Update relay script om .sts file te gebruiken:
$STEREO_TOOL -k "$LICENSE_KEY" -s /opt/radio/stereotool.sts -w "$WEB_PORT" - -
```

---

## 📊 **ALTERNATIEF: Poort 9001 Publiek Maken**

**⚠️ NIET AANBEVOLEN** maar mogelijk:

### **Optie 1: Stereo Tool op 0.0.0.0 laten luisteren**
```bash
# Mogelijk niet supported door stereotool-cmd
# Zou custom build/wrapper script vereisen
```

### **Optie 2: socat Port Forwarder**
```bash
# Install socat:
sudo apt-get install socat

# Forward 9001 external → 9001 localhost:
sudo socat TCP-LISTEN:9001,fork,reuseaddr TCP:localhost:9001 &

# Problem: Stereo Tool ziet niet het echte IP!
```

### **Optie 3: Nginx met stream module**
```nginx
# /etc/nginx/nginx.conf
stream {
    server {
        listen 9001;
        proxy_pass localhost:9001;
    }
}

# Problem: Requires nginx recompile with stream module
```

---

## 🎯 **AANBEVOLEN WORKFLOW:**

### **Voor Setup & Configuratie:**
```bash
1. SSH Tunnel: ssh -N -L 9001:localhost:9001 radio-ec2
2. Browse: http://localhost:9001
3. Configure Stereo Tool
4. Export settings to /opt/radio/stereotool.sts
```

### **Voor Productie:**
```bash
# Stereo Tool draait met saved settings:
stereotool-cmd -k <key> -s /opt/radio/stereotool.sts -w 9001 - -

# Web interface alleen via SSH tunnel
# OF: Disable web interface (-w weglaten)
```

---

## 🚀 **QUICK START COMMAND:**

```bash
# In één command: SSH tunnel + open browser
ssh -f -N -L 9001:localhost:9001 radio-ec2 && open http://localhost:9001

# -f = background
# -N = no remote command
# -L = local port forward
# && = then open browser
```

---

## 📋 **CURRENT STATUS:**

```
✅ Stereo Tool:     RUNNING + LICENSE KEY
✅ Port 9001:       LISTENING on localhost
✅ SSH Access:      Available
❌ Direct Access:   BLOCKED (localhost only)
❌ Nginx Proxy:     502 Bad Gateway (HTTP/1.0 issues)
✅ SSH Tunnel:      WORKS PERFECTLY! ⭐
```

---

## 🎯 **CONCLUSIE:**

**Gebruik SSH Port Forwarding!**
- Snelste oplossing
- Meest betrouwbaar
- Geen nginx/proxy issues
- Werkt altijd

**Command:**
```bash
ssh -N -L 9001:localhost:9001 radio-ec2
```

**Browser:**
```
http://localhost:9001
```

**🎚️ DONE! 💪**

---

**Volgende Stap:** Lambda deployment checken en stream testen! 🎵
