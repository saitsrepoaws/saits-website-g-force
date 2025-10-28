/**
 * MQTT Test Page
 * Tests MQTT.js connection to AWS IoT Core with Cognito auth
 */

import { useState, useEffect } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { getMQTTService, resetMQTTService } from '../services/mqttService'
import { attachIoTPolicyToCurrentUser } from '../services/iotPolicyAttacher'

const TEST_TOPIC = 'radio/player/player-main-001/command'

export default function MqttTest() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [messages, setMessages] = useState<Array<{ topic: string; message: any; time: Date }>>([])
  const [testMessage, setTestMessage] = useState('{"command":"LOAD","test":true}')
  const [subscribed, setSubscribed] = useState(false)
  const [identityId, setIdentityId] = useState<string>('')
  const [isAttachingPolicy, setIsAttachingPolicy] = useState(false)
  const [policyAttached, setPolicyAttached] = useState(false)

  useEffect(() => {
    // Get Identity ID on mount
    fetchAuthSession().then(session => {
      setIdentityId(session.identityId || '')
    }).catch(err => {
      console.error('Failed to get identity ID:', err)
    })

    const mqtt = getMQTTService()
    
    // Listen to connection state
    const unsubscribe = mqtt.onConnectionChange((connected) => {
      setStatus(connected ? 'connected' : 'disconnected')
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleAttachPolicy = async () => {
    setIsAttachingPolicy(true)
    try {
      const success = await attachIoTPolicyToCurrentUser()
      setPolicyAttached(success)
      if (success) {
        alert('✅ IoT Policy attached! Now try connecting to MQTT.')
      } else {
        alert('❌ Failed to attach IoT Policy. Check console for details.')
      }
    } catch (error) {
      alert(`❌ Error: ${error}`)
    } finally {
      setIsAttachingPolicy(false)
    }
  }

  const handleConnect = async () => {
    setStatus('connecting')
    const mqtt = getMQTTService()
    const success = await mqtt.connect()
    if (!success) {
      setStatus('disconnected')
      alert('Failed to connect to MQTT')
    }
  }

  const handleSubscribe = async () => {
    const mqtt = getMQTTService()
    if (!mqtt.isConnected()) {
      alert('Not connected! Click Connect first.')
      return
    }

    try {
      await mqtt.subscribe(TEST_TOPIC, (topic, message) => {
        console.log('📩 Received:', topic, message)
        setMessages(prev => [{
          topic,
          message,
          time: new Date()
        }, ...prev.slice(0, 9)]) // Keep last 10 messages
      })
      setSubscribed(true)
      console.log(`✅ Subscribed to ${TEST_TOPIC}`)
    } catch (error) {
      alert(`Failed to subscribe: ${error}`)
    }
  }

  const handlePublish = async () => {
    const mqtt = getMQTTService()
    if (!mqtt.isConnected()) {
      alert('Not connected!')
      return
    }

    try {
      const message = JSON.parse(testMessage)
      await mqtt.publish(TEST_TOPIC, message)
      console.log('✅ Published!')
    } catch (error) {
      alert(`Failed to publish: ${error}`)
    }
  }

  const handleReset = () => {
    resetMQTTService()
    setStatus('disconnected')
    setSubscribed(false)
    setMessages([])
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500 animate-pulse'
      case 'disconnected': return 'bg-red-500'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'disconnected': return 'Disconnected'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">🔌 MQTT.js Test</h1>
        
        {/* Identity ID Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">🆔 Your Cognito Identity ID:</h3>
              {identityId ? (
                <code className="text-sm bg-white px-3 py-2 rounded border border-blue-300 block font-mono break-all">
                  {identityId}
                </code>
              ) : (
                <p className="text-sm text-gray-500 italic">Loading...</p>
              )}
            </div>
            {identityId && (
              <button
                onClick={() => navigator.clipboard.writeText(identityId)}
                className="ml-4 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
              >
                📋 Copy
              </button>
            )}
          </div>
          
          {/* Attach Policy Button */}
          <div className="border-t border-blue-200 pt-3">
            <button
              onClick={handleAttachPolicy}
              disabled={isAttachingPolicy || !identityId}
              className={`w-full px-4 py-3 rounded font-semibold transition-colors ${
                policyAttached
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isAttachingPolicy ? (
                '⏳ Attaching IoT Policy...'
              ) : policyAttached ? (
                '✅ IoT Policy Attached!'
              ) : (
                '🔧 Attach IoT Policy (Required for MQTT)'
              )}
            </button>
            <p className="text-xs text-blue-700 mt-2">
              ⚠️ You MUST attach the IoT Policy before MQTT will work! Click the button above.
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-lg p-6 shadow mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${getStatusColor()}`} />
              <span className="text-lg font-semibold">{getStatusText()}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConnect}
                disabled={status !== 'disconnected'}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Topic: <code className="bg-gray-100 px-2 py-1 rounded">{TEST_TOPIC}</code>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Subscribe */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">📡 Subscribe</h2>
            <button
              onClick={handleSubscribe}
              disabled={status !== 'connected' || subscribed}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscribed ? '✅ Subscribed' : 'Subscribe to Topic'}
            </button>
          </div>

          {/* Publish */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">📤 Publish</h2>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full p-2 border rounded mb-2 font-mono text-sm"
              rows={3}
            />
            <button
              onClick={handlePublish}
              disabled={status !== 'connected'}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Publish Message
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-bold mb-4">📨 Received Messages ({messages.length})</h2>
          {messages.length === 0 ? (
            <p className="text-gray-500 italic">No messages yet. Subscribe and publish to test!</p>
          ) : (
            <div className="space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-500 font-mono">{msg.topic}</span>
                    <span className="text-xs text-gray-400">{msg.time.toLocaleTimeString()}</span>
                  </div>
                  <pre className="text-sm overflow-x-auto">{JSON.stringify(msg.message, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">📋 Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Click <strong>Connect</strong> - should turn green</li>
            <li>Click <strong>Subscribe to Topic</strong></li>
            <li>Click <strong>Publish Message</strong> - should receive own message</li>
            <li>Or use AWS CLI: <code className="bg-blue-100 px-1">aws iot-data publish --topic "{TEST_TOPIC}" ...</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
