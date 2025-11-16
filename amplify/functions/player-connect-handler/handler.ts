/**
 * Player Connect Handler
 * 
 * Triggered by IoT Lifecycle event when player connects
 * Fetches current track from Icecast and sends to player's specific topic
 * 
 * Gerard's brilliant idea: Player krijgt INSTANT de huidige track bij connect! ⚡
 */

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane'
import * as http from 'http'

const iot = new IoTDataPlaneClient({ region: 'eu-west-1' })

const ICECAST_URL = 'http://79.125.44.178:8000'

interface IcecastStatus {
  icestats: {
    source: {
      title?: string
      artist?: string
      listeners?: number
      bitrate?: number
    }
  }
}

interface TrackMetadata {
  artist: string
  title: string
  timestamp: string
  source: string
}

/**
 * Fetch current track from Icecast
 */
async function getCurrentTrack(): Promise<TrackMetadata | null> {
  return new Promise((resolve) => {
    console.log('📡 Fetching current track from Icecast...')
    
    const req = http.get(`${ICECAST_URL}/status-json.xsl`, (res) => {
      let data = ''
      
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const json: IcecastStatus = JSON.parse(data)
          const source = json.icestats?.source
          
          if (source && source.title) {
            // Parse "Artist - Title" format
            const parts = source.title.split(' - ')
            const artist = parts.length > 1 ? parts[0] : 'Splash FM'
            const title = parts.length > 1 ? parts.slice(1).join(' - ') : source.title
            
            console.log('✅ Current track:', { artist, title })
            
            resolve({
              artist,
              title,
              timestamp: new Date().toISOString(),
              source: 'icecast-current'
            })
          } else {
            console.log('⚠️ No track info in Icecast response')
            resolve(null)
          }
        } catch (error) {
          console.error('❌ Error parsing Icecast response:', error)
          resolve(null)
        }
      })
    })
    
    req.on('error', (error) => {
      console.error('❌ Error fetching from Icecast:', error)
      resolve(null)
    })
    
    req.setTimeout(5000, () => {
      console.error('❌ Icecast request timeout')
      req.destroy()
      resolve(null)
    })
  })
}

/**
 * Handler triggered by IoT Lifecycle event
 */
export const handler = async (event: any) => {
  console.log('🎵 Player Connect Handler triggered!')
  console.log('📦 Event:', JSON.stringify(event, null, 2))
  
  try {
    // Extract clientId from lifecycle event
    const clientId = event.clientId
    
    if (!clientId) {
      console.error('❌ No clientId in event')
      return { success: false, error: 'No clientId' }
    }
    
    console.log(`👤 Player connected: ${clientId}`)
    
    // Fetch current track from Icecast
    const track = await getCurrentTrack()
    
    if (!track) {
      console.log('⚠️ No current track available')
      return { success: false, error: 'No current track' }
    }
    
    // Publish to player-specific topic
    const topic = `radio/stream/player/${clientId}`
    
    console.log(`📤 Publishing current track to: ${topic}`)
    
    const command = new PublishCommand({
      topic,
      payload: Buffer.from(JSON.stringify(track)),
      qos: 1
    })
    
    await iot.send(command)
    
    console.log('✅ Current track sent to player!')
    
    return {
      success: true,
      clientId,
      track,
      topic
    }
    
  } catch (error: any) {
    console.error('❌ Error in player connect handler:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
