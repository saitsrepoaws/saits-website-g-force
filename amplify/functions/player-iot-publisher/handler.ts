/**
 * Player IoT Publisher
 * 
 * Simple pass-through handler - prepares IoT message
 * State Machine will handle actual IoT publish
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

  console.log('✅ IoT message prepared for topic:', topic)
  console.log('📦 Message:', JSON.stringify(message, null, 2))

  // Return success - State Machine will publish via IoT
  return {
    success: true,
    topic,
    message
  }
}
