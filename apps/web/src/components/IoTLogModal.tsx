import { useState } from 'react'
import type { IoTLogEntry } from '../services/radioPlayerIoT'

interface IoTLogModalProps {
  isOpen: boolean
  onClose: () => void
  logs: IoTLogEntry[]
  playerId: string
  onClearLogs?: () => void
}

export default function IoTLogModal({
  isOpen,
  onClose,
  logs,
  playerId,
  onClearLogs
}: IoTLogModalProps) {
  const [autoScroll, setAutoScroll] = useState(true)

  if (!isOpen) return null

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  function formatMessage(message: any): string {
    if (typeof message === 'string') return message
    try {
      return JSON.stringify(message, null, 2)
    } catch {
      return String(message)
    }
  }

  function getDirectionColor(direction: 'OUT' | 'IN'): string {
    return direction === 'OUT' 
      ? 'text-blue-400 bg-blue-900/30' 
      : 'text-green-400 bg-green-900/30'
  }

  function getDirectionIcon(direction: 'OUT' | 'IN'): string {
    return direction === 'OUT' ? '📤' : '📥'
  }

  function getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'state': 'bg-purple-600',
      'command': 'bg-orange-600',
      'track': 'bg-blue-600',
      'heartbeat': 'bg-pink-600',
      'status': 'bg-green-600',
      'schedule': 'bg-yellow-600'
    }
    return colors[type] || 'bg-gray-600'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                📡 IoT Message Log
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Player: <span className="font-mono font-medium">{playerId}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Controls */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{logs.length}</span> messages
              </div>
              <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-scroll</span>
              </label>
            </div>
            <button
              onClick={onClearLogs}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              🧹 Clear Logs
            </button>
          </div>

          {/* Log Content */}
          <div className="flex-1 overflow-y-auto bg-gray-900 p-4">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No messages yet. Start using the player to see IoT messages.
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-l-4 ${
                      log.direction === 'OUT' 
                        ? 'bg-blue-900/20 border-blue-500' 
                        : 'bg-green-900/20 border-green-500'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getDirectionColor(log.direction)}`}>
                          {getDirectionIcon(log.direction)} {log.direction}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${getTypeColor(log.type)}`}>
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Topic */}
                    <div className="text-xs text-gray-400 mb-2">
                      📍 {log.topic}
                    </div>

                    {/* Message */}
                    <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                      {formatMessage(log.message)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="flex space-x-2 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Outgoing</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">Incoming</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
