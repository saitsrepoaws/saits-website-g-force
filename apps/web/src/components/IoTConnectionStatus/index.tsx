/**
 * IoTConnectionStatus - Shows current IoT connection status
 * 
 * Can be used anywhere in the app to display connection health
 */

import { useIoT } from '../../contexts/IoTContext'

interface IoTConnectionStatusProps {
  showDetails?: boolean
  className?: string
}

export default function IoTConnectionStatus({ 
  showDetails = false,
  className = '' 
}: IoTConnectionStatusProps) {
  const { isConnected, connectionState, lastPingTime, connectionUptime } = useIoT()

  // Format uptime
  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  // Time since last ping
  const timeSinceLastPing = lastPingTime 
    ? Math.floor((Date.now() - lastPingTime) / 1000)
    : null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          isConnected 
            ? 'bg-green-500 animate-pulse' 
            : 'bg-red-500'
        }`} />
        <span className={`text-sm font-medium ${
          isConnected ? 'text-green-600' : 'text-red-600'
        }`}>
          {isConnected ? 'Connected' : connectionState}
        </span>
      </div>

      {/* Details */}
      {showDetails && isConnected && (
        <div className="text-xs text-gray-500 flex items-center gap-3">
          <span>Uptime: {formatUptime(connectionUptime)}</span>
          {timeSinceLastPing !== null && timeSinceLastPing < 15 && (
            <span className="flex items-center gap-1">
              💚 <span>{timeSinceLastPing}s ago</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
