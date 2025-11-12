import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlayerCard from '../../components/PlayerCard'
import NotificationControl from '../../components/NotificationControl'
import { useTabTitle } from '../../hooks/useTabTitle'
import { useIoT } from '../../contexts/IoTContext'
import { useNotifications } from '../../hooks/useNotifications'

/**
 * Players Component - Multi-Player View
 * 
 * Displays multiple player cards in a 2-column grid layout
 * with a full-width playlist viewer below
 */
export default function Players() {
  useTabTitle('Players', '🎵')
  
  const iot = useIoT()
  
  // Enable notifications for this page
  useNotifications()
  
  // ============================================
  // 🎙️ STREAM STATUS (from IoT)
  // ============================================
  const [streamStatus, setStreamStatus] = useState<{
    isLive: boolean
    currentTrack: { artist: string; title: string } | null
    listeners: number
    playlist: {
      current: string | null
      queue: string[]
      total: number
    }
  } | null>(null)
  
  // ============================================
  // 🔄 STREAM STATUS FETCH FUNCTION
  // ============================================
  const fetchStreamStatus = async () => {
    console.log('🔄 Fetching stream status from Icecast...')
    
    try {
      const response = await fetch('http://46.137.184.91:8000/status-json.xsl', {
        mode: 'cors',
        cache: 'no-cache'
      })
      const data = await response.json()
      const source = data.icestats?.source
      
      if (source) {
        // Parse current track from metadata
        let currentTrack = null
        const metadata = source.title || source.yp_currently_playing || ''
        
        if (metadata && metadata !== 'Unknown') {
          const match = metadata.match(/^(.+?)\s*-\s*(.+)$/)
          if (match) {
            currentTrack = {
              artist: match[1].trim(),
              title: match[2].trim()
            }
          }
        }
        
        // Set status (preserve playlist data if already present from IoT)
        setStreamStatus(prev => ({
          isLive: true,
          currentTrack,
          listeners: source.listeners || 0,
          playlist: prev?.playlist || {
            current: null,
            queue: [],
            total: 0
          }
        }))
        
        console.log('✅ Stream status refreshed:', currentTrack?.artist, '-', currentTrack?.title)
      }
    } catch (error) {
      // CORS error is expected if Icecast doesn't send CORS headers
      // This is not critical - IoT notifications provide track info
      console.log('ℹ️ Stream status unavailable (CORS/network issue - this is OK)')
      console.log('💡 Track info will be available via IoT notifications')
    }
  }
  
  // ============================================
  // 🔄 INITIAL STREAM STATUS FETCH
  // ============================================
  useEffect(() => {
    fetchStreamStatus()
  }, [])
  
  // ============================================
  // 📡 IOT SUBSCRIPTION FOR STREAM STATUS
  // ============================================
  useEffect(() => {
    if (iot.connectionState !== 'Connected') {
      return
    }

    console.log('📡 Subscribing to stream status updates...')
    
    const unsubscribePromise = iot.subscribe('radio/stream/status', (message: any) => {
      console.log('📥 Stream status update via IoT:', message)
      setStreamStatus(message)
    })
    
    return () => {
      unsubscribePromise.then(unsub => unsub())
    }
  }, [iot.connectionState])
  
  // ============================================
  // 📡 IOT - PLAYERS NOW HANDLE THEIR OWN SUBSCRIPTIONS
  // ============================================
  // PlayerCard components now handle their own:
  // - Command subscriptions
  // - Status subscriptions
  // - Registration requests
  // This avoids duplicate subscriptions and keeps logic encapsulated
  
  const handleTrackEnded = async (playerId: string, trackId: string) => {
    console.log(`🏁 Track ended on ${playerId}:`, trackId)
  }
  
  return (
    <Layout title="Players" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Splash FM Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-orange-600 rounded-2xl shadow-2xl p-8 mb-6">
          <div className="flex flex-col items-center gap-4">
            <img 
              src="/logosplashfmfm.png" 
              alt="Splash FM" 
              className="h-24 md:h-32 w-auto drop-shadow-2xl"
            />
            <div className="text-center">
              <h1 className="text-white text-2xl md:text-3xl font-bold drop-shadow-lg">
                Splash FM Radio Players
              </h1>
              <p className="text-blue-100 text-sm md:text-base mt-2">
                🎵 Live 24/7 Electronic Music Stream
              </p>
            </div>
          </div>
        </div>

        {/* Players Grid - 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Player 1 */}
          <PlayerCard 
            playerId="player-001" 
            playerName="🎵 Player 1"
            onTrackEnded={handleTrackEnded}
          />
          
          {/* Player 2 */}
          <PlayerCard 
            playerId="player-002" 
            playerName="🎧 Player 2"
            onTrackEnded={handleTrackEnded}
          />
        </div>
        
        {/* Notification Control */}
        <div className="flex justify-end">
          <NotificationControl />
        </div>
        
        {/* Live Stream Status */}
        {streamStatus && (
          <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-orange-50 rounded-xl shadow-lg p-6 border-2 border-gradient-to-r from-cyan-400 to-orange-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  {streamStatus.isLive && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-orange-500 rounded-full animate-pulse border-2 border-white"></div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold bg-gradient-to-r from-cyan-600 to-orange-600 bg-clip-text text-transparent text-xl">Splash FM Live Stream</h3>
                    {streamStatus.isLive && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold rounded uppercase animate-pulse">LIVE</span>
                    )}
                  </div>
                  {streamStatus.currentTrack ? (
                    <p className="text-gray-700 font-medium">
                      <span className="text-gray-500">Now Playing:</span> {streamStatus.currentTrack.artist} - {streamStatus.currentTrack.title}
                    </p>
                  ) : (
                    <p className="text-gray-500 text-sm">No track playing</p>
                  )}
                  <p className="text-sm text-gray-600">
                    👥 {streamStatus.listeners} listener{streamStatus.listeners !== 1 ? 's' : ''} • 
                    📋 {streamStatus.playlist.total} tracks in queue
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchStreamStatus}
                  className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2 border border-gray-200"
                  title="Refresh stream status"
                >
                  <span>🔄</span>
                </button>
                <a
                  href="http://46.137.184.91/stream.mp3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-orange-500 hover:from-cyan-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2"
                >
                  <span>🎧</span>
                  <span>Listen</span>
                </a>
              </div>
            </div>
            
            {/* Queue Preview */}
            {streamStatus.playlist.queue.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gradient-to-r from-cyan-200 to-orange-200">
                <p className="text-xs font-semibold bg-gradient-to-r from-cyan-600 to-orange-600 bg-clip-text text-transparent mb-2">🎵 COMING UP:</p>
                <div className="space-y-1">
                  {streamStatus.playlist.queue.slice(0, 3).map((track, idx) => (
                    <p key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-gradient bg-gradient-to-r from-cyan-500 to-orange-500 bg-clip-text text-transparent font-bold">{idx + 1}.</span>
                      {track}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
