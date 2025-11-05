import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import IoTLogWindow from '../../components/IoTLogWindow'
import PlaylistViewer from '../../components/PlaylistViewer'
import { useIoT } from '../../contexts/IoTContext'
import { ConnectionState } from '../../contexts/IoTContext'
import { loadScheduleAndDeterminePlaylist } from '../../services/scheduleService'
import { getPlaylist } from '../../services/playlists'
import { getTabId } from '../../services/pubsub'
import { useTabTitle } from '../../hooks/useTabTitle'
import { getAudioUrl, getCoverArtUrl, getWaveformUrl } from '../../utils/mediaUrl'
import type { ScheduleSlot } from '../../utils/scheduleCalculator'
import type { Playlist } from '../../types/playlist'

// Players page - IoT subscriptions setup
// Modulair gebouwd voor toekomstige uitbreidingen

export default function Players() {
  const [autoLoad, setAutoLoad] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [playerState, setPlayerState] = useState<any>({
    status: 'idle',
    autoLoad: false,
    track: null,
    volume: 100
  })
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [trackInfo, setTrackInfo] = useState<any>(null) // Separate state for track info
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)
  const iot = useIoT()
  
  const playerId = 'player-001' // TODO: Make dynamic later

  // Set browser tab title with Tab ID for easy identification
  useTabTitle('Player', '🎵')

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
  // Track subscription lifecycle across renders
  const [subscribedTopic, setSubscribedTopic] = useState<string | null>(null)
  let unsubCommandsRef: { current?: () => void } = (globalThis as any).__playersUnsubRef || { current: undefined }
  ;(globalThis as any).__playersUnsubRef = unsubCommandsRef

  // Effect: subscribe when connection is Connected and not yet subscribed
  useEffect(() => {
    const debugWildcard = (import.meta as any)?.env?.VITE_IOT_DEBUG_WILDCARD === 'true'
    const exactTopic = `radio/player/${playerId}/command`
    const commandsTopic = debugWildcard ? 'radio/player/+/command' : exactTopic

    const ensureSubscribed = async () => {
      console.log('🔍 Checking subscription...')
      console.log('   Connection state:', iot.connectionState)
      console.log('   Is connected:', iot.isConnected)
      console.log('   Current subscribed topic:', subscribedTopic)
      console.log('   Target topic:', commandsTopic)
      
      if (iot.connectionState !== ConnectionState.Connected) {
        console.log('⏳ Not connected yet, waiting...')
        return
      }
      
      if (subscribedTopic === commandsTopic && unsubCommandsRef.current) {
        console.log('✅ Already subscribed to correct topic')
        return
      }

      // Cleanup old subscription if topic changed
      if (unsubCommandsRef.current && subscribedTopic !== commandsTopic) {
        console.log('🧹 Cleaning up old subscription:', subscribedTopic)
        try { unsubCommandsRef.current() } catch {}
        unsubCommandsRef.current = undefined
        setSubscribedTopic(null)
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📡 SUBSCRIBING TO TOPIC')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('Topic:', commandsTopic)
      console.log('Wildcard:', debugWildcard)

      try {
        const unsub = await iot.subscribe(
          commandsTopic,
          (data: any) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('📥 INCOMING MESSAGE RECEIVED!')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('📥 INCOMING raw data:', data)
            let message
            try {
              if (typeof (data as any).value === 'string') {
                message = JSON.parse((data as any).value)
              } else {
                message = (data as any).value || data
              }
            } catch (err) {
              console.error('❌ Failed to parse incoming message:', err, data)
              return
            }
            console.log('📥 PARSED command:', message)
            if ((window as any).addIoTMessage) {
              ;(window as any).addIoTMessage({
                timestamp: Date.now(),
                direction: 'incoming',
                topic: commandsTopic,
                message,
                level: 'info'
              })
            }
            handleIncomingCommand(message)
          },
          (error) => {
            console.error('❌ Commands subscription error:', error)
          }
        )
        unsubCommandsRef.current = unsub
        setSubscribedTopic(commandsTopic)
        setIsSubscribed(true)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`✅ SUBSCRIBED SUCCESSFULLY`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('Topic:', commandsTopic)
        console.log('Wildcard debug:', debugWildcard ? 'ON' : 'OFF')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      } catch (error) {
        console.error('❌ Failed to setup subscriptions:', error)
        setIsSubscribed(false)
      }
    }

    ensureSubscribed()
  }, [iot.connectionState, iot.isConnected, playerId])

  // Effect: cleanup on unmount or when playerId changes
  useEffect(() => {
    return () => {
      if (unsubCommandsRef.current) {
        console.log('🧹 Player unmounting - cleaning up subscriptions')
        try { unsubCommandsRef.current() } catch {}
        unsubCommandsRef.current = undefined
      }
      setIsSubscribed(false)
      setSubscribedTopic(null)
    }
  }, [playerId])

  // ============================================
  // 📤 PUBLISH STATE HELPER
  // ============================================
  const publishState = async (state: any) => {
    const stateTopic = `radio/player/${playerId}/state`
    
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
      case 'UNLOAD':
        handleUnloadCommand(message)
        break
      default:
        console.warn(`⚠️ Unknown command: ${command}`)
    }
  }

  const handlePlayCommand = (message: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('▶️ PLAY COMMAND RECEIVED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Current playerState:', playerState)
    console.log('Has track?', !!playerState.track)
    console.log('coverArtUrl state:', coverArtUrl ? 'exists' : 'null')
    
    // Update player state to playing
    const newState = {
      ...playerState,
      status: 'playing'
    }
    console.log('New state:', newState)
    console.log('New state has track?', !!newState.track)
    setPlayerState(newState)
    
    // Start audio playback
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      console.log('🎵 Audio element found!')
      console.log('   Source:', audioElement.src)
      console.log('   Ready state:', audioElement.readyState)
      console.log('   Paused:', audioElement.paused)
      
      audioElement.play()
        .then(() => {
          console.log('✅ Audio playback started!')
          console.log('   Current time:', audioElement.currentTime)
          console.log('   Duration:', audioElement.duration)
        })
        .catch((error) => {
          console.error('❌ Failed to start audio playback:', error)
          console.error('   Error name:', error.name)
          console.error('   Error message:', error.message)
        })
    } else {
      console.error('⚠️ Audio element not found!')
      console.error('   audioUrl state:', audioUrl)
    }
    
    console.log('✅ Player status updated to: playing')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  const handlePauseCommand = (message: any) => {
    console.log('⏸️ PAUSE command received')
    // TODO: Implement pause logic
  }

  const handleStopCommand = (message: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⏹️ STOP COMMAND RECEIVED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Stop audio playback
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      console.log('✅ Audio stopped and reset')
    }
    
    // Update player state to stopped
    const newState = {
      ...playerState,
      status: 'stopped'
    }
    setPlayerState(newState)
    
    console.log('✅ Player status updated to: stopped')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  const handleUnloadCommand = (message: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🗑️ UNLOAD COMMAND RECEIVED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Clearing track from player...')
    
    // Stop audio if playing
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      console.log('🎵 Audio stopped and reset')
    }
    
    // Clear ALL track data
    setCoverArtUrl(null)
    setWaveformUrl(null)
    setAudioUrl(null)
    setTrackInfo(null)
    console.log('🗑️ All media URLs cleared')
    
    // Clear track from player state
    const clearedState = {
      ...playerState,
      status: 'idle',
      track: null,
      autoLoad: false
    }
    setPlayerState(clearedState)
    
    console.log('✅ Track cleared successfully')
    console.log('✅ Player is now empty')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  const handleLoadCommand = async (message: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💿 LOAD COMMAND RECEIVED FROM BACKEND')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Full message:', JSON.stringify(message, null, 2))
    
    if (!message.params || !message.params.track) {
      console.error('❌ No track data in LOAD command')
      return
    }

    const { track, playlist, schedule, currentTrack } = message.params
    
    console.log('✅ Track from backend:')
    console.log('   Title:', track.title)
    console.log('   Artist:', track.artist)
    console.log('')
    console.log('📁 Files (raw paths from State Machine):')
    console.log('   Audio:', track.fileUrl)
    console.log('   Cover:', track.coverArtUrl)
    console.log('   Waveform:', track.waveformUrl)
    console.log('')
    console.log('🔗 Getting presigned URLs...')
    
    // Get presigned URLs
    const [audioUrl, coverUrl, waveUrl] = await Promise.all([
      getAudioUrl(track.fileUrl),
      getCoverArtUrl(track.coverArtUrl),
      getWaveformUrl(track.waveformUrl)
    ])
    
    console.log('   Audio:', audioUrl.substring(0, 100) + '...')
    console.log('   Cover:', coverUrl.substring(0, 100) + '...')
    console.log('   Waveform:', waveUrl.substring(0, 100) + '...')
    console.log('')
    console.log('   Duration:', track.duration, 'sec')
    console.log('   Progress:', currentTrack?.percentComplete, '%')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Store URLs in state
    setCoverArtUrl(coverUrl)
    setWaveformUrl(waveUrl)
    setAudioUrl(audioUrl)

    // Store track info in separate state (won't be lost!)
    const trackData = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      fileUrl: track.fileUrl,
      coverArtUrl: track.coverArtUrl,
      waveformUrl: track.waveformUrl,
      duration: track.duration,
      bpm: track.bpm,
      key: track.key,
      genre: track.genre,
      year: track.year,
      label: track.label,
      energy: track.energy
    }
    setTrackInfo(trackData)

    // Update player state with loaded track
    const newState = {
      ...playerState,
      status: 'loaded',
      track: trackData,
      playlist: playlist,
      schedule: schedule,
      currentTrack: currentTrack
    }
    
    setPlayerState(newState)
    console.log('✅ Player state updated with track')
    console.log('✅ Track info stored separately')
  }

  // ============================================
  // 🎚️ UI HANDLERS
  // ============================================
  const handleStopButton = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⏹️ STOP BUTTON CLICKED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const commandTopic = `radio/player/${playerId}/command-request`
    const stopCommand = {
      command: 'STOP',
      playerId: playerId,
      timestamp: new Date().toISOString()
    }

    console.log('📍 Topic:', commandTopic)
    console.log('📦 Command:', JSON.stringify(stopCommand, null, 2))
    
    try {
      await iot.publish(commandTopic, stopCommand)
      
      console.log('✅ STOP command published successfully!')
      console.log('⏳ Waiting for State Machine to process...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } catch (error) {
      console.error('❌ FAILED to publish STOP command:', error)
    }
  }

  const handlePlayButton = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('▶️ PLAY BUTTON CLICKED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const commandTopic = `radio/player/${playerId}/command-request`
    const playCommand = {
      command: 'PLAY',
      playerId: playerId,
      timestamp: new Date().toISOString()
    }

    console.log('📍 Topic:', commandTopic)
    console.log('📦 Command:', JSON.stringify(playCommand, null, 2))
    
    try {
      await iot.publish(commandTopic, playCommand)
      
      console.log('✅ PLAY command published successfully!')
      console.log('⏳ Waiting for State Machine to process...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      // Log to IoT window
      if ((window as any).addIoTMessage) {
        (window as any).addIoTMessage({
          timestamp: Date.now(),
          direction: 'outgoing',
          topic: commandTopic,
          message: playCommand,
          level: 'command'
        })
      }
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌ FAILED to publish PLAY command')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('Error:', error)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }

  const handleAutoLoadToggle = async () => {
    const newValue = !autoLoad
    setAutoLoad(newValue)
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎚️ AUTO LOAD TOGGLE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('New value:', newValue ? '✅ ON' : '⭕ OFF')
    console.log('Player ID:', playerId)
    console.log('⚠️ STACK TRACE:', new Error().stack)

    if (newValue) {
      // Auto Load turned ON → Publish LOAD command to backend
      console.log('')
      console.log('📤 STEP 1: Publishing LOAD command to backend...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const commandTopic = `radio/player/${playerId}/command-request`
      const loadCommand = {
        command: 'LOAD',
        playerId: playerId,
        timestamp: new Date().toISOString()
      }

      console.log('📍 Topic:', commandTopic)
      console.log('📦 Command:', JSON.stringify(loadCommand, null, 2))
      
      try {
        await iot.publish(commandTopic, loadCommand)
        
        console.log('')
        console.log('✅ LOAD command published successfully!')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('⏳ STEP 2: Waiting for backend response...')
        console.log('   - Backend will read schedule')
        console.log('   - Backend will calculate current track')
        console.log('   - Backend will publish LOAD command back')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        // Log to IoT window
        if ((window as any).addIoTMessage) {
          (window as any).addIoTMessage({
            timestamp: Date.now(),
            direction: 'outgoing',
            topic: commandTopic,
            message: loadCommand,
            level: 'command'
          })
        }
      } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('❌ FAILED to publish LOAD command')
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('Error:', error)
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      }
    } else {
      // Auto Load turned OFF → Publish UNLOAD command
      console.log('')
      console.log('📤 UNLOAD: Auto Load turned OFF')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const commandTopic = `radio/player/${playerId}/command`
      const unloadCommand = {
        command: 'UNLOAD',
        playerId: playerId,
        timestamp: new Date().toISOString()
      }

      console.log('📍 Topic:', commandTopic)
      console.log('📦 Command:', JSON.stringify(unloadCommand, null, 2))
      
      try {
        await iot.publish(commandTopic, unloadCommand)
        
        console.log('✅ UNLOAD command published successfully!')
        console.log('🗑️ Track will be cleared from player')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        // Clear track from player state immediately
        const clearedState = {
          ...playerState,
          autoLoad: false,
          status: 'idle',
          track: null
        }
        setPlayerState(clearedState)
        
        // Log to IoT window
        if ((window as any).addIoTMessage) {
          (window as any).addIoTMessage({
            timestamp: Date.now(),
            direction: 'outgoing',
            topic: commandTopic,
            message: unloadCommand,
            level: 'command'
          })
        }
      } catch (error) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('❌ FAILED to publish UNLOAD command')
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('Error:', error)
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      }
    }

    // Only update state if turning ON (OFF already handled above with track cleared)
    if (newValue) {
      const newState = {
        ...playerState,
        autoLoad: true,
        status: 'loading'
      }
      setPlayerState(newState)
      
      // Publish state update
      await publishState(newState)
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  return (
    <Layout title="Player" showBackButton backTo="/devices">
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          id="player-audio"
          src={audioUrl}
          onPlay={() => console.log('🎵 Audio started playing')}
          onPause={() => console.log('⏸️ Audio paused')}
          onEnded={() => console.log('🏁 Audio ended')}
          onError={(e) => console.error('❌ Audio error:', e)}
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* Player Card - Left Column */}
        <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 p-6 lg:p-8 space-y-6">
          
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">🎵 Radio Player</h1>
            <p className="text-blue-200 text-sm">ID: {playerId}</p>
          </div>

          {/* Status LEDs */}
          <div className="flex items-center justify-center gap-6 pb-6 border-b border-white/10">
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

          {/* Cover Art Display - Large */}
          {coverArtUrl && (
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-gray-400 mb-3 font-mono uppercase">Now Playing:</div>
              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20">
                <img 
                  src={coverArtUrl} 
                  alt={playerState.track?.title ? `${playerState.track.title} cover art` : 'Cover art'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('❌ Failed to load cover art:', coverArtUrl)
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23374151" width="400" height="400"/%3E%3Ctext fill="%239CA3AF" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Cover Art%3C/text%3E%3C/svg%3E'
                  }}
                  onLoad={() => {
                    console.log('✅ Cover art loaded successfully!')
                    console.log('   URL:', coverArtUrl)
                  }}
                />
              </div>
              
              {/* Waveform Display */}
              {waveformUrl && (
                <div className="mt-4">
                  <div className="text-xs text-gray-400 mb-2 font-mono uppercase">Waveform:</div>
                  <div className="bg-black/50 rounded-lg p-3 border border-white/5">
                    <img 
                      src={waveformUrl} 
                      alt="Waveform"
                      className="w-full h-16 object-contain"
                      onError={(e) => {
                        console.error('❌ Failed to load waveform:', waveformUrl)
                        e.currentTarget.style.display = 'none'
                      }}
                      onLoad={() => {
                        console.log('✅ Waveform loaded successfully!')
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Control Buttons */}
          <div className="space-y-4">
            {/* Auto Load Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAutoLoadToggle()
              }}
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

            {/* Play Button - Only enabled when track is loaded */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePlayButton()
              }}
              disabled={!playerState.track || playerState.status === 'playing'}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                playerState.track && playerState.status !== 'playing'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50 cursor-pointer'
                  : 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span className="text-2xl">
                {playerState.status === 'playing' ? '⏸️' : '▶️'}
              </span>
              <span>
                {playerState.status === 'playing' ? 'Playing...' : 'Play Track'}
              </span>
              {!playerState.track && (
                <span className="ml-auto text-xs opacity-75">
                  Load track first
                </span>
              )}
            </button>

            {/* Stop Button - Only enabled when playing */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleStopButton()
              }}
              disabled={playerState.status !== 'playing'}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                playerState.status === 'playing'
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/50 cursor-pointer'
                  : 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span className="text-2xl">⏹️</span>
              <span>Stop</span>
            </button>
          </div>

          {/* Status Grid */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Status</div>
                <div className={`font-semibold capitalize ${
                  playerState.status === 'loading' ? 'text-yellow-400' :
                  playerState.status === 'playing' ? 'text-green-400' :
                  playerState.status === 'paused' ? 'text-orange-400' :
                  'text-white'
                }`}>
                  {playerState.status || 'idle'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Mode</div>
                <div className="text-white font-semibold">{autoLoad ? 'Auto' : 'Manual'}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Track</div>
                {(playerState.track || trackInfo) ? (
                  <div className="text-white text-sm">
                    <div className="font-semibold truncate" title={(playerState.track || trackInfo)?.title}>
                      {(playerState.track || trackInfo)?.title}
                    </div>
                    <div className="text-xs text-gray-400 truncate" title={(playerState.track || trackInfo)?.artist}>
                      {(playerState.track || trackInfo)?.artist}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No track loaded</div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Duration</div>
                <div className="text-white font-semibold text-sm">
                  {((playerState.track || trackInfo)?.duration) ? `${Math.floor((playerState.track || trackInfo).duration / 60)}:${String(Math.floor((playerState.track || trackInfo).duration % 60)).padStart(2, '0')}` : '--:--'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Volume</div>
                <div className="text-white font-semibold">{playerState.volume}%</div>
              </div>
            </div>

            {/* Extended Track Info - Only show when track is loaded */}
            {(playerState.track || trackInfo) && (() => {
              const track = playerState.track || trackInfo
              return (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Track Details</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {track.album && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Album:</span>
                        <span className="text-white ml-2">{track.album}</span>
                      </div>
                    )}
                    {track.genre && (
                      <div>
                        <span className="text-gray-400">Genre:</span>
                        <span className="text-white ml-2">{track.genre}</span>
                      </div>
                    )}
                    {track.year && (
                      <div>
                        <span className="text-gray-400">Year:</span>
                        <span className="text-white ml-2">{track.year}</span>
                      </div>
                    )}
                    {track.bpm && (
                      <div>
                        <span className="text-gray-400">BPM:</span>
                        <span className="text-white ml-2">{track.bpm}</span>
                      </div>
                    )}
                    {track.key && (
                      <div>
                        <span className="text-gray-400">Key:</span>
                        <span className="text-white ml-2">{track.key}</span>
                      </div>
                    )}
                    {track.energy !== undefined && (
                      <div>
                        <span className="text-gray-400">Energy:</span>
                        <span className="text-white ml-2">{Math.round(track.energy * 100)}%</span>
                      </div>
                    )}
                    {track.label && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Label:</span>
                        <span className="text-white ml-2">{track.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* IoT Diagnostics */}
          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-2 font-mono uppercase">IoT Diagnostics:</div>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Tab ID:</span>
                <span className="text-purple-400 truncate ml-2" title={getTabId()}>
                  {getTabId().substring(0, 20)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Subscribed Topic:</span>
                <span className="text-green-400 truncate ml-2" title={subscribedTopic || 'None'}>
                  {subscribedTopic || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Exact Topic:</span>
                <span className="text-blue-400">radio/player/{playerId}/command</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Wildcard Debug:</span>
                <span className="text-yellow-400">
                  {(import.meta as any)?.env?.VITE_IOT_DEBUG_WILDCARD === 'true' ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* IoT Info */}
          <div className="text-center text-xs text-gray-400 pt-4 border-t border-white/10">
            <p>IoT commands will control this player</p>
            <p className="mt-1">
              Configure on <a href="/devices/network" className="text-blue-400 hover:text-blue-300 underline">Network page</a>
            </p>
          </div>
        </div>

        {/* Right Side Column - IoT Log + Playlist */}
        <div className="space-y-6">
          {/* IoT Log Window - Top */}
          <div className="lg:sticky lg:top-6">
            <IoTLogWindow maxHeight="calc(50vh - 80px)" />
          </div>

          {/* Playlist View - Bottom */}
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
                  <p className="text-white/80 text-xs truncate leading-tight mt-0.5">
                    {activeSlot ? `${activeSlot.name} • ${activeSlot.time}` : 'No schedule slot active'}
                  </p>
                </div>
              </div>
            </div>

            {/* Playlist Content */}
            <div className="bg-white" style={{ maxHeight: 'calc(50vh - 120px)', overflowY: 'auto' }}>
              {isLoadingSchedule ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Loading schedule...</p>
                </div>
              ) : activePlaylist && activeSlot?.playlistId ? (
                <PlaylistViewer
                  playlistId={activeSlot.playlistId}
                  compact={true}
                  maxHeight="calc(50vh - 120px)"
                  showHeader={false}
                  showDragHandle={false}
                  allowReorder={false}
                  allowRemove={false}
                  allowPlay={false}
                  containerClassName="p-0"
                  scheduleSlot={{
                    time: activeSlot.time,
                    duration: activeSlot.duration || 0
                  }}
                />
              ) : (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-3 opacity-50">📭</div>
                  <p className="font-semibold text-gray-700 mb-1">No Playlist Scheduled</p>
                  <p className="text-xs text-gray-500">No active schedule slot for current time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
