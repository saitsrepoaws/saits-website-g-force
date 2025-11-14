# 📚 G-Forge IoT - Documentation Index

**Last Updated:** 13 November 2025  
**Version:** 1.0.0  
**Status:** 🟡 In Progress

---

## 🎯 Quick Links

- [Tech Stack](./TECH_STACK.md) - Complete technology overview
- [Functional Overview](./architecture/FUNCTIONAL_OVERVIEW.md) - What the system does
- [Technical Architecture](./architecture/TECHNICAL_ARCHITECTURE.md) - How it works
- [Deployment Guide](./operations/DEPLOYMENT.md) - How to deploy
- [Runbook](./operations/RUNBOOK.md) - Day-to-day operations

---

## 📁 Documentation Structure

### 🏗️ Architecture
High-level system design and component interactions

| Document | Status | Description |
|----------|--------|-------------|
| [Functional Overview](./architecture/FUNCTIONAL_OVERVIEW.md) | 🔴 TODO | Business objectives and use cases |
| [Technical Architecture](./architecture/TECHNICAL_ARCHITECTURE.md) | 🔴 TODO | System architecture and data flow |
| [System Diagrams](./architecture/SYSTEM_DIAGRAMS.md) | 🔴 TODO | Visual architecture diagrams |

### 💾 Database
Database schemas, access patterns, and optimization

| Document | Status | Description |
|----------|--------|-------------|
| [DynamoDB Schema](./database/DYNAMODB_SCHEMA.md) | 🔴 TODO | All table structures and indexes |
| [Access Patterns](./database/ACCESS_PATTERNS.md) | 🔴 TODO | Query patterns and performance |

### 🔌 API
API reference and integration guides

| Document | Status | Description |
|----------|--------|-------------|
| [API Reference](./api/API_REFERENCE.md) | 🔴 TODO | Complete API documentation |
| [GraphQL Schema](./api/GRAPHQL_SCHEMA.md) | 🔴 TODO | GraphQL types and queries |

### 📻 Streaming
Radio streaming infrastructure and configuration

| Document | Status | Description |
|----------|--------|-------------|
| [Radio Stack](./streaming/RADIO_STACK.md) | 🟡 Partial | Complete streaming architecture |
| [Hybrid SQS Streaming](./streaming/HYBRID_SQS_STREAMING.md) | 🟢 NEW | Active plan - Just-in-time track streaming |
| [M3U System (DEPRECATED)](./streaming/M3U_SYSTEM_DEPRECATED.md) | ⚠️ DEPRECATED | Old system being replaced |
| [Liquidsoap Config](./streaming/LIQUIDSOAP_CONFIG.md) | 🔴 TODO | Liquidsoap setup and scripts |
| [Stereo Tool Setup](./streaming/STEREO_TOOL_SETUP.md) | 🟡 Partial | Audio processing configuration |

### ☁️ Infrastructure
AWS resources and infrastructure as code

| Document | Status | Description |
|----------|--------|-------------|
| [AWS Resources](./infrastructure/AWS_RESOURCES.md) | 🔴 TODO | Complete AWS resource inventory |
| [Lambda Functions](./infrastructure/LAMBDA_FUNCTIONS.md) | 🔴 TODO | All Lambda functions reference |
| [EC2 Setup](./infrastructure/EC2_SETUP.md) | 🔴 TODO | EC2 instance configuration |

### ⚙️ Operations
Deployment, monitoring, and troubleshooting

| Document | Status | Description |
|----------|--------|-------------|
| [Deployment Guide](./operations/DEPLOYMENT.md) | 🔴 TODO | Step-by-step deployment |
| [Runbook](./operations/RUNBOOK.md) | 🔴 TODO | Operational procedures |
| [Monitoring](./operations/MONITORING.md) | 🔴 TODO | Monitoring and alerting setup |
| [Cost Optimization](./operations/COST_OPTIMIZATION.md) | 🔴 TODO | Cost management strategies |

### 🔒 Security
Security policies and best practices

