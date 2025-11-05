// Thin service layer for PubSub operations to keep UI lean and obey golden rules
// Uses Amplify JS v6 PubSub with AWS IoT over WebSocket. Requires Amplify to be configured via outputs.

import { CONNECTION_STATE_CHANGE, PubSub } from '@aws-amplify/pubsub'
import { Hub } from 'aws-amplify/utils'
import { fetchAuthSession } from 'aws-amplify/auth'

// ConnectionState enum from Amplify
enum ConnectionState {
  Connected = 'Connected',
  ConnectedPendingDisconnect = 'ConnectedPendingDisconnect',
  ConnectedPendingKeepAlive = 'ConnectedPendingKeepAlive',
  ConnectedPendingNetwork = 'ConnectedPendingNetwork',
  Connecting = 'Connecting',
  ConnectionDisrupted = 'ConnectionDisrupted',
  ConnectionDisruptedPendingNetwork = 'ConnectionDisruptedPendingNetwork',
  Disconnected = 'Disconnected',
}

// Debug logger for connection diagnostics
export type LogEntry = { timestamp: number; level: 'info'|'warn'|'error'; message: string }
const logs: LogEntry[] = []
const MAX_LOGS = 50

function log(level: LogEntry['level'], message: string) {
  const entry = { timestamp: Date.now(), level, message }
  logs.unshift(entry) // newest first
  if (logs.length > MAX_LOGS) logs.pop()
  console.log(`[PubSub ${level.toUpperCase()}]`, message)
}

export function getLogs(): LogEntry[] {
  return [...logs]
}

export function clearLogs() {
  logs.length = 0
}

export function getTabId(): string {
  return TAB_ID
}

export function resetPubSub() {
  console.log('🔄 RESETTING PUBSUB INSTANCE')
  log('warn', 'Manually resetting PubSub instance')
  
  // Stop intervals first
  if (connectionStateTimeout) {
    clearTimeout(connectionStateTimeout)
    connectionStateTimeout = null
  }
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval)
    keepaliveInterval = null
  }
  
  // Unsubscribe keepalive
  if (keepaliveSubscription) {
    try {
      keepaliveSubscription.unsubscribe()
    } catch (e) {
      console.warn('Failed to unsubscribe keepalive:', e)
    }
    keepaliveSubscription = null
  }
  
  // Reset instance and flags
  pubsubInstance = null
  hubListenerRegistered = false // Allow re-registration
  isAutoConnecting = false // Reset auto-connect flag
  
  console.log('✅ PubSub reset complete')
}

// PubSub instance - initialized lazily (SINGLETON for entire app!)
let pubsubInstance: PubSub | null = null
let connectionStateTimeout: NodeJS.Timeout | null = null
let hubListenerRegistered = false // Track if Hub listener is already registered
let keepaliveInterval: NodeJS.Timeout | null = null // Track keepalive logging
let isAutoConnecting = false // Prevent duplicate autoConnect calls
let keepaliveSubscription: any = null // Store keepalive subscription

// Generate unique tab ID (persists for this browser tab/window session)
const TAB_ID = `tab-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`
console.log('🆔 Tab ID:', TAB_ID)

// Reset PubSub instance if connection stays disrupted
function scheduleConnectionCheck() {
  if (connectionStateTimeout) clearTimeout(connectionStateTimeout)
  connectionStateTimeout = setTimeout(() => {
    log('warn', 'Connection disrupted for 30 seconds - use retry button to reconnect')
    // DON'T auto-reset - let user use retry button instead
    // Auto-reset was destroying active subscriptions!
  }, 30000) // Just log warning after 30 seconds
}

