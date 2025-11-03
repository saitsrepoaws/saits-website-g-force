/**
 * IoTContext - Central IoT Connection Management
 * 
 * Provides a single WebSocket connection to AWS IoT for the entire application.
 * Wraps the PubSub singleton and provides React-friendly interface.
 * 
 * Features:
 * - Single connection for entire app
 * - Automatic reconnection
 * - Connection status monitoring
 * - Credentials refresh handling
 * - Central logging
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import * as pubsub from '../services/pubsub'
import type { LogEntry } from '../services/pubsub'
import { attachIoTPolicyToCurrentUser } from '../services/iotPolicyAttacher'

// Connection states from AWS IoT SDK
export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  ConnectionDisrupted = 'ConnectionDisrupted',
}

// Context value interface
interface IoTContextValue {
  // Connection state
  isConnected: boolean
  connectionState: ConnectionState
  isInitialized: boolean
  
  // Metrics
  lastPingTime: number | null
  connectionUptime: number // in seconds
  
  // Logs
  logs: LogEntry[]
  
  // Methods
  publish: (topic: string, message: unknown) => Promise<void>
  subscribe: (topic: string, onMessage: (data: unknown) => void, onError?: (err: unknown) => void) => Promise<() => void>
  clearLogs: () => void
  reconnect: () => Promise<void>
}

// Create context with undefined default (will throw if used outside provider)
const IoTContext = createContext<IoTContextValue | undefined>(undefined)

// Provider props
interface IoTProviderProps {
  children: React.ReactNode
  autoConnect?: boolean
}

/**
 * IoTProvider - Wraps the entire app to provide IoT connection
 */
