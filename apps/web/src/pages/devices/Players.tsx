import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import IoTLogWindow from '../../components/IoTLogWindow'
import PlaylistViewer from '../../components/PlaylistViewer'
import { useIoT } from '../../contexts/IoTContext'
import { loadScheduleAndDeterminePlaylist } from '../../services/scheduleService'
import { getPlaylist } from '../../services/playlists'
import type { ScheduleSlot } from '../../utils/scheduleCalculator'
import type { Playlist } from '../../types/playlist'

// Players page - IoT subscriptions setup
// Modulair gebouwd voor toekomstige uitbreidingen

export default function Players() {
  const [autoLoad, setAutoLoad] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [playerState, setPlayerState] = useState({
    status: 'idle',
    autoLoad: false,
    track: null,
    volume: 100
  })
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)
  const iot = useIoT()
  
  const playerId = 'player-001' // TODO: Make dynamic later

  // ============================================
  // 📅 LOAD SCHEDULE & PLAYLIST
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
          
          // Load playlist data if playlistId exists
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
  // 📡 IOT SUBSCRIPTIONS
  // ============================================
  useEffect(() => {
    if (!iot.isConnected) {
      console.log('⏳ IoT not connected yet, skipping subscriptions')
      return
    }

    console.log('🎵 Player starting - setting up IoT subscriptions...')

    let unsubCommands: (() => void) | undefined

    // Subscribe to incoming commands (async)
    const commandsTopic = `radio/players/${playerId}/commands`
    
    const setupSubscriptions = async () => {
      try {
        unsubCommands = await iot.subscribe(
          commandsTopic,
          (message) => {
            console.log('📥 INCOMING command:', message)
            
            // Log to IoT window
            if ((window as any).addIoTMessage) {
              (window as any).addIoTMessage({
                timestamp: Date.now(),
                direction: 'incoming',
                topic: commandsTopic,
                message: message,
                level: 'info'
              })
            }

            // Handle command
            handleIncomingCommand(message)
          },
          (error) => {
            console.error('❌ Commands subscription error:', error)
          }
        )

        console.log(`✅ Subscribed to: ${commandsTopic}`)
        setIsSubscribed(true)
      } catch (error) {
        console.error('❌ Failed to setup subscriptions:', error)
        setIsSubscribed(false)
      }
    }

    setupSubscriptions()

    // Cleanup subscriptions on unmount
    return () => {
      console.log('🧹 Player unmounting - cleaning up subscriptions')
      setIsSubscribed(false)
      if (unsubCommands) {
        unsubCommands()
      }
    }
  }, [iot.isConnected, playerId])

  // ============================================
  // 📤 PUBLISH STATE HELPER
  // ============================================
  const publishState = async (state: any) => {
    const stateTopic = `radio/players/${playerId}/state`
    
    try {
      await iot.publish(stateTopic, {
        ...state,
        timestamp: new Date().toISOString()
      })

      console.log('📤 OUTGOING state:', state)

      // Log to IoT window
      if ((window as any).addIoTMessage) {
        (window as any).addIoTMessage({
          timestamp: Date.now(),
          direction: 'outgoing',
          topic: stateTopic,
          message: state,
          level: 'info'
        })
      }
    } catch (error) {
      console.error('❌ Failed to publish state:', error)
    }
  }

  // ============================================
  // 🎮 COMMAND HANDLERS
  // ============================================
  const handleIncomingCommand = (message: any) => {
    const { command } = message

    console.log(`🎯 Processing command: ${command}`)

    switch (command) {
      case 'PLAY':
        handlePlayCommand(message)
        break
      case 'PAUSE':
        handlePauseCommand(message)
        break
      case 'STOP':
        handleStopCommand(message)
        break
      case 'LOAD':
        handleLoadCommand(message)
        break
      default:
        console.warn(`⚠️ Unknown command: ${command}`)
    }
  }

  const handlePlayCommand = (message: any) => {
    console.log('▶️ PLAY command received')
    // TODO: Implement play logic
  }

  const handlePauseCommand = (message: any) => {
    console.log('⏸️ PAUSE command received')
    // TODO: Implement pause logic
  }

  const handleStopCommand = (message: any) => {
    console.log('⏹️ STOP command received')
    // TODO: Implement stop logic
  }

  const handleLoadCommand = (message: any) => {
    console.log('💿 LOAD command received:', message.trackId)
    // TODO: Implement load track logic
  }

  // ============================================
  // 🎚️ UI HANDLERS
  // ============================================
  const handleAutoLoadToggle = async () => {
    const newValue = !autoLoad
    setAutoLoad(newValue)
    console.log('Auto Load:', newValue ? 'ON' : 'OFF')

    // Update player state
    const newState = {
      ...playerState,
      autoLoad: newValue,
      status: 'idle'
    }
    setPlayerState(newState)

    // Publish state update
    await publishState(newState)
  }

  return (
    <Layout title="Player" showBackButton backTo="/devices">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* Placeholder Player Card */}
        <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 p-8">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-white mb-2">🎵 Radio Player</h1>
            <p className="text-blue-200">ID: {playerId}</p>
          </div>

          {/* Status LEDs */}
          <div className="flex items-center justify-center gap-6 mb-6 pb-6 border-b border-white/10">
            {/* IoT Connection LED */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${iot.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-white font-medium">
                IoT {iot.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Subscription LED */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm text-white font-medium">
                {isSubscribed ? 'Subscribed' : 'Not Subscribed'}
              </span>
            </div>
          </div>

          {/* Player State Display */}
          <div className="mb-6 bg-black/30 rounded-lg p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-2 font-mono">PLAYER STATE:</div>
            <pre className="text-xs text-green-400 font-mono overflow-x-auto">
              {JSON.stringify(playerState, null, 2)}
            </pre>
          </div>

          {/* Auto Load Toggle */}
          <div className="mb-6">
            <button
              onClick={handleAutoLoadToggle}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                autoLoad
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/50'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300 border-2 border-white/20'
              }`}
            >
              <span className="text-2xl">{autoLoad ? '✅' : '⭕'}</span>
              <span>Auto Load</span>
              <span className="ml-auto text-sm opacity-75">
                {autoLoad ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Placeholder content */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🔌</div>
            <h2 className="text-2xl font-bold text-white mb-3">No Functionality Yet</h2>
            <p className="text-gray-300 mb-6">
              This player will be rebuilt step by step with IoT commands
            </p>
            
            <div className="grid grid-cols-2 gap-4 mt-8 text-left max-w-md mx-auto">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className="text-white font-semibold">Idle</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Mode</div>
                <div className="text-white font-semibold">{autoLoad ? 'Auto' : 'Manual'}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Track</div>
                <div className="text-white font-semibold">None</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Volume</div>
                <div className="text-white font-semibold">100%</div>
              </div>
            </div>
          </div>

          {/* Future IoT controls placeholder */}
          <div className="mt-6 text-center text-sm text-gray-400">
            <p>IoT commands will control this player</p>
            <p className="mt-1">Configure IoT on the <a href="/devices/network" className="text-blue-400 hover:text-blue-300 underline">Network page</a></p>
          </div>
        </div>

        {/* Right Side Column - IoT Log + Playlist */}
        <div className="space-y-6">
          {/* IoT Log Window - Top Half */}
          <div className="lg:sticky lg:top-6">
            <IoTLogWindow maxHeight="calc(50vh - 80px)" />
          </div>

          {/* Playlist View - Bottom Half */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg overflow-hidden border border-purple-200">
            {/* Playlist Header */}
            <div className="p-4 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📻</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">
                      {isLoadingSchedule ? 'Loading...' : activePlaylist?.name || 'No Active Playlist'}
                    </h3>
                    <p className="text-white/80 text-xs">
                      {activeSlot ? `${activeSlot.name} • ${activeSlot.time}` : 'No schedule slot active'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Playlist Content */}
            <div className="bg-white" style={{ maxHeight: 'calc(50vh - 140px)', overflowY: 'auto' }}>
              {isLoadingSchedule ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                  <p>Loading schedule...</p>
                </div>
              ) : activePlaylist && activeSlot?.playlistId ? (
                <PlaylistViewer
                  playlistId={activeSlot.playlistId}
                  compact={true}
                  maxHeight="calc(50vh - 140px)"
                  showHeader={false}
                  showDragHandle={false}
                  allowReorder={false}
                  allowRemove={false}
                  allowPlay={false}
                  containerClassName="p-0"
                />
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="font-semibold">No playlist scheduled</p>
                  <p className="text-sm mt-1">No active schedule slot for current time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
