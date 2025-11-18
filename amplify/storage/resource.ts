import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'gforgeIotStorage',
  access: (allow) => ({
    // UI uploads (via web interface)
    'public/audio/ui/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    // Bulk uploads (via AWS CLI / scripts)
    'public/audio/bulk/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    // Backup storage (Glacier)
    'backup/audio/*': [
      allow.authenticated.to(['read']),
      allow.guest.to([]),
    ],
    'public/covers/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    'public/waveforms/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
  }),
})
