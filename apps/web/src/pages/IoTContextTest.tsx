/**
 * IoTContextTest - Test page for IoTContext
 * 
 * Tests:
 * - Connection status
 * - Subscribe to topic
 * - Publish to topic
 * - Logs display
 */

import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useIoT } from '../contexts/IoTContext'
import IoTConnectionStatus from '../components/IoTConnectionStatus'

export default function IoTContextTest() {
  const { 
    isConnected, 
    connectionState, 
    logs, 
    publish, 
    subscribe,
    clearLogs,
    reconnect,
    connectionUptime,
    lastPingTime
  } = useIoT()

  const [testMessage, setTestMessage] = useState('')
  const [testTopic, setTestTopic] = useState('radio/test/message')
  const [receivedMessages, setReceivedMessages] = useState<any[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Subscribe to test topic
  useEffect(() => {
    if (!isConnected) return

    console.log('🧪 Test: Subscribing to', testTopic)
    
    let unsubscribe: (() => void) | null = null
    
    const setupSubscription = async () => {
      try {
        unsubscribe = await subscribe(
          testTopic,
          (message: any) => {
            console.log('🧪 Test: Message received!', message)
            setReceivedMessages(prev => [
              { timestamp: Date.now(), data: message },
              ...prev.slice(0, 9) // Keep last 10
            ])
          },
          (error: any) => {
            console.error('🧪 Test: Subscribe error', error)
          }
        )
        setIsSubscribed(true)
        console.log('🧪 Test: Subscribed successfully!')
      } catch (err) {
        console.error('🧪 Test: Failed to subscribe', err)
      }
    }

    setupSubscription()

    return () => {
      console.log('🧪 Test: Unsubscribing from', testTopic)
      if (unsubscribe) {
        unsubscribe()
      }
      setIsSubscribed(false)
    }
  }, [isConnected, testTopic, subscribe])

  // Publish test message
  const handlePublish = async () => {
    if (!testMessage) {
      alert('Enter a message first!')
      return
    }

    try {
      console.log('🧪 Test: Publishing to', testTopic)
      await publish(testTopic, {
        message: testMessage,
        timestamp: new Date().toISOString(),
        source: 'IoTContextTest'
      })
      console.log('🧪 Test: Published successfully!')
      setTestMessage('')
    } catch (err) {
      console.error('🧪 Test: Publish failed', err)
      alert('Failed to publish: ' + err)
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl shadow-lg border border-white/20 p-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            🧪 IoT Context Test Page
          </h1>
          <p className="text-white/80">
            Test central IoT connection, publish, subscribe, and logs
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📡 Connection Status
          </h2>
          
          <div className="space-y-4">
            <IoTConnectionStatus showDetails={true} />
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">State</div>
                <div className="text-lg font-bold text-gray-900">{connectionState}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Connected</div>
                <div className="text-lg font-bold text-gray-900">
                  {isConnected ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="text-lg font-bold text-gray-900">
                  {connectionUptime}s
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Last Ping</div>
                <div className="text-lg font-bold text-gray-900">
                  {lastPingTime 
                    ? `${Math.floor((Date.now() - lastPingTime) / 1000)}s ago`
                    : 'N/A'
                  }
                </div>
              </div>
            </div>

            <button
              onClick={reconnect}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🔄 Reconnect
            </button>
          </div>
        </div>

        {/* Publish Test */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📤 Publish Test
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic
              </label>
              <input
                type="text"
                value={testTopic}
                onChange={(e) => setTestTopic(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="radio/test/message"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePublish()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Type your message..."
              />
            </div>

            <button
              onClick={handlePublish}
              disabled={!isConnected}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isConnected ? '📤 Publish Message' : '⏳ Waiting for connection...'}
            </button>
          </div>
        </div>

        {/* Subscribe Status */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📥 Subscription Status
          </h2>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Subscribed to:</span>
              <span className="text-sm font-mono font-bold text-blue-600">{testTopic}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm font-bold ${isSubscribed ? 'text-green-600' : 'text-red-600'}`}>
                {isSubscribed ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Received Messages */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📬 Received Messages ({receivedMessages.length})
          </h2>
          
          {receivedMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages received yet. Publish a message to see it here!
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {receivedMessages.map((msg, idx) => (
                <div key={idx} className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <pre className="text-sm text-gray-800 overflow-x-auto">
                    {JSON.stringify(msg.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection Logs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              📋 Connection Logs ({logs.length})
            </h2>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
          
          <div className="space-y-1 max-h-96 overflow-y-auto bg-black p-3 rounded-lg">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                No logs yet
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={`text-xs font-mono ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  [{new Date(log.timestamp).toLocaleTimeString()}] 
                  [{log.level.toUpperCase()}] 
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
