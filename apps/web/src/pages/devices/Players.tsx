import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlayerCard from '../../components/PlayerCard'
import PlaylistViewer from '../../components/PlaylistViewer'
import { useTabTitle } from '../../hooks/useTabTitle'
import { useIoT } from '../../contexts/IoTContext'
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
  
  // ============================================
  // 📊 SCHEDULE & PLAYLIST STATE
  // ============================================
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)
  
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
  // 📡 IOT SUBSCRIPTION FOR BOTH PLAYERS
  // ============================================
  useEffect(() => {
    if (iot.connectionState !== 'Connected') {
      return
    }

    console.log('📡 Subscribing to both player commands...')

    let unsubscribe1: (() => void) | undefined
    let unsubscribe2: (() => void) | undefined
    let isMounted = true

    // Subscribe to Player 1
    iot.subscribe('radio/player/player-001/command', (message: any) => {
      console.log('📥 [Player 1] Command:', message.command)
      
      if (message.command === 'LOAD' && message.params?.track?.id) {
        const trackId = message.params.track.id
        console.log('🎵 [Player 1] Track loaded:', trackId)
        setPlayer1TrackId(trackId)
      }
      
      if (message.command === 'UNLOAD') {
        console.log('🗑️ [Player 1] Track unloaded')
        // Mark as played before clearing
        if (player1TrackId) {
          setPlayedTrackIds(prev => new Set(prev).add(player1TrackId))
        }
        setPlayer1TrackId(null)
      }
    }).then((unsub) => {
      if (isMounted) {
        unsubscribe1 = unsub
        console.log('✅ Subscribed to Player 1')
      } else {
        unsub()
      }
    })

    // Subscribe to Player 2
    iot.subscribe('radio/player/player-002/command', (message: any) => {
      console.log('📥 [Player 2] Command:', message.command)
      
      if (message.command === 'LOAD' && message.params?.track?.id) {
        const trackId = message.params.track.id
        console.log('🎵 [Player 2] Track loaded:', trackId)
        setPlayer2TrackId(trackId)
      }
      
      if (message.command === 'UNLOAD') {
        console.log('🗑️ [Player 2] Track unloaded')
        // Mark as played before clearing
        if (player2TrackId) {
          setPlayedTrackIds(prev => new Set(prev).add(player2TrackId))
        }
        setPlayer2TrackId(null)
      }
    }).then((unsub) => {
      if (isMounted) {
        unsubscribe2 = unsub
        console.log('✅ Subscribed to Player 2')
      } else {
        unsub()
      }
    })

    return () => {
      isMounted = false
      if (unsubscribe1) unsubscribe1()
      if (unsubscribe2) unsubscribe2()
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
                {activeSlot && (
                  <p className="text-xs text-white/80 truncate">
                    {activeSlot.name} • {activeSlot.time}
                  </p>
                )}
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
