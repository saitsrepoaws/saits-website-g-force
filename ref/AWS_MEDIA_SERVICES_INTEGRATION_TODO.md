# AWS Media Services Integration - TODO & Implementation Plan
**Date:** 16 November 2025, 00:50 CET  
**Status:** 📋 TODO - Planning Phase  
**Priority:** Future Enhancement

## 🎯 Objective

Create a professional broadcast-grade streaming setup using AWS Media Services as an alternative/demo to the current Liquidsoap/Icecast setup.

## 🏗️ Architecture Overview

### Current Setup (Liquidsoap + Icecast)
```
Liquidsoap (EC2) → Icecast (EC2) → Nginx (EC2) → CloudFront → Users
```

### Proposed AWS Media Services Setup
```
Liquidsoap (EC2) → MediaLive (RTMP/RTP) → MediaPackage → CloudFront → Users
                                              ↓
                                         MediaStore (DVR)
```

## 📋 TODO List - Phase 1: Research & Planning

### ✅ Research Tasks

- [ ] **Study AWS MediaLive**
  - [ ] Read MediaLive documentation
  - [ ] Understand input types (RTMP, RTP, HLS)
  - [ ] Review pricing model (per channel, per minute)
  - [ ] Check available features (encoding profiles, outputs)
  
- [ ] **Study AWS MediaPackage**
  - [ ] Read MediaPackage documentation
  - [ ] Understand origin endpoints (HLS, DASH, CMAF)
  - [ ] Review DVR window options
  - [ ] Check live-to-VOD capabilities
  
- [ ] **Study AWS MediaStore**
  - [ ] Understand storage for DVR/time-shift
  - [ ] Review pricing (storage + requests)
  - [ ] Check CloudFront integration
  
- [ ] **Study AWS MediaConnect** (optional)
  - [ ] For source redundancy
  - [ ] Multi-region distribution
  - [ ] VPC connectivity

### 📊 Cost Analysis

- [ ] **Calculate MediaLive Costs**
  - [ ] Input: $X per hour
  - [ ] Encoding: $X per output hour
  - [ ] Total estimated: $/month for 24/7
  
- [ ] **Calculate MediaPackage Costs**
  - [ ] Packaging: $X per GB
  - [ ] Egress: $X per GB
  - [ ] Total estimated: $/month
  
- [ ] **Calculate MediaStore Costs**
  - [ ] Storage: $X per GB/month
  - [ ] Requests: $X per 10,000
  - [ ] Total estimated: $/month
  
- [ ] **Calculate CloudFront Costs**
  - [ ] Data transfer: $X per GB
  - [ ] Requests: $X per 10,000
  - [ ] Total estimated: $/month
  
- [ ] **Compare with Current Setup**
  - [ ] Current: EC2 ($15-20/month)
  - [ ] AWS Media: Estimated $XXX/month
  - [ ] Decision: Use case analysis

### 🔍 Technical Requirements

- [ ] **Determine Input Format**
  - [ ] RTMP push from Liquidsoap
  - [ ] HLS pull from Icecast
  - [ ] RTP push (professional)
  
- [ ] **Determine Output Formats**
  - [ ] HLS (required for web)
  - [ ] DASH (optional)
  - [ ] CMAF (future)
  
- [ ] **Determine Encoding Profiles**
  - [ ] 192 kbps MP3 (current)
  - [ ] 128 kbps AAC (mobile)
  - [ ] 320 kbps AAC (high quality)
  - [ ] Multiple bitrates (ABR)

## 📋 TODO List - Phase 2: Test Setup

### 🛠️ Infrastructure Setup

- [ ] **Create MediaLive Channel**
  - [ ] Choose channel class (SINGLE_PIPELINE for testing)
  - [ ] Configure input (RTMP push)
  - [ ] Set up input security group
  - [ ] Configure encoding profile (192 kbps AAC)
  - [ ] Configure output (MediaPackage)
  
- [ ] **Create MediaPackage Channel**
  - [ ] Create channel
  - [ ] Create origin endpoint (HLS)
  - [ ] Configure DVR window (optional)
  - [ ] Set up CloudFront distribution
  
