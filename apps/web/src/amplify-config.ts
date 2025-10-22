import { Amplify } from 'aws-amplify'

// Client-only safe configuration. Do NOT put long-lived AWS user keys here.
// Expect values via Vite env (only when feature toggle is enabled)
// Required for PubSub via AWS IoT Core with Amplify Gen 2:
// - VITE_AWS_REGION
// - VITE_IOT_ENDPOINT (xxxx-ats.iot.<region>.amazonaws.com)
// - VITE_IDENTITY_POOL_ID (Cognito Identity Pool ID)

export async function configureAmplify(): Promise<{ configured: boolean }> {
  // Always attempt to configure Amplify, independent of feature flags.
  // The file should be placed at apps/web/public/amplify_outputs.json
  try {
    const res = await fetch(`/amplify_outputs.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const outputs = await res.json()

    // Normalize Gen 2 outputs to Amplify JS v6 category shape (Auth)
    const auth = outputs?.auth
    const authConfig = auth ? {
      Auth: {
        Cognito: {
          userPoolId: auth.user_pool_id,
          userPoolClientId: auth.user_pool_client_id,
          identityPoolId: auth.identity_pool_id,
          region: auth.aws_region,
          allowGuestAccess: !!auth.unauthenticated_identities_enabled,
          loginWith: { email: (auth.username_attributes || []).includes('email') }
        }
      }
    } : {}

    // Configure Auth only - PubSub is instantiated directly in pubsub.ts
    try {
      Amplify.configure(authConfig)
    } catch (configErr) {
      console.error('[Amplify] configure() failed with config:', authConfig, configErr)
      throw configErr
    }
    return { configured: true }
  } catch (e) {
    console.warn('[Amplify] Could not initialize from /amplify_outputs.json. Auth and PubSub disabled until fixed.', e)
    return { configured: false }
  }
}
