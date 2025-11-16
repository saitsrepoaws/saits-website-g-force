import { useState, useEffect } from 'react'
import { useIoT } from '../contexts/IoTContext'
import { getAudioUrl, getCoverArtUrl, getWaveformUrl } from '../utils/mediaUrl'

interface PlayerCardProps {
  playerId: string
  playerName: string
  onTrackEnded?: (playerId: string, trackId: string) => void
}

/**
 * PlayerCard Component
 * 
 * Reusable player card that can be used for multiple players
 * Each card manages its own state and IoT subscription
 */
export default function PlayerCard({ playerId, playerName, onTrackEnded }: PlayerCardProps) {
  const iot = useIoT()
  
  // ============================================
  // 📊 LOCAL STATE
  // ============================================
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [showIoTStatus, setShowIoTStatus] = useState(false)
  
  // Track info for UI display
  const [trackInfo, setTrackInfo] = useState<any>(null)
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Player status for UI
  const [playerStatus, setPlayerStatus] = useState<'idle' | 'loading' | 'loaded' | 'playing' | 'paused' | 'stopped'>('idle')
  
  // Progress tracking
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  // ============================================
  // 📡 IOT SUBSCRIPTION
  // ============================================
  useEffect(() => {
    if (iot.connectionState !== 'Connected') {
      console.log(`⏸️ [${playerId}] IoT not connected, skipping subscription`)
      return
    }

    const commandTopic = `radio/player/${playerId}/command`
    const statusTopic = `radio/player/${playerId}/status`
    
    console.log(`📡 [${playerId}] Subscribing to command and status topics...`)

    let unsubscribeCommand: (() => void) | undefined
    let unsubscribeStatus: (() => void) | undefined
    let isMounted = true

    // Subscribe to commands
    iot.subscribe(commandTopic, (message: any) => {
      console.log(`📥 [${playerId}] COMMAND:`, message)
      handleIncomingCommand(message)
    }).then((unsub) => {
      if (!isMounted) {
        unsub()
        return
      }
      unsubscribeCommand = unsub
      console.log(`✅ [${playerId}] Subscribed to commands`)
    }).catch((error) => {
      console.error(`❌ [${playerId}] Failed to subscribe to commands:`, error)
    })

    // Subscribe to status updates
    iot.subscribe(statusTopic, (message: any) => {
      console.log(`📊 [${playerId}] STATUS UPDATE:`, message)
      handleStatusUpdate(message)
    }).then((unsub) => {
      if (!isMounted) {
        unsub()
        return
      }
      unsubscribeStatus = unsub
      setIsSubscribed(true)
      console.log(`✅ [${playerId}] Subscribed to status`)
      
      // Request current status
      iot.publish(`radio/player/${playerId}/register`, {
        playerId,
        action: 'register',
        requestStatus: true,
        timestamp: new Date().toISOString()
      }).then(() => {
        console.log(`📤 [${playerId}] Sent registration & status request`)
      })
    }).catch((error) => {
      console.error(`❌ [${playerId}] Failed to subscribe to status:`, error)
    })

    return () => {
      console.log(`🧹 [${playerId}] Cleaning up subscriptions...`)
      isMounted = false
      if (unsubscribeCommand) unsubscribeCommand()
      if (unsubscribeStatus) unsubscribeStatus()
      setIsSubscribed(false)
    }
  }, [iot.connectionState, playerId])
  
  // ============================================
  // 🎮 COMMAND HANDLERS
  // ============================================
  const handleIncomingCommand = async (message: any) => {
    const { command } = message

    console.log(`🎯 [${playerId}] Processing command: ${command}`)

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
        await handleLoadCommand(message)
        break
      case 'UNLOAD':
        handleUnloadCommand(message)
        break
      default:
        console.warn(`⚠️ [${playerId}] Unknown command: ${command}`)
    }
  }

  // Handle status updates from backend
  const handleStatusUpdate = async (message: any) => {
    console.log(`📊 [${playerId}] Processing status update...`)
    
    // Update player status
    if (message.status) {
      const statusMap: Record<string, typeof playerStatus> = {
        'idle': 'idle',
        'loading': 'loading',
        'loaded': 'loaded',
        'playing': 'playing',
        'paused': 'paused',
        'stopped': 'stopped'
      }
      const mappedStatus = statusMap[message.status] || 'idle'
      setPlayerStatus(mappedStatus)
      console.log(`🎚️ [${playerId}] Status: ${message.status}`)
    }
    
    // Update current track info
    if (message.currentTrack) {
      const track = message.currentTrack
      console.log(`🎵 [${playerId}] Current track:`, track.artist, '-', track.title)
      
      try {
        const [audioUrlResolved, coverUrl, waveUrl] = await Promise.all([
          getAudioUrl(track.fileUrl || ''),
          getCoverArtUrl(track.coverArtUrl || ''),
          getWaveformUrl(track.waveformUrl || '')
        ])
        
        setCoverArtUrl(coverUrl)
        setWaveformUrl(waveUrl)
        setAudioUrl(audioUrlResolved)
        
        setTrackInfo({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          bpm: track.bpm,
          key: track.key,
          genre: track.genre,
          year: track.year,
          label: track.label,
          energy: track.energy
        })
        
        console.log(`✅ [${playerId}] Track info updated from status`)
      } catch (error) {
        console.error(`❌ [${playerId}] Failed to process track URLs:`, error)
      }
    }
    
    // Update playback position
    if (message.position !== undefined) {
      setCurrentTime(message.position)
    }
    if (message.duration !== undefined) {
      setDuration(message.duration)
    }
  }

  const handlePlayCommand = (_message: any) => {
    console.log(`▶️ [${playerId}] PLAY COMMAND RECEIVED`)
    
    if (!audioUrl) {
      console.error(`❌ [${playerId}] Cannot play - no track loaded!`)
      return
    }
    
    setPlayerStatus('playing')
    
    const audioElement = document.getElementById(`player-audio-${playerId}`) as HTMLAudioElement
    if (audioElement) {
      console.log(`🎵 [${playerId}] Starting audio playback for:`, trackInfo?.title || 'Unknown')
      audioElement.play()
        .then(() => console.log(`✅ [${playerId}] Audio playback started!`))
        .catch((error) => console.error(`❌ [${playerId}] Failed to start audio:`, error))
    } else {
      console.error(`❌ [${playerId}] Audio element not found!`)
    }
  }

  const handlePauseCommand = (_message: any) => {
    console.log(`⏸️ [${playerId}] PAUSE COMMAND RECEIVED`)
    setPlayerStatus('paused')
    
    const audioElement = document.getElementById(`player-audio-${playerId}`) as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
    }
  }

  const handleStopCommand = (_message: any) => {
    console.log(`⏹️ [${playerId}] STOP COMMAND RECEIVED`)
    
    const audioElement = document.getElementById(`player-audio-${playerId}`) as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    
    setPlayerStatus('stopped')
  }

  const handleLoadCommand = async (message: any) => {
    console.log(`💿 [${playerId}] LOAD COMMAND RECEIVED`)
    
    if (!message.params || !message.params.track) {
      console.error(`❌ [${playerId}] No track data in LOAD command`)
      return
    }

    const { track } = message.params
    
    console.log(`✅ [${playerId}] Track:`, track.title, 'by', track.artist)
    
    setPlayerStatus('loading')
    
    try {
      const [audioUrlResolved, coverUrl, waveUrl] = await Promise.all([
        getAudioUrl(track.fileUrl),
        getCoverArtUrl(track.coverArtUrl),
        getWaveformUrl(track.waveformUrl)
      ])
      
      setCoverArtUrl(coverUrl)
      setWaveformUrl(waveUrl)
      setAudioUrl(audioUrlResolved)
      
      setTrackInfo({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        bpm: track.bpm,
        key: track.key,
        genre: track.genre,
        year: track.year,
        label: track.label,
        energy: track.energy
      })
      
      setPlayerStatus('loaded')
      console.log(`✅ [${playerId}] Track loaded successfully`)
    } catch (error) {
      console.error(`❌ [${playerId}] Failed to load track:`, error)
      setPlayerStatus('idle')
    }
  }

  const handleUnloadCommand = (_message: any) => {
    console.log(`🗑️ [${playerId}] UNLOAD COMMAND RECEIVED`)
    
    const audioElement = document.getElementById(`player-audio-${playerId}`) as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    
    setCoverArtUrl(null)
    setWaveformUrl(null)
    setAudioUrl(null)
    setTrackInfo(null)
    setPlayerStatus('idle')
    
    console.log(`✅ [${playerId}] Track cleared successfully`)
  }
  
  // ============================================
  // 🎚️ UI HANDLERS
  // ============================================
  const handleStopButton = async () => {
    const commandTopic = `radio/player/${playerId}/command-request`
    const stopCommand = {
      command: 'STOP',
      playerId: playerId,
      timestamp: new Date().toISOString()
    }

    try {
      await iot.publish(commandTopic, stopCommand)
      console.log(`✅ [${playerId}] STOP command published`)
    } catch (error) {
      console.error(`❌ [${playerId}] Failed to publish STOP:`, error)
    }
  }

  const handlePlayButton = async () => {
    const commandTopic = `radio/player/${playerId}/command-request`
    const playCommand = {
      command: 'PLAY',
      playerId: playerId,
      timestamp: new Date().toISOString()
    }

    try {
      await iot.publish(commandTopic, playCommand)
      console.log(`✅ [${playerId}] PLAY command published`)
    } catch (error) {
      console.error(`❌ [${playerId}] Failed to publish PLAY:`, error)
    }
  }

  
  // ============================================
  // 🎨 RENDER
  // ============================================
  return (
    <>
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          id={`player-audio-${playerId}`}
          src={audioUrl}
          onPlay={() => {
            console.log(`🎵 [${playerId}] Audio started playing`)
            setPlayerStatus('playing')
          }}
          onPause={() => {
            console.log(`⏸️ [${playerId}] Audio paused`)
            setPlayerStatus('paused')
          }}
          onEnded={() => {
            console.log(`🏁 [${playerId}] Audio ended`)
            setPlayerStatus('stopped')
            setCurrentTime(0)
            
            // Notify parent component if callback provided
            if (onTrackEnded && trackInfo?.id) {
              console.log(`📢 [${playerId}] Notifying parent: track ${trackInfo.id} ended`)
              onTrackEnded(playerId, trackInfo.id)
            }
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget
            setCurrentTime(audio.currentTime)
            setDuration(audio.duration)
          }}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget
            setDuration(audio.duration)
          }}
          onError={(e) => console.error(`❌ [${playerId}] Audio error:`, e)}
        />
      )}
      
      {/* Player Card */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-800 to-orange-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 p-6 space-y-4">
        
        {/* Splash FM Logo Header */}
        <div className="flex flex-col items-center gap-3 pb-4 border-b border-white/10">
          <img 
            src="/logosplashfmfm.png" 
            alt="Splash FM" 
            className="h-16 w-auto drop-shadow-2xl"
          />
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-1">{playerName}</h2>
            <p className="text-blue-200 text-xs">ID: {playerId}</p>
          </div>
        </div>

        {/* IoT Status Toggle */}
        <div className="flex items-center justify-center mb-2">
          <button
            onClick={() => setShowIoTStatus(!showIoTStatus)}
            className="px-3 py-1 text-xs text-white/60 hover:text-white/90 transition-colors"
            title={showIoTStatus ? 'Hide IoT status' : 'Show IoT status'}
          >
            {showIoTStatus ? '▼ Hide Debug' : '▶ Show Debug'}
          </button>
        </div>

        {/* Connection Status (Collapsible) */}
        {showIoTStatus && (
          <div className="flex items-center justify-center gap-4 text-xs mb-4 animate-fadeIn">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${iot.connectionState === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white font-medium">
                {iot.connectionState === 'Connected' ? 'IoT' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white font-medium">
                {isSubscribed ? 'Sub' : 'No Sub'}
              </span>
            </div>
          </div>
        )}

        {/* Cover Art Display */}
        {coverArtUrl && (
          <div className="bg-black/30 rounded-xl p-3 border border-white/10">
            <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20">
              <img 
                src={coverArtUrl} 
                alt={trackInfo?.title ? `${trackInfo.title} cover art` : 'Cover art'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23374151" width="400" height="400"/%3E%3Ctext fill="%239CA3AF" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E'
                }}
              />
            </div>
            
            {/* Waveform Display */}
            {waveformUrl && (
              <div className="mt-3">
                <div className="bg-black/50 rounded-lg p-2 border border-white/5">
                  <img 
                    src={waveformUrl} 
                    alt="Waveform"
                    className="w-full h-12 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
                
                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span className="font-mono">
                      {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                    </span>
                    <span className="font-mono">
                      {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-orange-500 transition-all duration-300 ease-linear"
                      style={{ 
                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` 
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Control Buttons */}
        <div className="space-y-2">
          {/* Play Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handlePlayButton()
            }}
            disabled={!(trackInfo) || playerStatus === 'playing'}
            className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              trackInfo && playerStatus !== 'playing'
                ? 'bg-gradient-to-r from-cyan-500 to-orange-500 hover:from-cyan-600 hover:to-orange-600 text-white shadow-lg shadow-cyan-500/50 cursor-pointer'
                : 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            <span className="text-xl">
              {playerStatus === 'playing' ? '⏸️' : '▶️'}
            </span>
            <span>
              {playerStatus === 'playing' ? 'Playing' : 'Play'}
            </span>
          </button>

          {/* Stop Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleStopButton()
            }}
            disabled={playerStatus !== 'playing'}
            className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              playerStatus === 'playing'
                ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/50 cursor-pointer'
                : 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            <span className="text-xl">⏹️</span>
            <span>Stop</span>
          </button>
        </div>

        {/* Status Grid */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Status</div>
              <div className={`text-xs font-semibold capitalize ${
                playerStatus === 'loading' ? 'text-yellow-400' :
                playerStatus === 'playing' ? 'text-green-400' :
                playerStatus === 'paused' ? 'text-orange-400' :
                playerStatus === 'stopped' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {playerStatus || 'idle'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Track</div>
              {trackInfo ? (
                <div className="text-white text-xs">
                  <div className="font-semibold truncate" title={trackInfo.title}>
                    {trackInfo.title}
                  </div>
                  <div className="text-xs text-gray-400 truncate" title={trackInfo.artist}>
                    {trackInfo.artist}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-xs">No track loaded</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
