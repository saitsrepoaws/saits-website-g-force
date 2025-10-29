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

export function resetPubSub() {
  log('warn', 'Manually resetting PubSub instance')
  pubsubInstance = null
  hubListenerRegistered = false // Allow re-registration
  if (connectionStateTimeout) {
    clearTimeout(connectionStateTimeout)
    connectionStateTimeout = null
  }
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval)
    keepaliveInterval = null
  }
}

// PubSub instance - initialized lazily (SINGLETON for entire app!)
let pubsubInstance: PubSub | null = null
let connectionStateTimeout: NodeJS.Timeout | null = null
let hubListenerRegistered = false // Track if Hub listener is already registered
let keepaliveInterval: NodeJS.Timeout | null = null // Track keepalive logging

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
      
      // Use identityId as client ID to match IoT policy
      const clientId = identityId.replace(':', '-') // IoT doesn't allow : in client ID
      log('info', `Using client ID: ${clientId}`)
      
      pubsubInstance = new PubSub({
        region: 'eu-west-1',
        endpoint: wssUrl,
        clientId: clientId,
        // MQTT keepalive settings to prevent connection timeout
        keepAliveTimeoutMs: 60000, // 60 seconds - send ping if no activity
        reconnectTimeoutMs: 5000,   // Auto-reconnect after 5 seconds
      })
      
      // Listen to connection state changes (ONLY ONCE for entire app!)
      if (!hubListenerRegistered) {
        log('info', '🎧 Registering Hub listener (once for entire app)')
        Hub.listen('pubsub', (data) => {
          const { payload } = data
          if (payload.event === CONNECTION_STATE_CHANGE) {
            const connectionState = (payload.data as any).connectionState as ConnectionState
            log('info', `Connection state: ${connectionState}`)
            
            if (connectionState === ConnectionState.Connected) {
              log('info', '✅ PubSub connected - ready to send/receive')
              // Clear timeout when connected
              if (connectionStateTimeout) {
                clearTimeout(connectionStateTimeout)
                connectionStateTimeout = null
              }
              
              // Start keepalive logging (shows ping activity every 60 seconds)
              if (keepaliveInterval) clearInterval(keepaliveInterval)
              keepaliveInterval = setInterval(() => {
                log('info', '📡 MQTT keepalive ping (connection active)')
              }, 60000) // Every 60 seconds
              
            } else if (connectionState === ConnectionState.Disconnected) {
              // Stop keepalive logging when disconnected
              if (keepaliveInterval) {
                clearInterval(keepaliveInterval)
                keepaliveInterval = null
              }
              log('warn', 'PubSub disconnected')
            } else if (connectionState === ConnectionState.Connecting) {
              log('info', 'PubSub connecting...')
            } else if (connectionState === ConnectionState.ConnectionDisrupted) {
              log('info', 'PubSub connection disrupted (normal during handshake)')
              // Schedule reset if stays disrupted
              scheduleConnectionCheck()
            }
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

export function isEnabled(): boolean {
  return (import.meta as any).env?.VITE_ENABLE_PUBSUB === 'true'
}

export async function publish({ topic, message }: PublishParams): Promise<void> {
  if (!isEnabled()) {
    log('warn', 'publish() called but PubSub is disabled')
    return
  }
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
  if (!isEnabled()) {
    log('warn', 'subscribe() called but PubSub is disabled')
    return null
  }
  try {
    log('info', `Subscribing to topic: ${topic}`)
    const pubsub = await getPubSubInstance()
    const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
      next: (data: any) => {
        log('info', `Message received on ${topic}`)
        onMessage(data)
      },
      error: (e: unknown) => {
        log('error', `Subscribe error on ${topic}: ${e}`)
        onError?.(e)
      },
    })
    log('info', `Subscribed successfully to ${topic}`)
    return { unsubscribe: () => {
      log('info', `Unsubscribing from ${topic}`)
      sub.unsubscribe()
    }}
  } catch (err) {
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
  if (!isEnabled()) {
    log('warn', 'autoConnect() called but PubSub is disabled')
    return false
  }
  
  log('info', '🔌 Auto-connecting to AWS IoT...')
  
  try {
    // Initialize PubSub instance (creates connection)
    await getPubSubInstance()
    
    // Wait a bit for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Test with a radio/player/* topic (allowed by RadioPlayerCognitoPolicy)
    return await testConnect('radio/player/health-check', 3000)
  } catch (err) {
    log('error', `Auto-connect failed: ${err}`)
    return false
  }
}

export async function testConnect(topic: string, timeoutMs = 5000): Promise<boolean> {
  if (!isEnabled()) {
    log('warn', 'testConnect() called but PubSub is disabled')
    return false
  }
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
