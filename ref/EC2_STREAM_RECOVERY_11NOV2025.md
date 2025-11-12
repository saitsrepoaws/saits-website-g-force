# EC2 Stream Recovery - 11 November 2025

## 🚨 Probleem
Stream was volledig dood na sandbox redeploy.

### Root Cause
1. **Nieuwe EC2 instance** werd gedeployed (instance ID veranderd)
2. **User data script faalde** door IAM permission issue
3. **Services niet opgestart** (Liquidsoap, Icecast)
4. **Missing dependencies** (`jq` niet geïnstalleerd)

---

## 📊 Diagnose

### Instance Status
- **Oude ID**: `i-0174c8094bb791cbc` ❌ (bestaat niet meer)
- **Nieuwe ID**: `i-021451e919d39c898` ✅ (running)
- **IP**: `46.137.184.91` (zelfde Elastic IP)

### User Data Failure
```
AccessDenied when calling ListExports
User: arn:aws:sts::035636364722:assumed-role/amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju/i-021451e919d39c898 
is not authorized to perform: cloudformation:ListExports
```

**Gevolg**: Liquidsoap config niet aangemaakt, services niet gestart.

---

## ✅ Oplossing

### 1. SSH Access Hersteld
```bash
# Public key via SSM geïnstalleerd
aws ssm send-command --instance-ids i-021451e919d39c898 ...

# SSH config updated
Host radio-ec2
    HostName 46.137.184.91
    User ubuntu
    IdentityFile ~/.ssh/ec2-radio-key
```

### 2. Missing Dependencies
```bash
sudo apt-get install -y jq
```

### 3. Liquidsoap Config Aangemaakt
```liquidsoap
# /opt/radio/radio.liq
# SQS queue: https://sqs.eu-west-1.amazonaws.com/035636364722/radio-track-stream-queue
# Downloads tracks from S3, queues them, streams to Icecast
```

### 4. Systemd Service
```bash
# /etc/systemd/system/liquidsoap-radio.service
sudo systemctl enable liquidsoap-radio
sudo systemctl start liquidsoap-radio
```

### 5. Nginx Config
```nginx
# /etc/nginx/sites-available/radio
server {
    listen 80;
    
    location /stream.mp3 {
        proxy_pass http://localhost:8000/stream.mp3;
    }
    
    location /status-json.xsl {
        proxy_pass http://localhost:8000/status-json.xsl;
    }
    
    location / {
        root /var/www/radio;
        index index.html;
    }
}
```

### 6. Homepage Deployed
```bash
aws s3 cp s3://radio-playlists-035636364722/splash-fm-standalone.html /var/www/radio/index.html
```

---

## 🎉 Resultaat

### Services Status
| Service | Status |
|---------|--------|
| Icecast2 | ✅ Active |
| Liquidsoap | ✅ Active |
| Nginx | ✅ Active |

### Stream Status
```
🎵 Now Playing: Greg Gow - Jack Me (Original Mix)
👂 Listeners: 1
🎚️ Bitrate: 192kbps
```

### URLs
- **Homepage**: http://46.137.184.91/
- **Stream**: http://46.137.184.91/stream.mp3
- **Status**: http://46.137.184.91/status-json.xsl

---

## 🔧 Quick Commands

### SSH Access
```bash
ssh radio-ec2
```

### Check Services
```bash
systemctl status icecast2 liquidsoap-radio nginx
```

### View Logs
```bash
# Liquidsoap
sudo tail -f /var/log/liquidsoap/radio.log

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Restart Services
```bash
sudo systemctl restart liquidsoap-radio
sudo systemctl restart icecast2
sudo systemctl reload nginx
```

### Check Stream
```bash
curl -s http://46.137.184.91/status-json.xsl | jq -r '.icestats.source'
```

---

## 📝 Lessons Learned

### Probleem: User Data Script Failure
**Oorzaak**: IAM role mist `cloudformation:ListExports` permission  
**Impact**: Config niet aangemaakt, services niet gestart  
**Oplossing**: Handmatige setup via SSH

### Probleem: Missing Dependencies
**Oorzaak**: `jq` niet in user data install list  
**Impact**: JSON parsing faalde in Liquidsoap  
**Oplossing**: Manual install + add to user data script

### Probleem: Instance ID Change
**Oorzaak**: Sandbox redeploy creëert nieuwe instance  
**Impact**: SSH config outdated, monitoring broken  
**Oplossing**: Check instance ID na elke deploy

---

## 🚀 Toekomstige Improvements

### 1. Fix User Data Script
- [ ] Add `cloudformation:ListExports` permission to IAM role
- [ ] OR hardcode SQS queue URL in user data
- [ ] Add `jq` to apt-get install list
- [ ] Add error handling + logging

### 2. Monitoring
- [ ] CloudWatch alarms for service status
- [ ] Health check endpoint
- [ ] Auto-restart on failure

### 3. Deployment
- [ ] Use CloudFormation/CDK for reproducible setup
- [ ] Store configs in Parameter Store
- [ ] Automated deployment pipeline

### 4. Crossfade (Toekomst)
- [ ] Blijf bij simple crossfade (werkt perfect)
- [ ] Smart mixing via Lambda (BPM, Harmonic, Energy)
- [ ] Full UI control na upgrade naar Ubuntu 24.04

---

## 📋 Recovery Checklist

Voor volgende keer dat stream down is:

1. **Check Instance Status**
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Name,Values=*StreamServer*"
   ```

2. **Get Instance ID**
   ```bash
   NEW_ID=$(aws ec2 describe-instances --query 'Reservations[0].Instances[0].InstanceId' --output text)
   ```

3. **Check Services via SSM**
   ```bash
   aws ssm send-command --instance-ids $NEW_ID --document-name "AWS-RunShellScript" --parameters 'commands=["systemctl status icecast2 liquidsoap-radio nginx"]'
   ```

4. **If SSH Not Working**
   ```bash
   # Install public key via SSM
   PUBLIC_KEY=$(cat ~/.ssh/ec2-radio-key.pub)
   aws ssm send-command --instance-ids $NEW_ID --parameters "commands=[\"echo '$PUBLIC_KEY' >> /home/ubuntu/.ssh/authorized_keys\"]"
   ```

5. **Check Logs**
   ```bash
   ssh radio-ec2 'sudo tail -100 /var/log/liquidsoap/radio.log'
   ```

6. **Verify Stream**
   ```bash
   curl http://46.137.184.91/status-json.xsl | jq
   ```

---

## ⏱️ Timeline

| Time | Action | Result |
|------|--------|--------|
| 12:30 | Stream down discovered | No response from EC2 |
| 12:35 | Instance ID mismatch found | New instance detected |
| 12:40 | SSH key via SSM | Access restored |
| 12:55 | Manual config deployment | Services started |
| 13:10 | `jq` missing discovered | Track fetching failed |
| 13:15 | `jq` installed + restart | Tracks queuing! |
| 13:20 | Nginx config fixed | Public access working |
| 13:25 | Full recovery complete | Stream live with player |

**Total downtime**: ~55 minutes  
**Resolution**: Manual recovery via SSH

---

*Recovery completed: 11 November 2025, 13:25 UTC*  
*New Instance: i-021451e919d39c898*  
*Status: ✅ Fully Operational*
