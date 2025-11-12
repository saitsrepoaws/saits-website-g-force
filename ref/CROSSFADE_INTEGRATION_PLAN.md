# Crossfade UI → EC2 Integration Plan

**Doel**: 1-op-1 koppeling tussen StreamSettings UI en Liquidsoap config op EC2

---

## 📋 Wat We Gaan Doen

### 1. Lambda Config Generator (Updated)
- ✅ Load settings from DynamoDB  
- 🔄 **Generate Liquidsoap config met UI values**
- ✅ Upload to S3

### 2. EC2 Sync Script (NEW)
- 🆕 Download config from S3
- 🆕 Apply to Liquidsoap
- 🆕 Graceful reload

### 3. UI Trigger (Optional)
- 🆕 "Apply Now" button
- Triggers Lambda directly

---

## 🎯 Implementatie Stappen

### Step 1: Update Lambda Config Generator

**File**: `amplify/functions/utils/liquidsoap-config-generator.ts` (NEW)

```typescript
interface CrossfadeSettings {
  enabled: boolean
  fadeIn: number
  fadeOut: number
  normalize: boolean
  preset: string
}

export function generateLiquidsoapConfig(settings: CrossfadeSettings): string {
  const timestamp = new Date().toISOString()
  
  if (!settings.enabled) {
    return `# Crossfade disabled (${timestamp})\n# No crossfade applied\n`
  }
  
  return `# Generated from StreamSettings UI
# Timestamp: ${timestamp}
# Preset: ${settings.preset}

# Custom crossfade transition
def ui_crossfade_transition(a, b) =
  # Fade durations from UI (${settings.preset})
  fade_in = ${settings.fadeIn}
  fade_out = ${settings.fadeOut}
  
  # Apply smooth sine fades
  a = fade.out(duration=fade_out, type="sin", a)
  b = fade.in(duration=fade_in, type="sin", b)
  
  # Mix both sources
  add(normalize=false, [a, b])
end

# Apply crossfade (assuming 'radio' source exists)
radio = cross(duration=${Math.max(settings.fadeIn, settings.fadeOut) + 2}.0, ui_crossfade_transition, radio)

${settings.normalize ? '# Normalize audio levels\nradio = normalize(target=-14.0, radio)' : '# Normalization disabled'}

# End of UI-generated crossfade config
`
}
```

### Step 2: Update stream-playlist-updater Lambda

**File**: `amplify/functions/stream-playlist-updater/handler.ts`

```typescript
import { generateLiquidsoapConfig } from '../utils/liquidsoap-config-generator'

// In handler, after loading settings:
const crossfadeSettings = {
  enabled: settings.crossfadeEnabled ?? true,
  fadeIn: settings.crossfadeFadeIn ?? 2.0,
  fadeOut: settings.crossfadeFadeOut ?? 3.0,
  normalize: settings.crossfadeNormalize ?? true,
  preset: settings.crossfadePreset ?? 'techno'
}

const liquidsoapConfig = generateLiquidsoapConfig(crossfadeSettings)

// Upload to S3
await s3.send(new PutObjectCommand({
  Bucket: PLAYLIST_BUCKET,
  Key: 'liquidsoap-crossfade.liq',
  Body: liquidsoapConfig,
  ContentType: 'text/plain'
}))

console.log('✅ Liquidsoap config generated and uploaded')
```

### Step 3: EC2 Sync Script

**File**: `/opt/radio/sync-crossfade.sh` (NEW on EC2)

```bash
#!/bin/bash

S3_BUCKET="radio-playlists-035636364722"
CONFIG_FILE="/opt/radio/crossfade-dynamic.liq"
MAIN_CONFIG="/opt/radio/radio.liq"
LOG_FILE="/var/log/crossfade-sync.log"

echo "[$(date)] Starting crossfade sync..." >> $LOG_FILE

# Download latest config from S3
aws s3 cp s3://${S3_BUCKET}/liquidsoap-crossfade.liq ${CONFIG_FILE} 2>> $LOG_FILE

if [ $? -eq 0 ]; then
  echo "[$(date)] ✅ Config downloaded successfully" >> $LOG_FILE
  
  # Test Liquidsoap config syntax
  liquidsoap --check ${MAIN_CONFIG} 2>> $LOG_FILE
  
  if [ $? -eq 0 ]; then
    echo "[$(date)] ✅ Config syntax valid" >> $LOG_FILE
    
    # Graceful reload
    systemctl reload liquidsoap-radio
    
    if [ $? -eq 0 ]; then
      echo "[$(date)] ✅ Liquidsoap reloaded successfully" >> $LOG_FILE
    else
      echo "[$(date)] ❌ Failed to reload Liquidsoap" >> $LOG_FILE
      exit 1
    fi
  else
    echo "[$(date)] ❌ Invalid Liquidsoap config syntax" >> $LOG_FILE
    exit 1
  fi
else
  echo "[$(date)] ❌ Failed to download config from S3" >> $LOG_FILE
  exit 1
fi

echo "[$(date)] Sync completed" >> $LOG_FILE
```

### Step 4: Update Main Liquidsoap Config

**File**: `/opt/radio/radio.liq` (MODIFY on EC2)

```liquidsoap
# ... existing config ...

# Create playlist source
radio = playlist(playlist_file, mode="normal", reload_mode="watch", reload=300)

