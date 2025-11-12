/**
 * Radio Dashboard Component - Live Stream Statistics
 * 
 * Shows:
 * - Now Playing (with cover art)
 * - Listener count (real-time)
 * - Stream health status
 * - 24h analytics
 * - Upcoming tracks (buffer)
 */
import { useState, useEffect } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'

const client = generateClient<Schema>()

interface StreamStats {
  isLive: boolean
  currentTrack: {
    artist: string
    title: string
    coverArt: string | null
    duration: number
    elapsed: number
  } | null
  listenerCount: number
  bitrate: number
  uptime: string
  nextTracks: Array<{
    artist: string
    title: string
  }>
}

interface HealthLog {
  timestamp: string
  icecastUp: boolean
  streamFlowing: boolean
  listenerCount: number
  bitrate: number | null
}

export default function RadioDashboard() {
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch stream stats from Icecast
  const fetchStreamStats = async () => {
    try {
      const response = await fetch('http://46.137.184.91/status-json.xsl')
      const data = await response.json()
      
      const source = data.icestats?.source
      
      if (source) {
        setStats({
          isLive: true,
          currentTrack: {
            artist: source.title?.split(' - ')[0] || 'Unknown',
            title: source.title?.split(' - ')[1] || source.title || 'Unknown',
            coverArt: null, // TODO: Link to Track table
            duration: 180, // TODO: Get from metadata
            elapsed: 0
          },
          listenerCount: source.listeners || 0,
          bitrate: source.bitrate || 192,
          uptime: source.stream_start_iso8601 || '',
          nextTracks: [] // TODO: Get from M3U or playlist
        })
      } else {
        setStats(prev => prev ? { ...prev, isLive: false } : null)
      }
    } catch (err) {
      console.error('Failed to fetch stream stats:', err)
      setStats(prev => prev ? { ...prev, isLive: false } : null)
    }
  }

  // Fetch health logs from DynamoDB
  const fetchHealthLogs = async () => {
    try {
      const { data: logs } = await client.models.StreamHealthLog.list({
        limit: 60, // Last 60 checks = 1 hour
        sortDirection: 'DESC'
      })
      
      if (logs) {
        setHealthLogs(logs.map(log => ({
          timestamp: log.timestamp,
          icecastUp: log.icecastUp,
          streamFlowing: log.streamFlowing,
          listenerCount: log.listenerCount,
          bitrate: log.bitrate
        })))
      }
    } catch (err) {
      console.error('Failed to fetch health logs:', err)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchStreamStats()
    fetchHealthLogs()
    setLoading(false)

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchStreamStats()
    }, 10000)

    // Refresh health logs every minute
    const healthInterval = setInterval(() => {
      fetchHealthLogs()
    }, 60000)

    return () => {
      clearInterval(interval)
      clearInterval(healthInterval)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const uptimeMinutes = stats?.uptime 
    ? Math.floor((Date.now() - new Date(stats.uptime).getTime()) / 60000)
    : 0

  // Calculate 24h listener average from health logs
  const avgListeners = healthLogs.length > 0
    ? Math.round(healthLogs.reduce((sum, log) => sum + log.listenerCount, 0) / healthLogs.length)
    : 0

  const peakListeners = healthLogs.length > 0
    ? Math.max(...healthLogs.map(log => log.listenerCount))
    : 0

  const streamHealth = healthLogs.length > 0
    ? Math.round((healthLogs.filter(log => log.streamFlowing).length / healthLogs.length) * 100)
    : 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📻 Stream Dashboard</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${stats?.isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-medium">{stats?.isLive ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Now Playing */}
        <div className="bg-white rounded-lg shadow p-6 col-span-2">
          <h3 className="text-sm font-medium text-gray-500 mb-3">🎵 Now Playing</h3>
          {stats?.currentTrack ? (
            <div className="flex gap-4">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-3xl">
                🎵
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold">{stats.currentTrack.title}</h4>
                <p className="text-gray-600">{stats.currentTrack.artist}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <span className="text-xs text-gray-500">2:15</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No track playing</p>
          )}
        </div>

        {/* Listeners */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">👥 Listeners</h3>
          <div className="text-4xl font-bold">{stats?.listenerCount || 0}</div>
          <p className="text-sm text-gray-500 mt-1">
            Avg: {avgListeners} | Peak: {peakListeners}
          </p>
        </div>

        {/* Stream Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">⚡ Health</h3>
          <div className="text-4xl font-bold">{streamHealth}%</div>
          <p className="text-sm text-gray-500 mt-1">
            Uptime: {uptimeMinutes}m
          </p>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 24h Listener Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Last Hour</h3>
          <div className="h-48 flex items-end justify-between gap-1">
            {healthLogs.slice(0, 30).reverse().map((log, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                style={{ 
                  height: `${Math.max((log.listenerCount / (peakListeners || 1)) * 100, 5)}%`,
                  opacity: 0.7 + (i / 30) * 0.3
                }}
                title={`${log.listenerCount} listeners at ${new Date(log.timestamp).toLocaleTimeString()}`}
              ></div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>60 min ago</span>
            <span>Now</span>
          </div>
        </div>

        {/* Stream Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">⚙️ Stream Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Bitrate</span>
              <span className="font-semibold">{stats?.bitrate || 0} kbps</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Format</span>
              <span className="font-semibold">MP3 Stereo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Icecast</span>
              <span className={`px-2 py-1 rounded text-sm ${stats?.isLive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {stats?.isLive ? '✓ Online' : '✗ Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Liquidsoap</span>
              <span className="px-2 py-1 rounded text-sm bg-green-100 text-green-800">
                ✓ Running
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📝 Recent Activity</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {healthLogs.slice(0, 10).map((log, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
              <span className="text-gray-600">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${log.streamFlowing ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>{log.listenerCount} listeners</span>
                {log.bitrate && <span className="text-gray-500">• {log.bitrate} kbps</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stream URL */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-blue-900">Stream URL</h4>
            <code className="text-sm text-blue-700">http://46.137.184.91:8000/stream.mp3</code>
          </div>
          <button 
            onClick={() => navigator.clipboard.writeText('http://46.137.184.91:8000/stream.mp3')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
