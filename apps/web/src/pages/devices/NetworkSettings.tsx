import { useState } from 'react'
import Layout from '../../components/Layout'
import { useIoT } from '../../contexts/IoTContext'

interface NetworkConfig {
  iotEndpoint: string
  mqttClientId: string
  reconnectEnabled: boolean
  reconnectInterval: number
  keepAliveInterval: number
  connectionTimeout: number
}

function NetworkSettings() {
  const iot = useIoT()
  
  const [config, setConfig] = useState<NetworkConfig>({
    iotEndpoint: import.meta.env.VITE_IOT_ENDPOINT || 'Not configured',
    mqttClientId: `libery-${Math.random().toString(36).substring(7)}`,
    reconnectEnabled: true,
    reconnectInterval: 5000,
    keepAliveInterval: 30000,
    connectionTimeout: 10000,
  })
  
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  const connectionStateColors = {
    Connected: 'bg-green-500',
    Connecting: 'bg-yellow-500',
    Disconnected: 'bg-red-500',
    ConnectionDisrupted: 'bg-orange-500',
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestMessage('Testing connection...')
    
    try {
      // Simple publish test (no subscribe to avoid disconnect)
      await iot.publish('radio/system/health-check', {
        timestamp: new Date().toISOString(),
        message: 'Connection health check',
        source: 'NetworkSettings',
        connectionState: iot.connectionState
      })
      
      setTestStatus('success')
      setTestMessage('✅ Connection test successful! Message published to radio/system/health-check')
      
      setTimeout(() => {
        setTestStatus('idle')
        setTestMessage('')
      }, 5000)
    } catch (error: any) {
      setTestStatus('error')
      setTestMessage(`❌ Test failed: ${error.message}`)
      
      setTimeout(() => {
        setTestStatus('idle')
        setTestMessage('')
      }, 5000)
    }
  }

  const handleReconnect = async () => {
    try {
      await iot.reconnect()
    } catch (error: any) {
      console.error('Reconnect failed:', error)
    }
  }

  return (
    <Layout title="Network Settings" showBackButton backTo="/devices">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Connection Status Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🌐 IoT Connection Status
            </h2>
          </div>
          
          <div className="p-6 space-y-4">
            {/* Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Connection State */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Connection State</div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${connectionStateColors[iot.connectionState]} animate-pulse`} />
                  <span className="font-bold text-gray-900">{iot.connectionState}</span>
                </div>
              </div>
              
              {/* Uptime */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Connection Uptime</div>
                <div className="font-bold text-gray-900">
                  {iot.isConnected ? `${Math.floor(iot.connectionUptime / 60)}m ${iot.connectionUptime % 60}s` : 'N/A'}
                </div>
              </div>
              
              {/* Last Ping */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Last Activity</div>
                <div className="font-bold text-gray-900">
                  {iot.lastPingTime ? new Date(iot.lastPingTime).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleTestConnection}
                disabled={!iot.isConnected || testStatus === 'testing'}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
              >
                {testStatus === 'testing' ? '⏳ Testing...' : '🔍 Test Connection'}
              </button>
              
              <button
                onClick={handleReconnect}
                disabled={iot.connectionState === 'Connecting'}
                className={`px-6 py-2 text-white rounded-lg font-semibold transition-all ${
                  iot.isConnected 
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {iot.connectionState === 'Connecting' ? '⏳ Connecting...' : 
                 iot.isConnected ? '🔄 Reconnect' : '🔌 Connect'}
              </button>
              
              <button
                onClick={iot.clearLogs}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all"
              >
                🗑️ Clear Logs
              </button>
            </div>

            {/* Connection Help Message */}
            {!iot.isConnected && iot.connectionState === 'Disconnected' && !testMessage && (
              <div className="p-4 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                ℹ️ Click <strong>🔌 Connect</strong> to establish IoT connection
              </div>
            )}

            {/* Test Status Message */}
            {testMessage && (
              <div className={`p-4 rounded-lg ${
                testStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                testStatus === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                {testMessage}
              </div>
            )}
          </div>
        </div>

        {/* Network Configuration */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ⚙️ Network Configuration
            </h2>
          </div>
          
          <div className="p-6 space-y-4">
            {/* IoT Endpoint */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                IoT Endpoint
              </label>
              <input
                type="text"
                value={config.iotEndpoint}
                readOnly
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Configured in environment variables</p>
            </div>

            {/* MQTT Client ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                MQTT Client ID
              </label>
              <input
                type="text"
                value={config.mqttClientId}
                onChange={(e) => setConfig({ ...config, mqttClientId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier for this client</p>
            </div>

            {/* Advanced Settings */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-3">Advanced Settings</h3>
              
              <div className="space-y-3">
                {/* Reconnect Enabled */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.reconnectEnabled}
                    onChange={(e) => setConfig({ ...config, reconnectEnabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Auto Reconnect</div>
                    <div className="text-xs text-gray-500">Automatically reconnect on connection loss</div>
                  </div>
                </label>

                {/* Reconnect Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reconnect Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={config.reconnectInterval}
                    onChange={(e) => setConfig({ ...config, reconnectInterval: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1000"
                    max="60000"
                    step="1000"
                  />
                </div>

                {/* Keep Alive Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keep Alive Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={config.keepAliveInterval}
                    onChange={(e) => setConfig({ ...config, keepAliveInterval: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="10000"
                    max="120000"
                    step="5000"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Logs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📋 Connection Logs
              <span className="text-sm font-normal text-gray-300">
                ({iot.logs.length} entries)
              </span>
            </h2>
          </div>
          
          <div className="p-4 bg-gray-900 max-h-96 overflow-y-auto font-mono text-xs">
            {iot.logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No logs yet. Connection activity will appear here.
              </div>
            ) : (
              <div className="space-y-1">
                {iot.logs.slice().reverse().map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400' :
                      log.level === 'info' ? 'text-blue-400' :
                      'text-gray-400'
                    }`}
                  >
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-gray-600">[{log.level.toUpperCase()}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Documentation */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-2">📚 Documentation</h3>
          <p className="text-sm text-blue-800 mb-3">
            IoT connection is managed centrally via <code className="bg-blue-100 px-2 py-1 rounded">IoTContext</code>.
          </p>
          <div className="text-xs text-blue-700 space-y-1">
            <div>• <strong>Auto-connect:</strong> Connection is established automatically on app load</div>
            <div>• <strong>Single connection:</strong> All components share the same WebSocket connection</div>
            <div>• <strong>Reconnection:</strong> Automatic retry on connection loss</div>
            <div>• <strong>Topics:</strong> Use <code className="bg-blue-100 px-1 rounded">radio/*</code> for player communication</div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default NetworkSettings