| Document | Status | Description |
|----------|--------|-------------|
| [Security Guide](./security/SECURITY.md) | 🔴 TODO | Security architecture and policies |
| [IAM Policies](./security/IAM_POLICIES.md) | 🔴 TODO | IAM roles and permissions |

### 🚀 Onboarding
Getting started guides for new team members

| Document | Status | Description |
|----------|--------|-------------|
| [Getting Started](./onboarding/GETTING_STARTED.md) | 🔴 TODO | Quick start guide |
| [Development Setup](./onboarding/DEVELOPMENT_SETUP.md) | 🔴 TODO | Local development environment |

---

## 📊 System Overview

### What is G-Forge IoT?

G-Forge IoT is a cloud-based radio automation platform that combines IoT device management with professional audio streaming. It enables:

- **Track Management** - Upload, analyze, and organize audio tracks
- **Playlist Scheduling** - Create and schedule playlists by day/hour
- **Professional Streaming** - High-quality audio processing with Stereo Tool
- **Web Player** - Real-time web player with track metadata
- **Device Management** - Control streaming devices remotely

### Key Features

✅ **Automated Track Analysis** - Extracts metadata, waveforms, and audio features  
✅ **Smart Scheduling** - Hourly playlist rotation with timezone support  
✅ **Professional Audio** - Stereo Tool processing for broadcast-quality sound  
✅ **Real-time Streaming** - Icecast server with multiple mount points  
✅ **Web Interface** - Modern React UI with real-time updates  
✅ **Scalable Architecture** - Serverless AWS infrastructure  

---

## 🛠️ Tech Stack Summary

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** TailwindCSS
- **State:** React Query
- **UI Components:** Radix UI, Lucide Icons

### Backend
- **Framework:** AWS Amplify Gen 2
- **Compute:** AWS Lambda (Node.js 18)
- **Database:** DynamoDB
- **Storage:** S3
- **Queues:** SQS (FIFO)
- **Scheduling:** EventBridge

### Streaming
- **Server:** EC2 (t3.medium, Ubuntu 22.04)
- **Audio Source:** Liquidsoap 2.x
- **Streaming Server:** Icecast 2
- **Processing:** Stereo Tool Professional
- **Web Server:** Nginx

### DevOps
- **Version Control:** GitHub
- **IaC:** AWS CDK (via Amplify Gen 2)
- **Deployment:** AWS Amplify CLI
- **Monitoring:** CloudWatch
- **Package Manager:** pnpm

---

## 📈 Current Status

### Implemented Features
- ✅ Track upload with metadata extraction
- ✅ Waveform generation
- ✅ Playlist management (CRUD)
- ✅ Schedule management (day/hour slots)
- ✅ Automated playlist updates (hourly Lambda)
- ✅ Radio streaming with Liquidsoap + Icecast
- ✅ Stereo Tool audio processing
- ✅ Web player with real-time metadata
- ✅ Device settings management

### In Progress
- 🟡 Cover art metadata integration (Lambda done, Liquidsoap pending)
- 🟡 News bulletin downloads (implemented but disabled)
- 🟡 Comprehensive documentation

### Planned
- 🔴 WatchCat loudness normalization
- 🔴 Voice cloning for jingles/sweepers
- 🔴 Advanced audio analysis (BPM, key, energy)
- 🔴 Automated playlist generation
- 🔴 Multi-tenant support
- 🔴 Mobile app

---