async function getPubSubInstance(): Promise<PubSub> {
  if (!pubsubInstance) {
    const endpoint = (import.meta as any).env?.VITE_AWS_IOT_ENDPOINT as string | undefined
    if (!endpoint) {
      log('error', 'VITE_AWS_IOT_ENDPOINT not configured')
      throw new Error('VITE_AWS_IOT_ENDPOINT not configured')
    }
    
    const wssUrl = endpoint.startsWith('wss://') 
      ? endpoint 
      : `wss://${endpoint}/mqtt`
    
    log('info', `Initializing NEW PubSub instance with endpoint: ${wssUrl}`)
    
    // Get auth session for credentials
    try {
      const session = await fetchAuthSession()
      const identityId = session.identityId
      log('info', `Auth session retrieved, identityId: ${identityId}`)
      
      if (!identityId) {
        throw new Error('No identityId in session - user may not be authenticated')
      }
      
      // Use identityId + TAB_ID to allow multiple tabs/devices
      // Each browser tab gets its own unique client ID
      // AWS IoT Core kicks duplicate client IDs → this prevents that
      const cleanIdentity = identityId.replace(/:/g, '-')
      const clientId = `${cleanIdentity}-${TAB_ID}`
      log('info', `Using client ID: ${clientId}`)
      log('info', `🔑 Tab-specific ID allows multiple tabs/devices to connect simultaneously`)
      
      pubsubInstance = new PubSub({
        region: 'eu-west-1',
        endpoint: wssUrl,
        clientId: clientId,
        // MQTT keepalive settings to prevent connection timeout
        keepAliveTimeoutMs: 30000,   // 30 seconds - keepalive ping interval
        reconnectTimeoutMs: 10000,   // 10 seconds - wait before reconnect (less aggressive)
        connectTimeoutMs: 15000,     // 15 seconds - initial connection timeout
      })
      
      // Listen to connection state changes (ONLY ONCE for entire app!)
      if (!hubListenerRegistered) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('🎧 REGISTERING HUB LISTENER (SINGLETON)')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        log('info', '🎧 Registering Hub listener (once for entire app)')
        
        // Track previous state to suppress normal handshake disruptions
        let previousState: ConnectionState | null = null
        let lastDisruptionTime = 0
        let lastConnectedTime = 0
        
        Hub.listen('pubsub', (data) => {
          const { payload } = data
          if (payload.event === CONNECTION_STATE_CHANGE) {
            const connectionState = (payload.data as any).connectionState as ConnectionState
            const now = Date.now()
            
            // Track when we connected
            if (connectionState === ConnectionState.Connected) {
              lastConnectedTime = now
            }
            
            // Suppress ConnectionDisrupted if:
            // 1. Previous state was Connecting (normal handshake)
            // 2. It happens within 3 seconds of last disruption (reconnect loop)
            // 3. Previous state was ConnectedPendingDisconnect (token refresh)
            // 4. Previous state was Connected AND < 5 seconds ago (credentials refresh!)
            if (connectionState === ConnectionState.ConnectionDisrupted) {
              const timeSinceLastDisruption = now - lastDisruptionTime
              const timeSinceConnected = now - lastConnectedTime
              
              if (previousState === ConnectionState.Connecting ||
                  previousState === ConnectionState.ConnectedPendingDisconnect ||
                  timeSinceLastDisruption < 3000 ||
                  (previousState === ConnectionState.Connected && timeSinceConnected < 5000)) {
                // This is NORMAL behavior - don't spam console
                // Reasons:
                // - AWS credentials refresh (every ~1 hour)
                // - TLS session renewal
                // - Network idle timeout
                // - Normal MQTT handshake flow
                log('info', '🔄 Brief disconnect (credential refresh or network handshake) - auto-reconnecting...')
                previousState = connectionState
                lastDisruptionTime = now
                return
              }
              lastDisruptionTime = now
            }
            
            // Suppress noisy "Pending" states (these are internal AWS IoT transitions)
            if (connectionState === ConnectionState.ConnectedPendingDisconnect ||
                connectionState === ConnectionState.ConnectedPendingKeepAlive ||
                connectionState === ConnectionState.ConnectedPendingNetwork ||
                connectionState === ConnectionState.ConnectionDisruptedPendingNetwork) {
              // These are internal state transitions, don't log them
              previousState = connectionState
              return
            }
            
            // Only log meaningful state changes
            log('info', `Connection state: ${connectionState}`)
            
            if (connectionState === ConnectionState.Connected) {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              console.log('✅ IoT CONNECTED - Ready to Send/Receive')
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              log('info', '✅ PubSub connected - ready to send/receive')
              
              // Clear timeout when connected
              if (connectionStateTimeout) {
                clearTimeout(connectionStateTimeout)
                connectionStateTimeout = null
              }
              
              // Start keepalive logging (shows ping activity every 30 seconds)
              if (keepaliveInterval) clearInterval(keepaliveInterval)
              keepaliveInterval = setInterval(() => {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                console.log('💚 IoT PING - Connection Alive')
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                log('info', '📡 MQTT keepalive ping (socket alive)')
              }, 30000) // Every 30 seconds - matches keepAliveTimeoutMs
              
            } else if (connectionState === ConnectionState.Disconnected) {
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              console.log('⚠️ IoT DISCONNECTED')
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              
              // Stop keepalive logging when disconnected
              if (keepaliveInterval) {
                clearInterval(keepaliveInterval)
                keepaliveInterval = null
              }
              log('warn', 'PubSub disconnected')
              
            } else if (connectionState === ConnectionState.Connecting) {
              console.log('🔌 IoT Connecting...')
              log('info', 'PubSub connecting...')
              
            } else if (connectionState === ConnectionState.ConnectionDisrupted) {
              // Only log if it's NOT during handshake (we already filtered that above)
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              console.log('⚠️ IoT Connection DISRUPTED (unexpected)')
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
              log('warn', 'PubSub connection disrupted (unexpected)')
              // Schedule reset if stays disrupted
              scheduleConnectionCheck()
            }
            
            previousState = connectionState
          }
        })
        hubListenerRegistered = true
      } else {
        log('info', '♻️ Hub listener already registered, skipping')
      }
      
      log('info', 'PubSub instance created and cached')
    } catch (err) {
      log('error', `Failed to get auth session: ${err}`)
      throw err
    }
  } else {
    log('info', 'Reusing existing PubSub instance')
  }
  return pubsubInstance
}

