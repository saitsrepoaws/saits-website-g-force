/**
 * Listener Tracker
 * 
 * Tracks detailed listener analytics from Icecast
 * - Polls /admin/listclients every minute
 * - Parses user-agent for device, OS, player
 * - Tracks sessions and profiles
 * - Detects returning listeners
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { createHash } from 'crypto'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const ICECAST_URL = 'http://46.137.184.91:8000'
const ICECAST_ADMIN_USER = 'admin'
const ICECAST_ADMIN_PASS = 'gforge2024radio'
const SESSION_TABLE = process.env.SESSION_TABLE || ''
const PROFILE_TABLE = process.env.PROFILE_TABLE || ''

/**
 * Hash IP for privacy
 */
function hashIP(ip: string): string {
  return createHash('sha256').update(ip + 'splash-fm-salt').digest('hex').substring(0, 16)
}

/**
 * Parse user-agent to extract device, OS, player
 */
function parseUserAgent(ua: string): { device: string, os: string, player: string } {
  const lowerUA = ua.toLowerCase()
  
  // Device detection
  let device = 'Desktop'
  if (lowerUA.includes('mobile') || lowerUA.includes('android') || lowerUA.includes('iphone')) {
    device = 'Mobile'
  } else if (lowerUA.includes('car') || lowerUA.includes('automotive')) {
    device = 'Car'
  } else if (lowerUA.includes('alexa') || lowerUA.includes('googlehome') || lowerUA.includes('homepod')) {
    device = 'Smart Speaker'
  }
  
  // OS detection
  let os = 'Unknown'
  if (lowerUA.includes('windows')) os = 'Windows'
  else if (lowerUA.includes('mac os') || lowerUA.includes('macos')) os = 'macOS'
  else if (lowerUA.includes('iphone') || lowerUA.includes('ipad') || lowerUA.includes('ios')) os = 'iOS'
  else if (lowerUA.includes('android')) os = 'Android'
  else if (lowerUA.includes('linux')) os = 'Linux'
  else if (lowerUA.includes('cros')) os = 'Chrome OS'
  
  // Player detection
  let player = 'Unknown'
  if (lowerUA.includes('vlc')) player = 'VLC'
  else if (lowerUA.includes('itunes')) player = 'iTunes'
  else if (lowerUA.includes('winamp')) player = 'Winamp'
  else if (lowerUA.includes('foobar')) player = 'Foobar2000'
  else if (lowerUA.includes('chrome')) player = 'Chrome Browser'
  else if (lowerUA.includes('firefox')) player = 'Firefox Browser'
  else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) player = 'Safari Browser'
  else if (lowerUA.includes('edge')) player = 'Edge Browser'
  else if (lowerUA.includes('mpv')) player = 'MPV'
  else if (lowerUA.includes('mplayer')) player = 'MPlayer'
  else if (lowerUA.includes('sonos')) player = 'Sonos'
  else if (lowerUA.includes('alexa')) player = 'Amazon Alexa'
  
  return { device, os, player }
}

/**
 * Get geolocation from IP (simplified - in production use IP geolocation API)
 */
async function getLocation(ip: string): Promise<{ country: string, city: string }> {
  // TODO: Integrate with IP geolocation service (ipinfo.io, ipapi.co, etc.)
  // For now, return placeholder
  return {
    country: 'Unknown',
    city: 'Unknown'
  }
}

/**
 * Fetch current listeners from Icecast
 */
async function fetchListeners(): Promise<any[]> {
  try {
    const auth = Buffer.from(`${ICECAST_ADMIN_USER}:${ICECAST_ADMIN_PASS}`).toString('base64')
    
    const response = await fetch(`${ICECAST_URL}/admin/listclients?mount=/stream.mp3`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    })
    
    if (!response.ok) {
      console.error('Failed to fetch listeners:', response.status)
      return []
    }
    
    const data = await response.json()
    const listeners = data?.icestats?.source?.listener || []
    
    return Array.isArray(listeners) ? listeners : [listeners]
  } catch (error) {
    console.error('Error fetching listeners:', error)
    return []
  }
}

/**
 * Update or create listener session
 */
