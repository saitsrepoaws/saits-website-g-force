# 🔄 EC2 Elastic IP Change - 16 November 2025

**Date:** 16 November 2025, 04:00 CET  
**Type:** Infrastructure Update  
**Impact:** All deployment scripts and SSH configs

---

## 📋 IP Change Details

### Old IP (Deprecated)
```
79.125.44.178
```
**Status:** ❌ No longer active  
**Last Used:** 15 November 2025

### New IP (Active)
```
79.125.44.178
```
**Status:** ✅ Currently active  
**Effective:** 16 November 2025

---

## 🔧 What Needs to Be Updated

### 1. SSH Config (`~/.ssh/config`)
```bash
Host radio-ec2
    HostName 79.125.44.178  # ⚠️ UPDATE THIS!
    User ubuntu
    IdentityFile ~/.ssh/ec2-radio-key
    StrictHostKeyChecking no
    UserKnownHostsFile=/dev/null
```

**Update Command:**
```bash
sed -i '' 's/79.125.44.178/79.125.44.178/g' ~/.ssh/config
```

### 2. Deployment Scripts

**Files to Update:**
- `/Users/gerard/Desktop/T7/g-forge-iot/deploy/*.sh`
- Any scripts referencing old IP

**Update Command:**
```bash
cd /Users/gerard/Desktop/T7/g-forge-iot/deploy
sed -i '' 's/79.125.44.178/79.125.44.178/g' *.sh
```

### 3. HTML Deployment Script
```bash
# Update splashfm-iot.html deployment
sed -i '' 's/79.125.44.178/79.125.44.178/g' /tmp/deploy-iot-html.sh
```

### 4. Reference Documentation

**Files Updated:**
- ✅ `EC2_STREAM_SERVER_INFO` memory (updated)
- ✅ This document (`EC2_IP_CHANGE_16NOV2025.md`)

**Files to Update Manually:**
- `EC2_STREAM_RECOVERY_11NOV2025.md`
- `EC2_STREAM_RECOVERY_15NOV2025.md`
- Any other docs referencing old IP

---

## 🧪 Verification Steps

### 1. Test SSH Connection
```bash
ssh radio-ec2
# Should connect to 79.125.44.178
```

### 2. Test Stream URLs
```bash
# Direct Icecast
curl -I http://79.125.44.178:8000/stream.mp3

# Via Nginx
curl -I http://79.125.44.178/

# Via Domain
curl -I https://splashfm.nl/splashfm.mp3
```

### 3. Test Services
```bash
ssh radio-ec2 'systemctl status liquidsoap icecast2 nginx'
```

---

## 📊 Service URLs (Updated)

### HTTP URLs (Direct)
- **Homepage:** http://79.125.44.178/
- **Stream:** http://79.125.44.178:8000/stream.mp3
- **Status JSON:** http://79.125.44.178:8000/status-json.xsl
- **Stereo Tool:** http://79.125.44.178:9001

### HTTPS URLs (via Domain)
- **Stream:** https://splashfm.nl/splashfm.mp3
- **Homepage:** https://splashfm.nl/

---

## ⚠️ Important Notes

1. **DNS Not Changed:**  
   - Domain `splashfm.nl` likely points to CloudFront or old IP
   - May need DNS update if pointing directly to EC2

2. **Firewall Rules:**  
   - Security Group rules should auto-update (attached to instance, not IP)
   - Verify ports: 22, 80, 8000, 9001

3. **SSL Certificates:**  
   - Nginx SSL config should still work (domain-based, not IP-based)

4. **CloudFront Origin:**  
   - If CloudFront uses IP as origin, needs update
   - Check origin configuration

---

## 🚀 Quick Update Script

```bash
#!/bin/bash
# Update all references to old IP

OLD_IP="79.125.44.178"
NEW_IP="79.125.44.178"

echo "🔄 Updating IP references from $OLD_IP to $NEW_IP..."

# Update SSH config
if grep -q "$OLD_IP" ~/.ssh/config 2>/dev/null; then
    sed -i '' "s/$OLD_IP/$NEW_IP/g" ~/.ssh/config
    echo "✅ Updated ~/.ssh/config"
fi

# Update deployment scripts
cd /Users/gerard/Desktop/T7/g-forge-iot/deploy 2>/dev/null
if [ -d "$(pwd)" ]; then
    for file in *.sh; do
        if [ -f "$file" ] && grep -q "$OLD_IP" "$file"; then
            sed -i '' "s/$OLD_IP/$NEW_IP/g" "$file"
            echo "✅ Updated deploy/$file"
        fi
    done
fi

# Update ref docs
cd /Users/gerard/Desktop/T7/g-forge-iot/ref 2>/dev/null
if [ -d "$(pwd)" ]; then
    for file in *.md; do
        if [ -f "$file" ] && grep -q "$OLD_IP" "$file"; then
            sed -i '' "s/$OLD_IP/$NEW_IP/g" "$file"
            echo "✅ Updated ref/$file"
        fi
    done
fi

echo ""
echo "✅ IP update complete!"
echo "🧪 Test SSH: ssh radio-ec2"
echo "🌐 Test stream: curl http://$NEW_IP:8000/stream.mp3"
```

---

## 📝 Checklist

- [x] Memory system updated
- [x] Documentation created
- [ ] SSH config updated
- [ ] Deployment scripts updated
- [ ] Test SSH connection
- [ ] Test stream URLs
- [ ] Update CloudFront origin (if needed)
- [ ] Update DNS (if needed)
- [ ] Notify team of IP change

---

**Status:** 📋 DOCUMENTED - Ready for implementation  
**Next Steps:** Run update script, verify connectivity
