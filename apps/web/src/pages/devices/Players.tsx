import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import IoTLogModal from '../../components/IoTLogModal'
import IoTLogPanel from '../../components/IoTLogPanel'
import { listPlaylists } from '../../services/playlists'
import { createRadioPlayerIoT } from '../../services/radioPlayerIoT'
import { startMockStateMachine, stopMockStateMachine } from '../../services/mockStateMachine'
import { loadScheduleAndDeterminePlaylist } from '../../services/scheduleService'
import { loadTrackAssets, resolveAudioUrl, formatTime } from '../../services/playerService'
import { calculateCurrentTrack } from '../../utils/scheduleCalculator'
import { PlayerState } from '../../types/player'
import type { Playlist } from '../../types/playlist'
import type { IoTLogEntry } from '../../services/radioPlayerIoT'
import type { ScheduleSlot, CurrentTrackInfo } from '../../utils/scheduleCalculator'
import type { Track } from '../../services/playerService'

// Mock schedule - later vervangen met echte data
const MOCK_SCHEDULE = [
  { time: '06:00', name: 'Morning Show', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { time: '09:00', name: 'Midday Mix', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { time: '12:00', name: 'Lunch Hour', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { time: '15:00', name: 'Afternoon Drive', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { time: '18:00', name: 'Evening Session', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
  { time: '21:00', name: 'Night Vibes', playlistId: null, days: ['FRI', 'SAT'] },
]

function Players() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(new Date())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // IoT Log Modal
  const [showIoTLog, setShowIoTLog] = useState(false)
  const [iotLogs, setIoTLogs] = useState<IoTLogEntry[]>([])
  const iotServiceRef = useRef<ReturnType<typeof createRadioPlayerIoT> | null>(null)
  const playerId = 'player-main-001'
  
  // Schedule & Current Track
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([])
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [currentTrackInfo, setCurrentTrackInfo] = useState<CurrentTrackInfo | null>(null)

  useEffect(() => {
    loadPlaylists()
    loadSchedule()
    
    // Start Mock State Machine
    console.log('🤖 Starting Mock State Machine...')
    startMockStateMachine()
    
    return () => {
      console.log('🛑 Stopping Mock State Machine...')
      stopMockStateMachine()
    }
  }, [])
  
  // Update active slot every minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadSchedule()
    }, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])

  // Separate effect for IoT service - always re-subscribe
  useEffect(() => {
    console.log('🔌 Setting up IoT service...')
    
    // Initialize IoT service if needed
    if (!iotServiceRef.current) {
      console.log('🆕 Creating new IoT service')
      iotServiceRef.current = createRadioPlayerIoT(playerId)
    }
    
    // Always subscribe to log updates (even if service already exists)
    console.log('📝 Registering log callback')
    const unsubscribeLog = iotServiceRef.current.onLog((log) => {
      console.log('🔔 Log callback triggered!', log.type)
      setIoTLogs(prev => [log, ...prev.slice(0, 99)])
    })
    
    // Subscribe to commands (IoT → Player)
    console.log('🎧 Subscribing to IoT commands...')
    let unsubscribeCommands: (() => void) | null = null
    
    iotServiceRef.current.subscribeToCommands((command) => {
      console.log('🎛️ Command received from IoT:', command)
      handleCommand(command)
    }).then(unsub => {
      unsubscribeCommands = unsub
    })
    
    // Get existing logs
    const existingLogs = iotServiceRef.current.getLogs()
    console.log('📚 Loading existing logs:', existingLogs.length)
    setIoTLogs(existingLogs)
    
    // Cleanup: unsubscribe callbacks
    return () => {
      console.log('🧹 Unsubscribing callbacks')
      unsubscribeLog()
      if (unsubscribeCommands) unsubscribeCommands()
    }
  }, [playerId])

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeDisplay(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // ==========================================================================
  // Command Handler (IoT → Player)
  // ==========================================================================

  function handleCommand(command: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎛️ COMMAND RECEIVED:', command.command)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    switch (command.command) {
      case 'LOAD':
        if (command.params?.track) {
          executeLoad(command.params.track)
        } else {
          console.error('❌ LOAD command missing track data')
        }
        break

      case 'PLAY':
        executePlay()
        break

      case 'PAUSE':
        executePause()
        break

      case 'STOP':
        executeStop()
        break

      case 'UNLOAD':
        executeUnload()
        break

      default:
        console.warn('⚠️ Unknown command:', command.command)
    }
  }

  // ==========================================================================
  // TEST FUNCTION
  // ==========================================================================

  async function testIoTConnection() {
    console.log('🧪 Testing IoT connection...')
    try {
      if (!iotServiceRef.current) {
        console.error('❌ IoT service not initialized!')
        alert('❌ IoT service not initialized!')
        return
      }
      
      console.log('📤 Publishing test state...')
      await iotServiceRef.current.publishState(PlayerState.IDLE)
      
      console.log('✅ Test message published!')
      alert('✅ Test message published! Check IoT Log.')
    } catch (error) {
      console.error('❌ Test failed:', error)
      alert(`❌ Test failed: ${error}`)
    }
  }

  async function loadPlaylists() {
    try {
      const { data } = await listPlaylists()
      if (data) {
        setPlaylists(data)
      }
    } catch (error) {
      console.error('Failed to load playlists:', error)
    }
  }
  
  function loadSchedule() {
    const result = loadScheduleAndDeterminePlaylist()
    setScheduleSlots(result.slots)
    setActiveSlot(result.activeSlot)
    
    if (result.playlistId) {
      setCurrentPlaylistId(result.playlistId)
    }
  }

  async function loadTrackIntoPlayer(track: any) {
    try {
      console.log('📥 loadTrackIntoPlayer called with track:', track.title)
      
      // Store track AS-IS (don't resolve audio URL yet - we do that in handlePlay)
      setCurrentTrack(track as Track)
      
      // Load assets (cover art and waveform)
      const assets = await loadTrackAssets(track as Track)
      setCoverArtUrl(assets.coverArtUrl)
      setWaveformUrl(assets.waveformUrl)

      // Mark as loaded
      setIsLoaded(true)
      
      console.log('✅ Track loaded into player:', track.title)
      console.log('   - Audio URL will be resolved when PLAY is clicked')
    } catch (error) {
      console.error('❌ Failed to load track:', error)
    }
  }

  function determineCurrentPlaylist() {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`
    
    // Find matching slot
    const matchingSlot = MOCK_SCHEDULE
      .filter(slot => slot.time <= currentTimeStr)
      .sort((a, b) => b.time.localeCompare(a.time))[0]

    if (matchingSlot?.playlistId) {
      setCurrentPlaylistId(matchingSlot.playlistId)
    } else if (playlists.length > 0) {
      setCurrentPlaylistId(playlists[0].id)
    }
  }

  async function handleLoad() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📥 LOAD BUTTON CLICKED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    if (!currentPlaylistId) {
      console.error('❌ No playlist selected')
      alert('⚠️ No playlist selected')
      return
    }

    console.log('📋 Current playlist ID:', currentPlaylistId)

    try {
      // Publish LOAD command to IoT (don't execute yet!)
      console.log('🎛️ Publishing LOAD command to IoT...')
      await iotServiceRef.current?.publishCommand({
        command: 'LOAD',
        timestamp: new Date().toISOString(),
        params: {
          playlistId: currentPlaylistId
        }
      })
      
      console.log('✅ LOAD command published - waiting for response from State Machine...')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } catch (error) {
      console.error('❌ Failed to publish LOAD command:', error)
      alert(`❌ Failed to send LOAD command: ${error}`)
    }
  }

  // Execute LOAD when command comes back from State Machine
  async function executeLoad(track: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚙️ EXECUTING LOAD COMMAND')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📦 Track data from IoT payload:', track)

    try {
      // Publish LOADING state
      console.log('📤 Publishing LOADING state...')
      await iotServiceRef.current?.publishState(PlayerState.LOADING, {
        playlistId: currentPlaylistId || undefined,
        trackId: track.id
      })

      // Load track (data already complete from IoT payload!)
      console.log('📥 Loading track into player...')
      await loadTrackIntoPlayer(track)
      
      console.log('📤 Publishing LOADED state...')
      await iotServiceRef.current?.publishState(PlayerState.LOADED, {
        trackId: track.id,
        playlistId: currentPlaylistId || undefined,
        duration: track.duration || 0
      })
      
      console.log('✅✅✅ TRACK LOADED SUCCESSFULLY! ✅✅✅')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      alert(`✅ Track loaded: ${track.title}`)
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌❌❌ LOAD EXECUTION FAILED ❌❌❌')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('Error:', error)
      await iotServiceRef.current?.publishState(PlayerState.ERROR, {
        error: String(error)
      })
      alert(`❌ Failed to load track: ${error}`)
    }
  }

  async function handleUnload() {
    if (isPlaying) {
      handleStop()
    }
    
    // Clear all track data
    setIsLoaded(false)
    setCurrentTrack(null)
    setCoverArtUrl(null)
    setWaveformUrl(null)
    setCurrentTime(0)
    setDuration(0)
    
    // Publish IDLE state
    await iotServiceRef.current?.publishState(PlayerState.IDLE)
    
    alert('⏏️ Track unloaded')
  }

  async function handlePause() {
    if (!audioRef.current || !isPlaying) return
    
    audioRef.current.pause()
    setIsPlaying(false)
    setIsPaused(true)
    
    // Publish PAUSED state
    await iotServiceRef.current?.publishState(PlayerState.PAUSED, {
      trackId: currentTrack?.id,
      position: audioRef.current.currentTime,
      duration: audioRef.current.duration
    })
  }

  async function handlePlay() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎵 PLAY BUTTON CLICKED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Current state:', {
      isLoaded,
      hasCurrentTrack: !!currentTrack,
      currentTrackId: currentTrack?.id,
      currentTrackTitle: currentTrack?.title,
      hasAudioRef: !!audioRef.current,
      isCurrentlyPlaying: isPlaying,
      isPaused
    })
    
    if (!isLoaded) {
      console.warn('⚠️ Track not loaded - user needs to click LOAD first')
      alert('⚠️ Please load a track first (click LOAD button)')
      return
    }
    
    if (!currentTrack) {
      console.error('❌ No currentTrack object available')
      alert('⚠️ No track available')
      return
    }
    
    console.log('📋 Current track object:', currentTrack)
    
    try {
      // If already playing, just resume
      if (audioRef.current && !audioRef.current.paused) {
        console.log('✅ Already playing, nothing to do')
        return
      }
      
      // If paused, resume
      if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
        console.log('▶️ Resuming paused playback')
        await audioRef.current.play()
        setIsPlaying(true)
        setIsPaused(false)
        console.log('✅ Resumed successfully!')
        return
      }
      
      // EXACT SAME AS PLAYLISTVIEWER - Use fileUrl!
      console.log('🎵 Creating new audio element for:', currentTrack.title)
      console.log('🔍 Checking track properties:', {
        hasFileUrl: !!(currentTrack as any).fileUrl,
        hasAudioUrl: !!currentTrack.audioUrl,
        fileUrl: (currentTrack as any).fileUrl,
        audioUrl: currentTrack.audioUrl
      })
      
      // Use fileUrl (like PlaylistViewer) as primary, fallback to audioUrl
      const trackUrl = (currentTrack as any).fileUrl || currentTrack.audioUrl
      
      if (!trackUrl) {
        console.error('❌ No fileUrl or audioUrl in currentTrack')
        console.error('Track object:', currentTrack)
        alert('⚠️ No audio file available for this track')
        return
      }
      
      console.log('📂 Using track URL:', trackUrl)
      
      // EXACT SAME AS PLAYLISTVIEWER - Handle legacy amazonaws.com URLs
      let s3Path = trackUrl
      if (s3Path.includes('amazonaws.com')) {
        console.log('🔧 Detected legacy amazonaws.com URL, extracting path...')
        try {
          const url = new URL(s3Path)
          s3Path = url.pathname.replace(/^\//, '')
          console.log('✅ Extracted S3 path:', s3Path)
        } catch (e) {
          console.error('❌ Failed to parse legacy URL:', e)
        }
      }
      
      console.log('🔗 Resolving S3 path to signed URL:', s3Path)
      const result = await getUrl({ path: s3Path })
      const audioUrl = result.url.toString()
      console.log('✅ S3 signed URL obtained:', audioUrl.substring(0, 120) + '...')
      
      console.log('🎵 Creating new Audio() object...')
      const audio = new Audio(audioUrl)
      
      console.log('📡 Setting up event listeners...')
      
      // Set up event listeners (EXACT SAME AS PLAYLISTVIEWER)
      audio.addEventListener('loadedmetadata', () => {
        console.log('✅ LOADEDMETADATA - Duration:', audio.duration, 'seconds')
        setDuration(audio.duration)
        audio.volume = volume
        console.log('🔊 Volume set to:', volume)
      })
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      
      audio.addEventListener('ended', () => {
        console.log('🏁 ENDED - Track finished playing')
        setIsPlaying(false)
        setIsPaused(false)
        setCurrentTime(0)
      })
      
      audio.addEventListener('error', (e) => {
        console.error('❌ AUDIO ERROR EVENT:', e)
        console.error('Error details:', {
          error: audio.error,
          code: audio.error?.code,
          message: audio.error?.message,
          networkState: audio.networkState,
          readyState: audio.readyState
        })
        alert('⚠️ Failed to load audio file')
        setIsPlaying(false)
      })
      
      audio.addEventListener('canplay', () => {
        console.log('✅ CANPLAY - Audio ready to start')
      })
      
      audio.addEventListener('playing', () => {
        console.log('✅ PLAYING - Playback actually started')
      })
      
      audio.addEventListener('pause', () => {
        console.log('⏸️ PAUSE event')
      })
      
      // Store reference
      audioRef.current = audio
      console.log('✅ Audio reference stored in audioRef.current')
      
      // Play (EXACT SAME AS PLAYLISTVIEWER)
      console.log('▶️ Calling audio.play()...')
      await audio.play()
      setIsPlaying(true)
      setIsPaused(false)
      
      // Publish PLAYING state
      await iotServiceRef.current?.publishState(PlayerState.PLAYING, {
        trackId: currentTrack.id,
        playlistId: currentPlaylistId || undefined,
        position: audio.currentTime,
        duration: audio.duration,
        volume: volume
      })
      
      // Publish track info
      await iotServiceRef.current?.publishTrackInfo({
        trackId: currentTrack.id,
        title: currentTrack.title || 'Unknown',
        artist: currentTrack.artist || 'Unknown',
        album: currentTrack.album || undefined,
        duration: audio.duration,
        bpm: currentTrack.bpm || undefined,
        key: currentTrack.key || undefined,
        genre: currentTrack.genre || undefined,
        playlistId: currentPlaylistId || undefined,
        position: 0
      })
      
      console.log('✅✅✅ PLAYBACK STARTED SUCCESSFULLY! ✅✅✅')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
    } catch (error: any) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌❌❌ PLAYBACK FAILED ❌❌❌')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('Error object:', error)
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      
      let errorMsg = 'Playback failed'
      if (error.name === 'NotAllowedError') {
        errorMsg = 'Browser blocked autoplay. Try clicking play again.'
        console.error('💡 This is usually a browser autoplay policy issue')
      } else if (error.name === 'NotSupportedError') {
        errorMsg = 'Audio format not supported'
        console.error('💡 The audio file format may not be supported by this browser')
      } else if (error.message) {
        errorMsg = error.message
      }
      
      alert(`⚠️ ${errorMsg}`)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }

  function togglePlay() {
    console.log('🎛️ togglePlay called', {
      hasAudioRef: !!audioRef.current,
      isPlaying,
      isPaused
    })
    
    // If no audio yet but track is loaded, create new audio
    if (!audioRef.current && isLoaded) {
      console.log('▶️ No audio yet, calling handlePlay to create new Audio()')
      handlePlay()
      return
    }
    
    // If audio exists, toggle play/pause
    if (audioRef.current) {
      if (isPlaying) {
        console.log('⏸️ Currently playing, pausing...')
        handlePause()
      } else {
        console.log('▶️ Currently paused, playing...')
        handlePlay()
      }
    }
  }

  async function handleStop() {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentTime(0)
    
    // Publish STOPPED state
    await iotServiceRef.current?.publishState(PlayerState.STOPPED, {
      trackId: currentTrack?.id,
      position: 0
    })
  }

  function toggleAuto() {
    setAutoPlay(!autoPlay)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current) return
    
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percentage = x / bounds.width
    const newTime = percentage * duration
    
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <Layout title="Player" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        {/* Player + IoT Log Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main Player - 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">🎵 Now Playing</h2>
                <p className="text-sm text-blue-200">Live Audio Player</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Track Elapsed Time */}
                {isPlaying && (
                  <div className="px-2 py-1 bg-blue-500/20 backdrop-blur-sm rounded text-xs border border-blue-500/50">
                    <div className="text-[10px] text-blue-300 font-semibold">ELAPSED</div>
                    <div className="text-white font-mono text-sm font-bold">
                      {formatTime(currentTime)}
                    </div>
                  </div>
                )}

                {/* Track Duration */}
                {currentTrack && (
                  <div className="px-2 py-1 bg-purple-500/20 backdrop-blur-sm rounded text-xs border border-purple-500/50">
                    <div className="text-[10px] text-purple-300 font-semibold">DURATION</div>
                    <div className="text-white font-mono text-sm font-bold">
                      {formatTime(duration)}
                    </div>
                  </div>
                )}

                {/* Current Time */}
                <div className="px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs border border-white/20">
                  <div className="text-[10px] text-gray-400 font-semibold">TIME</div>
                  <div className="text-white font-mono text-sm font-bold">
                    {currentTimeDisplay.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>

                {/* Live Indicator */}
                {isPlaying && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded border border-red-500/50">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-400 text-xs font-semibold">LIVE</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Left: Cover Art */}
              <div className="col-span-1">
                <div className="aspect-square rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-purple-500 to-pink-500 relative">
                  {coverArtUrl ? (
                    <img 
                      src={coverArtUrl} 
                      alt="Cover Art" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                      <span className="text-8xl mb-4">🎵</span>
                      {!currentTrack && (
                        <p className="text-white/80 text-sm font-semibold">
                          No track loaded
                        </p>
                      )}
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="text-white text-6xl animate-pulse">▶️</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle & Right: Track Info + Controls */}
              <div className="col-span-2 flex flex-col justify-between">
                {/* Track Info */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {currentTrack?.title || 'No Track Loaded'}
                  </h3>
                  <p className="text-lg text-blue-200 mb-2">
                    {currentTrack?.artist || (currentTrack ? 'Unknown Artist' : 'Click LOAD to start')}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-blue-300 mb-3">
                    {currentTrack?.album && <span>💿 {currentTrack.album}</span>}
                    {currentTrack?.year && <span>📅 {currentTrack.year}</span>}
                    {currentTrack?.genre && (
                      <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px]">
                        {currentTrack.genre}
                      </span>
                    )}
                  </div>

                  {/* Audio Features */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {currentTrack?.bpm && (
                      <div className="bg-white/10 backdrop-blur-sm rounded p-2 text-center">
                        <div className="text-[10px] text-blue-300 mb-0.5">BPM</div>
                        <div className="text-sm font-bold text-white">{currentTrack.bpm}</div>
                      </div>
                    )}
                    {currentTrack?.key && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">Key</div>
                        <div className="text-lg font-bold text-white">{currentTrack.key}</div>
                      </div>
                    )}
                    {currentTrack?.energy !== null && currentTrack?.energy !== undefined && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">Energy</div>
                        <div className="text-lg font-bold text-white">
                          {Math.round(currentTrack.energy * 100)}%
                        </div>
                      </div>
                    )}
                    {currentTrack?.danceability !== null && currentTrack?.danceability !== undefined && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">Dance</div>
                        <div className="text-lg font-bold text-white">
                          {Math.round(currentTrack.danceability * 100)}%
                        </div>
                      </div>
                    )}
                    {currentTrack?.valence !== null && currentTrack?.valence !== undefined && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">Mood</div>
                        <div className="text-lg font-bold text-white">
                          {Math.round(currentTrack.valence * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Waveform */}
                {waveformUrl && (
                  <div className="mb-6 p-4 bg-white/5 rounded-lg">
                    <img 
                      src={waveformUrl} 
                      alt="Waveform" 
                      className="w-full h-16 object-contain"
                    />
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mb-6">
                  <div 
                    className="h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden mb-2"
                    onClick={handleSeek}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-blue-300">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Top Controls: Auto, Load/Unload, Pause */}
                <div className="flex items-center gap-3 mb-6">
                  {/* Auto Button */}
                  <button
                    onClick={toggleAuto}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                      autoPlay 
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/50' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                    title={autoPlay ? 'Auto-play enabled' : 'Auto-play disabled'}
                  >
                    {autoPlay ? '🔄 AUTO' : '⏸️ MANUAL'}
                  </button>

                  {/* Load/Unload Buttons */}
                  <button
                    onClick={handleLoad}
                    disabled={isLoaded}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    title="Load track"
                  >
                    📥 LOAD
                  </button>
                  <button
                    onClick={handleUnload}
                    disabled={!isLoaded}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    title="Unload track"
                  >
                    ⏏️ UNLOAD
                  </button>

                  {/* Pause Button */}
                  <button
                    onClick={handlePause}
                    disabled={!isPlaying}
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    title="Pause playback"
                  >
                    ⏸️ PAUSE
                  </button>

                  {/* TEST IoT Button */}
                  <button
                    onClick={testIoTConnection}
                    className="px-4 py-3 bg-green-500/20 text-green-300 rounded-lg font-semibold hover:bg-green-500/30 transition-colors border border-green-500/50"
                    title="Test IoT Connection"
                  >
                    🧪 TEST IoT
                  </button>

                  {/* IoT Log Button */}
                  <button
                    onClick={() => setShowIoTLog(true)}
                    className="px-4 py-3 bg-purple-500/20 text-purple-300 rounded-lg font-semibold hover:bg-purple-500/30 transition-colors border border-purple-500/50 relative"
                    title="View IoT Message Log"
                  >
                    📡 IoT Log
                    {iotLogs.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {iotLogs.length > 99 ? '99+' : iotLogs.length}
                      </span>
                    )}
                  </button>

                  {/* Status Indicators */}
                  <div className="flex-1 flex items-center gap-3 justify-end">
                    {isLoaded && (
                      <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-semibold border border-green-500/50">
                        ✓ Loaded
                      </span>
                    )}
                    {isPaused && (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm font-semibold border border-yellow-500/50">
                        ⏸️ Paused
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Controls */}
                <div className="flex items-center gap-6">
                  <button
                    onClick={togglePlay}
                    disabled={!isLoaded}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl hover:scale-110 transition-transform shadow-lg disabled:bg-gray-600 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={handleStop}
                    className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl hover:bg-white/30 transition-colors"
                  >
                    ⏹️
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-white text-xl">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #60a5fa 0%, #60a5fa ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                    <span className="text-blue-300 text-sm font-mono w-12">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audio is created dynamically via new Audio() in handlePlay */}
        </div>

        {/* Current Playlist */}
        {currentPlaylistId && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📻 Current Schedule</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Now playing from scheduled playlist
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Current Time</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
            <PlaylistViewer
              playlistId={currentPlaylistId}
              showHeader={false}
              compact={false}
              maxHeight="600px"
              allowPlay={true}
              allowReorder={true}
              allowRemove={false}
              showDragHandle={true}
              onTrackSelect={async (playlistTrack) => {
                // Stop current playback if playing
                if (isPlaying) {
                  handleStop()
                }
                
                // Load track by ID
                if (playlistTrack.trackId) {
                  try {
                    const { data: tracks } = await listTracks()
                    const track = tracks?.find((t: any) => t.id === playlistTrack.trackId)
                    if (track) {
                      await loadTrackIntoPlayer(track)
                      alert(`✅ Track loaded from playlist: ${track.title}`)
                    }
                  } catch (error) {
                    console.error('Failed to load track from playlist:', error)
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* IoT Log - Right Column */}
      <div className="lg:col-span-1">
        <IoTLogPanel
          logs={iotLogs}
          onClearLogs={() => {
            iotServiceRef.current?.clearLogs()
            setIoTLogs([])
          }}
        />
      </div>
    </div>

  </div>

  {/* IoT Log Modal - Keep for optional full screen view */}
  <IoTLogModal
    isOpen={showIoTLog}
    onClose={() => setShowIoTLog(false)}
    logs={iotLogs}
    playerId={playerId}
    onClearLogs={() => {
      iotServiceRef.current?.clearLogs()
      setIoTLogs([])
    }}
  />
</Layout>
)
}

export default Players
