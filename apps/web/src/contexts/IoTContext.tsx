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

  // Initialize connection
  useEffect(() => {
    if (!autoConnect) return
    
    console.log('🔌 IoTProvider: Initializing connection...')
    
    const initialize = async () => {
      try {
        // Auto-connect will initialize PubSub singleton
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
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const currentLogs = pubsub.getLogs()
      
      // Update logs
      setLogs(currentLogs)
      
      // Check last log for connection state
      if (currentLogs.length > 0) {
        const latestLog = currentLogs[0]
        
        // Detect connection state from logs
        if (latestLog.message.includes('connected') && latestLog.level === 'info') {
          if (!isConnected) {
            setIsConnected(true)
            setConnectionState(ConnectionState.Connected)
            connectionStartTime.current = Date.now()
            console.log('✅ IoTContext: Connected')
          }
        } else if (latestLog.message.includes('disconnected') || latestLog.message.includes('disrupted')) {
          if (isConnected && latestLog.level === 'warn') {
            setIsConnected(false)
            setConnectionState(ConnectionState.ConnectionDisrupted)
            console.log('⚠️ IoTContext: Connection disrupted')
          }
        } else if (latestLog.message.includes('connecting')) {
          setConnectionState(ConnectionState.Connecting)
        }
        
        // Detect ping (keepalive)
        if (latestLog.message.includes('keepalive ping')) {
          setLastPingTime(Date.now())
        }
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
    if (!isInitialized) {
      throw new Error('IoT not initialized')
    }
    
    await pubsub.publish({ topic, message })
  }, [isInitialized])

  // Subscribe method
  const subscribe = useCallback(async (
    topic: string, 
    onMessage: (data: unknown) => void,
    onError?: (err: unknown) => void
  ) => {
    if (!isInitialized) {
      throw new Error('IoT not initialized')
    }
    
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
  }, [isInitialized])

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
