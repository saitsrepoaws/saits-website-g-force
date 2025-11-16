import { defineAuth } from '@aws-amplify/backend'

// Keep this file small and focused (golden rules)
// Basic email/password sign-up & sign-in. MFA off by default.

export const auth = defineAuth({
  loginWith: { email: true },
  multifactor: { mode: 'OFF' },
})
