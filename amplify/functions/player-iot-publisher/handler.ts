/**
 * Player IoT Publisher
 * 
 * Publishes messages to AWS IoT Core topics
 * Used by State Machine to send commands back to players
 */

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'

const iotClient = new IoTDataPlaneClient({})

export const handler = async (event: any) => {
  console.log('📤 IoT Publisher invoked:', JSON.stringify(event, null, 2))

  const { topic, message, playerId } = event

  if (!topic || !message) {
    console.error('❌ Missing topic or message parameter')
    return {
      success: false,
      error: 'Missing topic or message parameter'
    }
  }

  try {
    // Publish to IoT Core
    console.log(`📡 Publishing to topic: ${topic}`)
    console.log(`📝 Message:`, JSON.stringify(message, null, 2))
    
    const command = new PublishCommand({
      topic: topic,
      payload: Buffer.from(JSON.stringify(message)),
      qos: 1 // At least once delivery
    })

    await iotClient.send(command)
    
    console.log('✅ Message published successfully')
    
    return {
      success: true,
      topic: topic,
      playerId: playerId
    }
  } catch (error: any) {
    console.error('❌ Failed to publish to IoT:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
