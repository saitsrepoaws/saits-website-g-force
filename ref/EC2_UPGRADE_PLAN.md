# EC2 Upgrade Plan: Ubuntu 24.04 + Liquidsoap 2.2.5+

**Doel**: Full advanced crossfading met UI control

---

## 🎯 Waarom Upgraden?

### Huidige Situatie (22.04)
- Liquidsoap 2.0.2 (maximum)
- ❌ Geen custom fade times
- ❌ Geen UI → EC2 control
- ❌ Geen autocue

### Na Upgrade (24.04)
- Liquidsoap 2.2.5+ beschikbaar
- ✅ Custom fade times (UI controlled)
- ✅ Presets: Techno, Progressive, Ambient
- ✅ Autocue (smart cue point detection)
- ✅ Named parameters
- ✅ Full UI integration

---

## 📋 Upgrade Strategie

### Optie 1: In-Place Upgrade (NIET AANBEVOLEN)
```bash
# Risico's:
- Downtime tijdens upgrade
- Mogelijk package conflicts
- No rollback
```

### Optie 2: Nieuwe Instance (AANBEVOLEN) ✅
```bash
# Voordelen:
- Zero downtime (parallel setup)
- Easy rollback (oude instance blijft)
- Clean install
- Test eerst volledig
```

---

## 🚀 Implementatie Plan

### Fase 1: Nieuwe Instance Setup (30 min)

**1. Launch Instance**
```bash
AMI: ami-049442a6cf8319180 (Ubuntu 24.04 Noble)
Type: t3.small
VPC: Bestaande VPC
Security Group: Bestaande SG
Key Pair: Bestaande key
IAM Role: radio-server-role (met S3 access)
```

**2. Installeer Liquidsoap 2.2.5+**
```bash
# On new instance:
sudo apt-get update
sudo apt-get install -y liquidsoap

# Check version:
liquidsoap --version  # Should be 2.2.5+
```

**3. Installeer Dependencies**
```bash
sudo apt-get install -y \
  icecast2 \
  awscli \
  ffmpeg \
  jq
```

### Fase 2: Configuratie Migratie (15 min)

**1. Copy van oude instance via S3**
```bash
# On OLD instance:
aws s3 cp /opt/radio/radio.liq s3://radio-playlists-035636364722/backup/
aws s3 cp /etc/icecast2/icecast.xml s3://radio-playlists-035636364722/backup/

# On NEW instance:
aws s3 cp s3://radio-playlists-035636364722/backup/radio.liq /tmp/
aws s3 cp s3://radio-playlists-035636364722/backup/icecast.xml /tmp/
```

**2. Setup directories**
```bash
sudo mkdir -p /opt/radio
sudo mkdir -p /var/log/liquidsoap
sudo chown ubuntu:ubuntu /opt/radio
sudo chown ubuntu:ubuntu /var/log/liquidsoap
```

**3. Create NEW advanced config**
```liquidsoap
# /opt/radio/radio.liq - Liquidsoap 2.2.5+ with UI control

# Dynamic crossfade from UI settings
%include "/opt/radio/crossfade-ui.liq"

# Rest of config...
```

**4. Setup systemd service**
```bash
sudo systemctl enable liquidsoap-radio
sudo systemctl enable icecast2
```

### Fase 3: Testing (15 min)

**1. Test Liquidsoap syntax**
```bash
liquidsoap --check /opt/radio/radio.liq
```

**2. Start services**
```bash
sudo systemctl start icecast2
sudo systemctl start liquidsoap-radio
```

**3. Verify stream**
```bash
curl http://localhost:8000/status-json.xsl
```

**4. Test advanced crossfade**
```bash
# Create test config with custom fades
cat > /tmp/test-crossfade.liq << 'EOF'
radio = blank()

def ui_crossfade(a, b) =
  # Custom fade times from UI
  fade_in = 4.0
  fade_out = 3.0
  
  a = fade.out(duration=fade_out, type="sin", a)
  b = fade.in(duration=fade_in, type="sin", b)
  
  add(normalize=false, [a, b])
end

radio = cross(duration=7.0, ui_crossfade, radio)
EOF

liquidsoap --check /tmp/test-crossfade.liq
# Should pass in 2.2.5+!
```

