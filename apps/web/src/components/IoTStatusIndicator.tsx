/**
 * IoT Status Indicator Component
 * Shows connection status with colored indicator + retry button
 */

import { useState, useEffect } from 'react'
import { Hub } from 'aws-amplify/utils'
import { CONNECTION_STATE_CHANGE } from '@aws-amplify/pubsub'
import { testConnect, resetPubSub } from '../services/pubsub'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disrupted'

export default function IoTStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    // Listen to PubSub connection state changes via Hub
    const hubListener = Hub.listen('pubsub', (data) => {
      const { payload } = data
      if (payload.event === CONNECTION_STATE_CHANGE) {
        const connectionState = (payload.data as any).connectionState as string
        setLastUpdate(new Date())
        
        // Map Amplify connection states to our simplified states
        if (connectionState === 'Connected') {
          setStatus('connected')
        } else if (connectionState === 'Connecting') {
          setStatus('connecting')
        } else if (connectionState.includes('Disrupted')) {
          setStatus('disrupted')
        } else if (connectionState === 'Disconnected') {
          setStatus('disconnected')
        }
      }
    })

    return () => {
      hubListener()
    }
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500 animate-pulse'
      case 'disrupted':
        return 'bg-orange-500 animate-pulse'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'disrupted':
        return 'Disrupted'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Unknown'
    }
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    console.log('🔄 Manual IoT reconnect requested...')
    
    // Reset PubSub instance
    resetPubSub()
    setStatus('connecting')
    
    // Test connection
    const ok = await testConnect('radio/player/connection-test')
    setStatus(ok ? 'connected' : 'disconnected')
    setIsRetrying(false)
    
    console.log(ok ? '✅ Reconnect successful' : '❌ Reconnect failed')
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor()}`} />
      
      {/* Status text */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-700">
          IoT {getStatusText()}
        </span>
        <span className="text-[10px] text-gray-500">
          {lastUpdate.toLocaleTimeString()}
        </span>
      </div>
      
      {/* Retry button (only show if not connected) */}
      {status !== 'connected' && (
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="px-2 py-0.5 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded border border-blue-300 disabled:opacity-50"
          title="Retry connection"
        >
          {isRetrying ? '...' : '↻'}
        </button>
      )}
    </div>
  )
}
