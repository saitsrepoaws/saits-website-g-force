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
  // 🎵 PLAYER TRACKING
  // ============================================
  const [player1TrackId, setPlayer1TrackId] = useState<string | null>(null)
  const [player2TrackId, setPlayer2TrackId] = useState<string | null>(null)
  
  // ============================================
  // 🔄 STREAM STATUS FETCH FUNCTION
  // ============================================
  const fetchStreamStatus = async () => {
    console.log('🔄 Fetching stream status from Icecast...')
    
    try {
      const response = await fetch('http://46.137.184.91:8000/status-json.xsl')
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
      console.warn('⚠️ Could not fetch stream status:', error)
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
  // 📡 IOT REGISTRATION & SUBSCRIPTION - PLAYERS
  // ============================================
  useEffect(() => {
    if (iot.connectionState !== 'Connected') {
      return
    }

    console.log('📡 Registering players and subscribing...')

    let unsubscribe1: (() => void) | undefined
    let unsubscribe2: (() => void) | undefined
    let unsubscribeStatus1: (() => void) | undefined
    let unsubscribeStatus2: (() => void) | undefined
    let isMounted = true

    // Subscribe to Player 1 commands
    iot.subscribe('radio/player/player-001/command', (message: any) => {
      console.log('📥 [Player 1] Command:', message.command)
      
      if (message.command === 'LOAD' && message.params?.track?.id) {
        const trackId = message.params.track.id
        console.log('🎵 [Player 1] Track loaded:', trackId)
        setPlayer1TrackId(trackId)
      }
      
      if (message.command === 'UNLOAD') {
        console.log('🗑️ [Player 1] Track unloaded')
        setPlayer1TrackId(null)
      }
    }).then((unsub) => {
      if (isMounted) {
        unsubscribe1 = unsub
        console.log('✅ Subscribed to Player 1 commands')
      } else {
        unsub()
      }
    })
    
    // Subscribe to Player 1 status responses
    iot.subscribe('radio/player/player-001/status', (message: any) => {
      console.log('📥 [Player 1] Status:', message)
      // Update player 1 state based on status
      if (message.currentTrack?.id) {
        setPlayer1TrackId(message.currentTrack.id)
      }
    }).then((unsub) => {
      if (isMounted) {
        unsubscribeStatus1 = unsub
        console.log('✅ Subscribed to Player 1 status')
        
        // Send registration request
        iot.publish('radio/player/player-001/register', {
          playerId: 'player-001',
          action: 'register',
          requestStatus: true,
          timestamp: new Date().toISOString()
        }).then(() => {
          console.log('✅ Player 1 registered')
        })
      } else {
        unsub()
      }
    })

    // Subscribe to Player 2 commands
    iot.subscribe('radio/player/player-002/command', (message: any) => {
      console.log('📥 [Player 2] Command:', message.command)
      
      if (message.command === 'LOAD' && message.params?.track?.id) {
        const trackId = message.params.track.id
        console.log('🎵 [Player 2] Track loaded:', trackId)
        setPlayer2TrackId(trackId)
      }
      
      if (message.command === 'UNLOAD') {
        console.log('🗑️ [Player 2] Track unloaded')
        setPlayer2TrackId(null)
      }
    }).then((unsub) => {
      if (isMounted) {
        unsubscribe2 = unsub
        console.log('✅ Subscribed to Player 2 commands')
      } else {
        unsub()
      }
    })
    
    // Subscribe to Player 2 status responses
    iot.subscribe('radio/player/player-002/status', (message: any) => {
      console.log('📥 [Player 2] Status:', message)
      // Update player 2 state based on status
      if (message.currentTrack?.id) {
        setPlayer2TrackId(message.currentTrack.id)
      }
    }).then((unsub) => {
      if (isMounted) {
        unsubscribeStatus2 = unsub
        console.log('✅ Subscribed to Player 2 status')
        
        // Send registration request
        iot.publish('radio/player/player-002/register', {
          playerId: 'player-002',
          action: 'register',
          requestStatus: true,
          timestamp: new Date().toISOString()
        }).then(() => {
          console.log('✅ Player 2 registered')
        })
      } else {
        unsub()
      }
    })

    return () => {
      isMounted = false
      if (unsubscribe1) unsubscribe1()
      if (unsubscribe2) unsubscribe2()
      if (unsubscribeStatus1) unsubscribeStatus1()
      if (unsubscribeStatus2) unsubscribeStatus2()
    }
  }, [iot.connectionState, player1TrackId, player2TrackId])
  
  const handleTrackEnded = async (playerId: string, trackId: string) => {
    console.log(`🏁 Track ended on ${playerId}:`, trackId)
  }
  
  return (
    <Layout title="Players" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto space-y-6">
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
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl shadow-lg p-4 border-2 border-red-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  {streamStatus.isLive && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-pulse border-2 border-white"></div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 text-xl">Live Stream</h3>
                    {streamStatus.isLive && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded uppercase animate-pulse">LIVE</span>
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
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2"
                  title="Refresh stream status"
                >
                  <span>🔄</span>
                </button>
                <a
                  href="http://46.137.184.91:8000/stream.mp3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2"
                >
                  <span>🎧</span>
                  <span>Listen</span>
                </a>
              </div>
            </div>
            
            {/* Queue Preview */}
            {streamStatus.playlist.queue.length > 0 && (
              <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">COMING UP:</p>
                <div className="space-y-1">
                  {streamStatus.playlist.queue.slice(0, 3).map((track, idx) => (
                    <p key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-gray-400">{idx + 1}.</span>
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
