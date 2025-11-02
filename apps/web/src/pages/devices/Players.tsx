import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import SeekBar from '../../components/SeekBar'
import PlayerControls from '../../components/PlayerControls'
import TrackDisplay from '../../components/TrackDisplay'
import IoTLogWindow from '../../components/IoTLogWindow'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useSchedule } from '../../hooks/useSchedule'
import { usePlayerState } from '../../hooks/usePlayerState'
import { getUrl } from 'aws-amplify/storage'
import { getPlayerState } from '../../services/playerState'

// Schedule data is now loaded from DynamoDB via loadScheduleAndDeterminePlaylist()

function Players() {
  const playerId = 'player-main-001'
  
  // Remaining local state (not in hooks)
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(new Date())
  
  // 🎵 AUDIO PLAYER HOOK - Manages all audio state & controls
  const audioPlayer = useAudioPlayer()
  const {
    isPlaying,
    isPaused,
    autoPlay,
    currentTime,
    duration,
    currentTrack,
    audioRef,
    coverArtUrl,
    waveformUrl,
    setVolume: setPlayerVolume,
    setAutoPlay,
    setCurrentTime,
    _setIsPlaying,
    _setIsPaused,
    _setDuration
  } = audioPlayer
  
  // 📅 SCHEDULE HOOK - Manages schedule & track calculation
  const schedule = useSchedule()
  const {
    activeSlot
  } = schedule
  
  // 💾 PLAYER STATE HOOK - Manages persistence
  const playerState = usePlayerState({
    playerId,
    currentTrack,
    isPlaying,
    volume: 1.0, // Always 100%
    autoPlay,
    activeSlotId: activeSlot?.id,
    activeSlotName: activeSlot?.name
  })
  const {
    playerStateId,
    saveState
  } = playerState
  
  // Station mode removed - using hooks now

  // Set volume to 100% on mount and keep it there
  useEffect(() => {
    setPlayerVolume(1.0)
    if (audioRef.current) {
      audioRef.current.volume = 1.0
    }
  }, [])

  useEffect(() => {
    loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Update active slot every minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadSchedule()
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Initialize PlayerState - restore from last session
  useEffect(() => {
    async function initPlayerState() {
      try {
        const { data, errors } = await getPlayerState(playerId)
        
        if (errors || !data) {
          console.error('❌ Failed to get player state:', errors)
          return
        }
        
        // Track loading removed - controlled by IoT
        // Only restore volume and autoPlay settings
        
        // Volume always 100%
        setPlayerVolume(1.0)
        if (audioRef.current) {
          audioRef.current.volume = 1.0
        }
        
        // Restore autoPlay
        if (data.autoPlayEnabled !== undefined) {
          setAutoPlay(data.autoPlayEnabled)
        }
      } catch (error) {
        console.error('❌ Failed to initialize player state:', error)
      }
    }
    
    initPlayerState()
  }, [])
  
  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeDisplay(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  async function loadSchedule() {
    // Schedule loading is now handled by useSchedule hook
    // Call schedule.reload() if needed to force refresh
    await schedule.reload()
  }

  // Load/Unload logic removed - controlled by IoT

  async function handlePause() {
    if (!audioRef.current || !isPlaying) return
    audioRef.current.pause()
    _setIsPlaying(false)
    _setIsPaused(true)
    if (playerStateId) {
      await saveState({ status: 'paused', lastPosition: audioRef.current.currentTime })
    }
  }

  async function handlePlay() {
    if (!currentTrack) return
    
    try {
      if (audioRef.current?.paused && audioRef.current.src) {
        await audioRef.current.play()
        _setIsPlaying(true)
        _setIsPaused(false)
        return
      }
      
      if (audioRef.current && !audioRef.current.paused) return
      
      const trackUrl = (currentTrack as any).fileUrl || currentTrack.audioUrl
      if (!trackUrl) return
      
      let s3Path = trackUrl
      if (s3Path.includes('amazonaws.com')) {
        const url = new URL(s3Path)
        s3Path = url.pathname.replace(/^\//, '')
      }
      
      const result = await getUrl({ path: s3Path })
      const audio = new Audio(result.url.toString())
      audio.addEventListener('loadedmetadata', () => {
        _setDuration(audio.duration)
        audio.volume = 1.0 // Always 100%
      })
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
      audio.addEventListener('ended', () => {
        _setIsPlaying(false)
        _setIsPaused(false)
        setCurrentTime(0)
      })
      audio.addEventListener('error', () => {
        _setIsPlaying(false)
      })
      
      // @ts-ignore
      audioRef.current = audio
      await audio.play()
      _setIsPlaying(true)
      _setIsPaused(false)
      
      if (playerStateId) {
        await saveState({
          playerId,
          currentTrackId: currentTrack.id,
          currentTrackTitle: currentTrack.title || undefined,
          currentTrackArtist: currentTrack.artist || undefined,
          status: 'playing',
          lastPosition: audio.currentTime,
          duration: audio.duration,
          volume: 1.0,
          autoPlayEnabled: autoPlay,
          currentScheduleSlotId: activeSlot?.id,
          currentScheduleSlotName: activeSlot?.name
        })
      }
    } catch (error: any) {
      _setIsPlaying(false)
    }
  }

  function togglePlay() {
    if (audioRef.current) {
      if (isPlaying) {
        handlePause()
      } else {
        handlePlay()
      }
    }
  }

  async function handleStop() {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    _setIsPlaying(false)
    _setIsPaused(false)
    setCurrentTime(0)
    
    if (playerStateId && currentTrack) {
      await saveState({
        playerId,
        status: 'stopped',
        lastPosition: 0,
        volume: 1.0,
        autoPlayEnabled: autoPlay
      })
    }
  }

  function toggleAuto() {
    setAutoPlay(!autoPlay)
  }

  // Seek handler for SeekBar component
  function handleSeek(time: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  // Keyboard shortcuts for seeking
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!audioRef.current || !duration) return
      
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      let seekAmount = 0
      
      switch(e.key) {
        case 'ArrowLeft':
          seekAmount = e.shiftKey ? -30 : -5
          break
        case 'ArrowRight':
          seekAmount = e.shiftKey ? 30 : 5
          break
        case 'Home':
          audioRef.current.currentTime = 0
          setCurrentTime(0)
          return
        case 'End':
          audioRef.current.currentTime = duration
          setCurrentTime(duration)
          return
        default:
          return
      }
      
      if (seekAmount !== 0) {
        e.preventDefault()
        const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seekAmount))
        audioRef.current.currentTime = newTime
        setCurrentTime(newTime)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [duration])
  
  // Page unload handler - save state before closing
  useEffect(() => {
    function handleBeforeUnload() {
      if (playerStateId && currentTrack && audioRef.current) {
        const status = isPlaying ? 'paused' : 'stopped'
        const position = isPlaying ? audioRef.current.currentTime : 0
        
        // Use navigator.sendBeacon for guaranteed delivery
        const data = {
          id: playerStateId,
          playerId,
          status,
          lastPosition: position,
          volume: 1.0,
          autoPlayEnabled: autoPlay,
          lastActive: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
        
        console.log('💾 Saving state before page unload...', data)
        // Note: savePlayerState is async, might not complete before unload
        // In production, consider using sendBeacon API
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [playerStateId, currentTrack, isPlaying, autoPlay, playerId])

  // Helper: Format time for display (used outside SeekBar)
  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <Layout title="Player" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        {/* Grid Layout: Player left, Logs right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Player - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 transform hover:scale-[1.01] transition-transform duration-300">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/20 bg-gradient-to-r from-purple-800/30 to-blue-800/30 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">🎵 Now Playing</h2>
                  <p className="text-sm text-blue-200">Live Audio Player</p>
                </div>
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
            {/* Track Display Component */}
            <TrackDisplay
              track={currentTrack}
              coverArtUrl={coverArtUrl}
              waveformUrl={waveformUrl}
              isPlaying={isPlaying}
            />

            {/* SeekBar Component */}
            <SeekBar
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              className="mb-6"
            />

            {/* Player Controls Component */}
            <PlayerControls
              isPlaying={isPlaying}
              isPaused={isPaused}
              autoPlay={autoPlay}
              onPlay={togglePlay}
              onPause={handlePause}
              onStop={handleStop}
              onAutoPlayToggle={toggleAuto}
            />
          </div>
        </div>
          </div>

          {/* IoT Log Window - Takes 1 column */}
          <div className="lg:col-span-1">
            <IoTLogWindow maxHeight="calc(100vh - 200px)" />
          </div>
        </div>

        {/* Audio is created dynamically via new Audio() in handlePlay */}
      </div>

  </Layout>
  )
}

export default Players
