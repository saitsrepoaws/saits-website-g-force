# Lambda Deployment Cheatsheet - Amplify Gen 2

## 🎯 Complete Lambda Flow

### 1. Lambda Structure
```
amplify/functions/audio-metadata/
├── handler.ts          # Lambda code
├── resource.ts         # Lambda definition
├── package.json        # Dependencies
└── node_modules/       # Must exist for bundling
```

### 2. Lambda Definition (resource.ts)
```typescript
import { defineFunction } from '@aws-amplify/backend'

export const audioMetadata = defineFunction({
  name: 'audio-metadata',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
  resourceGroupName: 'storage', // Avoid circular dependencies
})
```

### 3. Backend Configuration (backend.ts)
```typescript
// Import Lambda
import { audioMetadata } from './functions/audio-metadata/resource'

// Add to backend
export const backend = defineBackend({
  auth,
  data,
  storage,
  audioMetadata, // ← Add here
})

// Grant permissions
const storageBucket = backend.storage.resources.bucket
const metadataLambda = backend.audioMetadata.resources.lambda
const trackTable = backend.data.resources.tables['Track']

// S3 permissions
storageBucket.grantRead(metadataLambda)
storageBucket.grantPut(metadataLambda)

// DynamoDB permissions
trackTable.grantReadWriteData(metadataLambda)

// Environment variables
backend.audioMetadata.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName)
backend.audioMetadata.addEnvironment('TRACK_TABLE_NAME', trackTable.tableName)

// S3 trigger
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(metadataLambda),
  { prefix: 'public/audio/' }
)
```

### 4. Lambda Handler Pattern
```typescript
// ESM imports only!
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

export const handler = async (event: any) => {
  // Parse S3 event
  const record = event.Records?.[0]
  const s3Key = record.s3?.object?.key
  const bucketName = record.s3?.bucket?.name
  
  // Download from S3
  const localPath = await downloadFromS3(s3Key, bucketName)
  
  // Process file
  const metadata = await extractMetadata(localPath)
  
  // Update DynamoDB
  await updateTrackInDatabase(s3Key, metadata)
  
  return { status: 'success', metadata }
}
```

## 🐛 Common Issues & Fixes

### Issue 1: "Cannot find module" errors
**Cause**: Dependencies not installed in Lambda folder
**Fix**:
```bash
cd amplify/functions/audio-metadata
npm install  # NOT pnpm in workspace!
```

### Issue 2: "SyntaxError: Invalid or unexpected token"
**Cause**: Corrupt esbuild binary
**Fix**:
```bash
pnpm remove esbuild
pnpm add -D esbuild@latest -w
```

### Issue 3: Lambda not updating
**Cause**: Amplify caches old version
**Fix**:
```bash
rm -rf .amplify
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once
```

### Issue 4: "Circular dependency" error
**Cause**: Lambda and Storage depend on each other
**Fix**: Add `resourceGroupName: 'storage'` to Lambda definition

### Issue 5: S3 trigger fails with "overlapping suffixes"
**Cause**: Can't have 2 Lambdas on same S3 event/prefix
**Fix**: Combine Lambdas or use SNS fanout

### Issue 6: Environment variable not set
**Cause**: Wrong syntax or timing
**Fix**: Use `backend.functionName.addEnvironment()` AFTER backend definition

## ✅ Deployment Checklist

- [ ] Lambda folder has `node_modules/` (run `npm install`)
- [ ] `resource.ts` has correct `resourceGroupName`
- [ ] Backend imports Lambda
- [ ] Backend adds Lambda to `defineBackend()`
- [ ] Permissions granted (S3, DynamoDB, etc.)
- [ ] Environment variables set
- [ ] S3 trigger configured (if needed)
- [ ] No circular dependencies
- [ ] esbuild binary not corrupt (`pnpm exec esbuild --version`)
- [ ] `.amplify` folder cleared if issues

## 🚀 Deployment Commands

```bash
# Clean deployment
rm -rf .amplify node_modules
pnpm install
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once

# Check Lambda deployed
aws lambda list-functions --query 'Functions[?contains(FunctionName, `audio`)].FunctionName'

# Check Lambda version
aws lambda get-function --function-name FUNCTION_NAME --query 'Configuration.LastModified'

# Check environment variables
aws lambda get-function --function-name FUNCTION_NAME --query 'Configuration.Environment.Variables'

# Tail logs
aws logs tail /aws/lambda/FUNCTION_NAME --since 5m --follow
```

## 📊 Testing Lambda

```bash
# Upload test file to trigger Lambda
aws s3 cp test.mp3 s3://BUCKET_NAME/public/audio/test.mp3

# Wait and check logs
sleep 10
aws logs tail /aws/lambda/FUNCTION_NAME --since 1m --format short

# Look for:
# - "Processing file: public/audio/test.mp3"
# - "Extracted metadata with features"
# - "Finding track with fileUrl"
# - "Track updated with audio features"
```

## 🎯 Lambda + DynamoDB Pattern

```typescript
// Find track by S3 key
const scanResult = await dynamoClient.send(new ScanCommand({
  TableName: process.env.TRACK_TABLE_NAME,
  FilterExpression: 'contains(fileUrl, :s3Key)',
  ExpressionAttributeValues: {
    ':s3Key': s3Key,
  },
}))

// Update track
await dynamoClient.send(new UpdateCommand({
  TableName: process.env.TRACK_TABLE_NAME,
  Key: { id: track.id },
  UpdateExpression: 'SET bpm = :bpm, energy = :energy',
  ExpressionAttributeValues: {
    ':bpm': metadata.bpm,
    ':energy': metadata.energy,
  },
}))
```

## 🔧 Debug Commands

```bash
# Test esbuild locally
cd amplify/functions/audio-metadata
pnpm exec esbuild handler.ts --bundle --target=node20 --platform=node --format=esm --outfile=test.mjs

# Check for syntax errors
node --check handler.ts

# Check TypeScript
npx tsc --noEmit handler.ts

# Verify dependencies
npm list
```

## 📝 Key Learnings

1. **ESM Only**: Amplify Gen 2 uses ESM, no `require()`
2. **Local node_modules**: Each Lambda needs its own `node_modules/`
3. **Workspace Issues**: Use `npm` not `pnpm` in Lambda folders
4. **Circular Dependencies**: Use `resourceGroupName` to break cycles
5. **S3 Limits**: One Lambda per S3 event/prefix combination
6. **Cache Issues**: Clear `.amplify` when Lambda won't update
7. **Binary Corruption**: Reinstall esbuild if bundling fails mysteriously
8. **DynamoDB Access**: Use `backend.data.resources.tables['ModelName']`
9. **Environment Variables**: Set AFTER `defineBackend()`
10. **Permissions**: Grant before adding triggers

## 🎨 Complete Working Example

See: `/Users/gerard/Desktop/T7/g-forge-iot/amplify/functions/audio-metadata/`

This Lambda:
- ✅ Triggers on S3 upload
- ✅ Downloads audio file
- ✅ Extracts metadata (BPM, energy, danceability)
- ✅ Extracts and uploads cover art
- ✅ Finds track in DynamoDB
- ✅ Updates track with features
- ✅ All in < 1 second!
