import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import IoTLogModal from '../../components/IoTLogModal'
import IoTStatusIndicator from '../../components/IoTStatusIndicator'
// import IoTConnectionStatus from '../../components/IoTConnectionStatus' // DISABLED
import SeekBar from '../../components/SeekBar'
import PlayerControls from '../../components/PlayerControls'
import TrackDisplay from '../../components/TrackDisplay'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useSchedule } from '../../hooks/useSchedule'
import { usePlayerState } from '../../hooks/usePlayerState'
import { listPlaylists } from '../../services/playlists'
// import { createRadioPlayerIoT } from '../../services/radioPlayerIoT' // DISABLED
import { calculateCurrentTrack } from '../../utils/scheduleCalculator'
import { PlayerState } from '../../types/player'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist } from '../../types/playlist'
import type { IoTLogEntry } from '../../services/radioPlayerIoT'
import type { Track } from '../../services/playerService'
import { listTracks } from '../../services/tracks'
import { getPlayerState, savePlayerState } from '../../services/playerState'
// import { useIoT } from '../../contexts/IoTContext' // DISABLED

// Schedule data is now loaded from DynamoDB via loadScheduleAndDeterminePlaylist()

function Players() {
  const playerId = 'player-main-001'
  
  // Remaining local state (not in hooks)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
  const [playlistTracksCache, setPlaylistTracksCache] = useState<any[]>([])
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState(new Date())
  
  // IoT Log Modal (temporary - will be moved later)
  const [showIoTLog, setShowIoTLog] = useState(false)
  const [iotLogs, setIoTLogs] = useState<IoTLogEntry[]>([])
  // IoT service disabled - keeping ref for backwards compatibility
  const iotServiceRef = useRef<any | null>(null)
  
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
    coverArtUrl,
    waveformUrl,
    audioRef,
    pause: pauseAudio,
    stop: stopAudio,
    // play, togglePlay - keeping custom versions below (legacy IoT integration)
    load: loadTrack,
    unload: unloadTrack,
    setVolume: setPlayerVolume,
    setAutoPlay,
    setCurrentTime,
    _setCurrentTrack,
    _setIsPlaying,
    _setIsPaused,
    _setIsLoaded,
    _setDuration
  } = audioPlayer
  
  // 📅 SCHEDULE HOOK - Manages schedule & track calculation
  const schedule = useSchedule({
    playlistTracksCache,
    playlistName: playlists.find(p => p.id === currentPlaylistId)?.name || 'Playlist',
    autoRefresh: true
  })
  const {
    scheduleSlots,
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
    isRestoring: isRestoringState,
    saveState,
    restoreState,
    updatePosition
  } = playerState
  
  // Station mode removed - using hooks now

  useEffect(() => {
    loadPlaylists()
    loadSchedule()
    
    // Auto-load playlist after schedule is loaded
    setTimeout(() => {
      console.log('🎵 Auto-loading playlist from schedule...')
      if (activeSlot && activeSlot.playlistId) {
        console.log('✅ Found active slot:', activeSlot.name)
        console.log('📋 Setting playlist:', activeSlot.playlistId)
        setCurrentPlaylistId(activeSlot.playlistId)
      } else {
        console.log('⚠️ No active slot yet, will try again...')
      }
    }, 1000) // Wait 1 second for loadSchedule to complete
    
    // Test IoT connection on startup - DISABLED
    // import('../../services/pubsub').then(({ testConnect }) => {
    //   console.log('🔌 Testing IoT connection...')
    //   testConnect('radio/player/connection-test').then((ok: boolean) => {
    //     if (ok) {
    //       console.log('✅ IoT connection test PASSED')
    //     } else {
    //       console.error('❌ IoT connection test FAILED')
    //     }
    //   })
    // })
    console.log('🚫 IoT connection test DISABLED')
    
    // Real AWS State Machine is now active via IoT Rule
    // No mock needed - Lambda handles all schedule logic
  }, [])
  
  // Update active slot every minute
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Minute tick - checking for schedule changes...')
      loadSchedule()
    }, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])
  
  // Initialize PlayerState - restore from last session
  useEffect(() => {
    async function initPlayerState() {
      try {
        console.log('💾 Initializing PlayerState...')
        const { data, errors } = await getPlayerState(playerId)
        
        if (errors || !data) {
          console.error('❌ Failed to get player state:', errors)
          return
        }
        
        // PlayerState is managed by usePlayerState hook now
        // Backend state will be available via playerState.backendState
        console.log('✅ PlayerState loaded:', data.id)
        
        // Restore state if was playing/paused
        if (data.status === 'paused' && data.currentTrackId && data.lastPosition > 0) {
          console.log('🔄 Restoring playback state...')
          console.log('   Track:', data.currentTrackTitle)
          console.log('   Position:', Math.round(data.lastPosition), 'seconds')
          
          // Restoring state - this will be handled by the hook
          
          // Load the track
          const { data: tracks } = await listTracks()
          const track = tracks?.find((t: any) => t.id === data.currentTrackId)
          
          if (track) {
            await loadTrackIntoPlayer(track)
            
            // Wait for audio to load
            setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.currentTime = data.lastPosition
                setCurrentTime(data.lastPosition)
                console.log('✅ Playback restored to:', Math.round(data.lastPosition), 'seconds')
              }
              // Restore complete
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
    if (activeSlot && activeSlot.playlistId) {
      console.log('🔄 Active slot changed to:', activeSlot.name, `(${activeSlot.time})`)
      console.log('📋 Auto-switching to playlist:', activeSlot.playlistId)
      
      // Only update if it's different from current
      if (activeSlot.playlistId !== currentPlaylistId) {
        console.log('✅ Switching playlist!')
        setCurrentPlaylistId(activeSlot.playlistId)
        
        // TODO: Optionally auto-load new track when slot changes
        // handleLoad() 
      } else {
        console.log('ℹ️ Same playlist, no switch needed')
      }
    }
  }, [activeSlot])

  // NOTE: Scheduled track calculation is now handled by useSchedule hook
  // It auto-refreshes every second and calculates currentTrackInfo and scheduledTrackId

  // IoT Service removed - using hooks architecture

  // IoT broadcast removed - using hooks architecture now

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeDisplay(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // IoT command handlers removed - direct hook usage now

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
      console.log('📥 loadTrackIntoPlayer called with track:', track.title)
      
      // Load track using hook
      await loadTrack(track as Track)
      
      console.log('✅ Track loaded into player:', track.title)
      console.log('   - Audio URL will be resolved when PLAY is clicked')
    } catch (error) {
      console.error('❌ Failed to load track:', error)
    }
  }

  // determineCurrentPlaylist removed - now using DynamoDB via loadSchedule()

  async function handleLoad() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📥 LOAD BUTTON CLICKED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
      // Use schedule data we already loaded
      console.log('📅 Checking active schedule...')
      await loadSchedule() // Refresh schedule data
      
      if (!activeSlot) {
        throw new Error('No active schedule found for current time')
      }
      
      if (!activeSlot.playlistId) {
        throw new Error('Active schedule has no playlist')
      }
      
      console.log('✅ Active schedule:', activeSlot.name)
      console.log('📋 Playlist ID:', activeSlot.playlistId)
      
      // Set current playlist ID (this will show the playlist!)
      setCurrentPlaylistId(activeSlot.playlistId)
      
      // Find the playlist
      const currentPlaylist = playlists.find(p => p.id === activeSlot.playlistId)
      if (!currentPlaylist) {
        throw new Error('Playlist not found')
      }
      
      console.log('📋 Playlist:', currentPlaylist.name)
      
      // Get playlist tracks
      const { getPlaylist } = await import('../../services/playlists')
      const result = await getPlaylist(activeSlot.playlistId)
      if (!result.data) {
        throw new Error('Could not load playlist')
      }
      
      console.log('📋 Raw playlist data:', result.data)
      console.log('   tracks type:', typeof result.data.tracks)
      console.log('   tracks value:', result.data.tracks)
      
      // Parse tracks if it's a JSON string
      let playlistTracks = result.data.tracks
      if (typeof playlistTracks === 'string') {
        console.log('🔧 Parsing tracks from JSON string...')
        playlistTracks = JSON.parse(playlistTracks)
      }
      
      if (!playlistTracks || !Array.isArray(playlistTracks) || playlistTracks.length === 0) {
        throw new Error('Playlist has no tracks')
      }
      
      console.log('📋 Playlist has', playlistTracks.length, 'tracks')
      
      // Debug playlist tracks
      const firstTrack = playlistTracks[0]
      console.log('🔍 First playlist track:', firstTrack)
      console.log('   Fields:', Object.keys(firstTrack))
      console.log('   Sample values:')
      console.log('     - trackId:', firstTrack.trackId)
      console.log('     - id:', firstTrack.id)
      console.log('     - trackTitle:', firstTrack.trackTitle)
      console.log('     - title:', firstTrack.title)
      
      // Calculate current track based on schedule time
      const now = new Date()
      const trackInfo = calculateCurrentTrack(activeSlot, playlistTracks, currentPlaylist.name, now)
      
      if (!trackInfo) {
        throw new Error('No track playing at current time')
      }
      
      console.log('🎯 Current track index:', trackInfo.trackIndex)
      console.log('🎵 Track:', trackInfo.track.trackTitle)
      console.log('🔍 Track object:', trackInfo.track)
      console.log('   - trackId:', trackInfo.track.trackId)
      console.log('   - trackTitle:', trackInfo.track.trackTitle)
      console.log('   - trackArtist:', trackInfo.track.trackArtist)
      
      // Current track info is now managed by useSchedule hook
      // It's available via currentTrackInfo from the hook
      
      // Load the actual track data
      console.log('🔍 Looking for track with ID:', trackInfo.track.trackId)
      const { data: tracks } = await listTracks()
      console.log('📚 Total tracks in library:', tracks?.length || 0)
      
      if (tracks && tracks.length > 0) {
        console.log('🔍 First few track IDs:')
        tracks.slice(0, 3).forEach((t: any) => console.log('   -', t.id, t.title))
      }
      
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
          console.log('✅ Found track by title fallback:', trackByTitle.title)
          await loadTrackIntoPlayer(trackByTitle)
          console.log('✅✅✅ LOAD COMPLETE (via title match)! ✅✅✅')
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
        console.log('💾 PlayerState saved (LOAD) - status: idle (ready)')
      }
      
      console.log('✅✅✅ LOAD COMPLETE! ✅✅✅')
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
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
  
  // Execute PAUSE when command comes from IoT
  async function executePause() {
    console.log('⚙️ Executing PAUSE...')
    
    if (!audioRef.current || !isPlaying) return
    
    pause()
    
    // Publish PAUSED state
    await iotServiceRef.current?.publishState(PlayerState.PAUSED, {
      trackId: currentTrack?.id,
      position: audioRef.current.currentTime,
      duration: audioRef.current.duration
    })
    
    // Save to PlayerState
    if (playerStateId && currentTrack) {
      const stateData = {
        playerId,
        status: 'paused' as const,
        lastPosition: audioRef.current.currentTime,
        volume,
        autoPlayEnabled: autoPlay
      }
      await saveState(stateData)
      console.log('💾 PlayerState saved (PAUSE) at', Math.round(audioRef.current.currentTime), 'seconds')
    }
    
    console.log('✅ Paused')
  }

  function handlePlay() {
    console.log('▶️ PLAY button clicked - executing locally...')
    // PLAY is local - no IoT needed, just control the audio element
    executePlay()
  }
  
  // Execute PLAY when command comes from IoT
  async function executePlay() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚙️ EXECUTING PLAY COMMAND')
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
        _setIsPlaying(true)
        _setIsPaused(false)
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
        _setDuration(audio.duration)
        audio.volume = volume
        console.log('🔊 Volume set to:', volume)
      })
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      
      audio.addEventListener('ended', () => {
        console.log('🏁 ENDED - Track finished playing')
        _setIsPlaying(false)
        _setIsPaused(false)
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
        _setIsPlaying(false)
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
      _setIsPlaying(true)
      _setIsPaused(false)
      
      // Save to backend PlayerState
      if (playerStateId) {
        const stateData = {
          playerId,
          currentTrackId: currentTrack.id,
          currentTrackTitle: currentTrack.title || undefined,
          currentTrackArtist: currentTrack.artist || undefined,
          currentPlaylistId: currentPlaylistId || undefined,
          status: 'playing' as const,
          lastPosition: audio.currentTime,
          duration: audio.duration,
          volume,
          autoPlayEnabled: autoPlay,
          currentScheduleSlotId: activeSlot?.id,
          currentScheduleSlotName: activeSlot?.name
        }
        await saveState(stateData)
        console.log('💾 Backend PlayerState saved (PLAY) - status: playing')
      }
      
      // Publish PLAYING state to IoT
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

  function handleStop() {
    console.log('⏹️ STOP button clicked - executing locally...')
    // STOP is local - no IoT needed, just stop the audio element
    executeStop()
  }
  
  // Execute STOP when command comes from IoT
  async function executeStop() {
    console.log('⚙️ Executing STOP...')
    
    if (!audioRef.current) return
    stop()
    
    // Publish STOPPED state
    await iotServiceRef.current?.publishState(PlayerState.STOPPED, {
      trackId: currentTrack?.id,
      position: 0
    })
    
    // Save to PlayerState
    if (playerStateId && currentTrack) {
      const stateData = {
        playerId,
        status: 'stopped' as const,
        lastPosition: 0,
        volume,
        autoPlayEnabled: autoPlay
      }
      await saveState(stateData)
      console.log('💾 PlayerState saved (STOP)')
    }
    
    console.log('✅ Stopped')
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
        
        // TODO: Send keyboard seek to IoT
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
        
        {/* IoT Connection Status - DISABLED */}
        {false && (
        <div className="mb-4 bg-gradient-to-r from-green-900 to-teal-900 rounded-xl shadow-lg border border-white/20 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🌐 Central IoT Connection
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/50">
                SHARED
              </span>
            </h3>
            <IoTConnectionStatus showDetails={true} className="text-white" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white/10 rounded p-2 border border-white/20">
              <div className="text-green-300 text-xs mb-1">Status</div>
              <div className="text-white font-semibold">
                {iotContextConnected ? '✅ Connected' : '❌ Disconnected'}
              </div>
            </div>
            <div className="bg-white/10 rounded p-2 border border-white/20">
              <div className="text-green-300 text-xs mb-1">Uptime</div>
              <div className="text-white font-semibold">
                {connectionUptime ? `${Math.floor(connectionUptime / 60)}m ${connectionUptime % 60}s` : 'N/A'}
              </div>
            </div>
            <div className="bg-white/10 rounded p-2 border border-white/20">
              <div className="text-green-300 text-xs mb-1">Last Ping</div>
              <div className="text-white font-semibold">
                {lastPingTime ? `${Math.floor((Date.now() - lastPingTime) / 1000)}s ago` : 'N/A'}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            📍 Player ID: <span className="font-mono text-white/80">{playerId}</span>
            {' '} • This connection is shared across the entire app
          </div>
        </div>
        )}
        
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
        {/* Player + IoT Log Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main Player - 2 columns */}
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
                {/* IoT Status Indicator */}
                <IoTStatusIndicator />
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
              onUnload={handleUnload}
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

      {/* Logs - Right Column (Split into 2) */}
      <div className="lg:col-span-1 space-y-4">
        {/* IoT Logs */}
        <div className="bg-gray-900 rounded-xl shadow-lg border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-blue-900/50 to-purple-900/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                📡 IoT Messages
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                  {iotLogs.length}
                </span>
              </h3>
              <button
                onClick={() => {
                  iotServiceRef.current?.clearLogs()
                  setIoTLogs([])
                }}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="p-3 max-h-[150px] overflow-y-auto bg-black/30">
            {iotLogs.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No IoT messages yet
              </div>
            ) : (
              <div className="space-y-2">
                {iotLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-xs border-l-2 ${
                      log.direction === 'OUT' 
                        ? 'bg-blue-900/20 border-blue-500' 
                        : 'bg-green-900/20 border-green-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.direction === 'OUT' 
                            ? 'text-blue-400 bg-blue-900/30' 
                            : 'text-green-400 bg-green-900/30'
                        }`}>
                          {log.direction === 'OUT' ? '📤' : '📥'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.type === 'command' 
                            ? 'text-purple-400 bg-purple-900/30' 
                            : log.type === 'state'
                            ? 'text-yellow-400 bg-yellow-900/30'
                            : 'text-gray-400 bg-gray-900/30'
                        }`}>
                          {log.type || 'data'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mb-1 truncate">
                      {log.topic}
                    </div>
                    <pre className="text-[10px] text-gray-300 overflow-x-auto whitespace-pre-wrap break-all max-h-20">
                      {JSON.stringify(log.message, null, 1)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Console Logs */}
        <div className="bg-gray-900 rounded-xl shadow-lg border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-green-900/50 to-teal-900/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                💻 Console Logs
                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                  {consoleLogs.length}
                </span>
              </h3>
              <button
                onClick={() => setConsoleLogs([])}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="p-3 max-h-[300px] overflow-y-auto bg-black/30">
            {consoleLogs.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No console logs yet
              </div>
            ) : (
              <div className="space-y-1">
                {consoleLogs.slice(-20).reverse().map((log, idx) => (
                  <div
                    key={idx}
                    className={`text-xs font-mono p-2 rounded border ${
                      log.type === 'error' 
                        ? 'bg-red-900/20 border-red-500/30 text-red-300'
                        : log.type === 'warn'
                        ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300'
                        : 'bg-gray-800/50 border-gray-700/50 text-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="flex-1 break-all">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
            console.log('📋 Playlist tracks loaded:', tracks.length)
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
                  console.log(`✅ Track loaded from playlist: ${track.title}`)
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