async function updateSession(listener: any, currentTrack: string) {
  const ipHash = hashIP(listener.IP)
  const sessionId = `${ipHash}-${listener.Connected}`
  const { device, os, player } = parseUserAgent(listener.UserAgent || '')
  const location = await getLocation(listener.IP)
  
  const now = new Date().toISOString()
  const connectTime = new Date(parseInt(listener.Connected) * 1000).toISOString()
  
  // Check if session exists
  const existing = await dynamodb.send(new GetCommand({
    TableName: SESSION_TABLE,
    Key: { id: sessionId }
  }))
  
  if (!existing.Item) {
    // New session
    await dynamodb.send(new PutCommand({
      TableName: SESSION_TABLE,
      Item: {
        id: sessionId,
        sessionId,
        ipHash,
        userAgent: listener.UserAgent,
        device,
        os,
        player,
        country: location.country,
        city: location.city,
        connectTime,
        currentTrack,
        tracksHeard: JSON.stringify([]),
        createdAt: now,
        updatedAt: now
      }
    }))
    
    console.log(`📱 New session: ${device} - ${os} - ${player}`)
  } else {
    // Update existing session
    await dynamodb.send(new UpdateCommand({
      TableName: SESSION_TABLE,
      Key: { id: sessionId },
      UpdateExpression: 'SET currentTrack = :track, updatedAt = :now',
      ExpressionAttributeValues: {
        ':track': currentTrack,
        ':now': now
      }
    }))
  }
  
  // Update profile
  await updateProfile(ipHash, device, os, player, location, connectTime)
}

/**
 * Update listener profile
 */
async function updateProfile(
  ipHash: string,
  device: string,
  os: string,
  player: string,
  location: { country: string, city: string },
  connectTime: string
) {
  const now = new Date().toISOString()
  const hour = new Date().getHours()
  
  const existing = await dynamodb.send(new GetCommand({
    TableName: PROFILE_TABLE,
    Key: { id: ipHash }
  }))
  
  if (!existing.Item) {
    // New profile
    await dynamodb.send(new PutCommand({
      TableName: PROFILE_TABLE,
      Item: {
        id: ipHash,
        ipHash,
        firstSeen: connectTime,
        lastSeen: now,
        totalSessions: 1,
        totalListenTime: 0,
        favoriteHours: JSON.stringify([hour]),
        returningListener: false,
        country: location.country,
        city: location.city,
        lastDevice: device,
        lastOs: os,
        lastPlayer: player,
        createdAt: now,
        updatedAt: now
      }
    }))
    
    console.log(`👤 New listener profile: ${ipHash}`)
  } else {
    // Update profile
    const profile = existing.Item
    const favoriteHours = JSON.parse(profile.favoriteHours || '[]')
    favoriteHours.push(hour)
    
    await dynamodb.send(new UpdateCommand({
      TableName: PROFILE_TABLE,
      Key: { id: ipHash },
      UpdateExpression: `
        SET lastSeen = :now,
            totalSessions = totalSessions + :one,
            favoriteHours = :hours,
            returningListener = :returning,
            lastDevice = :device,
            lastOs = :os,
            lastPlayer = :player,
            updatedAt = :now
      `,
      ExpressionAttributeValues: {
        ':now': now,
        ':one': 1,
        ':hours': JSON.stringify(favoriteHours),
        ':returning': true,
        ':device': device,
        ':os': os,
        ':player': player
      }
    }))
    
    console.log(`🔄 Returning listener: ${ipHash} (${profile.totalSessions + 1} sessions)`)
  }
}

export const handler = async (event: any) => {
  console.log('📊 Tracking listener analytics...')
  
  try {
    // Get current track from Icecast
    const statusResponse = await fetch(`${ICECAST_URL}/status-json.xsl`)
    const statusData = await statusResponse.json()
    const currentTrack = statusData?.icestats?.source?.title || 'Unknown'
    
    // Fetch all current listeners
    const listeners = await fetchListeners()
    
    console.log(`👥 Found ${listeners.length} active listeners`)
    
    // Update session for each listener
    for (const listener of listeners) {
      await updateSession(listener, currentTrack)
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        listenerCount: listeners.length,
        tracked: listeners.length
      })
    }
  } catch (error) {
    console.error('❌ Error tracking listeners:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