## 🗺️ System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud (eu-west-1)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │   React UI   │─────▶│  Amplify Gen2│─────▶│  DynamoDB    │ │
│  │  (Vite App)  │      │  (GraphQL)   │      │  (Tables)    │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│                               │                                 │
│                               ▼                                 │
│                        ┌──────────────┐                         │
│                        │   Lambda     │                         │
│                        │  Functions   │                         │
│                        └──────┬───────┘                         │
│                               │                                 │
│         ┌─────────────────────┼─────────────────────┐          │
│         ▼                     ▼                     ▼           │
│  ┌──────────────┐      ┌──────────────┐     ┌──────────────┐  │
│  │      S3      │      │  EventBridge │     │     SQS      │  │
│  │ (Audio/Cover)│      │  (Scheduler) │     │   (FIFO)     │  │
│  └──────────────┘      └──────────────┘     └──────────────┘  │
│         │                     │                                 │
│         │                     ▼                                 │
│         │              ┌──────────────┐                         │
│         │              │ Playlist     │                         │
│         │              │ Updater Λ    │                         │
│         │              └──────┬───────┘                         │
│         │                     │                                 │
│         │                     ▼ (SSM)                           │
│         │              ┌──────────────────────────────────┐    │
│         │              │         EC2 Instance             │    │
│         │              │  ┌────────────────────────────┐  │    │
│         └─────────────▶│  │  Liquidsoap (M3U player)   │  │    │
│                        │  └─────────────┬──────────────┘  │    │
│                        │                ▼                  │    │
│                        │  ┌────────────────────────────┐  │    │
│                        │  │  Stereo Tool (Processing)  │  │    │
│                        │  └─────────────┬──────────────┘  │    │
│                        │                ▼                  │    │
│                        │  ┌────────────────────────────┐  │    │
│                        │  │   Icecast (Streaming)      │  │    │
│                        │  └────────────────────────────┘  │    │
│                        └───────────────┬──────────────────┘    │
│                                        │                        │
└────────────────────────────────────────┼────────────────────────┘
                                         ▼
                                  ┌─────────────┐
                                  │   Nginx     │
                                  │ Web Player  │
                                  └─────────────┘
                                         │
                                         ▼
                                   [Listeners]
```

---

## 📞 Key Endpoints

### API
- **GraphQL:** `https://[amplify-domain]/graphql`

### Streaming
- **Raw Stream:** `http://46.137.184.91:8000/stream-raw.mp3`
- **Processed Stream:** `http://46.137.184.91:8000/stream-processed.mp3`
- **Main Stream:** `http://46.137.184.91:8000/stream.mp3`
- **Icecast Status:** `http://46.137.184.91/status-json.xsl`

### Web Player
- **URL:** `http://46.137.184.91/`

---

## 🔧 Common Tasks Quick Reference

### Deploy Application
```bash
npx ampx sandbox
```

### Trigger Playlist Update
```bash
aws lambda invoke \
  --function-name [stream-playlist-updater] \
  --region eu-west-1 \
  response.json
```

### Restart Liquidsoap
```bash
ssh radio-ec2 "sudo pkill liquidsoap && nohup liquidsoap /opt/radio/radio.liq &"
```

### Check Stream Status
```bash
curl http://46.137.184.91/status-json.xsl | jq '.icestats.source'
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/[function-name] --follow
```

---

## 📚 External References

### AWS Documentation
- [Amplify Gen 2 Docs](https://docs.amplify.aws/gen2/)
- [Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)

### Streaming Software
- [Liquidsoap Manual](https://www.liquidsoap.info/doc.html)
- [Icecast Documentation](https://icecast.org/docs/)
- [Stereo Tool Website](https://www.stereotool.com/)

### Frontend
- [React Documentation](https://react.dev/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/)

---

## 🤝 Contributing to Documentation

### Guidelines
1. Keep docs up-to-date with code changes
2. Use clear, concise language
3. Include code examples
4. Add diagrams where helpful
5. Link related documents
6. Test all commands before documenting

### Document Lifecycle
1. **Draft** (🔴) - Not started or incomplete
2. **In Progress** (🟡) - Being written or needs review
3. **Complete** (🟢) - Reviewed and published
4. **Outdated** (🔴) - Needs updating

---

## 📝 Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-13 | 1.0.0 | Initial documentation structure created |

---

## 📬 Contact

**Project Owner:** Gerard  
**Team:** G-Forge Development  
**Repository:** [GitHub Link]  

---

**Legend:**
- 🟢 Complete
- 🟡 In Progress
- 🔴 TODO
- ⚠️ Needs Review
