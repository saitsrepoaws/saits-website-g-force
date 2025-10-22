import { defineStorage } from '@aws-amplify/backend'

export const storage = defineStorage({
  name: 'gforgeIotStorage',
  access: (allow) => ({
    'audio/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'covers/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
})