export function IoTProvider({ children, autoConnect = true }: IoTProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected)
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastPingTime, setLastPingTime] = useState<number | null>(null)
  const [connectionUptime, setConnectionUptime] = useState(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  
  const connectionStartTime = useRef<number | null>(null)
  const uptimeInterval = useRef<NodeJS.Timeout | null>(null)
  const subscriptions = useRef<Map<string, any>>(new Map())

  // Initialize connection (only if autoConnect=true)
  useEffect(() => {
    if (!autoConnect) {
      console.log('📊 IoTProvider: Passive mode - monitoring existing connection')
      setIsInitialized(true)
      return
    }
    
    console.log('🔌 IoTProvider: Initializing connection...')
    
    const initialize = async () => {
      try {
        // First attach IoT Policy to Cognito Identity (required for MQTT!)
        console.log('🔗 Attaching IoT Policy to identity...')
        const attached = await attachIoTPolicyToCurrentUser()
        if (!attached) {
          console.warn('⚠️ Failed to attach IoT Policy - connection may fail')
        }
        
        // Then auto-connect will initialize PubSub singleton
        const connected = await pubsub.autoConnect()
        setIsInitialized(true)
        console.log('✅ IoTProvider: Connection initialized:', connected)
      } catch (err) {
        console.error('❌ IoTProvider: Failed to initialize:', err)
        setIsInitialized(true) // Still mark as initialized even if failed
      }
    }
    
    initialize()
  }, [autoConnect])

  // Monitor connection state via logs
  // DEBOUNCED to prevent rapid state flipping
  useEffect(() => {
    let stableConnectedCount = 0
    let stableDisconnectedCount = 0
    
    const checkInterval = setInterval(() => {
      const currentLogs = pubsub.getLogs()
      
      // Update logs
      setLogs(currentLogs)
      
      // Scan recent logs (last 10) for connection state
      const recentLogs = currentLogs.slice(0, 10)
      
      // Check if we have any "connected" logs recently
      const hasConnectedLog = recentLogs.some(log => 
        log.level === 'info' && 
        (log.message.toLowerCase().includes('connected') || 
         log.message.includes('Ready to Send/Receive'))
      )
      
      // Check if we have "connecting" or "disconnected" logs
      const hasConnectingLog = recentLogs.some(log => 
        log.message.toLowerCase().includes('connecting')
      )
      
      const hasDisconnectedLog = recentLogs.some(log => 
        (log.message.toLowerCase().includes('disconnected') || 
         log.message.toLowerCase().includes('disrupted')) &&
        log.level === 'warn'
      )
      
      // DEBOUNCE: Require 3 consecutive checks before changing state
      // This prevents rapid connect/disconnect flipping
      if (hasConnectedLog && !hasDisconnectedLog) {
        stableConnectedCount++
        stableDisconnectedCount = 0
        
        if (stableConnectedCount >= 3 && !isConnected) {
          setIsConnected(true)
          setConnectionState(ConnectionState.Connected)
          connectionStartTime.current = Date.now()
          console.log('✅ IoTContext: Stable connection detected')
          stableConnectedCount = 0
        }
      } else if (hasDisconnectedLog) {
        stableDisconnectedCount++
        stableConnectedCount = 0
        
        if (stableDisconnectedCount >= 5 && isConnected) {
          setIsConnected(false)
          setConnectionState(ConnectionState.ConnectionDisrupted)
          console.log('⚠️ IoTContext: Confirmed disconnection after 5 checks')
          stableDisconnectedCount = 0
        }
      } else if (hasConnectingLog && !isConnected) {
        stableConnectedCount = 0
        stableDisconnectedCount = 0
        setConnectionState(ConnectionState.Connecting)
      } else {
        // No clear state change, keep counters
      }
      
      // Detect ping (keepalive) - check last 3 logs
      const hasPingLog = currentLogs.slice(0, 3).some(log =>
        log.message.includes('keepalive ping') || log.message.includes('PING')
      )
      
      if (hasPingLog) {
        setLastPingTime(Date.now())
      }
    }, 1000) // Check every second
    
    return () => clearInterval(checkInterval)
  }, [isConnected])

  // Update uptime counter
  useEffect(() => {
    if (!isConnected || !connectionStartTime.current) {
      setConnectionUptime(0)
      if (uptimeInterval.current) {
        clearInterval(uptimeInterval.current)
        uptimeInterval.current = null
      }
      return
    }
    
    // Update uptime every second
    uptimeInterval.current = setInterval(() => {
      if (connectionStartTime.current) {
        const uptime = Math.floor((Date.now() - connectionStartTime.current) / 1000)
        setConnectionUptime(uptime)
      }
    }, 1000)
    
    return () => {
      if (uptimeInterval.current) {
        clearInterval(uptimeInterval.current)
      }
    }
  }, [isConnected])

  // Publish method
  const publish = useCallback(async (topic: string, message: unknown) => {
    // In passive mode, we can still publish if PubSub is available
    try {
      await pubsub.publish({ topic, message })
    } catch (err) {
      console.error('❌ IoTContext: Publish failed', err)
      throw err
    }
  }, [])

  // Subscribe method
  const subscribe = useCallback(async (
    topic: string, 
    onMessage: (data: unknown) => void,
    onError?: (err: unknown) => void
  ) => {
    // In passive mode, we can still subscribe if PubSub is available
    try {
      // Check if already subscribed to this topic
      if (subscriptions.current.has(topic)) {
        console.warn(`⚠️ Already subscribed to ${topic}, returning existing subscription`)
        return subscriptions.current.get(topic).unsubscribe
      }
      
      const sub = await pubsub.subscribe({ topic }, onMessage, onError)
      
      if (sub) {
        subscriptions.current.set(topic, sub)
        console.log(`📡 IoTContext: Subscribed to ${topic}`)
        
        // Return unsubscribe function
        return () => {
          console.log(`📡 IoTContext: Unsubscribing from ${topic}`)
          sub.unsubscribe()
          subscriptions.current.delete(topic)
        }
      }
      
      // Return no-op if subscription failed
      return () => {}
    } catch (err) {
      console.error('❌ IoTContext: Subscribe failed', err)
      throw err
    }
  }, [])

  // Clear logs
  const clearLogs = useCallback(() => {
    pubsub.clearLogs()
    setLogs([])
  }, [])

  // Reconnect
  const reconnect = useCallback(async () => {
    console.log('🔄 IoTContext: Reconnecting...')
    pubsub.resetPubSub()
    
    // Wait a bit then reconnect
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const connected = await pubsub.autoConnect()
    console.log('✅ IoTContext: Reconnected:', connected)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 IoTProvider: Cleaning up subscriptions')
      subscriptions.current.forEach((sub, topic) => {
        console.log(`📡 Unsubscribing from ${topic}`)
        sub.unsubscribe()
      })
      subscriptions.current.clear()
    }
  }, [])

  const value: IoTContextValue = {
    isConnected,
    connectionState,
    isInitialized,
    lastPingTime,
    connectionUptime,
    logs,
    publish,
    subscribe,
    clearLogs,
    reconnect,
  }

  return (
    <IoTContext.Provider value={value}>
      {children}
    </IoTContext.Provider>
  )
}

/**
 * useIoT - Hook to access IoT context
 * 
 * @throws Error if used outside IoTProvider
 */
export function useIoT(): IoTContextValue {
  const context = useContext(IoTContext)
  
  if (context === undefined) {
    throw new Error('useIoT must be used within an IoTProvider')
  }
  
  return context
}

// Export for convenience
export default IoTProvider
