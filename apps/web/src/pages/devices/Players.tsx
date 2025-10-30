import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import IoTLogModal from '../../components/IoTLogModal'
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
import { getPlayerState, savePlayerState, updatePlayerPosition, clearPlayerState } from '../../services/playerState'
import type { PlayerStateData } from '../../services/playerState'

// Schedule data is now loaded from DynamoDB via loadScheduleAndDeterminePlaylist()

function Players() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [volume, setVolume] = useState(0.7)
  
  // Seekbar state
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const seekbarRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
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
  
  // PlayerState for persistence
  const [playerStateId, setPlayerStateId] = useState<string | null>(null)
  const [isRestoringState, setIsRestoringState] = useState(false)
  const [backendPlayerState, setBackendPlayerState] = useState<any>(null)
  
  // Console logs capture
  const [consoleLogs, setConsoleLogs] = useState<Array<{type: string, message: string, timestamp: Date}>>([])
  const maxConsoleLogs = 50
  
  // Station mode (IoT-driven vs Manual)
  const [stationMode, setStationMode] = useState<'manual' | 'station'>('manual')
  const [scheduledPlayback, setScheduledPlayback] = useState<NodeJS.Timeout | null>(null)

  // Intercept console logs
  useEffect(() => {
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    console.log = (...args) => {
      originalLog.apply(console, args)
      setConsoleLogs(prev => [...prev.slice(-maxConsoleLogs), {
        type: 'log',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        timestamp: new Date()
      }])
    }

    console.warn = (...args) => {
      originalWarn.apply(console, args)
      setConsoleLogs(prev => [...prev.slice(-maxConsoleLogs), {
        type: 'warn',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        timestamp: new Date()
      }])
    }

    console.error = (...args) => {
      originalError.apply(console, args)
      setConsoleLogs(prev => [...prev.slice(-maxConsoleLogs), {
        type: 'error',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        timestamp: new Date()
      }])
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    }
  }, [maxConsoleLogs])

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
        
        setPlayerStateId(data.id)
        setBackendPlayerState(data) // Show in UI
        console.log('✅ PlayerState loaded:', data.id)
        
        // Restore state if was playing/paused
        if (data.status === 'paused' && data.currentTrackId && data.lastPosition > 0) {
          console.log('🔄 Restoring playback state...')
          console.log('   Track:', data.currentTrackTitle)
          console.log('   Position:', Math.round(data.lastPosition), 'seconds')
          
          setIsRestoringState(true)
          
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
              setIsRestoringState(false)
            }, 1000)
          }
        }
        
        // Restore volume
        if (data.volume) {
          setVolume(data.volume)
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

  // IoT Service - PERSISTENT setup (only once per playerId)
  useEffect(() => {
    let unsubscribeLog: (() => void) | null = null
    let unsubscribeCommands: (() => void) | null = null
    let isSubscribed = false
    
    // Skip if already initialized for this playerId
    if (iotServiceRef.current) {
      console.log('♻️ IoT service already exists, re-using it')
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔌 INITIALIZING IoT SERVICE (ONCE)')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('Player ID:', playerId)
      
      iotServiceRef.current = createRadioPlayerIoT(playerId)
      console.log('✅ IoT service created')
    }
    
    // Register log callback (persistent)
    console.log('📝 Registering log callback')
    unsubscribeLog = iotServiceRef.current.onLog((log) => {
      console.log('🔔 New log entry:', log.type)
      setIoTLogs(prev => [log, ...prev.slice(0, 99)])
    })
    
    // Subscribe to commands (IoT → Player)
    console.log('🎧 Setting up command subscription...')
    console.log('📡 Topic: radio/player/' + playerId + '/command')
    
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
      console.log('🧹 Component unmounting - cleaning up IoT service')
      unsubscribeLog()
      if (unsubscribeCommands) {
        unsubscribeCommands()
      }
      // Full cleanup of IoT service
      if (iotServiceRef.current) {
        iotServiceRef.current.cleanup()
        iotServiceRef.current = null
      }
    }
  }, [playerId]) // Only re-run if playerId changes

  // Station Broadcast Subscription (IoT-driven playback)
  useEffect(() => {
    if (!iotServiceRef.current) return
    
    console.log('📻 Setting up Station Broadcast subscription...')
    
    let isActive = true
    let subscription: any = null
    
    async function setupStationSubscription() {
      if (!isActive) return
      
      try {
        const { subscribe } = await import('../../services/pubsub')
        subscription = await subscribe(
          { topic: 'radio/station/current-track' },
          async (message: any) => {
            if (!isActive) return
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('📻 STATION BROADCAST RECEIVED')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log('Command:', message.command)
            console.log('Track:', message.track?.title)
            console.log('Mode:', message.mode || 'station')
            
            if (message.command === 'LOAD_AND_SCHEDULE') {
              // Cancel any existing scheduled playback
              if (scheduledPlayback) {
                console.log('⏹️ Cancelling previous scheduled playback')
                clearTimeout(scheduledPlayback)
                setScheduledPlayback(null)
              }
              
              // Switch to station mode
              setStationMode('station')
              
              // Load track
              console.log('📥 Loading track from station...')
              await loadTrackIntoPlayer(message.track)
              
              // Set playlist context
              if (message.playlist?.id) {
                setCurrentPlaylistId(message.playlist.id)
              }
              
              // Calculate timing
              const startTime = new Date(message.timing.startAt)
              const now = new Date()
              const delay = startTime.getTime() - now.getTime()
              
              console.log('⏱️ Start scheduled at:', message.timing.startAt)
              console.log('   Current time:', now.toISOString())
              console.log('   Delay:', Math.round(delay / 1000), 'seconds')
              
              // Schedule playback with 5-sec buffer
              if (delay > 0) {
                console.log('🎯 Scheduling playback in', Math.round(delay / 1000), 'seconds')
                
                const timeout = setTimeout(() => {
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                  console.log('🎵 STARTING STATION PLAYBACK!')
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                  
                  if (audioRef.current) {
                    audioRef.current.play()
                    setIsPlaying(true)
                    setIsPaused(false)
                    
                    // Save state
                    if (playerStateId) {
                      savePlayerState(playerStateId, {
                        playerId,
                        currentTrackId: message.track.id,
                        currentTrackTitle: message.track.title,
                        currentTrackArtist: message.track.artist,
                        currentPlaylistId: message.playlist?.id,
                        status: 'playing',
                        lastPosition: 0,
                        duration: message.track.duration,
                        volume,
                        autoPlayEnabled: autoPlay
                      })
                    }
                  }
                }, delay)
                
                setScheduledPlayback(timeout)
              } else {
                console.warn('⚠️ Start time has passed! Starting immediately')
                if (audioRef.current) {
                  audioRef.current.play()
                  setIsPlaying(true)
                  setIsPaused(false)
                }
              }
            }
          }
        )
        
        console.log('✅ Station broadcast subscription active')
      } catch (error) {
        console.error('❌ Failed to subscribe to station broadcast:', error)
      }
    }
    
    setupStationSubscription()
    
    return () => {
      console.log('🧹 Cleaning up station broadcast subscription')
      isActive = false
      if (subscription?.unsubscribe) {
        subscription.unsubscribe()
      }
    }
  }, []) // Empty deps - only setup once on mount

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
    console.log('📦 Full command params:', JSON.stringify(command.params, null, 2))

    switch (command.command) {
      case 'LOAD':
        if (command.params?.track) {
          // Extract playlist info from Lambda response
          if (command.params.playlist?.id) {
            console.log('📋 Setting playlistId from LOAD command:', command.params.playlist.id)
            setCurrentPlaylistId(command.params.playlist.id)
          } else {
            console.warn('⚠️ No playlist.id in LOAD command params!')
            console.log('   command.params:', command.params)
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
          
          // Extract current track info from Lambda response (for purple/green highlighting)
          if (command.params.currentTrack) {
            console.log('🎯 Setting currentTrackInfo from LOAD command:', {
              index: command.params.currentTrack.index,
              position: command.params.currentTrack.position,
              percentComplete: command.params.currentTrack.percentComplete
            })
            setCurrentTrackInfo({
              trackIndex: command.params.currentTrack.index,
              track: {
                trackId: command.params.track.id,
                trackTitle: command.params.track.title,
                trackArtist: command.params.track.artist,
                order: command.params.currentTrack.index
              } as any,
              playlistName: command.params.playlist?.name || '',
              slotName: command.params.schedule?.name || '',
              slotStartTime: command.params.schedule?.startTime || '',
              trackStartTime: command.params.currentTrack.startTime,
              trackEndTime: command.params.currentTrack.endTime,
              percentComplete: command.params.currentTrack.percentComplete,
              elapsedInTrack: 0,
              remainingInTrack: 0
            } as any)
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
      
      // Set current track info for purple/green highlighting
      setCurrentTrackInfo(trackInfo)
      
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
        await savePlayerState(playerStateId, stateData)
        setBackendPlayerState({...stateData, id: playerStateId, lastUpdated: new Date().toISOString()})
        console.log('💾 PlayerState saved (LOAD) - status: idle (ready)')
      }
      
      console.log('✅✅✅ LOAD COMPLETE! ✅✅✅')
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } catch (error) {
      console.error('❌ Failed to load track:', error)
      alert(`❌ Failed to load track: ${error}`)
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
    
    // Save to PlayerState
    if (playerStateId && currentTrack) {
      const stateData = {
        playerId,
        status: 'paused' as const,
        lastPosition: audioRef.current.currentTime,
        volume,
        autoPlayEnabled: autoPlay
      }
      await savePlayerState(playerStateId, stateData)
      setBackendPlayerState((prev: any) => ({...prev, ...stateData, lastUpdated: new Date().toISOString()}))
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
        await savePlayerState(playerStateId, stateData)
        setBackendPlayerState({...stateData, id: playerStateId, lastUpdated: new Date().toISOString()})
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
    
    // Save to PlayerState
    if (playerStateId && currentTrack) {
      const stateData = {
        playerId,
        status: 'stopped' as const,
        lastPosition: 0,
        volume,
        autoPlayEnabled: autoPlay
      }
      await savePlayerState(playerStateId, stateData)
      setBackendPlayerState((prev: any) => ({...prev, ...stateData, lastUpdated: new Date().toISOString()}))
      console.log('💾 PlayerState saved (STOP)')
    }
    
    console.log('✅ Stopped')
  }

  function toggleAuto() {
    setAutoPlay(!autoPlay)
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current) return
    
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percentage = Math.max(0, Math.min(1, x / bounds.width))
    const newTime = percentage * duration
    
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
    
    // TODO: Send seek position to IoT for sync (optional)
  }
  
  function handleSeekMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    setIsDragging(true)
    handleSeek(e)
  }
  
  function handleSeekMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    // Show hover preview
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percentage = Math.max(0, Math.min(1, x / bounds.width))
    const time = percentage * duration
    
    setHoverTime(time)
    setHoverPosition(x)
    
    // Update position if dragging
    if (isDragging) {
      handleSeek(e)
    }
  }
  
  function handleSeekMouseUp() {
    if (isDragging) {
      setIsDragging(false)
      // TODO: Send final seek position to IoT
    }
  }
  
  function handleSeekMouseLeave() {
    setHoverTime(null)
    setHoverPosition(null)
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
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
  
  // Global mouse up handler for drag
  useEffect(() => {
    function handleGlobalMouseUp() {
      if (isDragging) {
        setIsDragging(false)
      }
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragging])
  
  // 5-minute checkpoint while playing
  useEffect(() => {
    if (!isPlaying || !playerStateId || !currentTrack) return
    
    const interval = setInterval(() => {
      if (audioRef.current) {
        console.log('💾 5-minute checkpoint:', Math.round(audioRef.current.currentTime), 'seconds')
        updatePlayerPosition(playerStateId, audioRef.current.currentTime)
      }
    }, 5 * 60 * 1000) // 5 minutes
    
    return () => clearInterval(interval)
  }, [isPlaying, playerStateId, currentTrack])
  
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
              <button
                onClick={() => setBackendPlayerState(null)}
                className="text-white/60 hover:text-white text-sm"
              >
                ✕
              </button>
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
                  <div className="relative">
                    <div 
                      ref={seekbarRef}
                      className={`h-3 bg-white/10 rounded-full cursor-pointer overflow-visible mb-2 relative ${isDragging ? 'scale-y-125' : ''} transition-transform`}
                      onMouseDown={handleSeekMouseDown}
                      onMouseMove={handleSeekMouseMove}
                      onMouseUp={handleSeekMouseUp}
                      onMouseLeave={handleSeekMouseLeave}
                    >
                      {/* Progress */}
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all rounded-full"
                        style={{ width: `${progress}%`, transitionDuration: isDragging ? '0ms' : '100ms' }}
                      />
                      
                      {/* Thumb */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-all"
                        style={{ 
                          left: `${progress}%`,
                          transform: `translate(-50%, -50%) scale(${isDragging ? 1.3 : 1})`,
                          boxShadow: isDragging ? '0 0 0 4px rgba(255,255,255,0.3)' : '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                      
                      {/* Hover Preview */}
                      {hoverTime !== null && hoverPosition !== null && !isDragging && (
                        <div 
                          className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
                          style={{ left: `${hoverPosition}px` }}
                        >
                          {formatTime(hoverTime)}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-sm text-blue-300">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-xs opacity-75">⌨️ ←/→: ±5s | Shift+←/→: ±30s</span>
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