### Fase 4: Cutover (10 min)

**1. Setup Nginx op nieuwe instance**
```bash
# Install + configure
sudo apt-get install -y nginx
# Copy Splash FM player page
```

**2. Test complete stack**
```bash
# Test via new instance IP
curl http://NEW_IP:8000/stream.mp3
curl http://NEW_IP/
```

**3. Wissel Elastic IP**
```bash
# Disassociate from old instance
aws ec2 disassociate-address --association-id <old-assoc-id>

# Associate to new instance
aws ec2 associate-address \
  --instance-id <new-instance-id> \
  --allocation-id eipalloc-XXX
```

**4. Verify**
```bash
curl http://46.137.184.91/
curl http://46.137.184.91:8000/status-json.xsl
```

### Fase 5: Cleanup (Later)

**1. Monitor nieuwe instance (24h)**
- Check logs
- Monitor stream stability
- Test UI → EC2 updates

**2. Terminate oude instance**
```bash
# Na 24h zonder issues:
aws ec2 terminate-instances --instance-ids i-0426ac5a6811b0d2a
```

---

## 🎚️ Nieuwe Features na Upgrade

### 1. Custom Fade Times
```liquidsoap
# From UI:
fade_in = {{ settings.crossfadeFadeIn }}    # 2.0 - 6.0
fade_out = {{ settings.crossfadeFadeOut }}  # 2.0 - 6.0
```

### 2. Presets
```javascript
// UI Presets → Direct naar Liquidsoap:
{
  techno: { fadeIn: 2.0, fadeOut: 2.0 },
  progressive: { fadeIn: 4.0, fadeOut: 4.0 },
  ambient: { fadeIn: 6.0, fadeOut: 6.0 }
}
```

### 3. Autocue (Optional)
```liquidsoap
enable_autocue_metadata()
# Automatic cue point detection via FFmpeg
```

### 4. Dynamic Config Reload
```bash
# Update crossfade-ui.liq
# Reload without restart:
systemctl reload liquidsoap-radio
```

---

## 💰 Kosten

**New Instance**: t3.small  
**Cost**: ~$15/month (same as current)  
**During migration**: 2x cost voor max 1 dag

---

## ⚠️ Risico's & Mitigatie

### Risico 1: Downtime
**Mitigatie**: Parallel setup, test volledig, dan cutover

### Risico 2: Config incompatibility
**Mitigatie**: Test config syntax op nieuwe instance eerst

### Risico 3: Missing features
**Mitigatie**: Keep oude instance 24h voor rollback

### Risico 4: DNS propagation
**Mitigatie**: Use Elastic IP (instant switch)

---

## ✅ Rollback Plan

Als er problemen zijn:

```bash
# 1. Reassociate Elastic IP terug naar oude instance
aws ec2 associate-address \
  --instance-id i-0426ac5a6811b0d2a \
  --allocation-id eipalloc-XXX

# 2. Oude instance werkt weer direct
# Stream uninterrupted

# 3. Debug nieuwe instance in peace
```

---

## 🎯 Aanbeveling

**Go for it!** 🚀

**Voordelen**:
- ✅ Professional multi-layered crossfading
- ✅ Full UI control
- ✅ Modern Liquidsoap features
- ✅ Future-proof setup
- ✅ Easy rollback mogelijk

**Timing**: Nu is perfect!
- Stream werkt (no pressure)
- Weekend mogelijk (low traffic)
- Can test in parallel

**Estimated Total Time**: 90 minuten
- Setup: 30 min
- Config: 15 min  
- Testing: 15 min
- Cutover: 10 min
- Buffer: 20 min

---

## 🚦 Ready to Start?

**Commands ready voor**:
1. Launch nieuwe instance
2. Setup script voor nieuwe instance
3. Migration commands
4. Test scripts
5. Cutover scripts

**Zeg het maar!** 💪
