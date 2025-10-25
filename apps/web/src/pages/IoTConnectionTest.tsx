import { useState, useEffect } from 'react'
import { CONNECTION_STATE_CHANGE } from '@aws-amplify/pubsub'
import { Hub } from 'aws-amplify/utils'
import * as pubsubService from '../services/pubsub'
import Layout from '../components/Layout'

export default function IoTConnectionTest() {
  const [connectionState, setConnectionState] = useState('Not Connected')
  const [testResults, setTestResults] = useState<string[]>([])
  const [publishCount, setPublishCount] = useState(0)
  const [receivedCount, setReceivedCount] = useState(0)
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Listen for connection state changes
  useEffect(() => {
    const unsubscribe = Hub.listen('pubsub', (data: any) => {
      const { payload } = data
      if (payload.event === CONNECTION_STATE_CHANGE) {
        const state = payload.data.connectionState
        setConnectionState(state)
        addLog(`🔌 Connection State: ${state}`)
        
        if (state === 'Connected') {
          addLog('✅ IoT Core connected successfully!')
        } else if (state === 'ConnectionDisrupted') {
          addLog('❌ Connection disrupted - check IoT policy')
        }
      }
    })

    return () => unsubscribe()
  }, [])

  function addLog(message: string) {
    setTestResults(prev => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev.slice(0, 19) // Keep last 20 logs
    ])
  }

  async function testPublish() {
    try {
      addLog('📤 Publishing test message...')
      
      await pubsubService.publish({
        topic: 'radio/test/pubsub',
        message: {
          type: 'TEST',
          timestamp: new Date().toISOString(),
          count: publishCount + 1,
          from: 'IoTConnectionTest'
        }
      })
      
      setPublishCount(prev => prev + 1)
      addLog('✅ Publish successful!')
    } catch (error: any) {
      addLog(`❌ Publish failed: ${error.message}`)
      console.error('Publish error:', error)
    }
  }

  async function testSubscribe() {
    try {
      addLog('📡 Subscribing to radio/test/pubsub...')
      
      const subscription = await pubsubService.subscribe({
        topic: 'radio/test/pubsub'
      }, 
      (message: any) => {
        setReceivedCount(prev => prev + 1)
        addLog(`📥 Received message: ${JSON.stringify(message)}`)
      },
      (error: any) => {
        addLog(`❌ Subscribe error: ${error.message}`)
        console.error('Subscribe error:', error)
      })
      
      setIsSubscribed(true)
      addLog('✅ Subscribed successfully!')
      
      if (subscription) {
        // Store subscription for cleanup
        window.testSubscription = subscription
      }
    } catch (error: any) {
      addLog(`❌ Subscribe failed: ${error.message}`)
      console.error('Subscribe error:', error)
    }
  }

  async function testRadioPlayerState() {
    try {
      addLog('📤 Publishing to radio/player/test-001/state...')
      
      await pubsubService.publish({
        topic: 'radio/player/test-001/state',
        message: {
          playerId: 'test-001',
          state: 'PLAYING',
          previousState: 'LOADED',
          timestamp: new Date().toISOString(),
          metadata: {
            trackId: 'test-track-123',
            position: 45.5,
            duration: 180.0,
            volume: 0.7
          }
        }
      })
      
      addLog('✅ Radio player state published!')
    } catch (error: any) {
      addLog(`❌ Failed: ${error.message}`)
      console.error('Error:', error)
    }
  }

  async function testRadioPlayerCommand() {
    try {
      addLog('📤 Publishing command to radio/player/test-001/command...')
      
      await pubsubService.publish({
        topic: 'radio/player/test-001/command',
        message: {
          command: 'PLAY',
          timestamp: new Date().toISOString(),
          requestId: `req-${Date.now()}`
        }
      })
      
      addLog('✅ Radio player command published!')
    } catch (error: any) {
      addLog(`❌ Failed: ${error.message}`)
      console.error('Error:', error)
    }
  }

  function clearLogs() {
    setTestResults([])
    addLog('🧹 Logs cleared')
  }

  return (
    <Layout title="IoT Connection Test" showBackButton backTo="/devices">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🔌 IoT Connection Test</h1>
          <p className="text-gray-600 mt-2">Test AWS IoT Core PubSub connection and radio player topics</p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          
          <div className="flex items-center space-x-4">
            <div className={`w-4 h-4 rounded-full ${
              connectionState === 'Connected' ? 'bg-green-500' : 
              connectionState === 'Connecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`} />
            <span className="text-lg font-medium">{connectionState}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Published:</span>
              <span className="ml-2 font-semibold">{publishCount}</span>
            </div>
            <div>
              <span className="text-gray-600">Received:</span>
              <span className="ml-2 font-semibold">{receivedCount}</span>
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={testPublish}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📤 Publish Test Message
              </button>
              
              <button
                onClick={testSubscribe}
                disabled={isSubscribed}
                className={`px-4 py-2 rounded ${
                  isSubscribed 
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                📡 Subscribe to Test Topic
              </button>
            </div>

            <div className="border-t pt-3 mt-3">
              <p className="text-sm text-gray-600 mb-2">Radio Player Topics:</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={testRadioPlayerState}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  📊 Publish Player State
                </button>
                
                <button
                  onClick={testRadioPlayerCommand}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  🎛️ Publish Player Command
                </button>
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                🧹 Clear Logs
              </button>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          <div className="bg-gray-900 text-gray-100 rounded p-4 font-mono text-sm h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run a test to see results.</p>
            ) : (
              testResults.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Check if connection status shows "Connected" (green)</li>
            <li>Click "Subscribe to Test Topic" first</li>
            <li>Then click "Publish Test Message" - you should receive it</li>
            <li>Test radio player topics to verify they work</li>
            <li>Check browser console (F12) for detailed logs</li>
          </ol>
        </div>

        {/* Troubleshooting */}
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Troubleshooting:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
            <li><strong>ConnectionDisrupted:</strong> IoT policy not attached or incorrect</li>
            <li><strong>Publish fails:</strong> Check iot:Publish permission in backend.ts</li>
            <li><strong>Subscribe fails:</strong> Check iot:Subscribe permission</li>
            <li><strong>No messages received:</strong> Verify iot:Receive permission</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
