# Cover Art API - Public Endpoint

## Probleem
S3 bucket heeft Block Public Access enabled, dus directe URLs naar cover art werken niet (403 Forbidden).

## Oplossing
Lambda Function URL die signed S3 URLs genereert voor cover art.

## Lambda Function
**Location**: `/amplify/functions/get-cover-url/`

### Handler
```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Generates presigned URL (valid for 1 hour)
```

### Environment Variables
- `STORAGE_BUCKET` - S3 bucket name (auto-configured in backend.ts)

### Permissions
- S3 read access to storage bucket
- Public Function URL (no auth required)

## API Endpoint

**Method**: GET  
**Auth**: None (public)  
**CORS**: Enabled for all origins

### Request
```
GET https://<function-url>?path=public/covers/abc123.jpeg
```

### Response
```json
{
  "url": "https://bucket.s3.region.amazonaws.com/public/covers/abc123.jpeg?X-Amz-...",
  "expiresAt": "2025-11-10T13:00:00.000Z"
}
```

## Player Integration

### Old (broken)
```javascript
const coverUrl = `https://${bucket}.s3.eu-west-1.amazonaws.com/${path}`;
// 403 Forbidden
```

### New (working)
```javascript
const coverApiUrl = window.coverApiUrl; // From amplify_outputs.json
const response = await fetch(`${coverApiUrl}?path=${encodeURIComponent(path)}`);
const { url } = await response.json();
// Use presigned URL
```

## Deployment
1. Lambda deployed with backend
2. Function URL added to `amplify_outputs.json`
3. Player reads URL from config

## Benefits
- ✅ Respects S3 Block Public Access
- ✅ Temporary signed URLs (1 hour expiry)
- ✅ No authentication required for player
- ✅ CORS enabled
- ✅ Auto-scaling Lambda

## Implementation
- **Backend**: `amplify/backend.ts` (lines 931-956)
- **Lambda**: `amplify/functions/get-cover-url/`
- **Player**: Updates in `player-homepage-v2.html` (getCoverArtUrl function)
