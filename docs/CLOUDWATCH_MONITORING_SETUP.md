# 📊 CloudWatch Monitoring Setup - G-Forge Radio

**Complete AWS monitoring infrastructure voor production-ready streaming platform**

---

## 🎯 Overzicht

Dit document beschrijft de complete CloudWatch monitoring setup voor de G-Forge Radio stream server, inclusief:

- **Hierarchische log groups** voor alle componenten
- **Real-time metrics** in custom namespace
- **Performance alarms** (CPU, Memory, Disk)
- **Cost monitoring** met budgets en alerts
- **Security monitoring** voor auth events
- **CloudWatch Dashboard** voor real-time visibility
- **VERBOSE logging mode** voor maximum detail

---

## 📁 Log Groups Structuur

```
/g-forge-radio/stream-server/                    ← Hoofdgroep
│
├── /g-forge-radio/stream-server/docker/         ← Docker daemon + containers
│   ├── liquidsoap logs
│   ├── icecast logs
│   └── nginx logs
│
├── /g-forge-radio/stream-server/liquidsoap/     ← Liquidsoap specifiek
│   ├── Application logs
│   ├── Debug output
│   └── Audio processing logs
│
├── /g-forge-radio/stream-server/icecast/        ← Icecast specifiek
│   ├── Access logs
│   ├── Error logs
│   └── Stream status
│
├── /g-forge-radio/stream-server/nginx/          ← Nginx specifiek
│   ├── Access logs
│   ├── Error logs
│   └── Proxy logs
│
├── /g-forge-radio/stream-server/system/         ← System logs
│   └── syslog
│
├── /g-forge-radio/stream-server/deployment/     ← Deployment logs
│   └── CodeDeploy agent
│
├── /g-forge-radio/stream-server/security/       ← Security events
│   └── auth.log (failed logins, sudo, etc.)
│
└── /g-forge-radio/stream-server/performance/    ← Custom performance metrics
    └── Application-specific metrics
```

**Retention:** 30 dagen voor alle log groups  
**Mode:** VERBOSE (maximum detail!)

---

## 📈 Metrics Namespace

**Namespace:** `GForgeRadio/StreamServer`

### Custom Metrics:
- `CPU_IDLE` - CPU idle percentage
- `CPU_IOWAIT` - CPU waiting for I/O
- `MEM_USED` - Memory usage percentage
- `DISK_USED` - Disk usage percentage (per volume)
- `DISK_IO_TIME` - Disk I/O time in milliseconds
- `TCP_CONNECTIONS` - Active TCP connections
- `SWAP_USED` - Swap usage percentage

### Collection Interval:
- 60 seconden (1 minuut)
- Real-time visibility met minimale overhead

---

## 🚨 CloudWatch Alarms

### Performance Alarms:

| Alarm | Metric | Threshold | Period | Action |
|-------|--------|-----------|--------|--------|
| High CPU | CPUUtilization | >80% | 5 min | SNS Alert |
| High Memory | MEM_USED | >85% | 5 min | SNS Alert |
| High Root Disk | DISK_USED (/) | >90% | 5 min | SNS Alert |
| High Data Disk | DISK_USED (/data) | >80% | 5 min | SNS Alert |
| Status Check Failed | StatusCheckFailed | ≥1 | 2 checks | SNS Alert |

### Alarm Actions:
- **SNS Topic:** `g-forge-radio-alerts`
- **Notification:** Email (na subscribe)
- **Auto-resolve:** Ja, wanneer metric terugkeert naar normale waarden

---

## 💰 Cost Monitoring

### AWS Budget:
- **Name:** `g-forge-radio-monthly-budget`
- **Limit:** $50/maand
- **Type:** Cost budget
- **Filters:** Tag `Project=g-forge-radio`

### Budget Alerts:
1. **80% Alert** → Bij $40 uitgaven
2. **100% Alert** → Bij $50 uitgaven (budget bereikt)

### Notifications:
- SNS topic: `g-forge-radio-alerts`
- Type: ACTUAL costs (niet forecast)

---

## 📊 CloudWatch Dashboard

**Dashboard Name:** `GForgeRadio-StreamServer`

### Widgets:

1. **CPU & Memory Usage**
   - Line graph, 5 min intervals
   - Y-axis: 0-100%
   
2. **Disk Usage**
   - Line graph voor root (/) en data (/data) volumes
   - Y-axis: 0-100%

