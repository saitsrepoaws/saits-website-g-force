import { useState, useEffect } from 'react'
import { getLogs, clearLogs } from '../../services/pubsub'
import type { LogEntry } from '../../services/pubsub'

interface IoTMessage {
  timestamp: number
  direction: 'incoming' | 'outgoing'
  topic: string
  message: any
  level?: 'info' | 'warn' | 'error'
}

interface IoTLogWindowProps {
  className?: string
  maxHeight?: string
}

export default function IoTLogWindow({ className = '', maxHeight = '600px' }: IoTLogWindowProps) {
  const [pubsubLogs, setPubsubLogs] = useState<LogEntry[]>([])
  const [iotMessages, setIotMessages] = useState<IoTMessage[]>([])
  const [activeTab, setActiveTab] = useState<'pubsub' | 'messages'>('messages')

  // Poll logs every second
  useEffect(() => {
    const updateLogs = () => {
      const logs = getLogs()
      setPubsubLogs(logs)
    }

    updateLogs()
    const interval = setInterval(updateLogs, 1000)
    return () => clearInterval(interval)
  }, [])

  // Function to add IoT message (will be called from parent/hooks)
  const addMessage = (message: IoTMessage) => {
    setIotMessages(prev => [message, ...prev].slice(0, 50)) // Keep last 50
  }

  // Expose addMessage via window for easy access
  useEffect(() => {
    (window as any).addIoTMessage = addMessage
    return () => {
      delete (window as any).addIoTMessage
    }
  }, [])

  const handleClearLogs = () => {
    if (activeTab === 'pubsub') {
      clearLogs()
      setPubsubLogs([])
    } else {
      setIotMessages([])
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    })
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📡</span>
            <h3 className="text-lg font-bold text-white">IoT Messages</h3>
          </div>
          <button
            onClick={handleClearLogs}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm font-semibold transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'messages'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Messages ({iotMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('pubsub')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'pubsub'
                ? 'bg-white text-blue-600 shadow-lg'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            PubSub Logs ({pubsubLogs.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        className="overflow-y-auto p-4 space-y-2 bg-gray-50"
        style={{ maxHeight }}
      >
        {activeTab === 'messages' ? (
          // IoT Messages Tab
          iotMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <div className="font-semibold">No IoT messages yet</div>
              <div className="text-sm mt-1">Messages will appear here when they arrive</div>
            </div>
          ) : (
            iotMessages.map((msg, idx) => (
              <div
                key={`${msg.timestamp}-${idx}`}
                className={`rounded-lg p-3 border-l-4 ${
                  msg.direction === 'incoming'
                    ? 'bg-green-50 border-green-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {msg.direction === 'incoming' ? '📥' : '📤'}
                    </span>
                    <span className={`font-bold ${
                      msg.direction === 'incoming' ? 'text-green-700' : 'text-blue-700'
                    }`}>
                      {msg.direction === 'incoming' ? 'INCOMING' : 'OUTGOING'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Topic */}
                <div className="mb-2">
                  <span className="text-xs text-gray-600 font-semibold">Topic:</span>
                  <div className="font-mono text-sm text-gray-800 bg-white px-2 py-1 rounded mt-1">
                    {msg.topic}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <span className="text-xs text-gray-600 font-semibold">Message:</span>
                  <pre className="font-mono text-xs text-gray-800 bg-white px-2 py-1 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(msg.message, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )
        ) : (
          // PubSub Logs Tab
          pubsubLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📄</div>
              <div className="font-semibold">No logs yet</div>
              <div className="text-sm mt-1">Connection logs will appear here</div>
            </div>
          ) : (
            pubsubLogs.map((log, idx) => (
              <div
                key={`${log.timestamp}-${idx}`}
                className={`rounded-lg p-3 border-l-4 ${
                  log.level === 'error'
                    ? 'bg-red-50 border-red-500'
                    : log.level === 'warn'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-lg shrink-0">
                      {log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️'}
                    </span>
                    <span className="text-sm text-gray-800 flex-1">
                      {log.message}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-100 px-4 py-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              📥 Incoming: <strong className="text-green-600">
                {iotMessages.filter(m => m.direction === 'incoming').length}
              </strong>
            </span>
            <span>
              📤 Outgoing: <strong className="text-blue-600">
                {iotMessages.filter(m => m.direction === 'outgoing').length}
              </strong>
            </span>
          </div>
          <span className="text-gray-500">
            Total: {activeTab === 'messages' ? iotMessages.length : pubsubLogs.length}
          </span>
        </div>
      </div>
    </div>
  )
}
