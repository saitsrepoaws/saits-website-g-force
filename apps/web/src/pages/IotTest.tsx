import { useEffect, useState } from 'react'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import { useAuthenticator } from '@aws-amplify/ui-react'
import { isEnabled as pubsubEnabled, autoConnect, testConnect, publish, subscribe, getLogs, clearLogs, resetPubSub, type LogEntry } from '../services/pubsub'
import { attachIoTPolicyToCurrentUser } from '../services/iotPolicyAttacher'

const INPUT_TOPIC = 'radio/player/test-001/input'
const OUTPUT_TOPIC = 'radio/player/test-001/output'

function App() {
  const [email, setEmail] = useState<string>('')
  const [identityId, setIdentityId] = useState<string>('')
  const { signOut } = useAuthenticator()
  const [iotStatus, setIotStatus] = useState<'idle'|'connecting'|'connected'|'error'>(pubsubEnabled() ? 'idle' : 'error')
  const [isAttachingPolicy, setIsAttachingPolicy] = useState(false)
  const [policyAttached, setPolicyAttached] = useState(false)
  
  // Input panel state (send messages to INPUT_TOPIC)
  const [inputMessage, setInputMessage] = useState<string>('')
  
  // Output panel state (receive messages from OUTPUT_TOPIC)
  const [outputMessages, setOutputMessages] = useState<Array<{ timestamp: number; data: unknown }>>([])
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  
  // Debug log state
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([])
  const [showDebug, setShowDebug] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const user = await getCurrentUser()
        // username is often the email when loginWith.email=true
        if (mounted) setEmail(user?.username ?? '')
      } catch {}
      try {
        const session = await fetchAuthSession()
        if (mounted) setIdentityId(session.identityId ?? '')
      } catch {}
      
      // Auto-connect to IoT after auth is ready
      if (pubsubEnabled() && mounted) {
        setIotStatus('connecting')
        const ok = await autoConnect() // Auto-connect with keepalive
        if (mounted) setIotStatus(ok ? 'connected' : 'error')
      }
    })()
    return () => { mounted = false }
  }, [])

  // Poll debug logs every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      setDebugLogs(getLogs())
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Subscribe to OUTPUT_TOPIC when user clicks subscribe
  useEffect(() => {
    if (!isSubscribed) return
    
    let mounted = true
    let sub: Awaited<ReturnType<typeof subscribe>> = null
    
    ;(async () => {
      const subscription = await subscribe(
        { topic: OUTPUT_TOPIC },
        (data) => {
          if (mounted) {
            console.log('[OUTPUT] Raw data received:', data)
            // Extract the actual message from PubSub data structure
            const message = (data as any)?.value || data
            setOutputMessages((prev) => [...prev, { timestamp: Date.now(), data: message }])
          }
        },
        (err) => {
          console.error('[OUTPUT] subscribe error:', err)
        }
      )
      if (mounted) {
        sub = subscription
      } else {
        // If unmounted before subscribe completed, clean up immediately
        subscription?.unsubscribe()
      }
    })()
    
    return () => {
      mounted = false
      sub?.unsubscribe()
    }
  }, [isSubscribed])

  const handleAttachPolicy = async () => {
    setIsAttachingPolicy(true)
    try {
      const success = await attachIoTPolicyToCurrentUser()
      setPolicyAttached(success)
      if (success) {
        alert('✅ IoT Policy attached! Now retry the connection.')
        // Auto-retry connection with radio/player/* topic
        setIotStatus('connecting')
        resetPubSub()
        const ok = await testConnect('radio/player/connection-test')
        setIotStatus(ok ? 'connected' : 'error')
      } else {
        alert('❌ Failed to attach IoT Policy. Check console for details.')
      }
    } catch (error) {
      alert(`❌ Error: ${error}`)
    } finally {
      setIsAttachingPolicy(false)
    }
  }

  const handleSendInput = async () => {
    if (!inputMessage.trim()) return
    try {
      await publish({ topic: INPUT_TOPIC, message: { text: inputMessage, timestamp: Date.now() } })
      setInputMessage('')
    } catch (err) {
      console.error('[INPUT] publish error:', err)
    }
  }

  return (
    <div className="min-h-screen w-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 h-10 w-full bg-white border-b border-gray-200 relative">
        <div className="absolute right-4 inset-y-0 flex items-center gap-4 text-xs text-gray-800">
          {pubsubEnabled() && (
            <div className="flex items-center gap-2">
              <span className={
                iotStatus === 'connected' ? 'inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5' :
                iotStatus === 'connecting' ? 'inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5' :
                'inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5'
              }>
                IoT: {iotStatus}
              </span>
              <button
                disabled={isAttachingPolicy}
                onClick={handleAttachPolicy}
                className={`rounded border px-2 py-1 text-[11px] hover:opacity-80 disabled:opacity-60 ${
                  policyAttached 
                    ? 'bg-green-100 border-green-300 text-green-800' 
                    : 'bg-orange-100 border-orange-300 text-orange-800'
                }`}
                title="Attach IoT Policy to enable MQTT connection"
              >
                {isAttachingPolicy ? '⏳ Attaching...' : policyAttached ? '✅ Policy OK' : '🔧 Attach Policy'}
              </button>
              <button
                disabled={iotStatus === 'connecting'}
                onClick={async () => {
                  setIotStatus('connecting')
                  resetPubSub()
                  const ok = await testConnect('radio/player/connection-test')
                  setIotStatus(ok ? 'connected' : 'error')
                }}
                className="rounded border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50 disabled:opacity-60"
                title="Connect to AWS IoT"
              >
                {iotStatus === 'connecting' ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          )}
          <span title="Login e-mail">{email || 'Loading…'}</span>
          <span className="font-mono" title="Cognito identityId">{identityId || 'Loading…'}</span>
          <button
            onClick={() => signOut()}
            className="ml-2 rounded bg-gray-900 px-2 py-1 text-white text-[11px] hover:bg-gray-700"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="w-full p-6 text-sm">
        {/* Debug log window */}
        {showDebug && (
          <div className="max-w-7xl mx-auto mb-6 border border-yellow-400 rounded-lg p-4 bg-yellow-50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">
                🔍 Connection Debug Log
                <span className="ml-2 text-xs text-gray-600">({debugLogs.length} entries)</span>
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    resetPubSub()
                    setIotStatus('idle')
                  }}
                  className="px-2 py-1 bg-orange-200 text-orange-800 rounded hover:bg-orange-300 text-xs font-medium"
                >
                  Reset Connection
                </button>
                <button
                  onClick={() => clearLogs()}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowDebug(false)}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="h-40 overflow-y-auto bg-white border border-gray-300 rounded p-2 font-mono text-xs space-y-1">
              {debugLogs.length === 0 ? (
                <p className="text-gray-500 italic">No logs yet...</p>
              ) : (
                debugLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`${
                      log.level === 'error' ? 'text-red-700' :
                      log.level === 'warn' ? 'text-amber-700' :
                      'text-gray-700'
                    }`}
                  >
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {' '}
                    <span className="font-semibold">[{log.level.toUpperCase()}]</span>
                    {' '}
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {!showDebug && (
          <div className="max-w-7xl mx-auto mb-4">
            <button
              onClick={() => setShowDebug(true)}
              className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 text-xs font-medium"
            >
              Show Debug Log
            </button>
          </div>
        )}
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input panel - send messages to gforce/libery/input */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <h2 className="text-base font-semibold mb-3 text-gray-900">
              Send to IoT
              <span className="ml-2 text-xs font-mono text-gray-600">{INPUT_TOPIC}</span>
            </h2>
            <div className="space-y-3">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!pubsubEnabled()}
              />
              <button
                onClick={handleSendInput}
                disabled={!pubsubEnabled() || !inputMessage.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Send Message
              </button>
            </div>
          </div>

          {/* Output panel - receive messages from gforce/libery/output */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">
                Receive from IoT
                <span className="ml-2 text-xs font-mono text-gray-600">{OUTPUT_TOPIC}</span>
              </h2>
              <button
                onClick={() => setIsSubscribed(!isSubscribed)}
                disabled={!pubsubEnabled()}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  isSubscribed
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              </button>
            </div>
            <div className="h-64 overflow-y-auto bg-white border border-gray-300 rounded p-3 space-y-2">
              {outputMessages.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  {isSubscribed ? 'Waiting for messages...' : 'Click Subscribe to start receiving messages'}
                </p>
              ) : (
                outputMessages.map((msg, idx) => {
                  let displayData: string
                  try {
                    // Try to parse if it's a string
                    if (typeof msg.data === 'string') {
                      try {
                        const parsed = JSON.parse(msg.data)
                        displayData = JSON.stringify(parsed, null, 2)
                      } catch {
                        displayData = msg.data
                      }
                    } else if (msg.data instanceof ArrayBuffer || msg.data instanceof Uint8Array) {
                      // Handle binary data
                      const decoder = new TextDecoder()
                      const text = decoder.decode(msg.data)
                      try {
                        const parsed = JSON.parse(text)
                        displayData = JSON.stringify(parsed, null, 2)
                      } catch {
                        displayData = text
                      }
                    } else {
                      displayData = JSON.stringify(msg.data, null, 2)
                    }
                  } catch (err) {
                    displayData = `Error displaying message: ${err}`
                  }
                  
                  return (
                    <div key={idx} className="text-xs border-b border-gray-200 pb-2 last:border-0">
                      <div className="font-mono text-gray-500 text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                      <pre className="mt-1 text-gray-900 whitespace-pre-wrap break-words text-[11px]">
                        {displayData}
                      </pre>
                    </div>
                  )
                })
              )}
            </div>
            {outputMessages.length > 0 && (
              <button
                onClick={() => setOutputMessages([])}
                className="mt-2 w-full px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
              >
                Clear Messages
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
