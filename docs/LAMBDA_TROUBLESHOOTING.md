# Lambda Troubleshooting Guide

## 🐛 Common Issues & Solutions

### Issue 1: GraphQL Returns `undefined` for New Fields

**Symptom:**
```javascript
// Console shows:
{bpm: undefined, key: undefined, energy: undefined}
```

**Root Cause:**
- Added new fields to DynamoDB schema
- Lambda writes data successfully to DynamoDB
- BUT: GraphQL schema not synchronized with AppSync
- Frontend queries return `undefined` for new fields

**How to Diagnose:**
1. Check DynamoDB directly:
```bash
aws dynamodb get-item --table-name TABLE_NAME --key '{"id":{"S":"TRACK_ID"}}' --output json
```
2. If DynamoDB HAS data but frontend shows `undefined` → Schema sync issue

**Fix:**
```bash
# Re-deploy Amplify backend to sync GraphQL schema
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once

# Copy updated schema to web app
cp amplify_outputs.json apps/web/public/amplify_outputs.json

# Hard refresh browser (Cmd+Shift+R)
```

**Prevention:**
- Always deploy backend after schema changes
- Check `amplify_outputs.json` is copied to web app
- Verify GraphQL schema includes new fields

---

### Issue 2: Lambda Writes to DynamoDB but UI Shows Old Data

**Symptom:**
- Lambda logs show "Track updated successfully"
- DynamoDB has correct data
- UI shows old values (BPM: 0, Energy: -)

**Root Cause:**
- Frontend loaded data BEFORE Lambda finished
- Polling timeout too short
- Browser cache

**Fix:**
```typescript
// In Libery.tsx - increase polling delay
setTimeout(async () => {
  const updated = await listTracks()
  if (updated.data) {
    setTracks(updated.data)
  }
}, 5000) // Wait 5 seconds for Lambda
```

**Better Solution:**
Use GraphQL subscriptions to listen for updates:
```typescript
subscribeToTracks(
  undefined, // onCreate
  (track) => {
    // onUpdate - refresh UI when track updated
    loadTracksFromDB()
  }
)
```

---

### Issue 3: DynamoDB Reserved Words Error

**Symptom:**
```
ValidationException: Invalid UpdateExpression: Attribute name is a reserved keyword
```

**Root Cause:**
DynamoDB has reserved keywords: `key`, `duration`, `data`, etc.

**Fix:**
Use `ExpressionAttributeNames`:
```typescript
await dynamoClient.send(new UpdateCommand({
  TableName: tableName,
  Key: { id: track.id },
  UpdateExpression: 'SET #key = :key, #dur = :duration',
  ExpressionAttributeNames: {
    '#key': 'key',      // 'key' is reserved
    '#dur': 'duration', // 'duration' is reserved
  },
  ExpressionAttributeValues: {
    ':key': metadata.key,
    ':duration': metadata.duration,
  },
}))
```

**Common Reserved Words:**
- `key`, `name`, `data`, `timestamp`, `status`, `type`
- `count`, `date`, `time`, `year`, `month`, `day`
- `value`, `size`, `format`, `owner`, `group`

---

### Issue 4: Lambda Extracts Data but Doesn't Update Database

**Symptom:**
- Lambda logs show metadata extraction
- NO "Finding track" or "Track updated" logs
- Database unchanged

**Root Cause:**
- `updateTrackInDatabase()` function not called
- Try-catch silently swallowing errors
- Environment variable `TRACK_TABLE_NAME` not set

**Diagnosis:**
```bash
# Check if Lambda has table name
aws lambda get-function --function-name FUNCTION_NAME \
  --query 'Configuration.Environment.Variables.TRACK_TABLE_NAME'
```

**Fix:**
```typescript
// In backend.ts - ensure environment variable is set
backend.audioMetadata.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)

// In handler.ts - add explicit error logging
try {
  await updateTrackInDatabase(s3Key, metadata)
  console.log('Track updated in database successfully')
} catch (error) {
  console.error('CRITICAL: Failed to update track in database:', error)
  throw error // Don't swallow the error!
}
```

---

### Issue 5: Frontend Shows Stale Data After Upload

**Symptom:**
- Upload track → Success
- Click ℹ️ immediately → Shows BPM: 0
- Wait 10 seconds, click again → Shows BPM: 128

**Root Cause:**
- Lambda takes 500-1000ms to process
- Frontend shows track before Lambda updates it
- Polling happens but modal already open with old data

**Fix 1: Close and Reopen Modal**
```typescript
// User must close modal and reopen to see fresh data
```

