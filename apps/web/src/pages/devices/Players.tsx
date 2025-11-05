import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { useIoT } from '../../contexts/IoTContext'
import { useTabTitle } from '../../hooks/useTabTitle'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { getAudioUrl, getCoverArtUrl, getWaveformUrl } from '../../utils/mediaUrl'

/**
 * Players Component - Clean Architecture
 * 
 * Responsibilities:
 * - Manage player UI state
 * - Handle IoT subscriptions
 * - Coordinate audio playback
 * - Display player controls and status
 */
export default function PlayersClean() {
  // ============================================
  // 🎯 CONFIGURATION
  // ============================================
  const playerId = 'player-001' // TODO: Make dynamic via props/route params
  
  // ============================================
  // 🪝 HOOKS
  // ============================================
  const iot = useIoT()
  const audio = useAudioPlayer()
  
  useTabTitle('Player', '🎵')
  
  // ============================================
  // 📊 LOCAL STATE
  // ============================================
  const [autoLoad, setAutoLoad] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  // Track info for UI display (separate from audio hook)
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
    if (iot.connectionState !== 'Connected' || isSubscribed) {
      return
    }

    const commandTopic = `radio/player/${playerId}/command`
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📡 Subscribing to IoT topic...')
    console.log('Topic:', commandTopic)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    let unsubscribe: (() => void) | undefined

    iot.subscribe(commandTopic, (message: any) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📥 INCOMING MESSAGE RECEIVED!')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📥 INCOMING raw data:', message)
      
      handleIncomingCommand(message)
    }).then((unsub) => {
      unsubscribe = unsub
      setIsSubscribed(true)
      console.log('✅ SUBSCRIBED SUCCESSFULLY')
    }).catch((error) => {
      console.error('❌ Failed to subscribe:', error)
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
        setIsSubscribed(false)
      }
    }
  }, [iot.connectionState, playerId, isSubscribed])
  
  // ============================================
  // 🎮 COMMAND HANDLERS
  // ============================================
  const handleIncomingCommand = async (message: any) => {
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
        await handleLoadCommand(message)
        break
      case 'UNLOAD':
        handleUnloadCommand(message)
        break
      default:
        console.warn(`⚠️ Unknown command: ${command}`)
    }
  }

  const handlePlayCommand = (message: any) => {
    console.log('▶️ PLAY COMMAND RECEIVED')
    
    setPlayerStatus('playing')
    
    // Start audio playback
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      audioElement.play()
        .then(() => console.log('✅ Audio playback started!'))
        .catch((error) => console.error('❌ Failed to start audio playback:', error))
    }
  }

  const handlePauseCommand = (message: any) => {
    console.log('⏸️ PAUSE COMMAND RECEIVED')
    setPlayerStatus('paused')
    
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
    }
  }

  const handleStopCommand = (message: any) => {
    console.log('⏹️ STOP COMMAND RECEIVED')
    
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    
    setPlayerStatus('stopped')
  }

  const handleLoadCommand = async (message: any) => {
    console.log('💿 LOAD COMMAND RECEIVED FROM BACKEND')
    
    if (!message.params || !message.params.track) {
      console.error('❌ No track data in LOAD command')
      return
    }

    const { track } = message.params
    
    console.log('✅ Track from backend:', track.title, 'by', track.artist)
    
    setPlayerStatus('loading')
    
    try {
      // Get presigned URLs
      const [audioUrlResolved, coverUrl, waveUrl] = await Promise.all([
        getAudioUrl(track.fileUrl),
        getCoverArtUrl(track.coverArtUrl),
        getWaveformUrl(track.waveformUrl)
      ])
      
      // Store URLs in state
      setCoverArtUrl(coverUrl)
      setWaveformUrl(waveUrl)
      setAudioUrl(audioUrlResolved)
      
      // Store track info
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
      console.log('✅ Track loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load track:', error)
      setPlayerStatus('idle')
    }
  }

  const handleUnloadCommand = (message: any) => {
    console.log('🗑️ UNLOAD COMMAND RECEIVED')
    
    // Stop audio if playing
    const audioElement = document.getElementById('player-audio') as HTMLAudioElement
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    
    // Clear ALL track data
    setCoverArtUrl(null)
    setWaveformUrl(null)
    setAudioUrl(null)
    setTrackInfo(null)
    setPlayerStatus('idle')
    
    console.log('✅ Track cleared successfully')
  }
  
  // ============================================
  // 🎚️ UI HANDLERS
  // ============================================
  const handleStopButton = async () => {
    console.log('⏹️ STOP BUTTON CLICKED')
    
    const commandTopic = `radio/player/${playerId}/command-request`
    const stopCommand = {
      command: 'STOP',
      playerId: playerId,
      timestamp: new Date().toISOString()
    }

    try {
      await iot.publish(commandTopic, stopCommand)
      console.log('✅ STOP command published successfully!')
    } catch (error) {
      console.error('❌ FAILED to publish STOP command:', error)
    }
  }

  const handlePlayButton = async () => {
    console.log('▶️ PLAY BUTTON CLICKED')
    
    const commandTopic = `radio/player/${playerId}/command-request`
    const playCommand = {
      command: 'PLAY',
      playerId: playerId,
      timestamp: new Date().toISOString()
    }

    try {
      await iot.publish(commandTopic, playCommand)
      console.log('✅ PLAY command published successfully!')
    } catch (error) {
      console.error('❌ FAILED to publish PLAY command:', error)
    }
  }

  const handleAutoLoadToggle = async () => {
    const newValue = !autoLoad
    setAutoLoad(newValue)
    
    console.log('🎚️ AUTO LOAD TOGGLE:', newValue ? 'ON' : 'OFF')

    if (newValue) {
      // Auto Load turned ON → Publish LOAD command to backend
      const commandTopic = `radio/player/${playerId}/command-request`
      const loadCommand = {
        command: 'LOAD',
        playerId: playerId,
        timestamp: new Date().toISOString()
      }
      
      try {
        await iot.publish(commandTopic, loadCommand)
        console.log('✅ LOAD command published successfully!')
      } catch (error) {
        console.error('❌ Failed to publish LOAD command:', error)
      }
    } else {
      // Auto Load turned OFF → Publish UNLOAD command
      const commandTopic = `radio/player/${playerId}/command`
      const unloadCommand = {
        command: 'UNLOAD',
        playerId: playerId,
        timestamp: new Date().toISOString()
      }
      
      try {
        await iot.publish(commandTopic, unloadCommand)
        console.log('✅ UNLOAD command published successfully!')
      } catch (error) {
        console.error('❌ Failed to publish UNLOAD command:', error)
      }
    }
  }
  
  // ============================================
  // 🎨 RENDER
  // ============================================
  return (
    <Layout title="Player" showBackButton backTo="/devices">
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          id="player-audio"
          src={audioUrl}
          onPlay={() => {
            console.log('🎵 Audio started playing')
            setPlayerStatus('playing')
          }}
          onPause={() => {
            console.log('⏸️ Audio paused')
            setPlayerStatus('paused')
          }}
          onEnded={() => {
            console.log('🏁 Audio ended')
            setPlayerStatus('stopped')
            setCurrentTime(0)
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
          onError={(e) => console.error('❌ Audio error:', e)}
        />
      )}
      
      <div className="max-w-2xl mx-auto">
        {/* Player Card */}
        <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 p-6 lg:p-8 space-y-6">
          
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">🎵 Radio Player</h1>
            <p className="text-blue-200 text-sm">ID: {playerId}</p>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${iot.connectionState === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white font-medium">
                {iot.connectionState === 'Connected' ? 'IoT Connected' : 'IoT Disconnected'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white font-medium">
                {isSubscribed ? 'Subscribed' : 'Not Subscribed'}
              </span>
            </div>
          </div>

          {/* Cover Art Display */}
          {coverArtUrl && (
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-gray-400 mb-3 font-mono uppercase">Now Playing:</div>
              <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20">
                <img 
                  src={coverArtUrl} 
                  alt={trackInfo?.title ? `${trackInfo.title} cover art` : 'Cover art'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('❌ Failed to load cover art:', coverArtUrl)
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23374151" width="400" height="400"/%3E%3Ctext fill="%239CA3AF" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Cover Art%3C/text%3E%3C/svg%3E'
                  }}
                  onLoad={() => {
                    console.log('✅ Cover art loaded successfully!')
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
                  
                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="font-mono">
                        {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                      </span>
                      <span className="font-mono">
                        {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="relative h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-linear"
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

            {/* Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePlayButton()
              }}
              disabled={!(trackInfo) || playerStatus === 'playing'}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                trackInfo && playerStatus !== 'playing'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50 cursor-pointer'
                  : 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span className="text-2xl">
                {playerStatus === 'playing' ? '⏸️' : '▶️'}
              </span>
              <span>
                {playerStatus === 'playing' ? 'Playing...' : 'Play Track'}
              </span>
              {!trackInfo && (
                <span className="ml-auto text-xs opacity-75">
                  Load track first
                </span>
              )}
            </button>

            {/* Stop Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleStopButton()
              }}
              disabled={playerStatus !== 'playing'}
              className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                playerStatus === 'playing'
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
                  playerStatus === 'loading' ? 'text-yellow-400' :
                  playerStatus === 'playing' ? 'text-green-400' :
                  playerStatus === 'paused' ? 'text-orange-400' :
                  playerStatus === 'stopped' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {playerStatus || 'idle'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Mode</div>
                <div className="text-white font-semibold">{autoLoad ? 'Auto' : 'Manual'}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Track</div>
                {trackInfo ? (
                  <div className="text-white text-sm">
                    <div className="font-semibold truncate" title={trackInfo.title}>
                      {trackInfo.title}
                    </div>
                    <div className="text-xs text-gray-400 truncate" title={trackInfo.artist}>
                      {trackInfo.artist}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No track loaded</div>
                )}
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Duration</div>
                <div className="text-white font-semibold text-sm">
                  {trackInfo?.duration ? `${Math.floor(trackInfo.duration / 60)}:${String(Math.floor(trackInfo.duration % 60)).padStart(2, '0')}` : '--:--'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Volume</div>
                <div className="text-white font-semibold">100%</div>
              </div>
            </div>

            {/* Extended Track Info */}
            {trackInfo && (() => {
              return (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Track Details</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {trackInfo.album && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Album:</span>
                        <span className="text-white ml-2">{trackInfo.album}</span>
                      </div>
                    )}
                    {trackInfo.genre && (
                      <div>
                        <span className="text-gray-400">Genre:</span>
                        <span className="text-white ml-2">{trackInfo.genre}</span>
                      </div>
                    )}
                    {trackInfo.year && (
                      <div>
                        <span className="text-gray-400">Year:</span>
                        <span className="text-white ml-2">{trackInfo.year}</span>
                      </div>
                    )}
                    {trackInfo.bpm && (
                      <div>
                        <span className="text-gray-400">BPM:</span>
                        <span className="text-white ml-2">{trackInfo.bpm}</span>
                      </div>
                    )}
                    {trackInfo.key && (
                      <div>
                        <span className="text-gray-400">Key:</span>
                        <span className="text-white ml-2">{trackInfo.key}</span>
                      </div>
                    )}
                    {trackInfo.energy !== undefined && (
                      <div>
                        <span className="text-gray-400">Energy:</span>
                        <span className="text-white ml-2">{Math.round(trackInfo.energy * 100)}%</span>
                      </div>
                    )}
                    {trackInfo.label && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Label:</span>
                        <span className="text-white ml-2">{trackInfo.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

        </div>
      </div>
    </Layout>
  )
}
