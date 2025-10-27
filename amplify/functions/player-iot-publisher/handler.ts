/**
 * Player IoT Publisher
 * 
 * TEMPORARY MOCK - Logs instead of publishing
 * TODO: Implement real IoT publishing once bundling issues are resolved
 */

export const handler = async (event: any) => {
  console.log('📤 IoT Publisher (MOCK) invoked:', JSON.stringify(event, null, 2))

  const { topic, message } = event

  if (!topic || !message) {
    return {
      success: false,
      error: 'Missing topic or message parameter'
    }
  }

  // MOCK: Just log instead of publishing
  console.log(`📡 MOCK Publishing to topic: ${topic}`)
  console.log(`📝 Message:`, JSON.stringify(message, null, 2))
  
  return {
    success: true,
    topic: topic
  }
}
