# 📚 Documentation Index - G-Forge IoT Radio Platform

**Last Updated:** 15 November 2025  
**Status:** Complete & Up-to-date

---

## 🎯 SYSTEM BLOCKS (BLOKKEN)

### End-to-End Testing & Recovery
- [BLOK LIBERY](BLOK_LIBERY_END_TO_END.md) - **📚 Track Library System** - Upload, metadata, BPM, cover art, waveform

---

## 🏗️ Architecture

### System Design
- [Architecture Centralization](architecture/ARCHITECTURE_CENTRALIZATION.md) - Centrale architectuur beslissingen
- [Architecture Diagram](architecture/ARCHITECTURE_DIAGRAM.md) - Visuele systeemdiagrammen
- [State Machine Architecture](architecture/STATE_MACHINE_ARCHITECTURE.md) - State machine design
- [State Machine Diagram](architecture/STATE_MACHINE_DIAGRAM.md) - State machine visualisatie
- [Radio Player State Machine](architecture/RADIO_PLAYER_STATE_MACHINE.md) - Player state management

### Queue & Streaming
- [SQS Implementation Complete](architecture/SQS_IMPLEMENTATION_COMPLETE.md) - SQS implementatie details
- [SQS Streaming Architecture](architecture/SQS_STREAMING_ARCHITECTURE.md) - Streaming architectuur

---

## 🚀 Development

### Workflows & Processes
- [Development Workflow](development/DEVELOPMENT_WORKFLOW.md) - **⭐ START HIER** - 2-terminal development setup
- [Lambda Deployment Cheatsheet](development/LAMBDA_DEPLOYMENT_CHEATSHEET.md) - Lambda deployment guide
- [Implementation Plan](development/IMPLEMENTATION_PLAN.md) - Roadmap & planning

### API & Integration
- [Cover Art API](COVER_ART_API.md) - Cover art ophalen & caching
- [Media URL Setup](MEDIA_URL_SETUP.md) - Media URL configuratie
- [Player GraphQL Integration](PLAYER_GRAPHQL_INTEGRATION.md) - GraphQL integratie

---

## 📦 Deployment

### Infrastructure
- [EC2 IAM Setup](deployment/EC2_IAM_SETUP.md) - EC2 IAM configuratie
- [EC2 Stream Recovery](EC2_STREAM_RECOVERY_11NOV2025.md) - Recovery procedures
- [EC2 Inspection Report](EC2_INSPECTION_REPORT.md) - System audit
- [EC2 Upgrade Plan](EC2_UPGRADE_PLAN.md) - Upgrade strategie
- [Stream Server Setup](STREAM_SERVER_SETUP.md) - Server configuratie

### IoT Core
- [IoT Policy Setup](deployment/IOT_POLICY_SETUP.md) - IoT policy configuratie
- [IoT Topics Specification](deployment/IOT_TOPICS_SPECIFICATION.md) - Topic structuur
- [IoT Command Flow](deployment/IOT_COMMAND_FLOW.md) - Command handling
- [IoT Player Implementation](deployment/IOT_PLAYER_IMPLEMENTATION.md) - Player IoT setup
- [IoT Console Commands](IOT_CONSOLE_COMMANDS.md) - CLI commando's
- [IoT Setup Journey](IOT_SETUP_JOURNEY_31OCT2025.md) - Complete setup guide

### Status & Monitoring
- [Deployment Ready](DEPLOYMENT_READY.md) - Deployment checklist
- [Deployment Status](DEPLOYMENT_STATUS.md) - Current deployment state
- [Implementation Status](IMPLEMENTATION_STATUS.md) - Feature status

---

## 🎵 Features

### Audio & Playback
- [Crossfade Professional](features/CROSSFADE_PROFESSIONAL.md) - Professional crossfade system
- [Crossfade Integration Plan](CROSSFADE_INTEGRATION_PLAN.md) - Integratie planning
- [Smart Crossfade](SMART_CROSSFADE.md) - BPM-aware crossfading
- [Liquidsoap Compatibility](LIQUIDSOAP_COMPATIBILITY.md) - Liquidsoap 2.0.2 compatibility
- [Liquidsoap Crossfade](liquidsoap-crossfade.md) - Crossfade config
- [EC2 Crossfade Workaround](EC2_CROSSFADE_WORKAROUND.md) - EC2 specific fixes

### Players & UI
- [Players Refactor Plan](features/PLAYERS_REFACTOR_PLAN.md) - Refactoring strategie
- [Players Refactor Strategy](features/PLAYERS_REFACTOR_STRATEGY.md) - Implementatie strategie
- [Player Refactoring](features/PLAYER_REFACTORING.md) - Refactor details
- [Multi-Player Feature](FEATURE_MULTI_PLAYER.md) - Multi-player ondersteuning
- [Multi-Tab Support](MULTI_TAB_SUPPORT.md) - Multi-tab handling
- [Libery Component](LIBERY_COMPONENT.md) - Track library component

### Playlists & Scheduling
- [Dynamic Playlist Updates](DYNAMIC_PLAYLIST_UPDATES.md) - Real-time updates
- [Radio Station System](RADIO_STATION_SYSTEM.md) - Hourly scheduling
- [Playlist Plan](PLAYLIST_PLAN.md) - Playlist strategie
- [Playlist IoT Plan](PLAYLIST_IOT_PLAN.md) - IoT integratie

### Advanced Features
- [Voice Cloning Research](features/VOICE_CLONING_RESEARCH_RAPPORT.md) - AI voice research

---

## 🔧 Troubleshooting

