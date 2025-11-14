# 🛠️ G-Forge IoT - Technology Stack

**Last Updated:** 13 November 2025  
**Version:** 1.0.0

---

## 📋 Table of Contents

- [Overview](#overview)
- [Frontend Stack](#frontend-stack)
- [Backend Stack](#backend-stack)
- [Infrastructure](#infrastructure)
- [Streaming Stack](#streaming-stack)
- [DevOps & Tools](#devops--tools)
- [Third-Party Services](#third-party-services)
- [Version Matrix](#version-matrix)

---

## 🎯 Overview

G-Forge IoT uses a modern, scalable tech stack built on AWS serverless architecture with a React frontend and professional streaming infrastructure.

**Architecture Pattern:** Serverless + Microservices  
**Cloud Provider:** AWS (eu-west-1)  
**Development Approach:** Cloud-native, Infrastructure as Code

---

## 🎨 Frontend Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Vite** | 5.x | Build tool and dev server |

### Styling & UI
| Technology | Version | Purpose |
|------------|---------|---------|
| **TailwindCSS** | 3.x | Utility-first CSS framework |
| **Radix UI** | Latest | Accessible component primitives |
| **Lucide React** | Latest | Icon library |
| **clsx** | Latest | Conditional className utility |

### State Management
| Technology | Version | Purpose |
|------------|---------|---------|
| **React Query** | 5.x | Server state management |
| **React Context** | Built-in | Local state management |

### Routing & Navigation
| Technology | Version | Purpose |
|------------|---------|---------|
| **React Router** | 6.x | Client-side routing |

### Data Fetching
| Technology | Version | Purpose |
|------------|---------|---------|
| **AWS Amplify Client** | 1.x (Gen 2) | GraphQL API client |
| **Fetch API** | Native | HTTP requests |

### Audio/Media
| Technology | Version | Purpose |
|------------|---------|---------|
| **HTML5 Audio API** | Native | Audio playback in web player |
| **Web Audio API** | Native | Waveform visualization (future) |

---

## ⚙️ Backend Stack

### Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **AWS Amplify Gen 2** | Latest | Backend framework & deployment |
| **AWS CDK** | Via Amplify | Infrastructure as Code |

### Compute
| Technology | Version | Purpose |
|------------|---------|---------|
| **AWS Lambda** | Node.js 18.x | Serverless compute |
| **Lambda Layers** | N/A | Shared dependencies (future) |

### Database
| Technology | Version | Purpose |
|------------|---------|---------|
| **DynamoDB** | - | NoSQL database |
| **DynamoDB Streams** | - | Change data capture (future) |

### Storage
| Technology | Version | Purpose |
|------------|---------|---------|
| **Amazon S3** | - | Object storage (audio, covers, waveforms) |
| **S3 Event Notifications** | - | Trigger Lambdas on upload |

### Message Queues
| Technology | Version | Purpose |
|------------|---------|---------|
| **Amazon SQS (FIFO)** | - | Track queue for radio stream (deprecated) |

### Scheduling
| Technology | Version | Purpose |
|------------|---------|---------|
| **EventBridge** | - | Cron-based Lambda triggers |

### API
| Technology | Version | Purpose |
|------------|---------|---------|
| **AWS AppSync** | - | Managed GraphQL API |
| **GraphQL** | - | API query language |

### Authentication
| Technology | Version | Purpose |
|------------|---------|---------|
| **AWS Cognito** | - | User authentication (future) |
| **IAM** | - | Service-to-service auth |

---

## ☁️ Infrastructure

### AWS Services Used
| Service | Purpose | Configuration |
|---------|---------|---------------|
| **EC2** | Radio streaming server | t3.medium, Ubuntu 22.04 |
| **VPC** | Network isolation | Default VPC with public subnet |
| **Security Groups** | Firewall rules | Ports 80, 8000, 22 open |
| **IAM** | Access management | 10+ roles and policies |
| **CloudWatch** | Logging & monitoring | Log groups per Lambda |
| **CloudWatch Alarms** | Alerting | Error rate, duration (future) |
| **SSM (Systems Manager)** | EC2 management | Remote command execution |
| **Parameter Store** | Config management | Secrets and settings (future) |
| **CloudFront** | CDN | Static asset delivery (future) |

### Resource Naming Convention
```
amplify-gforgeiot-gerard-[environment]-[resource]-[hash]
```

Example: `amplify-gforgeiot-gerard-s-StreamServerRole6A0ED596-PDlQLOv2V4ju`

---

## 📻 Streaming Stack

### Server Infrastructure
| Component | Version | Purpose |
|-----------|---------|---------|
| **EC2 Instance** | t3.medium | Hosting streaming services |
| **Ubuntu Server** | 22.04 LTS | Operating system |
| **Nginx** | 1.18+ | Web server (player UI) |

### Audio Streaming
| Component | Version | Purpose |
|-----------|---------|---------|
| **Liquidsoap** | 2.x | Audio stream generator |
| **Icecast** | 2.4+ | Streaming media server |
| **Stereo Tool** | 10.x | Professional audio processing |

### Audio Processing Pipeline
```
Liquidsoap (M3U playlist)
    ↓
Liquidsoap (crossfade, cue cut)
    ↓
Icecast (raw stream: /stream-raw.mp3)
    ↓
Stereo Tool (loudness, EQ, compression)
    ↓
Icecast (processed stream: /stream-processed.mp3)
    ↓
[Listeners]
```

### Encoding
| Format | Bitrate | Channels | Sample Rate |
|--------|---------|----------|-------------|
| MP3 | 192 kbps | Stereo | 44.1 kHz |

---

## 🔧 DevOps & Tools

### Version Control
| Tool | Purpose |
|------|---------|
| **Git** | Version control |
| **GitHub** | Repository hosting |

### Package Management
| Tool | Purpose |
|------|---------|
| **pnpm** | Node.js package manager |
| **npm** | Alternative package manager |

### Development Tools
| Tool | Purpose |
|------|---------|
| **VS Code** | Code editor |
| **Windsurf IDE** | AI-assisted development |
| **AWS CLI** | AWS resource management |
| **Amplify CLI** | Amplify deployment tool |

### Deployment
| Tool | Purpose |
|------|---------|
| **Amplify Sandbox** | Local development environment |
| **Amplify Gen 2 CLI** | Production deployment |
| **AWS CDK** | Infrastructure provisioning |

### Monitoring & Debugging
| Tool | Purpose |
|------|---------|
| **CloudWatch Logs** | Centralized logging |
| **CloudWatch Insights** | Log analysis |
| **AWS X-Ray** | Distributed tracing (future) |

### CI/CD
| Tool | Purpose | Status |
|------|---------|--------|
| **GitHub Actions** | Automated testing/deployment | 🔴 TODO |
| **AWS CodePipeline** | Continuous deployment | 🔴 TODO |

---

## 🌐 Third-Party Services

### Media & Content
| Service | Purpose | Usage |
|---------|---------|-------|
| **Download Lokaal Media** | News bulletin MP3 | Hourly download (disabled) |

### Audio Analysis
| Service | Purpose | Status |
|---------|---------|--------|
| **Thimeo WatchCat** | Loudness normalization | 🔴 Planned |
| **ElevenLabs** | Voice cloning | 🔴 Planned |

### CDN & Assets
| Service | Purpose | Status |
|---------|---------|--------|
| **AWS S3** | Static assets | ✅ Active |
| **CloudFront** | CDN | 🔴 TODO |

---

## 📦 Version Matrix

### Frontend Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "^5.5.3",
  "vite": "^5.4.2",
  "@tanstack/react-query": "^5.51.23",
  "react-router-dom": "^6.26.0",
  "tailwindcss": "^3.4.7",
  "@radix-ui/react-*": "latest",
  "lucide-react": "^0.427.0",
  "aws-amplify": "^6.5.0"
}
```

### Backend Dependencies
```json
{
  "@aws-amplify/backend": "^1.2.1",
  "@aws-amplify/backend-cli": "^1.2.4",
  "aws-cdk-lib": "^2.149.0",
  "constructs": "^10.3.0",
  "esbuild": "^0.23.0"
}
```

### Lambda Runtime Dependencies
```json
{
  "@aws-sdk/client-dynamodb": "^3.x",
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/client-sqs": "^3.x",
  "@aws-sdk/client-ssm": "^3.x",
  "@aws-sdk/lib-dynamodb": "^3.x",
  "music-metadata": "^8.1.4"
}
```

### System Packages (EC2)
```bash
liquidsoap: 2.x
icecast2: 2.4+
nginx: 1.18+
stereo-tool-cmd: 10.x
aws-cli: 2.x
```

---

## 🏗️ Architecture Patterns

### Backend Patterns
- **Event-Driven Architecture** - S3 uploads trigger Lambdas
- **CQRS** - Separate read/write operations in DynamoDB
- **Serverless** - No servers to manage for compute
- **Microservices** - Each Lambda function has single responsibility

### Frontend Patterns
- **Component-Based Architecture** - Reusable React components
- **Atomic Design** - Atoms, molecules, organisms pattern
- **Server State Management** - React Query for API data
- **Composition over Inheritance** - Hooks and HOCs

### Data Flow Patterns
- **Unidirectional Data Flow** - Props down, events up
- **Optimistic Updates** - Immediate UI feedback
- **Cache Invalidation** - React Query automatic refetch

---

## 🔐 Security Stack

### Authentication & Authorization
| Layer | Technology | Status |
|-------|------------|--------|
| **API Auth** | AWS IAM | ✅ Active |
| **User Auth** | AWS Cognito | 🔴 TODO |
| **Service Auth** | IAM Roles | ✅ Active |

### Data Protection
| Protection | Technology |
|-----------|------------|
| **Encryption at Rest** | S3 server-side encryption |
| **Encryption in Transit** | HTTPS/TLS |
| **Secrets Management** | SSM Parameter Store (future) |

### Network Security
| Layer | Technology |
|-------|------------|
| **Firewall** | AWS Security Groups |
| **DDoS Protection** | AWS Shield (basic) |
| **Access Control** | IAM Policies |

---

## 📊 Performance Stack

### Caching
| Layer | Technology | Status |
|-------|------------|--------|
| **API Cache** | AppSync caching | 🔴 TODO |
| **Browser Cache** | React Query | ✅ Active |
| **CDN Cache** | CloudFront | 🔴 TODO |

### Optimization
| Technique | Implementation |
|-----------|----------------|
| **Code Splitting** | Vite dynamic imports |
| **Asset Optimization** | Vite build optimization |
| **Database Indexing** | DynamoDB GSI/LSI |
| **Lambda Cold Start** | Reserved concurrency (future) |

---

## 🧪 Testing Stack (TODO)

### Testing Framework
| Tool | Purpose | Status |
|------|---------|--------|
| **Vitest** | Unit testing | 🔴 TODO |
| **React Testing Library** | Component testing | 🔴 TODO |
| **Playwright** | E2E testing | 🔴 TODO |
| **AWS SAM** | Lambda local testing | 🔴 TODO |

---

## 📈 Monitoring & Observability

### Current Setup
- ✅ CloudWatch Logs (all Lambdas)
- ✅ CloudWatch Metrics (basic AWS metrics)
- ✅ Manual log inspection

### Planned
- 🔴 CloudWatch Dashboards
- 🔴 Custom metrics
- 🔴 Error tracking (Sentry/Rollbar)
- 🔴 Performance monitoring (AWS X-Ray)
- 🔴 Cost tracking dashboard

---

## 🔄 Migration & Compatibility

### Breaking Changes
None yet - Version 1.0

### Deprecated
- **SQS Track Queue** - Replaced by M3U file-based system
- **request.queue() in Liquidsoap** - Replaced by request.dynamic.list()

### Future Migrations
- DynamoDB → Aurora Serverless (if scale requires)
- EC2 → ECS/Fargate (for better scaling)
- Manual deployment → CI/CD pipeline

---

## 📚 Learning Resources

### Essential Reading
1. [AWS Amplify Gen 2 Docs](https://docs.amplify.aws/gen2/)
2. [React 18 Documentation](https://react.dev/)
3. [Liquidsoap Documentation](https://www.liquidsoap.info/doc.html)
4. [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

### Tutorials Used
- AWS Amplify Gen 2 Quickstart
- TailwindCSS with Vite setup
- Liquidsoap audio streaming guide
- Stereo Tool command-line usage

---

## 🤝 Contributing

### Adding New Technologies
1. Evaluate necessity and alternatives
2. Check compatibility with existing stack
3. Consider AWS-native options first
4. Document version and purpose
5. Update this file

### Upgrade Policy
- **Major versions:** Require testing and approval
- **Minor versions:** Can be upgraded freely
- **Security patches:** Apply immediately
- **Breaking changes:** Require migration guide

---

## 📞 Support & Resources

**AWS Support:** Basic (consider upgrading to Developer)  
**Community:** Internal team knowledge base  
**Stack Overflow:** For specific technical questions  

---

**Last Review:** 13 November 2025  
**Next Review Due:** 13 December 2025  
**Owner:** Gerard / Development Team
