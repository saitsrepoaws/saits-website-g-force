# 📋 TODO: AWS Infrastructure Documentation

**Created:** 13 November 2025, 22:50 CET  
**Status:** 🔴 TODO - Complete infrastructure documentation required  
**Priority:** HIGH - Critical for maintainability, onboarding, and scaling

---

## 🎯 Objective

Create comprehensive, professional documentation for the entire G-Forge IoT AWS infrastructure, covering functional architecture, technical implementation, and operational procedures.

---

## 📚 Documentation Structure

### 1. **Functional Overview** (`/docs/architecture/FUNCTIONAL_OVERVIEW.md`)
   - [ ] Business context and objectives
   - [ ] User stories and use cases
   - [ ] Feature list with descriptions
   - [ ] System capabilities
   - [ ] Data flow diagrams (high-level)
   - [ ] User journey maps
   - [ ] Integration points

### 2. **Technical Architecture** (`/docs/architecture/TECHNICAL_ARCHITECTURE.md`)
   - [ ] System architecture diagram (AWS resources)
   - [ ] Component interactions
   - [ ] Data flow (technical)
   - [ ] Network topology
   - [ ] Security architecture
   - [ ] Scalability design
   - [ ] Disaster recovery plan

### 3. **Tech Stack Documentation** (`/docs/TECH_STACK.md`)
   - [ ] Frontend technologies (React, Vite, TypeScript, TailwindCSS)
   - [ ] Backend technologies (AWS Amplify Gen 2, Lambda, DynamoDB)
   - [ ] Infrastructure (EC2, S3, SQS, CloudWatch, IAM)
   - [ ] DevOps tools (GitHub, AWS CDK)
   - [ ] Third-party services (Icecast, Liquidsoap, Stereo Tool)
   - [ ] Version matrix (all dependencies)

### 4. **AWS Resources Inventory** (`/docs/infrastructure/AWS_RESOURCES.md`)
   - [ ] Complete list of all AWS resources
   - [ ] Resource naming conventions
   - [ ] Cost breakdown per service
   - [ ] Resource dependencies map
   - [ ] IAM roles and policies
   - [ ] Security groups and VPC config

### 5. **Lambda Functions** (`/docs/infrastructure/LAMBDA_FUNCTIONS.md`)
   - [ ] Function inventory with descriptions
   - [ ] Trigger mechanisms (EventBridge, S3, API)
   - [ ] Environment variables
   - [ ] IAM permissions per function
   - [ ] Memory/timeout configurations
   - [ ] Cold start optimizations
   - [ ] Error handling and retry logic

### 6. **Database Schema** (`/docs/database/DYNAMODB_SCHEMA.md`)
   - [ ] Table structures (Track, Playlist, Schedule, Settings, Device)
   - [ ] Indexes (GSI, LSI)
   - [ ] Access patterns
   - [ ] Query examples
   - [ ] Capacity planning
   - [ ] Backup strategy

### 7. **API Documentation** (`/docs/api/API_REFERENCE.md`)
   - [ ] GraphQL schema
   - [ ] REST endpoints (if any)
   - [ ] Authentication/Authorization
   - [ ] Request/response examples
   - [ ] Error codes
   - [ ] Rate limits

### 8. **Streaming Infrastructure** (`/docs/streaming/RADIO_STACK.md`)
   - [ ] EC2 instance configuration
   - [ ] Liquidsoap setup and configuration
   - [ ] Icecast server setup
   - [ ] Stereo Tool integration
   - [ ] Stream URLs and mount points
   - [ ] Audio processing pipeline
   - [ ] Monitoring and health checks

### 9. **Deployment Guide** (`/docs/operations/DEPLOYMENT.md`)
   - [ ] Prerequisites
   - [ ] Environment setup
   - [ ] Deployment steps (sandbox, prod)
   - [ ] Rollback procedures
   - [ ] Environment variables management
   - [ ] Secrets management
   - [ ] CI/CD pipeline (if exists)

### 10. **Operational Runbook** (`/docs/operations/RUNBOOK.md`)
   - [ ] Common tasks (restart services, purge queues, etc.)
   - [ ] Troubleshooting guide
   - [ ] Monitoring dashboards
   - [ ] Alerting setup
   - [ ] Incident response procedures
   - [ ] Performance tuning
   - [ ] Backup and restore procedures

### 11. **Cost Management** (`/docs/operations/COST_OPTIMIZATION.md`)
   - [ ] Current cost breakdown
   - [ ] Cost optimization opportunities
   - [ ] Reserved instances strategy
   - [ ] S3 lifecycle policies
   - [ ] Lambda optimization tips
   - [ ] Budget alerts setup

