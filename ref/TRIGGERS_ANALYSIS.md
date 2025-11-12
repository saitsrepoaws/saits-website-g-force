# 🔄 Triggers & Automation Analysis

**Vraag**: Zitten er triggers op de Lambda die bij elke verandering de nieuwe playlist stuurt en de settings van crossfading bij het opslaan in de UI?

**Antwoord**: ❌ **NEE - Alleen tijd-gebaseerde triggers**

---

## 📋 Huidige Trigger Situatie

### ✅ Wat WEL bestaat

#### 1. **EventBridge Timer - Playlist Updater**
```typescript
// amplify/backend.ts:586
ruleName: 'StreamPlaylistEvery5Minutes'
schedule: events.Schedule.rate(Duration.minutes(5))
→ Triggers: stream-playlist-updater Lambda
```

**Frequentie**: Elke 5 minuten
**Actie**: 
- Haalt schedule slot op
- Genereert playlist
- Analyseert crossfade
- Upload naar S3

**Probleem**: Settings updates worden pas opgepikt bij volgende 5-min cycle!

#### 2. **EventBridge Timer - Status Publisher**
```typescript
// amplify/backend.ts:631
ruleName: 'StreamStatusEveryMinute'
schedule: events.Schedule.rate(Duration.minutes(1))
→ Triggers: stream-status-publisher Lambda
```

**Frequentie**: Elke 1 minuut
**Actie**:
- Publiceert stream status naar IoT
- Checkt track wijzigingen
- Kan playlist updater triggeren (bij track change)

---

### ❌ Wat NIET bestaat

#### 1. **DynamoDB Stream Trigger op StreamSettings**
```
❌ GEEN DynamoDB Stream enabled
❌ GEEN Lambda trigger bij settings wijziging
❌ GEEN automatische playlist update bij save
```

**Gevolg**: 
- Je slaat settings op in UI
- Maar playlist updater wacht tot volgende 5-min cycle
- Crossfade wijzigingen zijn niet real-time

#### 2. **Direct Lambda Invocatie vanuit UI**
```typescript
// StreamSettings.tsx - saveSettings() functie
await client.models.StreamSettings.update(updateData)
// ↑ Stopt hier! Geen Lambda call
```

**Gevolg**: 
- Settings opgeslagen in DynamoDB ✅
- Maar geen trigger naar playlist updater ❌
- Geen directe crossfade config update ❌

#### 3. **S3 Trigger naar EC2**
```
❌ GEEN S3 event notification
❌ GEEN auto-download script op EC2
❌ GEEN Liquidsoap reload bij config change
```

**Gevolg**:
- Config in S3 geüpdatet ✅
- Maar EC2 download niet automatisch ❌
- Liquidsoap gebruikt oude config ❌

---

## 🔄 Huidige Flow (met delays)

### Scenario: User wijzigt crossfade settings in UI

```
1. User: Wijzigt settings in UI
   ↓
2. UI: Slaat op in DynamoDB StreamSettings
   ↓ (WAIT: tot 5 minuten!)
   ↓
3. EventBridge: Triggert playlist-updater (5-min timer)
   ↓
4. Lambda: Leest nieuwe settings uit DynamoDB
   ↓
5. Lambda: Analyseert crossfade met nieuwe settings
   ↓
6. Lambda: Upload config naar S3
   ↓ (WAIT: indefinite - geen auto-sync!)
   ↓
7. EC2: ??? Moet handmatig downloaden
   ↓
8. Liquidsoap: ??? Moet handmatig herladen
```

**Totale delay**: 5 minuten + onbekend (manual sync)

---

## ⚡ Ideale Flow (met instant triggers)

### Wat het ZOU moeten zijn:

```
1. User: Wijzigt settings in UI
   ↓
2. UI: Slaat op in DynamoDB StreamSettings
   ↓ (INSTANT!)
   ↓
3. DynamoDB Stream: Triggert Lambda
   ↓
4. Lambda: Leest nieuwe settings
   ↓
5. Lambda: Genereert nieuwe crossfade config
   ↓
6. Lambda: Upload naar S3
   ↓ (INSTANT!)
   ↓
7. S3 Event: Triggert EC2 sync script (via SNS/SQS)
   ↓
8. EC2: Download nieuwe config
   ↓
9. Liquidsoap: Reload config (graceful)
   ↓
10. Stream: Nieuwe crossfade actief! 🎉
```

**Totale delay**: <10 seconden

---

## 🛠️ Oplossingen

### Optie 1: DynamoDB Stream Trigger (Recommended)

**Wat**: Trigger Lambda bij elke StreamSettings wijziging

**Implementatie**:

#### A. Enable DynamoDB Stream
```typescript
// amplify/data/resource.ts
StreamSettings: a.model({
  // ... existing fields
}).identifier(['settingKey'])
  .authorization((allow) => [allow.authenticated()])
  .enableStream() // ← Add this
```

#### B. Create Stream Handler Lambda
```typescript
// amplify/functions/stream-settings-handler/handler.ts
export const handler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName === 'MODIFY' || record.eventName === 'INSERT') {
      const newSettings = record.dynamodb.NewImage
      
      // Trigger playlist updater
      await lambda.invoke({
        FunctionName: process.env.PLAYLIST_UPDATER_FUNCTION,
        InvocationType: 'Event' // Async
      })
      
      console.log('✅ Triggered playlist update after settings change')
    }
  }
}
```

#### C. Configure Trigger
```typescript
// amplify/backend.ts
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'

const settingsTable = backend.data.resources.tables['StreamSettings']

const settingsHandlerLambda = backend.streamSettingsHandler.resources.lambda

settingsHandlerLambda.addEventSource(
  new DynamoEventSource(settingsTable, {
    startingPosition: lambda.StartingPosition.LATEST,
    batchSize: 1
  })
)
```