- [ ] **Configure Liquidsoap Output**
  - [ ] Install FFmpeg on EC2
  - [ ] Configure RTMP output to MediaLive
  - [ ] Test connection
  - [ ] Verify audio quality
  
- [ ] **Configure CloudFront**
  - [ ] Create distribution for MediaPackage
  - [ ] Configure SSL (ACM)
  - [ ] Set up custom domain (stream.splashfm.nl)
  - [ ] Configure caching (no cache for manifest)

### 🧪 Testing

- [ ] **Test Stream Ingestion**
  - [ ] Verify MediaLive receives RTMP
  - [ ] Check input metrics (bitrate, errors)
  - [ ] Test failover (if redundant)
  
- [ ] **Test Encoding**
  - [ ] Verify audio quality
  - [ ] Check encoding latency
  - [ ] Test bitrate accuracy
  
- [ ] **Test Packaging**
  - [ ] Verify HLS manifest generation
  - [ ] Check segment size and duration
  - [ ] Test DVR window (if enabled)
  
- [ ] **Test Playback**
  - [ ] Web player (HLS.js)
  - [ ] Mobile Safari (native HLS)
  - [ ] Desktop browsers
  - [ ] Test latency (end-to-end)
  
- [ ] **Test Failover**
  - [ ] Disconnect input
  - [ ] Verify slate/error handling
  - [ ] Test reconnection

### 📊 Performance Testing

- [ ] **Measure Latency**
  - [ ] Liquidsoap → MediaLive: X seconds
  - [ ] MediaLive → MediaPackage: X seconds
  - [ ] MediaPackage → CloudFront: X seconds
  - [ ] CloudFront → User: X seconds
  - [ ] Total: X seconds (target: < 10s)
  
- [ ] **Measure Quality**
  - [ ] Audio bitrate stability
  - [ ] Encoding artifacts
  - [ ] Buffer stability
  
- [ ] **Measure Cost**
  - [ ] Track actual costs for 24 hours
  - [ ] Extrapolate to monthly
  - [ ] Compare with estimate

## 📋 TODO List - Phase 3: Integration

### 🔌 Liquidsoap Integration

- [ ] **Configure RTMP Output**
  ```liquidsoap
  output.file.hls(
    playlist="live.m3u8",
    segment_duration=2.0,
    segments=5,
    "/tmp/hls"
  )
  
  # Or push to MediaLive RTMP endpoint
  output.url(
    fallible=true,
    %ffmpeg(
      format="flv",
      %audio(codec="aac", b="192k")
    ),
    "rtmp://MEDIALIVE_ENDPOINT/APP/STREAM"
  )
  ```
  
- [ ] **Add Metadata Injection**
  - [ ] ID3 tags for HLS
  - [ ] Timed metadata
  - [ ] SCTE-35 markers (future)
  
- [ ] **Add Monitoring**
  - [ ] Check connection status
  - [ ] Monitor bitrate
  - [ ] Alert on disconnect

### 🎮 Player Integration

- [ ] **Implement HLS Player**
  - [ ] Install HLS.js library
  - [ ] Create player component
  - [ ] Configure for low latency
  - [ ] Add quality selector (ABR)
  
- [ ] **Update UI**
  - [ ] Add "AWS Media" source option
  - [ ] Toggle between Icecast/MediaLive
  - [ ] Show stream type indicator
  
- [ ] **Add Monitoring**
  - [ ] Current bitrate
  - [ ] Buffer length
  - [ ] Quality level
  - [ ] Error tracking

### 📡 IoT Integration

- [ ] **Update Metadata Publishing**
  - [ ] Parse MediaPackage events
  - [ ] Publish to IoT topics
  - [ ] Maintain backward compatibility
  
- [ ] **Add MediaLive Events**
  - [ ] Input state changes
  - [ ] Encoding alerts
  - [ ] Publish to monitoring topic

### 🔧 Infrastructure as Code