### Debugging Guides
- [Lambda Troubleshooting](troubleshooting/LAMBDA_TROUBLESHOOTING.md) - Lambda debugging
- [Debugging Checklist](DEBUGGING_CHECKLIST.md) - Systematische debugging
- [Deep Dive Debug](DEEP_DIVE_DEBUG.md) - Diepgaande debug analyse
- [Debug Results](DEBUG_RESULTS.md) - Debug bevindingen
- [Root Cause Analysis](ROOT_CAUSE_ANALYSIS.md) - RCA template

### Specific Issues
- [Auto Load Debug Summary](AUTO_LOAD_DEBUG_SUMMARY.md) - Auto-load issues
- [Backend No Receive](BACKEND_NO_RECEIVE.md) - Backend communication
- [Player Refresh Analysis](PLAYER_REFRESH_ANALYSIS.md) - Refresh problemen
- [IoT Socket Closed Explained](IOT_SOCKET_CLOSED_EXPLAINED.md) - Socket issues
- [Triggers Analysis](TRIGGERS_ANALYSIS.md) - Lambda trigger debugging

---

## 🧪 Testing

### Test Guides
- [Quick Test Guide](QUICK_TEST_GUIDE.md) - Snelle test procedures
- [Test Report](TEST_REPORT.md) - Test resultaten
- [Test Lambda](TEST_LAMBDA.md) - Lambda testen
- [Test Notification](TEST_NOTIFICATION.md) - Notification testing
- [Test Player Status](TEST_PLAYER_STATUS.md) - Player status testing
- [Notification Test](NOTIFICATION_TEST.md) - Notification flow

---

## 📖 Reference

### Quick References
- [Cheatsheet](cheatsheet.md) - Snelle commando referentie
- [Amplify Gen2 Overview](amplify-gen2-overview.md) - Amplify Gen2 basics
- [Backend CLI Commands](backend-cli-commands.md) - CLI referentie
- [IoT PubSub Naslagwerk](iot-pubsub-naslagwerk.md) - IoT PubSub reference
- [IoT Policy Examples](iot-policy-examples.md) - Policy voorbeelden
- [IoT Setup](iot-setup.md) - Setup instructies
- [PubSub Gen2 React](pubsub-gen2-react.md) - React integratie
- [PubSub JS](pubsub-js.md) - JavaScript examples

### System Analysis
- [Setup Analyse 2025](SETUP_ANALYSE_2025.md) - Complete system analyse
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Implementatie overzicht
- [IoT Status](IOT_STATUS.md) - IoT system status
- [IoT Debug Plan](IOT_DEBUG_PLAN.md) - IoT debugging strategie
- [IoT Policy Issue](IOT_POLICY_ISSUE.md) - Policy troubleshooting
- [IoT PubSub Final](IOT_PUBSUB_FINAL.md) - PubSub final setup
- [IoT Quick Reference](IOT_QUICK_REFERENCE.md) - Quick IoT reference

---

## 📂 Documentation Structure

```
ref/
├── INDEX.md                          ← YOU ARE HERE
├── architecture/                     ← System design docs
├── development/                      ← Dev workflows & guides
├── deployment/                       ← Infrastructure & IoT
├── features/                         ← Feature documentation
├── troubleshooting/                  ← Debug & fix guides
└── [root level files]               ← Legacy & specific docs
```

---

## 🔄 Documentation Standards

### Writing Guidelines
1. **Clear titles** - Descriptive en specifiek
2. **Date stamps** - Altijd datum vermelden
3. **Status tags** - ✅ Complete, 🚧 In Progress, ❌ Deprecated
4. **Code examples** - Altijd met comments
5. **Screenshots** - Voor UI/UX features

### Update Frequency
- **Architecture docs** - Bij grote wijzigingen
- **Development workflows** - Wekelijks reviewen
- **Troubleshooting** - Na elke fix toevoegen
- **Testing** - Na elke test cycle

### Commit Strategie
✅ **KLEINE, FREQUENTE COMMITS:**
```bash
# Goed: Werkende feature
git commit -m "feat: Add news toggle - working! 📰"

# Goed: Bug fix
git commit -m "fix: Fade-out too long - reduced to 0.5s ⚡"

# Goed: Documentation
git commit -m "docs: Update INDEX with new sections 📚"

# Slecht: Te veel in 1 commit
git commit -m "Add features, fix bugs, update docs"
```

**Workflow:**
1. Maak kleine change (10-50 lines)
2. Test dat het werkt ✅
3. Commit immediately
4. Push regelmatig (elk uur)
5. Repeat!

---

## 🎯 Quick Start

### For New Developers
1. Start with [Development Workflow](development/DEVELOPMENT_WORKFLOW.md)
2. Read [Architecture Diagram](architecture/ARCHITECTURE_DIAGRAM.md)
3. Check [Deployment Status](DEPLOYMENT_STATUS.md)
4. Run [Quick Test Guide](QUICK_TEST_GUIDE.md)

### For Troubleshooting
1. Check [Debugging Checklist](DEBUGGING_CHECKLIST.md)
2. Read [Lambda Troubleshooting](troubleshooting/LAMBDA_TROUBLESHOOTING.md)
3. Review [Root Cause Analysis](ROOT_CAUSE_ANALYSIS.md)

### For Deployment
1. Review [Deployment Ready](DEPLOYMENT_READY.md)
2. Follow [EC2 IAM Setup](deployment/EC2_IAM_SETUP.md)
3. Configure [IoT Policy Setup](deployment/IOT_POLICY_SETUP.md)

---

## 📝 Notes

- All paths relative to `/Users/gerard/Desktop/T7/g-forge-iot/ref/`
- Use GitHub markdown viewer for best experience
- Keep this index updated with new docs
- Archive deprecated docs to `/ref/archive/`

---

**Maintained by:** Gerard  
**Project:** G-Forge IoT Radio Platform  
**Version:** 2.0  
**Last Review:** 13 November 2025