**Result**: Settings update → Instant playlist update!

---

### Optie 2: Direct Lambda Invocatie vanuit UI

**Wat**: UI roept Lambda direct aan na opslaan

**Implementatie**:

#### A. Update UI
```typescript
// StreamSettings.tsx - saveSettings()
const saveSettings = async () => {
  try {
    // Save to DynamoDB
    await client.models.StreamSettings.update(updateData)
    
    // Trigger playlist updater immediately
    const response = await fetch('/api/trigger-playlist-update', {
      method: 'POST'
    })
    
    showMessage('success', '✅ Settings saved and playlist updating!')
  } catch (error) {
    console.error('Error:', error)
  }
}
```

#### B. Create API Endpoint
```typescript
// amplify/functions/trigger-playlist-update/handler.ts
export const handler = async () => {
  // Invoke playlist updater
  await lambda.invoke({
    FunctionName: process.env.PLAYLIST_UPDATER_FUNCTION,
    InvocationType: 'Event'
  })
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Playlist update triggered' })
  }
}
```

**Result**: User clicks save → Instant trigger!

---

### Optie 3: Hybrid (Best of Both)

**Combine**: 
- DynamoDB Stream (for automatic triggers)
- Manual refresh button in UI (for instant user control)

**UI Addition**:
```typescript
<button 
  onClick={async () => {
    await fetch('/api/trigger-playlist-update', { method: 'POST' })
    showMessage('success', 'Playlist update triggered!')
  }}
  className="px-4 py-2 bg-blue-500 text-white rounded"
>
  🔄 Apply Changes Now
</button>
```

**Result**: 
- Automatic on save (DynamoDB Stream)
- Manual override (refresh button)
- Best user experience!

---

## 📊 Trigger Comparison

| Trigger Type | Delay | Automatic | User Control | Complexity |
|--------------|-------|-----------|--------------|------------|
| EventBridge (current) | 5 min | ✅ Yes | ❌ No | Low |
| DynamoDB Stream | <1 sec | ✅ Yes | ❌ No | Medium |
| Direct Invoke | <1 sec | ❌ No | ✅ Yes | Low |
| Hybrid | <1 sec | ✅ Yes | ✅ Yes | Medium |

---

## 🎯 Recommended Implementation

### Phase 1: Quick Win (Now - 30 min)

**Add manual refresh button in UI**:

```typescript
// StreamSettings.tsx
const triggerPlaylistUpdate = async () => {
  try {
    setIsUpdating(true)
    
    // Direct Lambda invoke via API
    const response = await fetch(`${API_ENDPOINT}/trigger-playlist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getCurrentToken()}`
      }
    })
    
    if (response.ok) {
      showMessage('success', '✅ Playlist update started!')
    }
  } catch (error) {
    showMessage('error', 'Failed to trigger update')
  } finally {
    setIsUpdating(false)
  }
}

// In render:
<button onClick={triggerPlaylistUpdate} disabled={isUpdating}>
  {isUpdating ? '⏳ Updating...' : '🔄 Apply Changes Now'}
</button>
```

**Result**: User can force immediate update!

### Phase 2: Full Automation (This Week - 2 hours)

**Implement DynamoDB Stream**:

1. Enable stream on StreamSettings table
2. Create stream handler Lambda
3. Configure trigger in backend.ts
4. Test automatic updates

**Result**: Zero-delay settings updates!

### Phase 3: EC2 Integration (Future - 4 hours)

**Auto-sync crossfade to EC2**:

1. SNS topic on S3 config upload
2. EC2 subscribed to SNS
3. Download script triggered
4. Liquidsoap graceful reload

**Result**: Full end-to-end automation!

---

## 🔍 Current Gaps Summary

### Settings → Lambda
```
❌ No DynamoDB Stream
❌ No direct invocation
✅ Only 5-min EventBridge timer
```

**Impact**: 0-5 minute delay

### Lambda → EC2
```
❌ No S3 event notification
❌ No auto-download on EC2
❌ No Liquidsoap reload automation
```

**Impact**: Manual sync needed

### Complete Flow
```
UI Save → DynamoDB ✅
       ↓
    (5 min wait) ⏳
       ↓
Lambda reads settings ✅
       ↓
S3 upload ✅
       ↓
    (manual) ❌
       ↓
EC2 sync ❌
```

---

## 💡 Quick Action Items

### DO THIS NOW (5 min):
```typescript
// Add to StreamSettings.tsx after save button:

<div className="mt-4 text-sm text-gray-600">
  ℹ️ Note: Changes will apply within 5 minutes (next playlist update cycle)
  
  <button 
    onClick={triggerPlaylistUpdate}
    className="ml-4 px-3 py-1 bg-blue-500 text-white text-xs rounded"
  >
    🔄 Apply Immediately
  </button>
</div>
```

### DO THIS WEEK:
1. Enable DynamoDB Stream on StreamSettings
2. Create stream handler Lambda
3. Test automatic triggers
4. Remove "5 minutes" note from UI

### DO LATER:
1. EC2 auto-sync script
2. Liquidsoap dynamic reload
3. Real-time UI updates via IoT

---

## 🎉 Summary

**Huidige situatie**:
- ❌ Geen instant triggers
- ⏳ 5 minuten delay via EventBridge
- ❌ Manual EC2 sync needed

**Na implementatie**:
- ✅ Instant DynamoDB Stream trigger
- ✅ <1 seconde settings → Lambda
- ✅ User control met refresh button
- ✅ Automatic playlist updates

**Wil je dat ik een van deze oplossingen implementeer?** 🚀
