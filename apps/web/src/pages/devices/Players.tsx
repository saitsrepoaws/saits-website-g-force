import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import SeekBar from '../../components/SeekBar'
import PlayerControls from '../../components/PlayerControls'
import TrackDisplay from '../../components/TrackDisplay'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useSchedule } from '../../hooks/useSchedule'
import { usePlayerState } from '../../hooks/usePlayerState'
import { listPlaylists } from '../../services/playlists'
import { calculateCurrentTrack } from '../../utils/scheduleCalculator'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist } from '../../types/playlist'
import type { Track } from '../../services/playerService'
import { listTracks } from '../../services/tracks'
import { getPlayerState } from '../../services/playerState'

// Schedule data is now loaded from DynamoDB via loadScheduleAndDeterminePlaylist()

function Players() {
  const playerId = 'player-main-001'
  
  // Remaining local state (not in hooks)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
  const [playlistTracksCache, setPlaylistTracksCache] = useState<any[]>([])
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(new Date())
  
  // 🎵 AUDIO PLAYER HOOK - Manages all audio state & controls
  const audioPlayer = useAudioPlayer()
  const {
    isPlaying,
    isPaused,
    isLoaded,
    volume,
    autoPlay,
    currentTime,
    duration,
    currentTrack,
    audioRef,
    coverArtUrl,
    waveformUrl,
    load: loadTrack,
    unload: unloadTrack,
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
    activeSlot,
    currentTrackInfo,
    scheduledTrackId
  } = schedule
  
  // 💾 PLAYER STATE HOOK - Manages persistence
  const playerState = usePlayerState({
    playerId,
    currentTrack,
    isPlaying,
    volume,
    autoPlay,
    activeSlotId: activeSlot?.id,
    activeSlotName: activeSlot?.name
  })
  const {
    playerStateId,
    backendState: backendPlayerState,
    saveState
  } = playerState
  
  // Station mode removed - using hooks now

  useEffect(() => {
    loadPlaylists()
    loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Auto-load playlist when activeSlot changes
  useEffect(() => {
    if (activeSlot?.playlistId && activeSlot.playlistId !== currentPlaylistId) {
      setCurrentPlaylistId(activeSlot.playlistId)
    }
  }, [activeSlot, currentPlaylistId])
  
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
        
        // Restore state if was playing/paused
        if (data.status === 'paused' && data.currentTrackId && data.lastPosition > 0) {
          const { data: tracks } = await listTracks()
          const track = tracks?.find((t: any) => t.id === data.currentTrackId)
          
          if (track) {
            await loadTrackIntoPlayer(track)
            setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.currentTime = data.lastPosition
                setCurrentTime(data.lastPosition)
              }
            }, 1000)
          }
        }
        
        // Restore volume
        if (data.volume) {
          setPlayerVolume(data.volume)
          if (audioRef.current) {
            audioRef.current.volume = data.volume
          }
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
  
  // Auto-switch playlist when activeSlot changes
  useEffect(() => {
    if (activeSlot?.playlistId && activeSlot.playlistId !== currentPlaylistId) {
      setCurrentPlaylistId(activeSlot.playlistId)
    }
  }, [activeSlot, currentPlaylistId])

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeDisplay(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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
  
  async function loadSchedule() {
    // Schedule loading is now handled by useSchedule hook
    // Call schedule.reload() if needed to force refresh
    await schedule.reload()
    
    if (activeSlot?.playlistId && activeSlot.playlistId !== currentPlaylistId) {
      setCurrentPlaylistId(activeSlot.playlistId)
    }
  }

  async function loadTrackIntoPlayer(track: any) {
    try {
      await loadTrack(track as Track)
    } catch (error) {
      console.error('❌ Failed to load track:', error)
    }
  }

  // determineCurrentPlaylist removed - now using DynamoDB via loadSchedule()

  async function handleLoad() {
    try {
      await loadSchedule()
      
      if (!activeSlot) {
        throw new Error('No active schedule found for current time')
      }
      
      if (!activeSlot.playlistId) {
        throw new Error('Active schedule has no playlist')
      }
      
      setCurrentPlaylistId(activeSlot.playlistId)
      
      // Find the playlist
      const currentPlaylist = playlists.find(p => p.id === activeSlot.playlistId)
      if (!currentPlaylist) {
        throw new Error('Playlist not found')
      }
      
      // Get playlist tracks
      const { getPlaylist } = await import('../../services/playlists')
      const result = await getPlaylist(activeSlot.playlistId)
      if (!result.data) {
        throw new Error('Could not load playlist')
      }
      
      // Parse tracks if it's a JSON string
      let playlistTracks = result.data.tracks
      if (typeof playlistTracks === 'string') {
        playlistTracks = JSON.parse(playlistTracks)
      }
      
      if (!playlistTracks || !Array.isArray(playlistTracks) || playlistTracks.length === 0) {
        throw new Error('Playlist has no tracks')
      }
      
      // Calculate current track based on schedule time
      const now = new Date()
      const trackInfo = calculateCurrentTrack(activeSlot, playlistTracks, currentPlaylist.name, now)
      
      if (!trackInfo) {
        throw new Error('No track playing at current time')
      }
      
      const { data: tracks } = await listTracks()
      
      const fullTrack = tracks?.find((t: any) => t.id === trackInfo.track.trackId)
      
      if (!fullTrack) {
        console.error('❌ Track not found!')
        console.error('   Looking for ID:', trackInfo.track.trackId)
        console.error('   Track title from playlist:', trackInfo.track.trackTitle)
        console.error('   Available tracks:', tracks?.length || 0)
        
        // Try to find by title as fallback
        const trackByTitle = tracks?.find((t: any) => 
          t.title?.toLowerCase() === trackInfo.track.trackTitle?.toLowerCase()
        )
        
        if (trackByTitle) {
          await loadTrackIntoPlayer(trackByTitle)
          return
        }
        
        throw new Error(`Track not found in library (ID: ${trackInfo.track.trackId})`)
      }
      
      // Load track into player
      await loadTrackIntoPlayer(fullTrack)
      
      // Save to PlayerState
      if (playerStateId) {
        const stateData = {
          playerId,
          currentTrackId: fullTrack.id,
          currentTrackTitle: fullTrack.title || undefined,
          currentTrackArtist: fullTrack.artist || undefined,
          currentPlaylistId: currentPlaylistId || undefined,
          status: 'idle' as const,  // Track loaded, ready to play (not playing yet)
          lastPosition: 0,
          duration: fullTrack.duration || 0,
          volume,
          autoPlayEnabled: autoPlay,
          currentScheduleSlotId: activeSlot?.id,
          currentScheduleSlotName: activeSlot?.name
        }
        await saveState(stateData)
      }
    } catch (error) {
      console.error('❌ Failed to load track:', error)
      alert(`❌ Failed to load track: ${error}`)
    }
  }

  async function handlePause() {
    // PAUSE uses hook directly
    if (!audioRef.current || !isPlaying) return
    
    audioRef.current.pause()
    _setIsPlaying(false)
    _setIsPaused(true)
    
    if (playerStateId) {
      await saveState({ status: 'paused', lastPosition: audioRef.current.currentTime })
    }
  }
  
  // executePause removed - using handlePause directly

  function handlePlay() {
    executePlay()
  }
  
  async function executePlay() {
    if (!isLoaded || !currentTrack) {
      alert('⚠️ Please load a track first')
      return
    }
    
    try {
      // Resume if already exists
      if (audioRef.current?.paused && audioRef.current.src) {
        await audioRef.current.play()
        _setIsPlaying(true)
        _setIsPaused(false)
        return
      }
      
      if (audioRef.current && !audioRef.current.paused) return
      
      // Get audio URL
      const trackUrl = (currentTrack as any).fileUrl || currentTrack.audioUrl
      if (!trackUrl) {
        alert('⚠️ No audio file available')
        return
      }
      
      // Handle legacy URLs
      let s3Path = trackUrl
      if (s3Path.includes('amazonaws.com')) {
        const url = new URL(s3Path)
        s3Path = url.pathname.replace(/^\//, '')
      }
      
      // Get signed URL and create audio
      const result = await getUrl({ path: s3Path })
      const audio = new Audio(result.url.toString())
      
      // Event listeners
      audio.addEventListener('loadedmetadata', () => {
        _setDuration(audio.duration)
        audio.volume = volume
      })
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
      audio.addEventListener('ended', () => {
        _setIsPlaying(false)
        _setIsPaused(false)
        setCurrentTime(0)
      })
      audio.addEventListener('error', () => {
        console.error('Audio playback error')
        alert('⚠️ Failed to load audio file')
        _setIsPlaying(false)
      })
      
      // Play
      // @ts-ignore - audioRef is readonly but we need to set it
      audioRef.current = audio
      await audio.play()
      _setIsPlaying(true)
      _setIsPaused(false)
      
      // Save state
      if (playerStateId) {
        await saveState({
          playerId,
          currentTrackId: currentTrack.id,
          currentTrackTitle: currentTrack.title || undefined,
          currentTrackArtist: currentTrack.artist || undefined,
          currentPlaylistId: currentPlaylistId || undefined,
          status: 'playing',
          lastPosition: audio.currentTime,
          duration: audio.duration,
          volume,
          autoPlayEnabled: autoPlay,
          currentScheduleSlotId: activeSlot?.id,
          currentScheduleSlotName: activeSlot?.name
        })
      }
    } catch (error: any) {
      console.error('Playback failed:', error)
      const errorMsg = error.name === 'NotAllowedError' 
        ? 'Browser blocked autoplay. Try clicking play again.'
        : error.name === 'NotSupportedError'
        ? 'Audio format not supported'
        : error.message || 'Playback failed'
      alert(`⚠️ ${errorMsg}`)
    }
  }

  function togglePlay() {
    if (!audioRef.current && isLoaded) {
      handlePlay()
      return
    }
    
    if (audioRef.current) {
      if (isPlaying) {
        handlePause()
      } else {
        handlePlay()
      }
    }
  }

  function handleStop() {
    executeStop()
  }
  
  async function executeStop() {
    if (!audioRef.current) return
    
    // Stop playback
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
        volume,
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

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVolume = parseFloat(e.target.value)
    setPlayerVolume(newVolume)
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
          volume,
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
  }, [playerStateId, currentTrack, isPlaying, volume, autoPlay, playerId])

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
        
        {/* Backend PlayerState Display */}
        {backendPlayerState && (
          <div className="mb-6 bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl shadow-lg border border-white/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💾 Backend Player State
                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/50">
                  SYNCED
                </span>
              </h3>
              {/* Close button disabled - state managed by hook now */}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-white/10 rounded p-2 border border-white/20">
                <div className="text-blue-300 text-xs mb-1">Status</div>
                <div className="text-white font-semibold">{backendPlayerState.status || 'idle'}</div>
              </div>
              <div className="bg-white/10 rounded p-2 border border-white/20">
                <div className="text-blue-300 text-xs mb-1">Track</div>
                <div className="text-white font-semibold truncate" title={backendPlayerState.currentTrackTitle}>
                  {backendPlayerState.currentTrackTitle || 'None'}
                </div>
              </div>
              <div className="bg-white/10 rounded p-2 border border-white/20">
                <div className="text-blue-300 text-xs mb-1">Last Position</div>
                <div className="text-white font-semibold">
                  {backendPlayerState.lastPosition ? formatTime(backendPlayerState.lastPosition) : '0:00'}
                </div>
              </div>
              <div className="bg-white/10 rounded p-2 border border-white/20">
                <div className="text-blue-300 text-xs mb-1">Last Updated</div>
                <div className="text-white font-semibold text-xs">
                  {backendPlayerState.lastUpdated ? new Date(backendPlayerState.lastUpdated).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Main Player */}
        <div className="mb-6">
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
              isLoaded={isLoaded}
              volume={volume}
              autoPlay={autoPlay}
              onPlay={togglePlay}
              onPause={handlePause}
              onStop={handleStop}
              onLoad={handleLoad}
              onUnload={unloadTrack}
              onVolumeChange={handleVolumeChange}
              onAutoPlayToggle={toggleAuto}
            />
          </div>
        </div>
      </div>

      {/* Audio is created dynamically via new Audio() in handlePlay */}

      {/* Schedule Info Card */}
      {activeSlot && currentPlaylistId && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg overflow-hidden border border-purple-200">
            <div className="p-6 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <span className="text-3xl">📻</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Now Playing Schedule</h3>
                    <p className="text-white/80 text-sm">{activeSlot.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-bold text-gray-800 shadow-lg">
                    ⏰ {activeSlot.time}
                  </div>
                  <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-bold text-white shadow-lg border border-white/30">
                    ⏱️ {activeSlot.duration}m
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 mt-3">
                <div className="text-lg font-bold text-white mb-1">
                  {playlists.find(p => p.id === currentPlaylistId)?.name || 'Loading...'}
                </div>
                <div className="flex items-center gap-3 text-sm text-white/90">
                  <span className="flex items-center gap-1">
                    <span className="text-green-300">▶️</span>
                    Auto-loaded from schedule
                  </span>
                  <span className="text-white/50">•</span>
                  <span className="flex items-center gap-1">
                    🎧 Click track to preview
                  </span>
                  <span className="text-white/50">•</span>
                  <span className="font-mono text-white/80">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    {/* Playlist Viewer - Full Width Below */}
    {currentPlaylistId ? (
      <div className="mt-6">
        <PlaylistViewer
          playlistId={currentPlaylistId}
          showHeader={true}
          compact={false}
          maxHeight="600px"
          allowPlay={true}
          allowReorder={true}
          allowRemove={false}
          showDragHandle={true}
          highlightTrackId={scheduledTrackId}
          currentTrackIndex={currentTrackInfo?.trackIndex ?? null}
          scheduleSlot={activeSlot ? { time: activeSlot.time, duration: activeSlot.duration } : null}
          loadedTrackId={currentTrack?.id ?? null}
          onTracksLoaded={(tracks) => {
            setPlaylistTracksCache(tracks)
          }}
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
                }
              } catch (error) {
                console.error('Failed to load track from playlist:', error)
              }
            }
          }}
        />
      </div>
    ) : (
      <div className="mt-6 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-center">
        <p className="text-yellow-800 font-semibold">⚠️ No playlist loaded</p>
        <p className="text-yellow-600 text-sm mt-2">Click LOAD to load the scheduled track and playlist</p>
        <p className="text-xs text-gray-500 mt-2">currentPlaylistId: {currentPlaylistId || 'null'}</p>
      </div>
    )}

  </Layout>
  )
}

export default Players
