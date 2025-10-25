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

    // Normalize Gen 2 outputs to Amplify JS v6 category shape
    const auth = outputs?.auth
    const data = outputs?.data
    const storage = outputs?.storage

    const config: any = {}

    // Auth configuration
    if (auth) {
      config.Auth = {
        Cognito: {
          userPoolId: auth.user_pool_id,
          userPoolClientId: auth.user_pool_client_id,
          identityPoolId: auth.identity_pool_id,
          region: auth.aws_region,
          allowGuestAccess: !!auth.unauthenticated_identities_enabled,
          loginWith: { email: (auth.username_attributes || []).includes('email') }
        }
      }
    }

    // Data (GraphQL API) configuration
    if (data) {
      config.API = {
        GraphQL: {
          endpoint: data.url,
          region: data.aws_region,
          defaultAuthMode: 'userPool',
          modelIntrospection: data.model_introspection
        }
      }
    }

    // Storage (S3) configuration
    if (storage) {
      config.Storage = {
        S3: {
          bucket: storage.bucket_name,
          region: storage.aws_region
        }
      }
    }

    // Configure Amplify with all resources
    try {
      Amplify.configure(config)
      console.log('[Amplify] Configured successfully with Auth, Data, and Storage')
    } catch (configErr) {
      console.error('[Amplify] configure() failed with config:', config, configErr)
      throw configErr
    }
    return { configured: true }
  } catch (e) {
    console.warn('[Amplify] Could not initialize from /amplify_outputs.json. Auth and PubSub disabled until fixed.', e)
    return { configured: false }
  }
}
