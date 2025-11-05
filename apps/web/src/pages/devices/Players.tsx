import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlayerCard from '../../components/PlayerCard'
import PlaylistViewer from '../../components/PlaylistViewer'
import { useTabTitle } from '../../hooks/useTabTitle'
import { useIoT } from '../../contexts/IoTContext'
import { loadScheduleAndDeterminePlaylist } from '../../services/scheduleService'
import { getPlaylist } from '../../services/playlists'
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
  
  return (
    <Layout title="Players" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Players Grid - 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Player 1 */}
          <PlayerCard 
            playerId="player-001" 
            playerName="🎵 Player 1"
          />
          
          {/* Player 2 */}
          <PlayerCard 
            playerId="player-002" 
            playerName="🎵 Player 2"
          />
        </div>
        
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
