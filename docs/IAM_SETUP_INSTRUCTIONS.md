# 🔐 IAM CloudWatch Permissions Setup

## ⚠️ **VEREIST VOOR MONITORING SETUP**

De EC2 instance heeft CloudWatch permissions nodig om logs en metrics te kunnen publiceren.

---

## 📋 **HANDMATIGE SETUP (5 minuten)**

### Stap 1: Open IAM Console
```
https://console.aws.amazon.com/iam/home?region=eu-west-1#/roles
```

### Stap 2: Zoek de EC2 Role
Role naam: `amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju`

**Of zoek via:**
1. Filter op "StreamServerRole"
2. Klik op de role

### Stap 3: Voeg Inline Policy toe
1. Klik op tab "Permissions"
2. Klik op "Add permissions" → "Create inline policy"
3. Klik op tab "JSON"
4. Kopieer de policy uit `docs/IAM_CLOUDWATCH_POLICY.json`
5. Plak in de JSON editor
6. Klik "Review policy"
7. Policy naam: `StreamServerCloudWatchAccess`
8. Klik "Create policy"

**✅ Klaar!** De EC2 kan nu logs en metrics publiceren.

---

## 🤖 **AUTOMATISCHE SETUP (via AWS CLI)**

**⚠️ Vereist IAM permissions om roles te wijzigen**

```bash
# Vanuit project root:
aws iam put-role-policy \
  --role-name amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju \
  --policy-name StreamServerCloudWatchAccess \
  --policy-document file://docs/IAM_CLOUDWATCH_POLICY.json \
  --region eu-west-1
```

---

## ✅ **VERIFICATIE**

Na het toevoegen van de policy:

```bash
# Check of policy is toegevoegd:
aws iam list-role-policies \
  --role-name amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju \
  --region eu-west-1
```

Expected output:
```
{
    "PolicyNames": [
        "StreamServerCloudWatchAccess",
        "StreamServerSQSAccess"
    ]
}
```

---

## 🚀 **NA POLICY TOEVOEGEN**

Run de monitoring setup:

```bash
# Op je lokale machine:
bash scripts/setup-complete-monitoring.sh
```

**Of direct op EC2:**

```bash
curl -sSL https://raw.githubusercontent.com/saitsrepoaws/saits-website-g-force/development/scripts/setup-cloudwatch-logging.sh | bash
```

---

## 📊 **WAT DEZE POLICY TOESTAAT**

### CloudWatch Logs:
✅ Aanmaken van log groups en streams  
✅ Schrijven van logs  
✅ Instellen van retention (30 dagen)  
✅ Opvragen van logs

### CloudWatch Metrics:
✅ Publiceren van custom metrics  
✅ Opvragen van metric statistieken  
✅ Namespace: `GForgeRadio/StreamServer`

### EC2 Metadata:
✅ Opvragen van instance info  
✅ Opvragen van volume info  
✅ Opvragen van tags

---

## 🔒 **SECURITY**

- **Resource restriction:** Alleen `/g-forge-radio/*` log groups
- **Namespace restriction:** Alleen `GForgeRadio/StreamServer` metrics
- **Least privilege:** Alleen benodigde acties toegestaan
- **No wildcards:** Specifieke resources waar mogelijk

---

## 💡 **WAAROM DEZE PERMISSIONS?**

| Permission | Doel |
|------------|------|
| `logs:CreateLogGroup` | Aanmaken van log groups voor Docker, Liquidsoap, etc. |
| `logs:CreateLogStream` | Aanmaken van log streams per container/service |
| `logs:PutLogEvents` | Schrijven van log entries (real-time!) |
| `logs:PutRetentionPolicy` | Instellen van 30 dagen retention |
| `cloudwatch:PutMetricData` | Publiceren van CPU, Memory, Disk metrics |
| `ec2:DescribeInstances` | Instance ID opvragen voor log stream namen |

---

## 🆘 **TROUBLESHOOTING**

### Error: "User is not authorized to perform: iam:PutRolePolicy"
**Oplossing:** Gebruik handmatige setup via AWS Console

### Error: "AccessDeniedException... logs:PutRetentionPolicy"
**Oorzaak:** Policy nog niet toegevoegd  
**Oplossing:** Volg stappen hierboven om policy toe te voegen

### Policy niet zichtbaar in role
**Check:** Klik op "Refresh" in IAM console  
**Check:** Zorg dat je in de juiste AWS region bent (eu-west-1)

---

## 📝 **VOLGENDE STAPPEN**

Na het toevoegen van de IAM policy:

1. ✅ Run CloudWatch setup script
2. ✅ Verifieer dat log groups zijn aangemaakt
3. ✅ Check dat logs verschijnen in CloudWatch
4. ✅ Setup monitoring alarms
5. ✅ Create CloudWatch dashboard
6. ✅ Subscribe to SNS for email alerts

**Zie:** `docs/CLOUDWATCH_MONITORING_SETUP.md` voor complete guide

---

**Laatst bijgewerkt:** 17 November 2025  
**Versie:** 1.0  
**Status:** Required ⚠️
