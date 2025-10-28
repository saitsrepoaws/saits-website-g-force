/**
 * Player IoT Publisher
 * 
 * Publishes to AWS IoT using dynamic import (available in Lambda runtime)
 */

export const handler = async (event: any) => {
  console.log('📤 IoT Publisher invoked:', JSON.stringify(event, null, 2))

  const { topic, message } = event

  if (!topic || !message) {
    return {
      success: false,
      error: 'Missing topic or message'
    }
  }

  try {
    // Dynamic import - AWS SDK available in Lambda runtime (no bundling!)
    const { IoTDataPlaneClient, PublishCommand } = await import('@aws-sdk/client-iot-data-plane')
    
    const endpoint = process.env.IOT_ENDPOINT || ''
    const client = new IoTDataPlaneClient({ 
      region: process.env.AWS_REGION || 'eu-west-1',
      endpoint: `https://${endpoint}`
    })
    
    const command = new PublishCommand({
      topic,
      payload: Buffer.from(JSON.stringify(message)),
      qos: 1
    })
    
    await client.send(command)
    
    console.log('✅ Published to IoT topic:', topic)
    console.log('📦 Message:', JSON.stringify(message, null, 2))
    
    return {
      success: true,
      topic,
      message
    }
  } catch (error: any) {
    console.error('❌ IoT publish failed:', error)
    return {
      success: false,
      error: `IoT publish failed: ${error.message}`
    }
  }
}