### 12. **Security Documentation** (`/docs/security/SECURITY.md`)
   - [ ] IAM best practices
   - [ ] Secrets management
   - [ ] Network security
   - [ ] Data encryption (at rest, in transit)
   - [ ] Compliance requirements
   - [ ] Vulnerability management
   - [ ] Access audit logs

---

## 🏗️ Current Infrastructure Snapshot

### AWS Services in Use
- **Amplify Gen 2** - Backend framework
- **Lambda** - Serverless compute (10+ functions)
- **DynamoDB** - NoSQL database (6+ tables)
- **S3** - Object storage (audio, covers, waveforms, news)
- **SQS** - Message queues (FIFO queue for tracks)
- **EventBridge** - Scheduled triggers (hourly playlist updates)
- **CloudWatch** - Logging and monitoring
- **IAM** - Identity and access management
- **EC2** - Radio streaming server (t3.medium)
- **SSM** - Systems Manager (for EC2 management)
- **VPC** - Virtual Private Cloud

### External Services
- **Icecast 2** - Streaming media server
- **Liquidsoap** - Audio stream generator
- **Stereo Tool** - Professional audio processing
- **Nginx** - Web server (player UI)

### Key Components
1. **Track Upload Pipeline**
   - S3 upload → Lambda (metadata extraction) → DynamoDB
   - Parallel: Waveform generation, audio analysis
   - Cover art extraction and storage

2. **Radio Streaming System**
   - EventBridge (hourly) → Lambda (playlist updater)
   - Downloads tracks from S3 → EC2 local storage
   - Generates M3U playlist → Liquidsoap plays
   - Stereo Tool processes → Icecast streams

3. **Schedule Management**
   - UI creates schedules (day/hour/playlist mapping)
   - Lambda reads schedule at trigger time (CET timezone)
   - Auto-loads correct playlist per hour

4. **Web Player**
   - Nginx serves HTML/CSS/JS player
   - Fetches Icecast metadata (real-time track info)
   - Displays: track title, artist, progress, listeners, bitrate

---

## 📊 Documentation Priorities

### Phase 1: Critical (Week 1)
1. ✅ Functional overview
2. ✅ Technical architecture diagram
3. ✅ AWS resources inventory
4. ✅ Lambda functions reference

### Phase 2: Essential (Week 2)
5. ✅ Database schema
6. ✅ Streaming infrastructure
7. ✅ Deployment guide
8. ✅ Operational runbook

### Phase 3: Important (Week 3)
9. ✅ API documentation
10. ✅ Security documentation
11. ✅ Cost management
12. ✅ Tech stack details

---

## 🎨 Documentation Standards

### Writing Style
- **Clear and concise** - Avoid jargon when possible
- **Examples first** - Show code/config before explaining
- **Visual diagrams** - Use Mermaid.js for flowcharts
- **Step-by-step** - Number all procedures
- **Copy-pasteable** - All commands must be runnable
- **Version tagged** - Note when features were added/changed

### File Structure
```
/docs
  /architecture
    - FUNCTIONAL_OVERVIEW.md
    - TECHNICAL_ARCHITECTURE.md
    - SYSTEM_DIAGRAMS.md
  /database
    - DYNAMODB_SCHEMA.md
    - ACCESS_PATTERNS.md
  /api
    - API_REFERENCE.md
    - GRAPHQL_SCHEMA.md
  /streaming
    - RADIO_STACK.md
    - LIQUIDSOAP_CONFIG.md
    - STEREO_TOOL_SETUP.md
  /infrastructure
    - AWS_RESOURCES.md
    - LAMBDA_FUNCTIONS.md
    - EC2_SETUP.md
  /operations
    - DEPLOYMENT.md
    - RUNBOOK.md
    - MONITORING.md
    - COST_OPTIMIZATION.md
  /security
    - SECURITY.md
    - IAM_POLICIES.md
  /onboarding
    - GETTING_STARTED.md
    - DEVELOPMENT_SETUP.md
  - TECH_STACK.md
  - CHANGELOG.md
  - INDEX.md (master reference)
```

### Diagram Tools
- **Mermaid.js** - Flowcharts, sequence diagrams
- **AWS Architecture Icons** - For infrastructure diagrams
- **Draw.io** - Complex system diagrams
- **Lucidchart** - Alternative for collaboration

### Code Examples
- Must include imports/dependencies
- Show input AND output
- Include error handling
- Note AWS region if relevant
- Tag with date/version when written

---

## 🔧 Tools & Automation

### Documentation Generation
- [ ] Setup auto-generated API docs (GraphQL schema → Markdown)
- [ ] Create Lambda inventory script (list all functions + configs)
- [ ] DynamoDB table export script (schema + sample data)
- [ ] Cost analysis script (current month breakdown)
- [ ] Resource tagging audit script