# Fallback to silence
radio = fallback(track_sensitive=false, [radio, blank()])

# === DYNAMIC CROSSFADE (UI-controlled) ===
%include "/opt/radio/crossfade-dynamic.liq"
# This file is auto-generated from UI settings

# ... rest of config ...

output.icecast(...)
```

### Step 5: Cron Job (EC2)

```bash
# Edit crontab
crontab -e

# Add: Sync every 5 minutes
*/5 * * * * /opt/radio/sync-crossfade.sh
```

---

## 🔄 Complete Flow

```
1. User changes settings in UI
   ├─ crossfadeFadeIn: 3.0
   ├─ crossfadeFadeOut: 2.5
   └─ crossfadePreset: "progressive"
   ↓
2. Click "Save" → DynamoDB update
   ↓
3. EventBridge triggers playlist-updater (5 min)
   OR
   User clicks "Apply Now" (instant)
   ↓
4. Lambda reads DynamoDB settings
   ↓
5. Lambda generates Liquidsoap config:
   ```liquidsoap
   def ui_crossfade_transition(a, b) =
     fade_in = 3.0
     fade_out = 2.5
     ...
   end
   radio = cross(duration=5.0, ui_crossfade_transition, radio)
   radio = normalize(target=-14.0, radio)
   ```
   ↓
6. Lambda uploads to S3: liquidsoap-crossfade.liq
   ↓
7. EC2 cron (every 5 min):
   - Download from S3
   - Validate syntax
   - Reload Liquidsoap
   ↓
8. ✅ New crossfade settings active!
```

---

## 🎮 UI Changes

### Add "Apply Now" Button

**File**: `apps/web/src/pages/devices/StreamSettings.tsx`

```typescript
const triggerCrossfadeUpdate = async () => {
  try {
    setIsUpdating(true)
    
    // Invoke Lambda directly
    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/trigger-crossfade-update`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getCurrentToken()}`
        }
      }
    )
    
    if (response.ok) {
      setMessage({ 
        type: 'success', 
        text: '✅ Crossfade update triggered! Changes will be active within 1 minute.' 
      })
    }
  } catch (error) {
    setMessage({ type: 'error', text: 'Failed to trigger update' })
  } finally {
    setIsUpdating(false)
  }
}

// In render (after save button):
<button
  onClick={triggerCrossfadeUpdate}
  disabled={isUpdating}
  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
>
  {isUpdating ? '⏳ Updating...' : '🔄 Apply to Stream Now'}
</button>
```

---

## ✅ Testing Checklist

### 1. Config Generation
- [ ] Lambda generates correct Liquidsoap syntax
- [ ] Fade durations match UI values
- [ ] Presets work correctly
- [ ] Normalize toggle works

### 2. S3 Upload
- [ ] File uploaded successfully
- [ ] Content-Type is text/plain
- [ ] File is readable

### 3. EC2 Download
- [ ] Script downloads from S3
- [ ] AWS credentials work
- [ ] File permissions correct

### 4. Liquidsoap Reload
- [ ] Syntax validation passes
- [ ] Reload doesn't interrupt stream
- [ ] New settings are applied
- [ ] Logs show success

### 5. End-to-End
- [ ] Change UI setting
- [ ] Save
- [ ] Wait 5 min (or trigger)
- [ ] Check stream has new crossfade
- [ ] Listen for quality

---

## 🚨 Error Handling

### Lambda
```typescript
try {
  const config = generateLiquidsoapConfig(settings)
  await uploadToS3(config)
  console.log('✅ Config uploaded')
} catch (error) {
  console.error('❌ Failed to generate/upload config:', error)
  // Fall back to default config
}
```

### EC2 Script
```bash
# Backup before applying
cp $CONFIG_FILE ${CONFIG_FILE}.backup

# If reload fails, restore backup
if [ $? -ne 0 ]; then
  cp ${CONFIG_FILE}.backup $CONFIG_FILE
  systemctl reload liquidsoap-radio
fi
```

---

## 📊 Monitoring

### CloudWatch Logs
```
✅ Settings loaded from DynamoDB
✅ Liquidsoap config generated (preset: progressive)
✅ Config uploaded to S3
```

### EC2 Logs
```bash
tail -f /var/log/crossfade-sync.log
tail -f /var/log/liquidsoap/radio.log | grep -i crossfade
```

### Icecast Status
```bash
curl -s http://localhost:8000/status-json.xsl | jq '.icestats.source'
```

---

## 🎯 Priority

**Phase 1 (Must Have - Now)**:
1. ✅ Lambda config generator
2. ✅ S3 upload
3. ✅ EC2 sync script
4. ✅ Cron setup

**Phase 2 (Nice to Have - Later)**:
5. ⏳ "Apply Now" button
6. ⏳ Real-time status in UI
7. ⏳ Preview before apply

**Phase 3 (Future)**:
8. 🔮 Upgrade to Liquidsoap 2.2.5+
9. 🔮 Enable autocue
10. 🔮 Smart features in Liquidsoap

---

## 🎉 Result

Na implementatie:
- ✅ UI settings → Direct naar EC2
- ✅ Presets werken (Techno, Progressive, etc.)
- ✅ Custom fade durations
- ✅ Normalize toggle
- ✅ Graceful reload (no interruption)
- ✅ Max 5 min delay (of instant met button)

**Professional radio station quality crossfades!** 🎵✨
