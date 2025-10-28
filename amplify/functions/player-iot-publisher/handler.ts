/**
 * Player IoT Publisher
 * 
 * Publishes to AWS IoT Core using dynamic import (no bundling issues!)
 */

const IOT_ENDPOINT = process.env.IOT_ENDPOINT || ''

async function publishToIoT(topic: string, payload: any) {
  // Dynamic import - SDK available in Lambda runtime
  const { IoTDataPlaneClient, PublishCommand } = await import('@aws-sdk/client-iot-data-plane')
  
  const iotClient = new IoTDataPlaneClient({ 
    region: process.env.AWS_REGION || 'eu-west-1',
    endpoint: `https://${IOT_ENDPOINT}`
  })
  
  const command = new PublishCommand({
    topic,
    payload: Buffer.from(JSON.stringify(payload)),
    qos: 1
  })
  
  await iotClient.send(command)
  return { success: true }
}

export const handler = async (event: any) => {
  console.log('📤 IoT Publisher invoked:', JSON.stringify(event, null, 2))

  const { topic, message } = event

  if (!topic || !message) {
    return {
      success: false,
      error: 'Missing topic or message parameter'
    }
  }

  try {
    console.log(`📡 Publishing to topic: ${topic}`)
    console.log(`📝 Message:`, JSON.stringify(message, null, 2))
    
    await publishToIoT(topic, message)
    
    console.log('✅ Message published successfully')
    
    return {
      success: true,
      topic: topic
    }
  } catch (error: any) {
    console.error('❌ Failed to publish:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
