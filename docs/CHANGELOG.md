# 📝 Changelog

All notable changes to the G-Forge IoT project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- WatchCat loudness normalization integration
- Voice cloning for jingles/sweepers (ElevenLabs)
- Advanced audio analysis (BPM, key, energy)
- Automated playlist generation
- Multi-tenant support
- Mobile app

---

## [1.0.0] - 2025-11-13

### 🎉 Major Milestone: Documentation Structure Created

#### Added - Documentation
- **Documentation structure** - Created comprehensive docs folder with subdirectories
- **INDEX.md** - Master documentation index with navigation
- **TECH_STACK.md** - Complete technology stack overview
- **TODO_AWS_INFRASTRUCTURE_DOCS.md** - Documentation roadmap and plan
- **README.md** - Quick start guide for documentation
- **CHANGELOG.md** - This file for tracking changes

#### Added - Features
- **Lambda playlist system** - M3U-based playlist updates via Lambda/SSM
- **TechnoHouse playlist** - 16 tracks loaded and playing
- **Web player centered button** - Play button now centered in middle of player card
- **Smart fallback** - Player shows "Live on Splash FM" when no metadata available

#### Changed - Architecture
- **SQS queue deprecated** - Moved from SQS FIFO queue to M3U file-based system
- **Liquidsoap M3U mode** - Using `playlist()` instead of `request.dynamic.list()`
- **Track storage** - Tracks downloaded to EC2 `/var/radio/tracks/` directory
- **Auto-cleanup** - Tracks older than 2 hours automatically deleted

---

## [0.9.0] - 2025-11-12

### Added - Radio Streaming System
- **Hourly playlist updates** - EventBridge triggers Lambda every hour
- **Schedule system** - Day/hour scheduling with CET timezone support
- **News bulletins** - Automated news download (disabled by setting)
- **Stereo Tool integration** - Professional audio processing pipeline
- **Web player** - Modern HTML5 player with real-time metadata

### Changed
- **Timezone handling** - Lambda converts UTC to CET for schedule matching
- **EC2 timezone** - Set to Europe/Amsterdam (CET)

### Fixed
- **FIFO queue permissions** - Added EC2 IAM role permissions for SQS
- **Track looping** - Fixed infinite loop in Liquidsoap queue
- **Metadata display** - Improved Icecast metadata parsing

---

## [0.8.0] - 2025-11-07

### Added - Track Management
- **Track upload** - S3 upload with metadata extraction
- **Waveform generation** - Automated waveform image creation
- **Cover art extraction** - ID3 tag cover art extraction
- **Audio features Lambda** - Placeholder for BPM/key detection

### Added - Playlist Management
- **Playlist CRUD** - Create, read, update, delete playlists
- **Track association** - Link tracks to playlists
- **Playlist metadata** - Name, description, creation date

### Added - Infrastructure
- **Amplify Gen 2 setup** - Backend framework configuration
- **DynamoDB tables** - Track, Playlist, Schedule, Settings, Device
- **Lambda functions** - audio-metadata, waveform-generator, audio-features
- **S3 bucket** - Audio storage with event notifications

---

## [0.7.0] - 2025-10-15

### Added - Initial Setup
- **React frontend** - Vite + TypeScript + TailwindCSS
- **AWS Amplify backend** - Gen 2 framework
- **EC2 instance** - Streaming server (t3.medium, Ubuntu 22.04)
- **Liquidsoap** - Audio stream generator
- **Icecast** - Streaming media server
- **Basic web UI** - Track list, playlist view, device settings

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2025-11-13 | Documentation structure, M3U playlist system |
| 0.9.0 | 2025-11-12 | Radio streaming, scheduling, Stereo Tool |
| 0.8.0 | 2025-11-07 | Track management, waveforms, playlists |
| 0.7.0 | 2025-10-15 | Initial setup, basic infrastructure |

---

## Change Categories

### Types of Changes
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Features that will be removed
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

---

## Breaking Changes

### v1.0.0
- ⚠️ **SQS Queue Deprecated** - System now uses M3U files. Old queue system no longer functional.
- ⚠️ **Liquidsoap Config** - Changed from `request.dynamic.list()` to `playlist()`. Requires config update.

---

## Migration Guides

### From SQS to M3U (v0.9.0 → v1.0.0)

**Changes Required:**
1. Update Liquidsoap config to use `playlist()` mode
2. Remove SQS queue reading code
3. Lambda now uses SSM to upload M3U to EC2
4. Tracks downloaded to local EC2 storage

**Steps:**
```bash
# 1. Update Liquidsoap config
ssh radio-ec2
sudo vi /opt/radio/radio.liq
# Change to: radio = playlist("/var/radio/playlists/current.m3u")

# 2. Restart Liquidsoap
sudo pkill liquidsoap
nohup liquidsoap /opt/radio/radio.liq &

# 3. Trigger Lambda
aws lambda invoke \
  --function-name stream-playlist-updater \
  --region eu-west-1 \
  response.json
```

---

## Deprecated Features

### v1.0.0
- **SQS FIFO Queue** - Replaced by M3U file system
- **`request.dynamic.list()` in Liquidsoap** - Replaced by `playlist()`

---

## Upcoming Changes (Next Release)

### v1.1.0 (Planned)
- [ ] Cover art metadata in Icecast stream
- [ ] Liquidsoap cover support integration
- [ ] Player background dynamic cover art
- [ ] Comprehensive architecture documentation
- [ ] Lambda functions reference guide

---

## Notes

### Semantic Versioning
- **Major (1.0.0)** - Breaking changes
- **Minor (0.1.0)** - New features, backwards compatible
- **Patch (0.0.1)** - Bug fixes, backwards compatible

### Changelog Maintenance
- Update this file with every significant change
- Group changes by version and category
- Include migration guides for breaking changes
- Tag dates in ISO 8601 format (YYYY-MM-DD)

---

**Last Updated:** 13 November 2025  
**Maintained By:** Development Team
