import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import IoTLogModal from '../../components/IoTLogModal'
import { listPlaylists } from '../../services/playlists'
import { listTracks } from '../../services/tracks'
import { getUrl } from 'aws-amplify/storage'
import { generateClient } from 'aws-amplify/data'
import { createRadioPlayerIoT } from '../../services/radioPlayerIoT'
import { PlayerState } from '../../types/player'
import type { Playlist } from '../../types/playlist'
import type { IoTLogEntry } from '../../services/radioPlayerIoT'

// Lazy client for Amplify
const getClient = () => generateClient()

interface Track {
  id: string
  title?: string | null
  artist?: string | null
  album?: string | null
  genre?: string | null
  year?: number | null
  bpm?: number | null
  key?: string | null
  energy?: number | null
  danceability?: number | null
  valence?: number | null
  duration?: number | null
  audioUrl?: string | null
  coverArtUrl?: string | null
  waveformUrl?: string | null
}

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

  useEffect(() => {
    loadPlaylists()
    determineCurrentPlaylist()
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
    const unsubscribe = iotServiceRef.current.onLog((log) => {
      console.log('🔔 Log callback triggered!', log.type)
      setIoTLogs(prev => [log, ...prev.slice(0, 99)])
    })
    
    // Get existing logs
    const existingLogs = iotServiceRef.current.getLogs()
    console.log('📚 Loading existing logs:', existingLogs.length)
    setIoTLogs(existingLogs)
    
    // Cleanup: only unsubscribe callback, don't cleanup service
    return () => {
      console.log('🧹 Unsubscribing log callback')
      unsubscribe()
    }
  }, [playerId])

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeDisplay(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // TEST FUNCTION - Direct IoT test
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

  async function loadTrackIntoPlayer(track: any) {
    try {
      console.log('📥 loadTrackIntoPlayer called with track:', track.title)
      console.log('📋 Track has fileUrl:', !!(track as any).fileUrl)
      console.log('📋 Track has audioUrl:', !!track.audioUrl)
      
      // Store track AS-IS (don't resolve audio URL yet - we do that in handlePlay)
      setCurrentTrack(track as Track)
      
      // Load cover art
      if (track.coverArtUrl) {
        try {
          const url = await getUrl({ path: track.coverArtUrl })
          setCoverArtUrl(url.url.toString())
          console.log('✅ Cover art loaded')
        } catch (e) {
          console.log('⚠️ Cover art not found')
          setCoverArtUrl(null)
        }
      } else {
        setCoverArtUrl(null)
      }

      // Load waveform
      if (track.waveformUrl) {
        try {
          const url = await getUrl({ path: track.waveformUrl })
          setWaveformUrl(url.url.toString())
          console.log('✅ Waveform loaded')
        } catch (e) {
          console.log('⚠️ Waveform not found')
          setWaveformUrl(null)
        }
      } else {
        setWaveformUrl(null)
      }

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
    
    // Load first track from current playlist
    if (!currentPlaylistId) {
      console.error('❌ No playlist selected')
      alert('⚠️ No playlist selected')
      return
    }

    console.log('📋 Current playlist ID:', currentPlaylistId)

    try {
      // Publish LOADING state
      console.log('📤 Publishing LOADING state...')
      await iotServiceRef.current?.publishState(PlayerState.LOADING, {
        playlistId: currentPlaylistId
      })

      console.log('🔍 Fetching playlist data...')
      // @ts-ignore - Playlist model exists at runtime
      const { data: playlistData } = await getClient().models.Playlist.get({ id: currentPlaylistId })
      console.log('✅ Playlist data received:', playlistData)
      
      if (!playlistData?.tracks) {
        console.error('❌ Playlist has no tracks')
        alert('⚠️ Playlist has no tracks')
        await iotServiceRef.current?.publishState(PlayerState.ERROR, {
          error: 'Playlist has no tracks'
        })
        return
      }

      console.log('📊 Playlist has', playlistData.tracks.length, 'tracks')

      // Sort tracks by order (ascending)
      const sortedTracks = [...playlistData.tracks].sort((a, b) => {
        return (a.order ?? 0) - (b.order ?? 0)
      })

      const firstPlaylistTrack = sortedTracks[0]

      console.log('🎵 First track in playlist:', firstPlaylistTrack)
      console.log('   - trackId:', firstPlaylistTrack.trackId)
      console.log('   - order:', firstPlaylistTrack.order)

      // Load the actual track data
      if (firstPlaylistTrack.trackId) {
        console.log('🔍 Fetching track from library...')
        const { data: tracks } = await listTracks()
        console.log('📚 Total tracks in library:', tracks?.length || 0)
        
        const track = tracks?.find((t: any) => t.id === firstPlaylistTrack.trackId)
        console.log('🎵 Found track:', track ? track.title : 'NOT FOUND')
        
        if (track) {
          console.log('📥 Loading track into player...')
          await loadTrackIntoPlayer(track)
          
          console.log('📤 Publishing LOADED state...')
          // Publish LOADED state
          await iotServiceRef.current?.publishState(PlayerState.LOADED, {
            trackId: track.id,
            playlistId: currentPlaylistId,
            duration: track.duration || 0
          })
          
          console.log('✅✅✅ TRACK LOADED SUCCESSFULLY! ✅✅✅')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          alert(`✅ Track #1 loaded from playlist: ${track.title}`)
        } else {
          console.error('❌ Track not found in library')
          alert('⚠️ Track not found in library')
          await iotServiceRef.current?.publishState(PlayerState.ERROR, {
            error: 'Track not found in library'
          })
        }
      } else {
        console.error('❌ No trackId in playlist track')
      }
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌❌❌ LOAD FAILED ❌❌❌')
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
        {/* Main Player */}
        <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl overflow-hidden mb-6">
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">🎵 Now Playing</h2>
                <p className="text-blue-200">Live Audio Player</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Track Remaining Time (Countdown) */}
                {isPlaying && duration > 0 && (
                  <div className="px-4 py-2 bg-red-500/20 backdrop-blur-sm rounded-lg border border-red-500/50">
                    <div className="text-xs text-red-300 font-semibold mb-1">REMAINING</div>
                    <div className="text-white font-mono text-lg font-bold">
                      -{formatTime(duration - currentTime)}
                    </div>
                  </div>
                )}

                {/* Track Elapsed Time */}
                {isPlaying && (
                  <div className="px-4 py-2 bg-blue-500/20 backdrop-blur-sm rounded-lg border border-blue-500/50">
                    <div className="text-xs text-blue-300 font-semibold mb-1">ELAPSED</div>
                    <div className="text-white font-mono text-lg font-bold">
                      {formatTime(currentTime)}
                    </div>
                  </div>
                )}

                {/* Track Duration */}
                {currentTrack && (
                  <div className="px-4 py-2 bg-purple-500/20 backdrop-blur-sm rounded-lg border border-purple-500/50">
                    <div className="text-xs text-purple-300 font-semibold mb-1">DURATION</div>
                    <div className="text-white font-mono text-lg font-bold">
                      {formatTime(duration)}
                    </div>
                  </div>
                )}

                {/* Current Time */}
                <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                  <div className="text-xs text-gray-400 font-semibold mb-1">TIME</div>
                  <div className="text-white font-mono text-lg font-bold">
                    {currentTimeDisplay.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>

                {/* Live Indicator */}
                {isPlaying && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/20 rounded-lg border border-red-500/50">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-400 text-sm font-semibold">LIVE</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-3 gap-8">
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
                  <h3 className="text-4xl font-bold text-white mb-2">
                    {currentTrack?.title || 'No Track Loaded'}
                  </h3>
                  <p className="text-2xl text-blue-200 mb-4">
                    {currentTrack?.artist || (currentTrack ? 'Unknown Artist' : 'Click LOAD to start')}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-blue-300 mb-6">
                    {currentTrack?.album && <span>💿 {currentTrack.album}</span>}
                    {currentTrack?.year && <span>📅 {currentTrack.year}</span>}
                    {currentTrack?.genre && (
                      <span className="px-3 py-1 bg-white/10 rounded-full">
                        {currentTrack.genre}
                      </span>
                    )}
                  </div>

                  {/* Audio Features */}
                  <div className="grid grid-cols-5 gap-3 mb-6">
                    {currentTrack?.bpm && (
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-300 mb-1">BPM</div>
                        <div className="text-xl font-bold text-white">{currentTrack.bpm}</div>
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
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

        {!currentPlaylistId && playlists.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500 mb-4">No scheduled playlist for current time</p>
            <select
              onChange={(e) => setCurrentPlaylistId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a playlist...</option>
              {playlists.map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* IoT Log Window - Always visible under player */}
        <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                📡 IoT Message Log
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Player: <span className="font-mono font-medium">{playerId}</span> • {iotLogs.length} messages
              </p>
            </div>
            <button
              onClick={() => {
                iotServiceRef.current?.clearLogs()
                setIoTLogs([])
              }}
              className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              🧹 Clear
            </button>
          </div>

          <div className="p-4 h-96 overflow-y-auto">
            {iotLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No messages yet. Click 🧪 TEST IoT to start!
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {iotLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-l-4 ${
                      log.direction === 'OUT' 
                        ? 'bg-blue-900/20 border-blue-500' 
                        : 'bg-green-900/20 border-green-500'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          log.direction === 'OUT' 
                            ? 'text-blue-400 bg-blue-900/30' 
                            : 'text-green-400 bg-green-900/30'
                        }`}>
                          {log.direction === 'OUT' ? '📤' : '📥'} {log.direction}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${
                          log.type === 'state' ? 'bg-purple-600' :
                          log.type === 'command' ? 'bg-orange-600' :
                          log.type === 'track' ? 'bg-blue-600' :
                          log.type === 'status' ? 'bg-green-600' :
                          'bg-gray-600'
                        }`}>
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString('nl-NL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            fractionalSecondDigits: 3
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Topic */}
                    <div className="text-xs text-gray-400 mb-2">
                      📍 {log.topic}
                    </div>

                    {/* Message */}
                    <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.message, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
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
