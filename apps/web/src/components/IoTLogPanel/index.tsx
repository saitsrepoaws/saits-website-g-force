/**
 * IoT Log Panel Component
 * 
 * Compact sidebar panel showing IoT messages
 */

import type { IoTLogEntry } from '../../services/radioPlayerIoT'

interface IoTLogPanelProps {
  logs: IoTLogEntry[]
  onClearLogs: () => void
}

export default function IoTLogPanel({ logs, onClearLogs }: IoTLogPanelProps) {
  return (
    <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden sticky top-6 max-h-[calc(100vh-8rem)]">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">📡 IoT Log</h3>
            <p className="text-xs text-gray-400 mt-0.5">{logs.length} messages</p>
          </div>
          <button
            onClick={onClearLogs}
            className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            🧹
          </button>
        </div>
      </div>

      <div className="p-3 h-[calc(100vh-12rem)] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            No messages yet
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs border-l-2 ${
                  log.direction === 'OUT' 
                    ? 'bg-blue-900/20 border-blue-500' 
                    : 'bg-green-900/20 border-green-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    log.direction === 'OUT' 
                      ? 'text-blue-400 bg-blue-900/30' 
                      : 'text-green-400 bg-green-900/30'
                  }`}>
                    {log.direction === 'OUT' ? '📤' : '📥'}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 mb-1 truncate">
                  {log.topic}
                </div>
                <pre className="text-[10px] text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(log.message, null, 1)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
