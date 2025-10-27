/**
 * Player IoT Publisher
 * 
 * Publishes to AWS IoT Core using HTTPS API (no AWS SDK needed!)
 */

import https from 'https'

const IOT_ENDPOINT = process.env.IOT_ENDPOINT || ''

async function publishToIoT(topic: string, payload: any) {
  const url = new URL(`https://${IOT_ENDPOINT}/topics/${encodeURIComponent(topic)}?qos=1`)
  
  const postData = JSON.stringify(payload)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true })
        } else {
          reject(new Error(`IoT publish failed: ${res.statusCode} ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
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
