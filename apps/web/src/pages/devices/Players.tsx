import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import IoTLogModal from '../../components/IoTLogModal'
import IoTLogPanel from '../../components/IoTLogPanel'
import IoTStatusIndicator from '../../components/IoTStatusIndicator'
import { listPlaylists } from '../../services/playlists'
import { createRadioPlayerIoT } from '../../services/radioPlayerIoT'
import { loadScheduleAndDeterminePlaylist } from '../../services/scheduleService'
import { loadTrackAssets } from '../../services/playerService'
import { calculateCurrentTrack } from '../../utils/scheduleCalculator'
import { PlayerState } from '../../types/player'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist } from '../../types/playlist'
import type { IoTLogEntry } from '../../services/radioPlayerIoT'
import type { ScheduleSlot, CurrentTrackInfo } from '../../utils/scheduleCalculator'
import type { Track } from '../../services/playerService'
import { listTracks } from '../../services/tracks'

// Schedule data is now loaded from DynamoDB via loadScheduleAndDeterminePlaylist()

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
  const [scheduledTrackId, setScheduledTrackId] = useState<string | null>(null)
  const [playlistTracksCache, setPlaylistTracksCache] = useState<any[]>([])

  useEffect(() => {
    loadPlaylists()
    loadSchedule()
    
    // Test IoT connection on startup
    import('../../services/pubsub').then(({ testConnect }) => {
      console.log('🔌 Testing IoT connection...')
      testConnect('radio/player/connection-test').then((ok: boolean) => {
        if (ok) {
          console.log('✅ IoT connection test PASSED')
        } else {
          console.error('❌ IoT connection test FAILED')
        }
      })
    })
    
    // Real AWS State Machine is now active via IoT Rule
    // No mock needed - Lambda handles all schedule logic
  }, [])
  
  // Update active slot every minute
  useEffect(() => {
    const interval = setInterval(() => {
      loadSchedule()
    }, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])

  // Calculate scheduled track every second
  useEffect(() => {
    function updateScheduledTrack() {
      if (!activeSlot || !currentPlaylistId || playlistTracksCache.length === 0) {
        setScheduledTrackId(null)
        return
      }

      // Find current playlist
      const currentPlaylist = playlists.find(p => p.id === currentPlaylistId)
      if (!currentPlaylist) {
        setScheduledTrackId(null)
        return
      }

      // Calculate current track
      const trackInfo = calculateCurrentTrack(
        activeSlot,
        playlistTracksCache,
        currentPlaylist.name || 'Playlist'
      )

      if (trackInfo) {
        setCurrentTrackInfo(trackInfo)
        setScheduledTrackId(trackInfo.track.trackId)
        console.log('🎯 Scheduled track:', trackInfo.track.trackTitle, `(${trackInfo.percentComplete}%)`)
      } else {
        setScheduledTrackId(null)
      }
    }

    // Update immediately
    updateScheduledTrack()

    // Then update every second
    const interval = setInterval(updateScheduledTrack, 1000)
    
    return () => clearInterval(interval)
  }, [activeSlot, currentPlaylistId, playlistTracksCache, playlists])

  // IoT Service - PERSISTENT setup (only once)
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔌 INITIALIZING IoT SERVICE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Create IoT service (only once)
    if (!iotServiceRef.current) {
      console.log('🆕 Creating new IoT service for player:', playerId)
      iotServiceRef.current = createRadioPlayerIoT(playerId)
      console.log('✅ IoT service created')
    } else {
      console.log('♻️ IoT service already exists, reusing')
    }
    
    // Register log callback (persistent)
    console.log('📝 Registering log callback')
    const unsubscribeLog = iotServiceRef.current.onLog((log) => {
      console.log('🔔 New log entry:', log.type)
      setIoTLogs(prev => [log, ...prev.slice(0, 99)])
    })
    
    // Subscribe to commands (IoT → Player)
    console.log('🎧 Setting up command subscription...')
    console.log('📡 Topic: radio/player/' + playerId + '/command')
    
    let unsubscribeCommands: (() => void) | null = null
    let isSubscribed = false
    
    const setupSubscription = async () => {
      try {
        console.log('⏳ Subscribing to IoT commands...')
        const unsub = await iotServiceRef.current!.subscribeToCommands((command) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('📥 COMMAND RECEIVED FROM IoT!')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('Command:', command.command)
          console.log('Params:', command.params)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          
          // Execute command
          handleCommand(command)
        })
        
        unsubscribeCommands = unsub
        isSubscribed = true
        console.log('✅ SUBSCRIBED to IoT commands!')
        console.log('📡 Active on: radio/player/' + playerId + '/command')
      } catch (err) {
        console.error('❌ Failed to subscribe:', err)
        
        // Retry after 2 seconds
        console.log('🔄 Retrying subscription in 2s...')
        setTimeout(() => {
          if (!isSubscribed) {
            setupSubscription()
          }
        }, 2000)
      }
    }
    
    setupSubscription()
    
    // Load existing logs
    const existingLogs = iotServiceRef.current.getLogs()
    console.log('📚 Loading', existingLogs.length, 'existing logs')
    setIoTLogs(existingLogs)
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ IoT SERVICE READY')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 Component unmounting - cleaning up subscriptions')
      unsubscribeLog()
      if (unsubscribeCommands) {
        unsubscribeCommands()
      }
    }
  }, [playerId]) // Only re-run if playerId changes

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
          // Extract playlist info from Lambda response
          if (command.params.playlist?.id) {
            console.log('📋 Setting playlistId from LOAD command:', command.params.playlist.id)
            setCurrentPlaylistId(command.params.playlist.id)
          }
          
          // Extract schedule info from Lambda response
          if (command.params.schedule) {
            console.log('📅 Setting schedule info from LOAD command:', command.params.schedule.name)
            setActiveSlot({
              id: command.params.schedule.id,
              name: command.params.schedule.name,
              time: command.params.schedule.startTime,
              playlistId: command.params.playlist?.id || null,
              days: [], // Not used in display
              duration: 60, // Default, could calculate from start/endTime
              active: true
            })
          }
          
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
    console.log('🧪 Testing IoT Commands...')
    try {
      if (!iotServiceRef.current) {
        console.error('❌ IoT service not initialized!')
        alert('❌ IoT service not initialized!')
        return
      }
      
      console.log('📤 Publishing test commands...')
      
      // Test 1: PLAY command
      console.log('1️⃣ Publishing PLAY command...')
      await iotServiceRef.current.publishCommand({
        command: 'PLAY',
        timestamp: new Date().toISOString()
      })
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Test 2: PAUSE command
      console.log('2️⃣ Publishing PAUSE command...')
      await iotServiceRef.current.publishCommand({
        command: 'PAUSE',
        timestamp: new Date().toISOString()
      })
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Test 3: STOP command
      console.log('3️⃣ Publishing STOP command...')
      await iotServiceRef.current.publishCommand({
        command: 'STOP',
        timestamp: new Date().toISOString()
      })
      
      console.log('✅ All test commands published!')
      console.log('👀 Check the IoT Log panel to see the commands!')
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
  
  async function loadSchedule() {
    const result = await loadScheduleAndDeterminePlaylist()
    setScheduleSlots(result.slots)
    setActiveSlot(result.activeSlot)
    
    if (result.playlistId && result.playlistId !== currentPlaylistId) {
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

  // determineCurrentPlaylist removed - now using DynamoDB via loadSchedule()

  async function handleLoad() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📥 LOAD BUTTON CLICKED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    try {
      // IoT-driven: Send LOAD command, backend determines track based on time
      console.log('📤 Publishing LOAD command to IoT...')
      console.log('🎯 Backend will determine playlist AND track based on current time')
      console.log('⏰ Timestamp:', new Date().toISOString())
      
      await iotServiceRef.current?.publishCommand({
        command: 'LOAD',
        timestamp: new Date().toISOString()
        // No params needed! Backend determines everything based on time
      })
      
      console.log('✅ LOAD command published')
      console.log('⏳ Waiting for backend to send track data via IoT...')
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
      console.log(`✅ Track loaded: ${track.title}`)
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
    console.log('⏏️ UNLOAD button clicked - publishing command to IoT...')
    
    try {
      await iotServiceRef.current?.publishCommand({
        command: 'UNLOAD',
        timestamp: new Date().toISOString()
      })
      console.log('✅ UNLOAD command published')
    } catch (error) {
      console.error('❌ Failed to publish UNLOAD command:', error)
    }
  }

  async function handlePause() {
    console.log('⏸️ PAUSE button clicked - executing locally...')
    // PAUSE is local - no IoT needed, just pause the audio element
    executePause()
  }
  
  // Execute UNLOAD when command comes from IoT
  async function executeUnload() {
    console.log('⚙️ Executing UNLOAD...')
    
    // Clear player state
    setIsPlaying(false)
    setIsPaused(false)
    setIsLoaded(false)
    setCurrentTrack(null)
    setCoverArtUrl(null)
    setWaveformUrl(null)
    setCurrentTime(0)
    setDuration(0)
    
    // Publish IDLE state
    await iotServiceRef.current?.publishState(PlayerState.IDLE)
    
    console.log('✅ Track unloaded')
  }
  
  // Execute PAUSE when command comes from IoT
  async function executePause() {
    console.log('⚙️ Executing PAUSE...')
    
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

  function handleStop() {
    console.log('⏹️ STOP button clicked - executing locally...')
    // STOP is local - no IoT needed, just stop the audio element
    executeStop()
  }
  
  // Execute STOP when command comes from IoT
  async function executeStop() {
    console.log('⚙️ Executing STOP...')
    
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
    
    console.log('✅ Stopped')
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
            <div className="grid grid-cols-3 gap-4">
              {/* Left: Cover Art */}
              <div className="col-span-1">
                <div className="aspect-square rounded-2xl overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.6)] bg-gradient-to-br from-purple-500 to-pink-500 relative transform hover:scale-105 transition-transform duration-300 border-4 border-white/20">
                  {coverArtUrl ? (
                    <img 
                      src={coverArtUrl} 
                      alt="Cover Art" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500">
                      <span className="text-8xl mb-4 drop-shadow-2xl">🎵</span>
                      {!currentTrack && (
                        <p className="text-white/90 text-sm font-bold drop-shadow-lg">
                          No track loaded
                        </p>
                      )}
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-center justify-center backdrop-blur-[2px]">
                      <div className="text-white text-6xl animate-pulse drop-shadow-2xl">▶️</div>
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
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/50 transform hover:scale-105 active:scale-95"
                    title="Load track"
                  >
                    📥 LOAD
                  </button>
                  <button
                    onClick={handleUnload}
                    disabled={!isLoaded}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-orange-500/50 transform hover:scale-105 active:scale-95"
                    title="Unload track"
                  >
                    ⏏️ UNLOAD
                  </button>

                  {/* Pause Button */}
                  <button
                    onClick={handlePause}
                    disabled={!isPlaying}
                    className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl font-bold hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-yellow-500/50 transform hover:scale-105 active:scale-95"
                    title="Pause playback"
                  >
                    ⏸️ PAUSE
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
                    className="w-20 h-20 bg-gradient-to-br from-white to-gray-200 rounded-full flex items-center justify-center text-4xl hover:scale-110 transition-all shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_40px_-5px_rgba(255,255,255,0.3)] disabled:from-gray-600 disabled:to-gray-700 disabled:scale-100 disabled:cursor-not-allowed transform active:scale-95 border-4 border-white/30"
                  >
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={handleStop}
                    className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-2xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-red-500/50 transform hover:scale-110 active:scale-95 border-2 border-white/20"
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

    {/* Playlist Viewer - Full Width Below */}
    {currentPlaylistId && (
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
    )}

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
