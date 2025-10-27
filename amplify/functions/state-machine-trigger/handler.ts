/**
 * State Machine Trigger Lambda
 * 
 * Receives IoT messages and starts State Machine with proper JSON string input
 */

import https from 'https'

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || ''
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1' // Automatically set by Lambda

async function startStateMachine(input: any) {
  const url = new URL(`https://states.${AWS_REGION}.amazonaws.com/`)
  
  const postData = JSON.stringify({
    stateMachineArn: STATE_MACHINE_ARN,
    input: JSON.stringify(input), // Convert to JSON STRING
    name: `player-cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  })

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': 'AWSStepFunctions.StartExecution',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`StartExecution failed: ${res.statusCode} ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

export const handler = async (event: any) => {
  console.log('📥 State Machine Trigger invoked:', JSON.stringify(event, null, 2))

  try {
    // Start State Machine with JSON STRING input
    const result = await startStateMachine(event)
    
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
