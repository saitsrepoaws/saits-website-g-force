import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlayerCard from '../../components/PlayerCard'
import PlaylistViewer from '../../components/PlaylistViewer'
import NotificationControl from '../../components/NotificationControl'
import { useTabTitle } from '../../hooks/useTabTitle'
import { useIoT } from '../../contexts/IoTContext'
import { useNotifications } from '../../hooks/useNotifications'
import { loadScheduleAndDeterminePlaylist } from '../../services/scheduleService'
import { getPlaylist } from '../../services/playlists'
import { getTrack } from '../../services/tracks'
import type { ScheduleSlot } from '../../utils/scheduleCalculator'
import type { Playlist } from '../../types/playlist'

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
  // 📊 SCHEDULE & PLAYLIST STATE
  // ============================================
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)
  
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
  // 🎵 PLAYER TRACKING (for playlist highlighting)
  // ============================================
  const [player1TrackId, setPlayer1TrackId] = useState<string | null>(null)
  const [player2TrackId, setPlayer2TrackId] = useState<string | null>(null)
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set())
  const [isCrossFadeActive, setIsCrossFadeActive] = useState(false)
  
  // ============================================
  // 🔄 CROSS-FADE STATE
  // ============================================
  const [crossFadeState, setCrossFadeState] = useState<{
    currentPlayer: 1 | 2
    nextTrackIndex: number
    allTracks: any[]
  } | null>(null)
  
  // ============================================
  // 📅 SCHEDULE & PLAYLIST LOADING
  // ============================================
  useEffect(() => {
    const loadScheduleData = async () => {
      console.log('📅 Loading schedule and playlist...')
      setIsLoadingSchedule(true)
      
      try {
        const { activeSlot: slot, playlistId } = await loadScheduleAndDeterminePlaylist()
        
        if (slot) {
          console.log('✅ Active slot:', slot.name, slot.time)
          setActiveSlot(slot)
          
          if (playlistId) {
            console.log('📋 Loading playlist:', playlistId)
            const result = await getPlaylist(playlistId)
            if (result.data) {
              console.log('✅ Playlist loaded:', result.data.name)
              setActivePlaylist(result.data)
            } else {
              console.warn('⚠️ Playlist not found:', playlistId)
              setActivePlaylist(null)
            }
          } else {
            console.warn('⚠️ No playlist ID in active slot')
            setActivePlaylist(null)
          }
        } else {
          console.log('ℹ️ No active slot for current time')
          setActiveSlot(null)
          setActivePlaylist(null)
        }
      } catch (error) {
        console.error('❌ Failed to load schedule:', error)
        setActiveSlot(null)
        setActivePlaylist(null)
      } finally {
        setIsLoadingSchedule(false)
      }
    }

    loadScheduleData()
    
    // Reload every minute to check for schedule changes
    const interval = setInterval(loadScheduleData, 60000)
    return () => clearInterval(interval)
  }, [])
  
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
        if (player1TrackId) {
          setPlayedTrackIds(prev => new Set(prev).add(player1TrackId))
        }
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
        if (player2TrackId) {
          setPlayedTrackIds(prev => new Set(prev).add(player2TrackId))
        }
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
  
  // ============================================
  // 🎵 TRACK LOADING HANDLER
  // ============================================
  const handleTracksLoaded = (tracks: any[]) => {
    console.log('📋 Tracks loaded:', tracks.length)
    // Note: We don't auto-load anymore
    // The first track will be highlighted blue (current/next up)
    // When a track is actually loaded via IoT command, it will be highlighted purple
  }
  
  // ============================================
  // 🎛️ CROSS-FADE CONTROLLER
  // ============================================
  const handleStartCrossFade = async () => {
    if (!activePlaylist) {
      console.error('No active playlist')
      return
    }

    console.log('▶️ Starting cross-fade for playlist:', activePlaylist.id)
    setIsCrossFadeActive(true)

    try {
      // Publish START_CROSSFADE command to IoT topic
      await iot.publish('radio/crossfade/control', {
        command: 'START_CROSSFADE',
        playlistId: activePlaylist.id,
        timestamp: new Date().toISOString()
      })

      // Initialize cross-fade state
      // Lambda will load first 2 tracks (Player 1 starts playing, Player 2 preloaded)
      // We start from track index 2 (third track) as next
      const tracks = typeof activePlaylist.tracks === 'string' 
        ? JSON.parse(activePlaylist.tracks) 
        : (activePlaylist.tracks || [])
      
      setCrossFadeState({
        currentPlayer: 1, // Player 1 is playing
        nextTrackIndex: 2, // Next track to load (0=P1, 1=P2, 2=next)
        allTracks: tracks
      })

      console.log('✅ Cross-fade started!')
    } catch (error) {
      console.error('❌ Error starting cross-fade:', error)
      setIsCrossFadeActive(false)
    }
  }

  const handleStopCrossFade = async () => {
    console.log('⏹️ Stopping cross-fade')
    setIsCrossFadeActive(false)
    setCrossFadeState(null)

    try {
      await iot.publish('radio/crossfade/control', {
        command: 'STOP_CROSSFADE',
        timestamp: new Date().toISOString()
      })

      console.log('✅ Cross-fade stopped!')
    } catch (error) {
      console.error('❌ Error stopping cross-fade:', error)
    }
  }

  const handleTrackEnded = async (playerId: string, trackId: string) => {
    console.log(`🏁 Track ended on ${playerId}:`, trackId)
    
    if (!isCrossFadeActive || !crossFadeState) {
      console.log('⚠️ Cross-fade not active, ignoring track end')
      return
    }

    const { nextTrackIndex, allTracks } = crossFadeState
    
    // Determine which player just finished based on the actual playerId parameter
    const finishedPlayerNum = playerId === 'player-001' ? 1 : 2
    const nextPlayerNum = finishedPlayerNum === 1 ? 2 : 1
    const nextPlayerId = `player-00${nextPlayerNum}`
    const finishedPlayerId = playerId
    
    console.log(`🔄 Player ${finishedPlayerNum} finished → Starting Player ${nextPlayerNum}`)
    console.log(`📊 State: nextTrackIndex=${nextTrackIndex}, totalTracks=${allTracks.length}`)

    try {
      // 1. Start playing the OTHER player (which already has a track loaded)
      console.log(`▶️ Starting playback on Player ${nextPlayerNum}`)
      await iot.publish(`radio/player/${nextPlayerId}/command`, {
        command: 'PLAY',
        playerId: nextPlayerId,
        timestamp: new Date().toISOString()
      })
      
      // 2. Load next track in the player that just finished (if available)
      if (nextTrackIndex < allTracks.length) {
        const nextTrack = allTracks[nextTrackIndex]
        console.log(`📥 Preloading track ${nextTrackIndex + 1}/${allTracks.length} in Player ${finishedPlayerNum}: ${nextTrack.trackTitle || 'Unknown'}`)
        
        // Small delay to let the other player start
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Get full track data from DynamoDB
        const { data: trackData, errors } = await getTrack(nextTrack.trackId)
        
        if (errors || !trackData) {
          console.error('❌ Failed to load track data for:', nextTrack.trackId, errors)
          return
        }
        
        // Load track directly with full data (bypass state machine)
        await iot.publish(`radio/player/${finishedPlayerId}/command`, {
          command: 'LOAD',
          playerId: finishedPlayerId,
          timestamp: new Date().toISOString(),
          params: {
            track: {
              id: trackData.id,
              title: trackData.title,
              artist: trackData.artist,
              fileUrl: trackData.fileUrl,
              coverArtUrl: trackData.coverArtUrl,
              waveformUrl: trackData.waveformUrl,
              duration: trackData.trackDuration
            }
          }
        })
        
        // Update state
        setCrossFadeState({
          currentPlayer: nextPlayerNum, // Now the other player is playing
          nextTrackIndex: nextTrackIndex + 1, // Next track to load
          allTracks
        })
      } else {
        // No more tracks to load, but let the last track play
        console.log('📋 No more tracks to preload, last track playing on Player', nextPlayerNum)
        setCrossFadeState({
          currentPlayer: nextPlayerNum,
          nextTrackIndex: nextTrackIndex,
          allTracks
        })
      }

      console.log(`✅ Switched to Player ${nextPlayerNum}`)
    } catch (error) {
      console.error('❌ Error switching players:', error)
    }
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
        
        {/* Cross-Fade Controller */}
        {activePlaylist && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-lg p-6 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🎛️</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Cross-Fade Controller</h3>
                  <p className="text-sm text-gray-600">
                    {isCrossFadeActive ? (
                      <span className="text-green-600 font-medium">▶️ Active - Playing tracks alternately</span>
                    ) : (
                      <span className="text-gray-500">⏸️ Ready to start cross-fade playback</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                {!isCrossFadeActive ? (
                  <button
                    onClick={handleStartCrossFade}
                    disabled={isLoadingSchedule}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                  >
                    <span className="text-xl">▶️</span>
                    <span>Start Cross-Fade</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopCrossFade}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-red-600 hover:to-rose-700 transition-all duration-200 flex items-center gap-2"
                  >
                    <span className="text-xl">⏹️</span>
                    <span>Stop Cross-Fade</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
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
        
        {/* Playlist Viewer - Full Width */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg overflow-hidden border border-purple-200">
          {/* Playlist Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📻</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate leading-tight">
                  {isLoadingSchedule ? 'Loading...' : activePlaylist?.name || 'No Active Playlist'}
                </h3>
              </div>
            </div>
          </div>

          {/* Playlist Content */}
          {activePlaylist && (
            <PlaylistViewer
              playlistId={activePlaylist.id}
              maxHeight="500px"
              onTracksLoaded={handleTracksLoaded}
              player1TrackId={player1TrackId}
              player2TrackId={player2TrackId}
              playedTrackIds={playedTrackIds}
            />
          )}
        </div>
      </div>
    </Layout>
  )
}
