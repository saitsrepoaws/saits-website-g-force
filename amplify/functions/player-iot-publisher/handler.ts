/**
 * Player IoT Publisher
 * 
 * Publishes messages to AWS IoT Core
 * Used by State Machine to send command responses back to players
 */

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'

const iotClient = new IoTDataPlaneClient({})

interface PublishEvent {
  topic: string
  message: any
}

interface PublishResponse {
  success: boolean
  topic?: string
  error?: string
}

export const handler = async (event: PublishEvent): Promise<PublishResponse> => {
  console.log('📤 IoT Publisher invoked:', JSON.stringify(event, null, 2))

  const { topic, message } = event

  if (!topic || !message) {
    console.error('❌ Missing topic or message')
    return {
      success: false,
      error: 'Missing topic or message parameter'
    }
  }

  try {
    // Publish to IoT Core
    console.log(`📡 Publishing to topic: ${topic}`)
    
    const command = new PublishCommand({
      topic: topic,
      payload: Buffer.from(JSON.stringify(message)),
      qos: 1 // At least once delivery
    })

    await iotClient.send(command)

    console.log('✅ Message published successfully')
    
    return {
      success: true,
      topic: topic
    }

  } catch (error) {
    console.error('❌ Error publishing to IoT:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