3. **Network Traffic**
   - NetworkIn en NetworkOut
   - Sum per 5 min

4. **Liquidsoap Logs**
   - Recent 100 log entries
   - Real-time updates

5. **Icecast Logs**
   - Recent 100 log entries
   - Real-time updates

6. **Security Events**
   - Failed login attempts
   - Filtered op "Failed" keyword
   - Recent 50 events

---

## 🔐 IAM Permissions

### EC2 Role Permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:eu-west-1:*:log-group:/g-forge-radio/*"
      ]
    },
    {
      "Sid": "CloudWatchMetricsAccess",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "GForgeRadio/StreamServer"
        }
      }
    },
    {
      "Sid": "EC2MetadataAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVolumes",
        "ec2:DescribeTags",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 🛠️ Installatie Scripts

### 1. IAM Permissions Update
```bash
bash scripts/update-iam-cloudwatch-permissions.sh
```
- Voegt CloudWatch permissions toe aan EC2 role
- Vereist: IAM permissies voor policy updates

### 2. CloudWatch Logging Setup
```bash
bash scripts/setup-cloudwatch-logging.sh
```
- Creëert alle log groups
- Installeert CloudWatch Agent
- Configureert Docker logging driver
- Start log streaming

**Duurtijd:** ~5-8 minuten

### 3. Monitoring & Alarms Setup
```bash
bash scripts/setup-monitoring-alarms.sh
```
- Creëert SNS topic voor alerts
- Configureert performance alarms
- Setup cost budget
- Creëert CloudWatch dashboard

**Duurtijd:** ~2-3 minuten

### 4. Complete Setup (Alles in 1x)
```bash
bash scripts/setup-complete-monitoring.sh
```
- Uitvoert alle stappen in correcte volgorde
- Interactieve bevestiging
- Complete verificatie

**Duurtijd:** ~10-15 minuten totaal

---

## 📧 Email Notificaties Setup

### Stap 1: Haal SNS Topic ARN op
```bash
aws sns list-topics \
  --region eu-west-1 \
  --query "Topics[?contains(TopicArn, 'g-forge-radio-alerts')].TopicArn" \
  --output text
```

### Stap 2: Subscribe met je email
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:ACCOUNT_ID:g-forge-radio-alerts \
  --protocol email \
  --notification-endpoint jouw-email@example.com \
  --region eu-west-1
```

### Stap 3: Bevestig subscription
- Check je inbox voor bevestigings-email van AWS
- Klik op "Confirm subscription" link
- Je ontvangt nu alle alerts!

---

## 🐳 Docker Logging Configuratie

### Docker Daemon Config (`/etc/docker/daemon.json`):
```json
{
  "data-root": "/data/docker",
  "log-driver": "awslogs",
  "log-opts": {
    "awslogs-region": "eu-west-1",
    "awslogs-group": "/g-forge-radio/stream-server/docker",
    "tag": "{{.Name}}/{{.ID}}"
  }
}
```

### Docker Compose Logging:
```yaml
services:
  liquidsoap:
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "eu-west-1"
        awslogs-group: "/g-forge-radio/stream-server/liquidsoap"
        awslogs-stream: "container"
```

**Voordelen:**
- Logs blijven beschikbaar na container restart
- Centralized logging in CloudWatch
- Geen disk space problemen (logs niet op EC2!)
- Real-time log streaming

---

## 🔍 CloudWatch Logs Insights Queries

### Recent Errors (alle componenten):
```sql
fields @timestamp, @message
| filter @message like /ERROR|FATAL|Exception/
| sort @timestamp desc
| limit 100
```

### Stream Performance:
```sql
SOURCE '/g-forge-radio/stream-server/liquidsoap'
| fields @timestamp, @message
| filter @message like /bitrate|buffer|latency/
| sort @timestamp desc
| limit 50
```

### Failed Login Attempts:
```sql
SOURCE '/g-forge-radio/stream-server/security'
| fields @timestamp, @message
| filter @message like /Failed password/
| stats count() by bin(5m)
```

### Docker Container Restarts:
```sql
SOURCE '/g-forge-radio/stream-server/docker'
| fields @timestamp, @message
| filter @message like /restart|stopped|started/
| sort @timestamp desc
```

---

## 💡 Best Practices

### 1. Log Levels
- **VERBOSE mode** tijdens development/testing
- **INFO mode** voor production (optioneel)
- **DEBUG mode** alleen bij troubleshooting

### 2. Cost Optimization
- 30 dagen retention (balans tussen kosten & troubleshooting)
- Log sampling voor zeer verbose componenten (optioneel)
- Archive naar S3 voor long-term storage (optioneel)

### 3. Alerting
- Email alerts voor critical issues
- Slack/Teams integratie mogelijk via Lambda
- PagerDuty integratie voor on-call engineers

### 4. Monitoring Dashboard
- Pin dashboard in CloudWatch favorites
- Mobile app beschikbaar voor on-the-go monitoring
- Custom widgets toevoegen naar behoefte

---

## 📊 Cost Breakdown

### CloudWatch Logs:
- **Ingestion:** $0.50 per GB
- **Storage:** $0.03 per GB/maand
- **Geschat:** ~1-2 GB/maand = **$2-3/maand**

### CloudWatch Metrics:
- **Custom metrics:** $0.30 per metric/maand
- **API requests:** $0.01 per 1000 requests
- **Geschat:** 6 custom metrics = **$2/maand**

### CloudWatch Alarms:
- **Standard alarms:** $0.10 per alarm/maand
- **Geschat:** 5 alarms = **$0.50/maand**

### CloudWatch Dashboard:
- **First 3:** Gratis
- **Extra dashboards:** $3/maand each
- **Geschat:** 1 dashboard = **Gratis**

### SNS:
- **Email notifications:** $0 (gratis tier)
- **Geschat:** **Gratis**

### AWS Budgets:
- **First 2 budgets:** Gratis
- **Geschat:** 1 budget = **Gratis**

**TOTAAL CLOUDWATCH KOSTEN:** ~$4-6/maand

---

## 🎯 Verificatie Checklist

Na setup, verifieer:

- [ ] Alle 8 log groups aangemaakt
- [ ] CloudWatch Agent draait op EC2
- [ ] Docker logging driver = awslogs
- [ ] Logs verschijnen in CloudWatch (binnen 1-2 min)
- [ ] Alle 5 alarms actief
- [ ] SNS topic aangemaakt
- [ ] Email subscription bevestigd
- [ ] Cost budget actief
- [ ] Dashboard zichtbaar in console
- [ ] Custom metrics gepubliceerd
- [ ] Container logs streamen

---

## 🔗 Nuttige Links

- **CloudWatch Console:** https://eu-west-1.console.aws.amazon.com/cloudwatch/
- **Logs:** https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups
- **Dashboard:** https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#dashboards:name=GForgeRadio-StreamServer
- **Alarms:** https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#alarmsV2:
- **Budgets:** https://console.aws.amazon.com/billing/home#/budgets

---

## 🆘 Troubleshooting

### Logs verschijnen niet in CloudWatch:

1. **Check CloudWatch Agent status:**
   ```bash
   /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a query -m ec2 -c default
   ```

2. **Check IAM permissions:**
   ```bash
   aws iam get-role-policy \
     --role-name <ROLE_NAME> \
     --policy-name StreamServerCloudWatchAccess
   ```

3. **Check Docker logging driver:**
   ```bash
   docker info | grep "Logging Driver"
   ```

### Alarms triggeren niet:

1. **Check alarm state:**
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-names "GForgeRadio-HighCPU-<INSTANCE_ID>"
   ```

2. **Check SNS subscription:**
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn <TOPIC_ARN>
   ```

### High CloudWatch costs:

1. **Check log ingestion:**
   ```bash
   aws logs describe-log-groups \
     --log-group-name-prefix "/g-forge-radio/" \
     --query 'logGroups[].storedBytes'
   ```

2. **Adjust retention policy:**
   ```bash
   aws logs put-retention-policy \
     --log-group-name <LOG_GROUP> \
     --retention-in-days 7
   ```

---

## 📝 Conclusie

Met deze complete CloudWatch monitoring setup heb je:

✅ **Real-time visibility** in alle componenten  
✅ **Proactive alerting** bij problemen  
✅ **Cost monitoring** voor budget controle  
✅ **Security monitoring** voor unauthorized access  
✅ **Hierarchische log structuur** voor easy navigation  
✅ **VERBOSE logging** voor maximum troubleshooting detail  
✅ **Production-ready** monitoring infrastructure  

**Kosten:** ~$4-6/maand (zeer betaalbaar!)  
**Voordeel:** Onbetaalbaar! 🚀

---

**Laatst bijgewerkt:** 17 November 2025  
**Versie:** 1.0  
**Status:** Production Ready ✅
