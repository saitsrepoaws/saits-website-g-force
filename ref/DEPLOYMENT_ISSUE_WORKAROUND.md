# 🔧 Deployment Issue & Workaround

**Date:** 14 November 2025, 00:03 CET  
**Issue:** Lambda bundling fails for track-queue-manager and genre-merger  
**Status:** 🟡 WORKAROUND AVAILABLE

---

## 📋 Issue Description

**Error:**
```
✘ [ERROR] Could not resolve "@aws-sdk/client-dynamodb"
✘ [ERROR] Could not resolve "@aws-sdk/lib-dynamodb"  
✘ [ERROR] Could not resolve "@aws-sdk/client-sqs"
```

**Root Cause:**
Amplify Gen 2 bundles Lambda functions in a Docker container, but the AWS SDK dependencies from `package.json` are not being picked up correctly during the esbuild bundling process.

---

## ✅ **Workaround Options:**

### **Option 1: External Dependencies (Recommended)**

AWS SDK v3 is already available in the Lambda runtime. Mark dependencies as external in the bundle config.

**Update resource.ts files:**

```typescript
// amplify/functions/track-queue-manager/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const trackQueueManager = defineFunction({
  name: 'track-queue-manager',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  resourceGroupName: 'data',
  bundling: {
    externalModules: ['@aws-sdk/*']  // ← ADD THIS
  }
})
```

```typescript
// amplify/functions/genre-merger/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const genreMerger = defineFunction({
  name: 'genre-merger',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 1024,
  resourceGroupName: 'data',
  bundling: {
    externalModules: ['@aws-sdk/*']  // ← ADD THIS
  }
})
```

**Why this works:**
- AWS SDK v3 is pre-installed in Lambda Node.js 18+ runtime
- No need to bundle it, just use the runtime version
- Smaller bundle size
- Faster cold starts

---

### **Option 2: Layer Approach**

Create a Lambda Layer with the dependencies.

**Steps:**
1. Create layer folder with dependencies
2. Zip the layer
3. Upload to AWS Lambda Layers
4. Reference layer ARN in resource.ts

**Not recommended:** More complex, slower iteration.

---

### **Option 3: Temporary Disable**

Disable the new Lambdas temporarily, deploy the rest, then enable after fix.

**In backend.ts:**
```typescript
// Temporarily comment out
// import { trackQueueManager } from './functions/track-queue-manager/resource'
// import { genreMerger } from './functions/genre-merger/resource'

export const backend = defineBackend({
  // ... existing functions
  // trackQueueManager,  // ← DISABLED
  // genreMerger,        // ← DISABLED
})
```

**Deploy without these functions:**
```bash
npx ampx sandbox --once
```

**After deployment works, re-enable with fix from Option 1.**

---

## 🚀 **Quick Fix (Do This Now):**

### **Step 1: Update resource.ts files**

```bash
# Update track-queue-manager
cat > amplify/functions/track-queue-manager/resource.ts << 'EOF'
import { defineFunction } from '@aws-amplify/backend'

export const trackQueueManager = defineFunction({
  name: 'track-queue-manager',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  resourceGroupName: 'data',
  bundling: {
    externalModules: ['@aws-sdk/*']
  }
})
EOF

# Update genre-merger
cat > amplify/functions/genre-merger/resource.ts << 'EOF'
import { defineFunction } from '@aws-amplify/backend'

export const genreMerger = defineFunction({
  name: 'genre-merger',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 1024,
  resourceGroupName: 'data',
  bundling: {
    externalModules: ['@aws-sdk/*']
  }
})
EOF
```

### **Step 2: Deploy Again**

```bash
cd /Users/gerard/Desktop/T7/g-forge-iot
pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once
```

---

## 📊 **What's Already Working:**

✅ **Multi-Genre Playlist Generator** (already deployed!)  
✅ **M3U Streaming System** (active)  
✅ **All Other Lambdas** (audio-metadata, waveform, etc.)  

**Only the 2 NEW Lambdas have this issue.**

---

## 🎯 **Impact:**

### **If Deployed Without Fix:**
- ❌ No Hybrid SQS streaming (M3U still works)
- ❌ No Genre Merger tool
- ✅ Everything else works fine

### **After Fix:**
- ✅ Hybrid SQS streaming ready
- ✅ Genre Merger ready
- ✅ Complete system operational

---

## 📝 **Next Steps:**

1. **Apply Option 1 fix** (externalModules)
2. **Deploy again**
3. **Test Lambdas**
4. **Celebrate!** 🎉

---

**Status:** 🟡 Fixable in 2 minutes  
**Complexity:** Low  
**Risk:** None (external modules is AWS best practice)

---

**Let me apply the fix now...**
