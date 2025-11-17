# 🎵 G-FORGE RADIO PLATFORM - TECHNICAL PITCH
## Part 1: Overview & Architecture

---

## 📋 EXECUTIVE SUMMARY

**G-Forge Radio Platform** is a fully automated, cloud-native radio streaming platform built on AWS.

### Key Features
- ✅ **24/7 Automated Radio Stream** with scheduled programming
- ✅ **100% Stateless CI/CD Pipeline** with branch-based deployments  
- ✅ **Real-time IoT Metadata** streaming to web players
- ✅ **AI-Powered Track Library** with automatic audio analysis
- ✅ **Professional Audio Processing** with Stereo Tool integration
- ✅ **Multi-Platform Player** (Web, Mobile, IoT devices)
- ✅ **Zero-Downtime Deployments** with AWS CodeDeploy
- ✅ **Comprehensive Monitoring** with CloudWatch & IoT

### Current Status
- **Development:** 🟢 LIVE (deployment in progress)
- **Production:** ⏸️ Ready (instance stopped for cost optimization)

### Tech Stack
AWS (IoT, Amplify, Lambda, S3, DynamoDB, EC2, CodeDeploy), Liquidsoap 2.4.0, Icecast2, React, TypeScript, TailwindCSS

---

## 🏗️ SYSTEM ARCHITECTURE

### Component Overview

```
USER LAYER
├── Web Player (React + IoT WebSocket)
├── Mobile App (planned)
└── IoT Devices (Amazon Echo, Google Home)
    ↓
CDN LAYER
└── AWS CloudFront (< 500ms latency, SSL/TLS)
    ↓
STREAMING LAYER (EC2)
├── Nginx (Reverse Proxy + Buffering)
├── Icecast2 (Stream Distribution: /stream.mp3)
├── Liquidsoap 2.4.0 (Automation + SQS Polling)
└── Stereo Tool (Professional Audio Processing)
    ↓
METADATA LAYER
├── AWS IoT Core (real-time pub/sub)
└── Device Shadow (< 50ms instant metadata)
    ↓
CONTENT LAYER
├── Lambda: stream-playlist-updater (hourly)
├── SQS FIFO Queue (track ordering)
└── S3: Track Storage
    ↓
DATA LAYER
├── DynamoDB (Track, Schedule, Playlist)
├── Lambda: Audio Analysis (3-stage pipeline)
└── GraphQL API (AWS Amplify)
    ↓
WEB APPLICATION
└── React + TypeScript + Amplify Hosting
```

---

## 🚀 DEVOPS STRATEGY

### 100% Stateless Branch-Based Pipeline

**Innovation:** All configuration in AWS Parameter Store, no hardcoded values!

#### Key Principles

1. **Branch = Environment**
   - `main` → Production
   - `development` → Development sandbox
   - `feature/*` → Optional feature sandboxes

2. **Parameter Store Structure**
```
/g-forge-radio/
├── production/
│   ├── instance-id
│   ├── data-volume-id
│   ├── codedeploy-app
│   ├── deployment-group
│   └── s3-bucket
└── development/
    ├── instance-id
    ├── data-volume-id
    └── (same structure)
```

3. **One-Command Deployment**
```bash
./deploy_streamserver <environment>
```

#### Deployment Lifecycle (CodeDeploy)

```
ApplicationStop (< 1s)
   ↓ Stop Nginx (keep stream alive!)
DownloadBundle (~6s)
   ↓ Download from S3
BeforeInstall (20-30 min on fresh instance)
   ├── OS security updates
   ├── Install Docker
   ├── Install Liquidsoap 2.4.0 (from source)
   ├── Install Icecast2, Nginx
   └── Install AWS CLI & agents
Install (< 1 min)
   ↓ Copy files to /opt/radio
AfterInstall (~2 min)
   ├── Configure services
   ├── Attach & mount data volume
   └── Setup systemd
ApplicationStart (~1 min)
   ├── Start Icecast2
   ├── Start Liquidsoap
   └── Start Nginx
ValidateService (~30s)
   └── Health checks
```

### Zero-Downtime Strategy
- Icecast & Liquidsoap **keep running** during deployment
- Only Nginx stops briefly (< 1 second)
- Stream buffer prevents audio gaps
- Listeners experience seamless transition

---

## 🔒 SECURITY ARCHITECTURE

### 1. Network Security
- **VPC:** `vpc-0a8e5c55ce96e6e5c` (isolated network)
- **Security Group:** Only ports 22, 80, 8000 allowed
- **No direct SSH:** SSM Session Manager only
- **CloudFront SSL/TLS:** All traffic encrypted

### 2. IAM Security (Least Privilege)
- **EC2 Instance Profile:** StreamServerProfile
  - S3 read/write (deployment bucket only)
  - SQS read/delete (queue polling)
  - IoT publish (metadata)
  - Parameter Store read (config)
  - CloudWatch logs write
  - ❌ NO admin permissions