- [ ] **Create CDK Stack**
  ```typescript
  // amplify/backend.ts
  
  // MediaLive Channel
  const mediaLiveChannel = new medialive.CfnChannel(...)
  
  // MediaPackage Channel
  const mediaPackageChannel = new mediapackage.CfnChannel(...)
  
  // CloudFront Distribution
  const distribution = new cloudfront.Distribution(...)
  ```
  
- [ ] **Add Outputs**
  - [ ] MediaLive endpoint URL
  - [ ] MediaPackage HLS endpoint
  - [ ] CloudFront stream URL
  
- [ ] **Add IAM Roles**
  - [ ] MediaLive → MediaPackage
  - [ ] MediaPackage → MediaStore
  - [ ] CloudFront → MediaPackage

## 📋 TODO List - Phase 4: Production Deployment

### 🚀 Deployment

- [ ] **Deploy Infrastructure**
  - [ ] Run CDK deploy
  - [ ] Verify all resources created
  - [ ] Test endpoints
  
- [ ] **Configure DNS**
  - [ ] Add stream.splashfm.nl CNAME
  - [ ] Verify SSL certificate
  - [ ] Test HTTPS access
  
- [ ] **Update Liquidsoap**
  - [ ] Deploy new configuration
  - [ ] Test RTMP push
  - [ ] Verify stream active
  
- [ ] **Update Player**
  - [ ] Deploy new player code
  - [ ] Test playback
  - [ ] Verify metadata

### 📊 Monitoring Setup

- [ ] **CloudWatch Dashboards**
  - [ ] MediaLive metrics
  - [ ] MediaPackage metrics
  - [ ] CloudFront metrics
  - [ ] Combined overview
  
- [ ] **CloudWatch Alarms**
  - [ ] Input disconnect
  - [ ] Encoding errors
  - [ ] High latency
  - [ ] Cost threshold
  
- [ ] **Logging**
  - [ ] MediaLive logs → CloudWatch
  - [ ] MediaPackage access logs → S3
  - [ ] CloudFront logs → S3

### 🧪 Production Testing

- [ ] **Smoke Test**
  - [ ] Stream starts
  - [ ] Playback works
  - [ ] Metadata flows
  - [ ] No errors
  
- [ ] **Load Test**
  - [ ] Simulate 100 concurrent users
  - [ ] Check performance
  - [ ] Monitor costs
  
- [ ] **Failover Test**
  - [ ] Disconnect input
  - [ ] Verify recovery
  - [ ] Check user experience

## 📋 TODO List - Phase 5: Optimization

### ⚡ Performance Optimization

- [ ] **Low Latency Mode**
  - [ ] Enable MediaLive low latency
  - [ ] Configure short segments (2s)
  - [ ] Reduce MediaPackage buffer
  - [ ] Optimize player settings
  - [ ] Target: < 5s latency
  
- [ ] **ABR Optimization**
  - [ ] Add multiple bitrates
  - [ ] Configure ladder (64k, 128k, 192k, 320k)
  - [ ] Test switching behavior
  - [ ] Optimize for mobile

### 💰 Cost Optimization

- [ ] **Right-Size Channel**
  - [ ] Test with SINGLE_PIPELINE
  - [ ] Evaluate if STANDARD needed
  - [ ] Optimize encoding profiles
  
- [ ] **Optimize DVR Window**
  - [ ] Determine actual need
  - [ ] Reduce if possible
  - [ ] Use MediaStore efficiently
  
- [ ] **Optimize CloudFront**
  - [ ] Configure proper caching
  - [ ] Use price class wisely
  - [ ] Review data transfer

### 📈 Feature Enhancements

- [ ] **DVR / Time-Shift**
  - [ ] Enable DVR window
  - [ ] Add UI controls
  - [ ] Test playback
  
- [ ] **Live-to-VOD**
  - [ ] Configure harvesting
  - [ ] Store in S3
  - [ ] Create VOD library
  
- [ ] **Multi-Quality**
  - [ ] Implement ABR
  - [ ] Add quality selector
  - [ ] Auto quality switching
  
- [ ] **SCTE-35 Markers**
  - [ ] Ad insertion points
  - [ ] Chapter markers
  - [ ] Metadata events

