import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'gforgeIotStorage',
  access: (allow) => ({
    'public/audio/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
    'public/covers/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
  }),
})
