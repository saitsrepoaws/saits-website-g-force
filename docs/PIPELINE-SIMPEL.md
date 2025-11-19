# 📋 PIPELINE 1 & 2 - SUPER SIMPEL UITGELEGD

---

## 🔵 **PIPELINE 1 (Serverless basis)**

### **Command:**
```bash
npm run sandbox
```

### **Environment:**
```bash
DEPLOY_EC2=false  # of niet gezet
```

### **Wat wordt deployed:**
```
✅ Cognito (authentication)
✅ DynamoDB (10 tables)
✅ Lambda (21+ functions)
✅ S3 (storage bucket)
✅ SQS (FIFO queue)
✅ AppSync (GraphQL API)
✅ IoT Core (MQTT topics)
✅ CloudWatch (monitoring)
✅ Parameter Store (config)

❌ EC2 (NIET deployed!)
```

### **Resultaat:**
- Complete serverless backend ✅
- Upload tracks werkt ✅
- Playlists werken ✅
- API werkt ✅
- Queue vult zich ✅
- MAAR: Geen streaming server ❌
- MAAR: Geen live radio ❌

### **Kosten:**
~$25-50/maand

---

## 🟢 **PIPELINE 2 (Basis + EC2 streaming)**

### **Command:**
```bash
DEPLOY_EC2=true npm run sandbox
```

### **Environment:**
```bash
DEPLOY_EC2=true  # ALTIJD true voor Pipeline 2!
```

### **Wat wordt deployed:**
```
✅ Cognito (authentication)
✅ DynamoDB (10 tables)
✅ Lambda (21+ functions)
✅ S3 (storage bucket)
✅ SQS (FIFO queue)
✅ AppSync (GraphQL API)
✅ IoT Core (MQTT topics)
✅ CloudWatch (monitoring)
✅ Parameter Store (config)

✅ EC2 (t3.small, Ubuntu 22.04)
✅ Elastic IP (fixed public IP)
✅ Security Group (firewall)
✅ IAM Role (permissions)
```

### **Resultaat:**
- Complete serverless backend ✅
- Upload tracks werkt ✅
- Playlists werken ✅
- API werkt ✅
- Queue vult zich ✅
- EC2 server draait ✅
- MAAR: Software nog NIET geïnstalleerd ❌
- MAAR: Nog GEEN live radio ❌

### **Extra stap nodig:**
```bash
# Connect via SSM
aws ssm start-session --target i-xxxxx

# Run script
bash ec2-complete-install.sh

# Wacht 10-15 minuten
# ✅ Dan: Live radio! 🎙️
```

### **Kosten:**
~$42-292/maand (basis + EC2)

---

## 📊 **VERGELIJKING**

| Component | Pipeline 1 | Pipeline 2 |
|-----------|------------|------------|
| Cognito | ✅ | ✅ |
| DynamoDB | ✅ | ✅ |
| Lambda | ✅ | ✅ |
| S3 | ✅ | ✅ |
| SQS | ✅ | ✅ |
| AppSync | ✅ | ✅ |
| IoT Core | ✅ | ✅ |
| CloudWatch | ✅ | ✅ |
| **EC2** | ❌ | ✅ |
| **Streaming** | ❌ | ✅* |

*Na manual software installatie

---

## 🎯 **SIMPELE REGELS**

### **Pipeline 1:**
- Command: `npm run sandbox`
- Deploy: Basis (serverless)
- Result: Backend werkt, geen streaming

### **Pipeline 2:**
- Command: `DEPLOY_EC2=true npm run sandbox`
- Deploy: Basis + EC2 (in één sandbox)
- Result: Backend + EC2, nog geen streaming
- Extra: Manual `ec2-complete-install.sh` run
- Final: Backend + streaming! 🎙️

---

## 💡 **CRITICAL:**

```
Pipeline 1 = ALLEEN basis (geen EC2)
Pipeline 2 = Basis + EC2 (samen in nieuwe sandbox)

Pipeline 2 ≠ Toevoegen aan bestaande
Pipeline 2 = Nieuwe sandbox met alles (basis + EC2)
```

---

## 🚀 **DEPLOYMENT FLOW**

### **Pipeline 1:**
```
1. npm run sandbox
2. Wacht 5-7 minuten
3. ✅ Klaar! Backend werkt
```

### **Pipeline 2:**
```
FASE 1 (Automatic):
1. DEPLOY_EC2=true npm run sandbox
2. Wacht 5-7 minuten
3. ✅ Backend + EC2 klaar

FASE 2 (Manual):
4. aws ssm start-session --target i-xxxxx
5. bash ec2-complete-install.sh
6. Wacht 10-15 minuten
7. ✅ Live radio! 🎙️
```

---

## 📝 **SAMENVATTING**

**Pipeline 1:**
- Serverless only
- Geen streaming
- ~$25-50/maand

**Pipeline 2:**
- Serverless + EC2
- Live streaming (na manual setup)
- ~$42-292/maand

**Pipeline 2 = Pipeline 1 + EC2 in dezelfde nieuwe sandbox!**

---

**Built with ❤️ by Gerard & Cascade**
