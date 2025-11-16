# 🎚️ STEREO TOOLS WEB INTERFACE - ACCESS INFO

**Date:** 14 Nov 2025, 02:01 CET  
**Status:** ✅ **PORT OPEN**

---

## ✅ **PROBLEEM OPGELOST:**

### **Poort 9001 stond DICHT!**

```bash
# Was:
Security Group: sg-0d77592e5d47c3761
Ports: 22, 80, 8000
Port 9001: ❌ CLOSED

# Nu:
Security Group: sg-0d77592e5d47c3761  
Ports: 22, 80, 8000, 9001 ✅
Port 9001: ✅ OPEN (0.0.0.0/0)
```

---

## 🎚️ **STEREO TOOLS WEB INTERFACE:**

### **URL:**
```
http://79.125.44.178:9001
```

### **Status:**
```
✅ Port open in Security Group
✅ Stereo Tool process running
⚠️  HTTP 403 FORBIDDEN response
```

---

## ⚠️ **HTTP 403 - MOGELIJKE OORZAKEN:**

### **1. Stereo Tool Web Interface Beveiliging**
```
Stereo Tool kan:
- Alleen localhost access toestaan
- Password authentication vereisen
- Geen remote access toestaan in trial/unregistered mode
```

### **2. Mogelijk Nginx/Proxy Block**
```bash
# Check if nginx is blocking:
ssh radio-ec2 "sudo nginx -T | grep 9001"
```

### **3. Stereo Tool Mogelijk Alleen Localhost**
```bash
# Current command:
/usr/local/bin/stereotool-cmd -w 9001 - -

# Might need IP binding:
/usr/local/bin/stereotool-cmd -w 0.0.0.0:9001 - -
```

---

## 🔍 **DEBUGGING STEPS:**

### **Step 1: Test from EC2 itself (localhost)**
```bash
ssh radio-ec2
curl -I http://localhost:9001

# If this works → binding issue
# If 403 also → auth/license issue
```

### **Step 2: Check Stereo Tool process**
```bash
ps aux | grep stereotool
# Currently: stereotool-cmd -w 9001 - -
```

### **Step 3: Check if license/registration required**
```
Stereo Tool often requires:
- Registration key for remote access
- License for web interface
- Might work only in localhost mode without license
```

---

## 💡 **MOGELIJKE OPLOSSINGEN:**

### **Option 1: SSH Port Forward** ⭐ QUICKEST
```bash
# From your Mac:
ssh -L 9001:localhost:9001 radio-ec2

# Then access:
http://localhost:9001
```

### **Option 2: Restart with IP Binding**
```bash
ssh radio-ec2
sudo pkill stereotool
sudo stereotool-cmd -w 0.0.0.0:9001 - - &
```

### **Option 3: Nginx Proxy**
```nginx
# Add to nginx config:
location /stereo-tools/ {
    proxy_pass http://localhost:9001/;
}

# Then access:
http://79.125.44.178/stereo-tools/
```

### **Option 4: Check License/Registration**
```bash
# Stereo Tool might need registration for remote access
# Check documentation or trial limitations
```

---

## 🚀 **QUICK TEST: SSH TUNNEL**

```bash
# Run this on your Mac:
ssh -N -L 9001:localhost:9001 radio-ec2 &

# Then open in browser:
http://localhost:9001

# If this works → binding issue
# If still 403 → auth/license issue
```

---

## 📊 **CURRENT STATUS:**

```
✅ Security Group: Port 9001 OPEN
✅ Stereo Tool: RUNNING on port 9001
⚠️  Access: HTTP 403 FORBIDDEN
```

**Next Step:** Try SSH tunnel om te zien of het lokaal wel werkt!

---

## 🎯 **RECOMMENDED ACTION:**

```bash
# Terminal 1 (keep running):
ssh -N -L 9001:localhost:9001 radio-ec2

# Browser:
open http://localhost:9001
```

**Als dit werkt:** Binding issue → fix met 0.0.0.0:9001  
**Als dit niet werkt:** License/auth issue → check Stereo Tool docs

---

**Status:** 🔧 PORT OPEN, TESTING ACCESS  
**Security Group:** ✅ FIXED  
**Next:** SSH tunnel test

**🎚️ Let's get that interface working! 💪**
