import { useState } from 'react'

interface IoTTestPanelProps {
  playerId: string
  onPublish: (topic: string, message: any) => Promise<void>
  isConnected: boolean
}

export default function IoTTestPanel({ playerId, onPublish, isConnected }: IoTTestPanelProps) {
  const [testMessage, setTestMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Topic configuration
  const outgoingTopic = `radio/player/${playerId}/command-request`
  const incomingTopic = `radio/player/${playerId}/command`

  const sendTestMessage = async () => {
    if (!testMessage.trim()) {
      alert('Vul een test bericht in!')
      return
    }

    setIsSending(true)
    try {
      const payload = {
        command: 'TEST',
        playerId: playerId,
        timestamp: new Date().toISOString(),
        params: {
          message: testMessage,
          type: 'manual-test'
        }
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🧪 IOT TEST - OUTGOING')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📤 Topic:', outgoingTopic)
      console.log('📤 Message:', JSON.stringify(payload, null, 2))
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      await onPublish(outgoingTopic, payload)
      
      alert('✅ Test bericht verzonden!\nCheck IoT Log Window voor output.')
    } catch (error) {
      console.error('❌ Failed to send test:', error)
      alert('❌ Fout bij verzenden: ' + error)
    } finally {
      setIsSending(false)
    }
  }

  const sendTestLoadCommand = async () => {
    setIsSending(true)
    try {
      const payload = {
        command: 'LOAD',
        playerId: playerId,
        timestamp: new Date().toISOString()
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🧪 IOT TEST - LOAD COMMAND')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📤 Topic:', outgoingTopic)
      console.log('📤 Message:', JSON.stringify(payload, null, 2))
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('Verwacht response op:', incomingTopic)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      await onPublish(outgoingTopic, payload)
      
      alert('✅ LOAD command verzonden!\n\nBackend zal track bepalen en terugsturen naar:\n' + incomingTopic + '\n\nWacht 3-4 seconden...')
    } catch (error) {
      console.error('❌ Failed to send LOAD:', error)
      alert('❌ Fout bij verzenden: ' + error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">🧪</span>
        <div>
          <h3 className="text-lg font-bold text-gray-900">IoT Test Panel</h3>
          <p className="text-sm text-gray-600">Test berichten versturen & ontvangen</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`mb-4 px-4 py-2 rounded-lg ${isConnected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`text-sm font-semibold ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Topics Display */}
      <div className="space-y-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">📤</span>
            <div className="flex-1">
              <div className="text-xs font-bold text-blue-700 mb-1">OUTGOING TOPIC</div>
              <code className="text-xs text-blue-900 break-all">{outgoingTopic}</code>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">📥</span>
            <div className="flex-1">
              <div className="text-xs font-bold text-green-700 mb-1">INCOMING TOPIC (subscribed)</div>
              <code className="text-xs text-green-900 break-all">{incomingTopic}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Test Actions */}
      <div className="space-y-3">
        {/* Quick Test: LOAD Command */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-2">🎯 Quick Test: LOAD Command</h4>
          <p className="text-xs text-gray-600 mb-3">
            Stuurt LOAD command → Backend bepaalt track → Response komt terug
          </p>
          <button
            onClick={sendTestLoadCommand}
            disabled={!isConnected || isSending}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {isSending ? '⏳ Versturen...' : '🚀 Test LOAD Command'}
          </button>
        </div>

        {/* Custom Test Message */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-2">✏️ Custom Test Bericht</h4>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Type test bericht..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isSending && isConnected) {
                sendTestMessage()
              }
            }}
          />
          <button
            onClick={sendTestMessage}
            disabled={!isConnected || isSending || !testMessage.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {isSending ? '⏳ Versturen...' : '📤 Verstuur Custom Test'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="font-semibold text-gray-900 mb-2">📊 Hoe te gebruiken:</div>
          <div>1. Check "Connected" status ✅</div>
          <div>2. Click "Test LOAD Command" voor volledige test</div>
          <div>3. Check IoT Log Window rechts voor berichten</div>
          <div>4. Check browser console voor details</div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <span className="font-semibold">Verwachte flow:</span><br/>
            📤 Outgoing → Backend → 📥 Incoming (3-4 sec)
          </div>
        </div>
      </div>
    </div>
  )
}
