import { defineStorage } from '@aws-amplify/backend'

/**
 * G-FORCE UPLOAD ZONE
 * 
 * Purpose: Public drop zone voor audio uploads
 * Workflow: Upload → Auto-analyze → Move to tracks
 * 
 * Features:
 * - Public upload access (anyone can upload)
 * - Auto-trigger analysis Lambda
 * - Move to main storage after processing
 * - Same workflow as UI upload
 */
export const uploadZone = defineStorage({
  name: 'gforceUploadZone',
  access: (allow) => ({
    // Public upload access (write only)
    'uploads/*': [
      allow.guest.to(['read', 'write', 'delete']),
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    // Processing area (Lambda only)
    'processing/*': [
      allow.resource(audioMetadataLambda).to(['read', 'write', 'delete']),
      allow.resource(waveformGeneratorLambda).to(['read', 'write', 'delete'])
    ]
  })
})

/**
 * UPLOAD WORKFLOW:
 * 
 * 1. User uploads: s3://gforce-upload-zone/uploads/track.mp3
 * 2. S3 trigger → upload-processor Lambda
 * 3. Lambda analyzes:
 *    - Extract metadata (artist, title, BPM, etc.)
 *    - Generate waveform
 *    - Extract/generate cover art
 * 4. Lambda creates Track in DB
 * 5. Lambda moves file: uploads/track.mp3 → main-storage/public/audio/track.mp3
 * 6. Lambda deletes from upload zone
 * 7. Done! ✅
 */