**Fix 2: Auto-refresh Modal After Delay**
```typescript
useEffect(() => {
  if (showTrackInfo && selectedTrack) {
    // Refresh track data after 5 seconds
    const timer = setTimeout(async () => {
      const { data } = await getTrack(selectedTrack.id)
      if (data) {
        setSelectedTrack(data)
      }
    }, 5000)
    
    return () => clearTimeout(timer)
  }
}, [showTrackInfo, selectedTrack])
```

**Fix 3: Show Loading State**
```typescript
{(selectedTrack as any).bpm === 0 && (
  <div className="text-xs text-gray-500 mt-1">
    ⏳ Analyzing audio... refresh in 5 seconds
  </div>
)}
```

---

## 🔍 Debugging Checklist

### When Lambda Data Doesn't Appear in UI:

1. **Check Lambda Logs**
```bash
aws logs tail /aws/lambda/FUNCTION_NAME --since 5m --format short
```
Look for:
- ✅ "Extracted metadata with features"
- ✅ "Finding track with fileUrl"
- ✅ "Track updated with audio features"

2. **Check DynamoDB**
```bash
aws dynamodb scan --table-name TABLE_NAME \
  --projection-expression "title,bpm,energy" \
  --limit 1
```
If data exists → Problem is in GraphQL or Frontend

3. **Check GraphQL Schema**
```bash
# Look for new fields in schema
grep -A 5 "type Track" amplify/data/resource.ts
```

4. **Check Frontend Console**
```javascript
// Add debug logging
console.log('Track data:', track)
console.log('Audio features:', {
  bpm: track.bpm,
  energy: track.energy
})
```

5. **Check amplify_outputs.json**
```bash
# Ensure it's up to date
ls -la amplify_outputs.json apps/web/public/amplify_outputs.json
```

---

## 🎯 Quick Fixes

### "I see undefined in console"
→ Re-deploy backend, copy amplify_outputs.json, hard refresh

### "I see 0 or null values"
→ Wait 5 seconds, close modal, reopen

### "Lambda logs show success but DB unchanged"
→ Check TRACK_TABLE_NAME environment variable

### "New field not in GraphQL"
→ Deploy backend after schema changes

### "DynamoDB error: reserved keyword"
→ Use ExpressionAttributeNames

---

## 📊 Data Flow Diagram

```
User Upload → S3
              ↓
           Lambda Trigger
              ↓
      Download + Analyze
              ↓
      Extract Metadata
              ↓
    Find Track in DynamoDB (by fileUrl)
              ↓
    Update Track with Features
              ↓
         DynamoDB Updated
              ↓
    Frontend Polls (5 sec delay)
              ↓
    GraphQL Query → AppSync → DynamoDB
              ↓
         UI Updates
```

**Critical Points:**
1. Lambda writes to DynamoDB ✅
2. GraphQL schema must match DynamoDB ⚠️
3. Frontend must refresh to see changes ⚠️

---

## 🚀 Best Practices

1. **Always Deploy After Schema Changes**
```bash
# After editing amplify/data/resource.ts
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once
cp amplify_outputs.json apps/web/public/amplify_outputs.json
```

2. **Add Debug Logging**
```typescript
// In Lambda
console.log('Extracted metadata:', metadata)
console.log('Found track:', track.id)
console.log('Updated track successfully')

// In Frontend
console.log('Loaded tracks:', data)
console.log('Selected track:', track)
```

3. **Use GraphQL Subscriptions**
```typescript
// Real-time updates instead of polling
const subscription = subscribeToTracks(
  undefined,
  (updatedTrack) => {
    setTracks(prev => prev.map(t => 
      t.id === updatedTrack.id ? updatedTrack : t
    ))
  }
)
```

4. **Handle Reserved Words**
```typescript
// Always use ExpressionAttributeNames for:
// key, name, data, timestamp, status, type, etc.
```

5. **Test End-to-End**
```bash
# 1. Upload file
# 2. Check Lambda logs (should see "Track updated")
# 3. Check DynamoDB (should have data)
# 4. Check GraphQL (should return data)
# 5. Check UI (should display data)
```

---

## 📝 Lessons Learned

### Session: 2025-10-22

**Issue**: GraphQL returned `undefined` for all audio features
**Cause**: Schema updated but not deployed to AppSync
**Fix**: Re-deploy backend, sync amplify_outputs.json
**Time Lost**: 30 minutes debugging
**Prevention**: Always deploy after schema changes

**Issue**: UI showed BPM: 0 for new uploads
**Cause**: Frontend loaded data before Lambda finished
**Fix**: Increased polling delay, added debug logging
**Time Lost**: 15 minutes
**Prevention**: Use GraphQL subscriptions for real-time updates

**Issue**: DynamoDB error on `key` field
**Cause**: `key` is a reserved word in DynamoDB
**Fix**: Used ExpressionAttributeNames
**Time Lost**: 10 minutes
**Prevention**: Check reserved words list before naming fields