- **CodeDeploy Service Role:** Limited to deployment operations
- **IoT Policies:** Separate for EC2 (write) and web (read)

### 3. Secrets Management
- ✅ AWS credentials: IAM roles (no keys!)
- ✅ GitHub PAT: Local git config only
- ✅ Environment files: `.gitignore` protected
- ✅ Database: DynamoDB fine-grained access

### 4. Data Security
- **At Rest:** S3, EBS, DynamoDB all encrypted (AES-256)
- **In Transit:** TLS 1.2+ for all connections
- **Backups:** Daily EBS snapshots, S3 versioning, DynamoDB PITR

### 5. Operational Security
- **Monitoring:** CloudWatch alarms (CPU, deployment failures, stream downtime)
- **Logging:** All services → CloudWatch Logs (7-day retention)
- **Incident Response:** Security incident report template created
- **Audit Trail:** CloudTrail enabled for all API calls

---

## 🏷️ TAGGING STRATEGY

### Tag Schema

**Common Tags (All Resources):**
```yaml
Project: g-forge-radio
ManagedBy: codedeploy
Owner: gerard@g-forge.com
```

**Environment-Specific:**
```yaml
Environment: [production | development]
Purpose: [streaming | deployment | storage]
```

**Deployment & Cost:**
```yaml
DeploymentGroup: [radio-production | radio-development]
BackupSchedule: [daily | weekly | none]
ScheduledShutdown: [yes | no]
```

### Usage
- **Cost Allocation:** Track costs per environment
- **Automation:** CodeDeploy uses `Environment` tag
- **Cleanup:** Identify unused resources
- **Compliance:** Track resource ownership

---

## 📊 TECHNICAL SPECIFICATIONS

### Infrastructure

#### EC2 Instances

**Production:**
- Type: t3.medium (2 vCPU, 4 GB RAM)
- AMI: Ubuntu 24.04 LTS
- Storage: 8 GB root + 20 GB data (gp3)
- Region: eu-west-1 (Ireland)
- Instance: i-053c03b188282f1bd
- Status: **STOPPED** (ready for launch)

**Development:**
- Type: t3.medium (2 vCPU, 4 GB RAM)
- AMI: Ubuntu 24.04 LTS
- Storage: 8 GB root + 20 GB data (gp3)
- Instance: i-0924372740ff587ca
- IP: 18.203.103.225
- Status: **RUNNING** ✅

#### Storage
- **EBS:** 2 × 20 GB gp3 (3000 IOPS, 125 MB/s)
- **S3:** Deployment artifacts + track library (~10 GB)
- **Encryption:** All volumes encrypted

#### Networking
- **VPC:** vpc-0a8e5c55ce96e6e5c
- **Subnet:** subnet-0cdb078c275014e24
- **Security Group:** sg-005c8d71776faf97b
- **Domain:** splashfm.nl (production)
- **Dev IP:** 18.203.103.225

### Software Stack

#### Streaming Server
- **Liquidsoap 2.4.0:** Audio automation (SQS polling, crossfading, metadata)
- **Icecast2 2.4.4:** Stream distribution (192 kbps MP3, 44.1 kHz stereo)
- **Nginx 1.24:** Reverse proxy + SSL/TLS
- **Stereo Tool:** Professional audio processing (EBU R128, 5-band compression)

#### Backend Services
- **Lambda Functions:**
  - `stream-playlist-updater`: Hourly playlist management
  - `audio-analysis-pipeline`: 3-stage track analysis (metadata, cover, waveform)
- **AWS IoT Core:** Real-time metadata (topic + device shadow)
- **SQS FIFO:** Track queue with strict ordering
- **DynamoDB:** Track, Schedule, Playlist, DJ, Station tables

#### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS + shadcn/ui
- **State:** React hooks + Context
- **GraphQL:** AWS Amplify Data client
- **IoT:** AWS IoT SDK for JavaScript
- **Hosting:** AWS Amplify Hosting (Gen 2)

---

## 💰 COST ANALYSIS

### Monthly Costs (Estimated)

| Category | Cost |
|----------|------|
| EC2 (production + dev) | $40 |
| Lambda executions | $5 |
| EBS volumes | $4 |
| S3 storage + requests | $0.30 |
| CloudFront (100 GB) | $8.50 |
| EC2 data transfer | $5 |
| IoT Core + SQS | $0.02 |
| DynamoDB (on-demand) | $2 |
| CloudWatch Logs | $1 |
| **TOTAL** | **~$66/month** |

### Cost Optimization
- ✅ Reserved Instances: Save 30-50% on EC2
- ✅ Spot Instances: Save 50-70% for dev
- ✅ Dev auto-shutdown: Save ~$5/month
- ✅ S3 Lifecycle: Move old artifacts to Glacier
- **Potential Savings: $20-25/month (30-40%)**

---

**Continue to Part 2 for: Features, Roadmap, and Implementation Status**

