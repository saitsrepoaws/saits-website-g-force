/**
 * State Machine Trigger Lambda
 * 
 * Receives IoT messages and starts State Machine with proper JSON string input
 * Uses AWS SDK v3 for proper authentication
 */

import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || ''
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1'

const sfnClient = new SFNClient({ region: AWS_REGION })

export const handler = async (event: any) => {
  console.log('📥 State Machine Trigger invoked:', JSON.stringify(event, null, 2))

  try {
    // Start State Machine with JSON STRING input
    const command = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify(event), // Convert to JSON STRING
      name: `player-cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    })
    
    const result = await sfnClient.send(command)
    
    console.log('✅ State Machine started:', result)
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    }
  } catch (error: any) {
    console.error('❌ Failed to start State Machine:', error)
    throw error
  }
}