### Maintenance
- [ ] Monthly review schedule
- [ ] Auto-update VERSION.md on deploys
- [ ] Link checker for internal docs
- [ ] Broken diagram detection
- [ ] Outdated code example alerts

---

## 📋 Checklist for Each Document

- [ ] Title and purpose clearly stated
- [ ] Table of contents for docs > 200 lines
- [ ] Visual diagram (where applicable)
- [ ] Code examples with context
- [ ] Links to related documents
- [ ] Last updated date at bottom
- [ ] Author/maintainer listed
- [ ] Reviewed by 2nd person

---

## 🚀 Getting Started

### Step 1: Create Base Structure
```bash
mkdir -p docs/{architecture,database,api,streaming,infrastructure,operations,security,onboarding}
touch docs/INDEX.md
touch docs/TECH_STACK.md
touch docs/CHANGELOG.md
```

### Step 2: Generate Resource Inventory
```bash
# Lambda functions
aws lambda list-functions --region eu-west-1 > docs/infrastructure/lambda-inventory.json

# DynamoDB tables
aws dynamodb list-tables --region eu-west-1 > docs/database/dynamodb-tables.json

# S3 buckets
aws s3 ls > docs/infrastructure/s3-buckets.txt

# EC2 instances
aws ec2 describe-instances --region eu-west-1 > docs/infrastructure/ec2-inventory.json
```

### Step 3: Start with Most Critical Docs
1. `FUNCTIONAL_OVERVIEW.md` - What does the system do?
2. `TECHNICAL_ARCHITECTURE.md` - How does it work?
3. `AWS_RESOURCES.md` - What's deployed?
4. `RUNBOOK.md` - How to operate it?

---

## 📝 Documentation Templates

### Lambda Function Template
```markdown
# Lambda Function: [Name]

**Purpose:** Brief description
**Trigger:** EventBridge/S3/Manual
**Runtime:** Node.js 18.x
**Memory:** 512 MB
**Timeout:** 60 seconds

## Environment Variables
- `TABLE_NAME`: DynamoDB table
- `BUCKET_NAME`: S3 bucket

## IAM Permissions
- `dynamodb:GetItem`
- `s3:GetObject`

## Code Location
`/amplify/functions/[name]/handler.ts`

## Example Invocation
```bash
aws lambda invoke \
  --function-name [name] \
  --region eu-west-1 \
  --payload '{}' \
  response.json
```

## Monitoring
- CloudWatch Logs: `/aws/lambda/[name]`
- Error Rate Alarm: [alarm-name]
```

### Database Table Template
```markdown
# DynamoDB Table: [Name]

**Purpose:** Brief description
**Capacity:** On-demand / Provisioned

## Schema
```json
{
  "id": "string (PK)",
  "name": "string",
  "createdAt": "string (ISO 8601)"
}
```

## Indexes
- **GSI1:** byName (name, createdAt)

## Access Patterns
1. Get item by ID
2. List items by name
3. Query by date range
```

---

## 🎯 Success Metrics

Documentation is complete when:
- ✅ New team member can deploy system from docs alone
- ✅ All AWS resources are documented with purpose
- ✅ Common operational tasks have runbook entries
- ✅ Architecture diagrams accurately reflect current state
- ✅ All Lambda functions have inline docs + external reference
- ✅ Database schema matches actual tables
- ✅ Deployment process is repeatable
- ✅ Troubleshooting guide resolves 80%+ of issues

---

## 📞 Stakeholders

- **Development Team** - Primary authors
- **Operations Team** - Runbook contributors
- **Product Team** - Functional overview input
- **Security Team** - Security doc review
- **Finance Team** - Cost optimization review

---

## 🔗 Related Tasks

- [ ] Setup Confluence/Wiki for documentation (optional)
- [ ] Create video walkthrough of system (15 min)
- [ ] Present architecture to team
- [ ] Document disaster recovery procedures
- [ ] Create onboarding checklist for new devs

---

## 📅 Timeline

**Week 1:** Core architecture docs  
**Week 2:** Operational runbooks  
**Week 3:** Detailed technical specs  
**Week 4:** Polish, review, publish

**Target Completion:** End of November 2025

---

## ✅ Next Actions

1. Create `/docs` directory structure
2. Start with `INDEX.md` (master table of contents)
3. Write `FUNCTIONAL_OVERVIEW.md` (2-3 pages)
4. Create AWS architecture diagram (Mermaid or Draw.io)
5. Document all Lambda functions in spreadsheet first
6. Generate current resource inventory with AWS CLI
7. Schedule weekly doc review sessions

---

**Status:** 🔴 Not Started  
**Owner:** Development Team  
**Due Date:** 30 November 2025  
**Last Updated:** 13 November 2025