export type PublishParams = { topic: string; message: unknown }
export type SubscribeParams = { topic: string }
export type Subscription = { unsubscribe: () => void }

export async function publish({ topic, message }: PublishParams): Promise<void> {
  try {
    log('info', `Publishing to topic: ${topic}`)
    const pubsub = await getPubSubInstance()
    await pubsub.publish({ topics: [topic], message: message as any })
    log('info', `Published successfully to ${topic}`)
  } catch (err) {
    log('error', `Publish failed: ${err}`)
    throw err
  }
}

export async function subscribe(
  { topic }: SubscribeParams,
  onMessage: (data: unknown) => void,
  onError?: (err: unknown) => void
): Promise<Subscription | null> {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 PUBSUB SUBSCRIBE CALLED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Topic:', topic)
    console.log('Timestamp:', new Date().toISOString())
    
    log('info', `Subscribing to topic: ${topic}`)
    
    console.log('Getting PubSub instance...')
    const pubsub = await getPubSubInstance()
    console.log('✅ PubSub instance obtained')
    
    console.log('Creating subscription...')
    const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
      next: (data: any) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📥 MESSAGE RECEIVED IN PUBSUB.TS')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('Topic:', topic)
        console.log('Raw data:', data)
        console.log('Data type:', typeof data)
        console.log('Data keys:', Object.keys(data))
        if (data.value) {
          console.log('data.value type:', typeof data.value)
          console.log('data.value:', data.value)
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        log('info', `Message received on ${topic}`)
        onMessage(data)
      },
      error: (e: unknown) => {
        console.error('❌ SUBSCRIPTION ERROR:', e)
        log('error', `Subscribe error on ${topic}: ${e}`)
        onError?.(e)
      },
    })
    
    console.log('✅ Subscription created successfully')
    console.log('Subscription object:', sub)
    log('info', `Subscribed successfully to ${topic}`)
    
    return { unsubscribe: () => {
      console.log(`🧹 Unsubscribing from ${topic}`)
      log('info', `Unsubscribing from ${topic}`)
      sub.unsubscribe()
    }}
  } catch (err) {
    console.error('❌ SUBSCRIBE FAILED:', err)
    console.error('Error details:', err)
    log('error', `Subscribe setup failed: ${err}`)
    onError?.(err)
    return null
  }
}

/**
 * Auto-connect to IoT - initializes PubSub and waits for connection
 * Call this on app startup to ensure connection is ready
 */
