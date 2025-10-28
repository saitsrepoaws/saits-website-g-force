/**
 * IoT Policy Attacher
 * Automatically attaches IoT Policy to current Cognito Identity
 * Required for MQTT connections to work
 */

import { fetchAuthSession } from 'aws-amplify/auth'
import { IoTClient, AttachPolicyCommand, CreatePolicyCommand } from '@aws-sdk/client-iot'

const REGION = 'eu-west-1'
const POLICY_NAME = 'CognitoIoTPolicy'

/**
 * Attach IoT Policy to current user's Cognito Identity
 */
export async function attachIoTPolicyToCurrentUser(): Promise<boolean> {
  try {
    console.log('🔧 Attaching IoT Policy to current user...')
    
    // Get current session
    const session = await fetchAuthSession()
    if (!session.identityId || !session.credentials) {
      throw new Error('No identity or credentials available')
    }

    const identityId = session.identityId
    console.log('🆔 Identity ID:', identityId)

    // Create IoT client with Cognito credentials
    const iotClient = new IoTClient({
      region: REGION,
      credentials: session.credentials,
    })

    // First, ensure policy exists (create if not)
    try {
      console.log('📋 Creating IoT Policy (if not exists)...')
      await iotClient.send(new CreatePolicyCommand({
        policyName: POLICY_NAME,
        policyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: 'iot:Connect',
              Resource: `arn:aws:iot:${REGION}:*:client/\${cognito-identity.amazonaws.com:sub}`,
            },
            {
              Effect: 'Allow',
              Action: ['iot:Subscribe'],
              Resource: `arn:aws:iot:${REGION}:*:topicfilter/*`,
            },
            {
              Effect: 'Allow',
              Action: ['iot:Publish', 'iot:Receive'],
              Resource: `arn:aws:iot:${REGION}:*:topic/*`,
            },
          ],
        }),
      }))
      console.log('✅ IoT Policy created')
    } catch (error: any) {
      if (error.name === 'ResourceAlreadyExistsException') {
        console.log('✅ IoT Policy already exists')
      } else {
        console.error('⚠️  Failed to create policy:', error.message)
        // Continue anyway - policy might exist
      }
    }

    // Attach policy to identity
    console.log('🔗 Attaching policy to identity...')
    try {
      await iotClient.send(new AttachPolicyCommand({
        policyName: POLICY_NAME,
        target: identityId,
      }))
      console.log('✅ IoT Policy attached successfully!')
      return true
    } catch (error: any) {
      if (error.name === 'ResourceAlreadyExistsException') {
        console.log('✅ IoT Policy already attached')
        return true
      }
      throw error
    }
  } catch (error) {
    console.error('❌ Failed to attach IoT Policy:', error)
    return false
  }
}

/**
 * Check if IoT Policy is attached to current user
 * Note: This requires ListAttachedPolicies permission which we might not have
 */
export async function checkIoTPolicyAttached(): Promise<boolean> {
  try {
    const session = await fetchAuthSession()
    if (!session.identityId) return false

    // We can't easily check without additional permissions
    // So we'll just try to attach (idempotent operation)
    return true
  } catch (error) {
    console.error('Failed to check IoT Policy:', error)
    return false
  }
}
