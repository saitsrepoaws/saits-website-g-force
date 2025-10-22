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
  if (connectionStateTimeout) {
    clearTimeout(connectionStateTimeout)
    connectionStateTimeout = null
  }
}

// PubSub instance - initialized lazily
let pubsubInstance: PubSub | null = null
let connectionStateTimeout: NodeJS.Timeout | null = null

// Reset PubSub instance if connection stays disrupted
function scheduleConnectionCheck() {
  if (connectionStateTimeout) clearTimeout(connectionStateTimeout)
  connectionStateTimeout = setTimeout(() => {
    log('warn', 'Connection disrupted for too long, resetting PubSub instance')
    pubsubInstance = null
  }, 10000) // Reset after 10 seconds of disruption
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
      })
      
      // Listen to connection state changes
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
          } else if (connectionState === ConnectionState.Disconnected) {
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

export async function testConnect(topic: string, timeoutMs = 1500): Promise<boolean> {
  if (!isEnabled()) {
    log('warn', 'testConnect() called but PubSub is disabled')
    return false
  }
  log('info', `Testing connection to topic: ${topic} (timeout: ${timeoutMs}ms)`)
  return new Promise(async (resolve) => {
    let done = false
    try {
      const pubsub = await getPubSubInstance()
      const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
        next: () => {
          log('info', `testConnect received data on ${topic}`)
        },
        error: (err: unknown) => {
          if (!done) {
            done = true
            log('error', `testConnect error on ${topic}: ${err}`)
            try { sub.unsubscribe() } catch {}
            resolve(false)
          }
        },
        complete: () => {
          log('info', `testConnect completed on ${topic}`)
        }
      })
      log('info', `testConnect subscribed to ${topic}, waiting for timeout...`)
      setTimeout(() => {
        if (!done) {
          done = true
          log('info', `testConnect timeout reached for ${topic} - connection OK`)
          try { sub.unsubscribe() } catch {}
          resolve(true)
        }
      }, timeoutMs)
    } catch (err) {
      log('error', `testConnect setup failed: ${err}`)
      resolve(false)
    }
  })
}