export async function autoConnect(): Promise<boolean> {
  // Prevent duplicate autoConnect calls (singleton pattern)
  if (isAutoConnecting) {
    log('info', '⏳ AutoConnect already in progress, skipping duplicate call')
    return true
  }
  
  if (keepaliveSubscription) {
    log('info', '✅ AutoConnect already completed, connection active')
    return true
  }
  
  isAutoConnecting = true
  log('info', '🔌 Auto-connecting to AWS IoT...')
  
  try {
    // Initialize PubSub instance
    const pubsub = await getPubSubInstance()
    
    // Trigger connection by subscribing to a keepalive topic
    // In Amplify PubSub v6, WebSocket only opens on first subscribe/publish!
    log('info', '📡 Triggering connection with keepalive subscribe...')
    keepaliveSubscription = pubsub.subscribe({ 
      topics: 'radio/system/keepalive' 
    }).subscribe({
      next: () => {}, // Ignore messages
      error: (err) => log('warn', `Keepalive sub error: ${err}`)
    })
    
    // Wait for Hub listener to detect Connected state (max 10 seconds)
    const connected = await new Promise<boolean>((resolve) => {
      let attempts = 0
      const maxAttempts = 20 // 10 seconds total (500ms * 20)
      
      const checkConnection = setInterval(() => {
        attempts++
        
        // Check recent logs for "connected" message
        const recentLogs = getLogs().slice(0, 5)
        const hasConnected = recentLogs.some(log => 
          log.message.includes('PubSub connected') || 
          log.message.includes('ready to send/receive')
        )
        
        if (hasConnected) {
          clearInterval(checkConnection)
          log('info', '✅ Auto-connect confirmed - connection established!')
          resolve(true)
        } else if (attempts >= maxAttempts) {
          clearInterval(checkConnection)
          log('warn', '⚠️ Auto-connect timeout - connection may still be establishing')
          resolve(true) // Assume success, Hub listener will update state
        }
      }, 500)
    })
    
    // Keep the keepalive subscription alive (don't unsubscribe!)
    // This maintains the WebSocket connection
    log('info', '🔗 Keepalive subscription active - connection maintained')
    
    // Start publishing keepalive pings every 30 seconds
    // This prevents AWS IoT from closing idle connections
    if (keepaliveInterval) clearInterval(keepaliveInterval)
    keepaliveInterval = setInterval(async () => {
      try {
        await pubsub.publish({
          topics: 'radio/system/keepalive',
          message: {
            timestamp: Date.now(),
            type: 'ping'
          }
        })
        console.log('💚 IoT PING - Connection Alive')
      } catch (err) {
        console.warn('⚠️ Keepalive ping failed:', err)
      }
    }, 30000) // Every 30 seconds
    
    return connected
  } catch (err) {
    log('error', `Auto-connect failed: ${err}`)
    return false
  } finally {
    isAutoConnecting = false
  }
}

export async function testConnect(topic: string, timeoutMs = 5000): Promise<boolean> {
  log('info', `Testing connection to topic: ${topic} (timeout: ${timeoutMs}ms)`)
  
  return new Promise(async (resolve) => {
    let done = false
    let connectionCheckInterval: NodeJS.Timeout | null = null
    
    try {
      const pubsub = await getPubSubInstance()
      
      // Wait for Connected state by checking Hub events
      const checkConnection = () => {
        // Check if we've seen a Connected state via Hub listener
        // If timeout reached without explicit error, assume OK
        if (!done) {
          done = true
          log('info', `testConnect timeout reached for ${topic} - assuming connection OK`)
          if (connectionCheckInterval) clearInterval(connectionCheckInterval)
          resolve(true)
        }
      }
      
      // Subscribe to test topic
      const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
        next: () => {
          if (!done) {
            done = true
            log('info', `testConnect received message on ${topic} - connection confirmed!`)
            if (connectionCheckInterval) clearInterval(connectionCheckInterval)
            try { sub.unsubscribe() } catch {}
            resolve(true)
          }
        },
        error: (err: unknown) => {
          if (!done) {
            done = true
            log('error', `testConnect error on ${topic}: ${err}`)
            if (connectionCheckInterval) clearInterval(connectionCheckInterval)
            try { sub.unsubscribe() } catch {}
            resolve(false)
          }
        }
      })
      
      log('info', `testConnect subscribed to ${topic}, waiting up to ${timeoutMs}ms...`)
      
      // Set timeout
      setTimeout(() => {
        checkConnection()
        try { sub.unsubscribe() } catch {}
      }, timeoutMs)
      
    } catch (err) {
      log('error', `testConnect setup failed: ${err}`)
      if (connectionCheckInterval) clearInterval(connectionCheckInterval)
      resolve(false)
    }
  })
}