## 📚 Reference Links

### Documentation
- [AWS MediaLive](https://docs.aws.amazon.com/medialive/)
- [AWS MediaPackage](https://docs.aws.amazon.com/mediapackage/)
- [AWS MediaStore](https://docs.aws.amazon.com/mediastore/)
- [AWS MediaConnect](https://docs.aws.amazon.com/mediaconnect/)

### Pricing
- [MediaLive Pricing](https://aws.amazon.com/medialive/pricing/)
- [MediaPackage Pricing](https://aws.amazon.com/mediapackage/pricing/)
- [MediaStore Pricing](https://aws.amazon.com/mediastore/pricing/)
- [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)

### Tutorials
- [Getting Started with MediaLive](https://docs.aws.amazon.com/medialive/latest/ug/getting-started.html)
- [HLS Streaming Tutorial](https://aws.amazon.com/blogs/media/create-a-live-streaming-channel-using-aws-elemental-medialive-and-aws-elemental-mediapackage/)
- [Low Latency Streaming](https://aws.amazon.com/blogs/media/reduce-latency-for-live-video-streaming/)

## 💡 Decision Points

### When to Use AWS Media Services?

**Pros:**
- ✅ Broadcast-grade quality
- ✅ Scalable to millions of viewers
- ✅ Professional features (ABR, DVR, time-shift)
- ✅ Managed service (no server maintenance)
- ✅ Global distribution (built-in)
- ✅ Advanced features (SCTE-35, DRM, etc.)

**Cons:**
- ❌ Higher cost (~$XXX/month vs $15/month)
- ❌ More complex setup
- ❌ Overkill for small streams (<1000 viewers)
- ❌ Less control over encoding
- ❌ Requires RTMP/HLS from source

### Use Cases for Demo

**Good For:**
- 🎯 Professional broadcast demo
- 🎯 Scalability demonstration
- 🎯 Testing advanced features (ABR, DVR)
- 🎯 Client presentations
- 🎯 Large events (>1000 viewers)

**Not Needed For:**
- ⚠️ Daily operations with <100 viewers
- ⚠️ Cost-sensitive deployments
- ⚠️ Simple audio streaming
- ⚠️ Internal testing

## 🎯 Success Criteria

### Test Setup Success
- [ ] MediaLive channel running
- [ ] Stream ingestion working
- [ ] HLS playback functional
- [ ] Latency < 10 seconds
- [ ] Audio quality maintained
- [ ] Cost understood

### Production Success
- [ ] Reliable 24/7 operation
- [ ] Latency < 5 seconds (low latency mode)
- [ ] Quality equals or exceeds current
- [ ] Cost justified by features
- [ ] Easy to switch back to Icecast

## 📝 Notes

### Current Setup (Baseline)
```
Cost: ~$15/month (EC2)
Latency: 2-3 seconds
Quality: 192 kbps MP3
Viewers: <100 concurrent
Features: Basic streaming
```

### AWS Media Setup (Target)
```
Cost: ~$XXX/month (to be determined)
Latency: 3-5 seconds (low latency mode)
Quality: 192 kbps AAC (or ABR)
Viewers: Unlimited (auto-scaling)
Features: ABR, DVR, analytics, etc.
```

### Hybrid Approach
```
Option: Keep both setups
- Icecast for daily operations
- AWS Media for demos/events
- Toggle via feature flag
```

## ⏱️ Estimated Timeline

**Phase 1 (Research):** 1-2 days
**Phase 2 (Test Setup):** 2-3 days
**Phase 3 (Integration):** 3-5 days
**Phase 4 (Production):** 1-2 days
**Phase 5 (Optimization):** Ongoing

**Total:** 7-12 days for complete implementation

---

**Status:** 📋 Planning Phase - Ready to Start Research  
**Priority:** Future Enhancement (after playlist & go live)  
**Dependencies:** Current streaming setup stable  
**Budget:** TBD (cost analysis needed)

**Gerard: "Demo setup voor professional broadcasting!"** 🎥🚀
