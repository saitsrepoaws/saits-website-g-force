/**
 * MQTT Service for AWS IoT Core
 * Uses MQTT.js with Cognito credentials
 * Replaces broken Amplify PubSub
 */

import mqtt, { type MqttClient } from 'mqtt'
import { fetchAuthSession } from 'aws-amplify/auth'
import { generateSignedIoTUrl } from './awsIotSigner'

type MessageCallback = (topic: string, message: any) => void
type ConnectionCallback = (connected: boolean) => void

export class MQTTService {
  private client: MqttClient | null = null
  private endpoint: string
  private region: string
  private subscriptions: Map<string, Set<MessageCallback>> = new Map()
  private connectionCallbacks: Set<ConnectionCallback> = new Set()
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5

  constructor(endpoint: string, region: string = 'eu-west-1') {
    this.endpoint = endpoint
    this.region = region
  }

  /**
   * Connect to AWS IoT Core
   */
  async connect(): Promise<boolean> {
    if (this.client?.connected) {
      console.log('✅ MQTT already connected')
      return true
    }

    try {
      console.log('🔌 Connecting to AWS IoT via MQTT.js...')

      // Get Cognito credentials
      const session = await fetchAuthSession()
      if (!session.credentials) {
        throw new Error('No credentials available')
      }

      const identityId = session.identityId
      console.log(`🔑 Using identityId: ${identityId}`)

      // Generate signed WebSocket URL
      const { url } = await generateSignedIoTUrl(
        this.endpoint,
        session.credentials,
        this.region
      )

      console.log('🔐 Generated signed URL for MQTT connection')

      // Connect with MQTT.js
      this.client = mqtt.connect(url, {
        clientId: identityId?.replace(':', '-') || `mqtt-${Date.now()}`,
        protocol: 'wss',
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        clean: true,
        keepalive: 60,
      })

      // Setup event handlers
      this.setupEventHandlers()

      // Wait for connection
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('❌ MQTT connection timeout')
          resolve(false)
        }, 10000)

        this.client!.once('connect', () => {
          clearTimeout(timeout)
          console.log('✅ MQTT connected successfully!')
          this.reconnectAttempts = 0
          this.notifyConnectionCallbacks(true)
          resolve(true)
        })

        this.client!.once('error', (err) => {
          clearTimeout(timeout)
          console.error('❌ MQTT connection error:', err)
          resolve(false)
        })
      })
    } catch (error) {
      console.error('❌ Failed to connect to MQTT:', error)
      return false
    }
  }

  /**
   * Setup MQTT event handlers
   */
  private setupEventHandlers() {
    if (!this.client) return

    this.client.on('connect', () => {
      console.log('✅ MQTT connected')
      this.reconnectAttempts = 0
      this.notifyConnectionCallbacks(true)
      
      // Re-subscribe to all topics
      this.resubscribeAll()
    })

    this.client.on('reconnect', () => {
      this.reconnectAttempts++
      console.log(`🔄 MQTT reconnecting... (attempt ${this.reconnectAttempts})`)
    })

    this.client.on('disconnect', () => {
      console.log('🔌 MQTT disconnected')
      this.notifyConnectionCallbacks(false)
    })

    this.client.on('offline', () => {
      console.log('📴 MQTT offline')
      this.notifyConnectionCallbacks(false)
    })

    this.client.on('error', (err) => {
      console.error('❌ MQTT error:', err)
    })

    this.client.on('message', (topic, payload) => {
      try {
        const message = JSON.parse(payload.toString())
        console.log(`📩 MQTT message on ${topic}:`, message)
        this.notifySubscribers(topic, message)
      } catch (error) {
        console.error('❌ Failed to parse MQTT message:', error)
      }
    })
  }

  /**
   * Subscribe to topic
   */
  async subscribe(topic: string, callback: MessageCallback): Promise<() => void> {
    if (!this.client) {
      throw new Error('MQTT client not initialized. Call connect() first.')
    }

    console.log(`📡 Subscribing to MQTT topic: ${topic}`)

    // Add callback to subscriptions
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set())
    }
    this.subscriptions.get(topic)!.add(callback)

    // Subscribe to topic if connected
    if (this.client.connected) {
      await new Promise<void>((resolve, reject) => {
        this.client!.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`❌ Failed to subscribe to ${topic}:`, err)
            reject(err)
          } else {
            console.log(`✅ Subscribed to ${topic}`)
            resolve()
          }
        })
      })
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(topic)?.delete(callback)
      if (this.subscriptions.get(topic)?.size === 0) {
        this.subscriptions.delete(topic)
        if (this.client?.connected) {
          this.client.unsubscribe(topic)
          console.log(`📡 Unsubscribed from ${topic}`)
        }
      }
    }
  }

  /**
   * Publish message to topic
   */
  async publish(topic: string, message: any): Promise<void> {
    if (!this.client?.connected) {
      throw new Error('MQTT client not connected')
    }

    const payload = JSON.stringify(message)
    console.log(`📤 Publishing to ${topic}:`, message)

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Failed to publish to ${topic}:`, err)
          reject(err)
        } else {
          console.log(`✅ Published to ${topic}`)
          resolve()
        }
      })
    })
  }

  /**
   * Re-subscribe to all topics after reconnect
   */
  private async resubscribeAll() {
    if (!this.client?.connected) return

    console.log('🔄 Re-subscribing to all topics...')
    for (const topic of this.subscriptions.keys()) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.client!.subscribe(topic, { qos: 1 }, (err) => {
            if (err) reject(err)
            else {
              console.log(`✅ Re-subscribed to ${topic}`)
              resolve()
            }
          })
        })
      } catch (error) {
        console.error(`❌ Failed to re-subscribe to ${topic}:`, error)
      }
    }
  }

  /**
   * Notify message subscribers
   */
  private notifySubscribers(topic: string, message: any) {
    const callbacks = this.subscriptions.get(topic)
    if (callbacks) {
      callbacks.forEach(callback => callback(topic, message))
    }
  }

  /**
   * Register connection state callback
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback)
    // Immediately call with current state
    callback(this.client?.connected || false)
    return () => {
      this.connectionCallbacks.delete(callback)
    }
  }

  /**
   * Notify connection callbacks
   */
  private notifyConnectionCallbacks(connected: boolean) {
    this.connectionCallbacks.forEach(callback => callback(connected))
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.connected || false
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.client) {
      console.log('🔌 Disconnecting MQTT...')
      this.client.end(true)
      this.client = null
    }
  }
}

// Singleton instance
let mqttInstance: MQTTService | null = null

/**
 * Get MQTT service instance (singleton)
 */
export function getMQTTService(): MQTTService {
  if (!mqttInstance) {
    const endpoint = (import.meta as any).env?.VITE_AWS_IOT_ENDPOINT
    if (!endpoint) {
      throw new Error('VITE_AWS_IOT_ENDPOINT not configured')
    }
    mqttInstance = new MQTTService(endpoint, 'eu-west-1')
  }
  return mqttInstance
}

/**
 * Reset MQTT service (for testing/debugging)
 */
export function resetMQTTService() {
  if (mqttInstance) {
    mqttInstance.disconnect()
    mqttInstance = null
  }
}
