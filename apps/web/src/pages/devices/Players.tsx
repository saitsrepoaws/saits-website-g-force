import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import { listPlaylists } from '../../services/playlists'
import { listTracks } from '../../services/tracks'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist } from '../../types/playlist'

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

  useEffect(() => {
    loadPlaylists()
    determineCurrentPlaylist()
  }, [])

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

  async function loadSampleTrack() {
    try {
      const { data: tracks } = await listTracks()
      if (tracks && tracks.length > 0) {
        const track = tracks[0]
        await loadTrackIntoPlayer(track as Track)
      }
    } catch (error) {
      console.error('Failed to load tracks:', error)
    }
  }

  async function loadTrackIntoPlayer(track: any) {
    try {
      // Create a new track object with resolved URLs
      const resolvedTrack: Track = { ...track }
      
      // Load audio URL from S3
      if (track.audioUrl) {
        try {
          const url = await getUrl({ path: track.audioUrl })
          resolvedTrack.audioUrl = url.url.toString()
          console.log('Audio URL resolved:', resolvedTrack.audioUrl)
        } catch (e) {
          console.error('Audio not found:', e)
          resolvedTrack.audioUrl = null
        }
      }
      
      // Load cover art
      if (track.coverArtUrl) {
        try {
          const url = await getUrl({ path: track.coverArtUrl })
          setCoverArtUrl(url.url.toString())
        } catch (e) {
          console.log('Cover art not found')
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
        } catch (e) {
          console.log('Waveform not found')
          setWaveformUrl(null)
        }
      } else {
        setWaveformUrl(null)
      }

      // Set the resolved track
      setCurrentTrack(resolvedTrack)
      
      // Mark as loaded
      setIsLoaded(true)
      
      console.log('Track loaded:', resolvedTrack.title, 'Audio ready:', !!resolvedTrack.audioUrl)
    } catch (error) {
      console.error('Failed to load track:', error)
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
    // Load track from library
    await loadSampleTrack()
    
    if (currentTrack) {
      setIsLoaded(true)
      alert(`✅ Track loaded: ${currentTrack.title}`)
    }
  }

  function handleUnload() {
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
    
    alert('⏏️ Track unloaded')
  }

  function handlePause() {
    if (!audioRef.current || !isPlaying) return
    
    audioRef.current.pause()
    setIsPlaying(false)
    setIsPaused(true)
  }

  async function handlePlay() {
    if (!audioRef.current || !isLoaded) {
      console.warn('Cannot play: audio not ready or track not loaded')
      return
    }
    
    try {
      await audioRef.current.play()
      setIsPlaying(true)
      setIsPaused(false)
      console.log('Playback started')
    } catch (error) {
      console.error('Playback failed:', error)
      alert('⚠️ Playback failed. Audio file may not be available.')
    }
  }

  function togglePlay() {
    if (!audioRef.current) return
    
    if (isPlaying) {
      handlePause()
    } else {
      handlePlay()
    }
  }

  function handleStop() {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentTime(0)
  }

  function toggleAuto() {
    setAutoPlay(!autoPlay)
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      setDuration(audioRef.current.duration || 0)
    }
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

          {/* Audio Element */}
          {currentTrack?.audioUrl && (
            <audio
              ref={audioRef}
              src={currentTrack.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                setIsPlaying(false)
                setIsPaused(false)
                console.log('Track ended')
              }}
              onLoadedMetadata={() => {
                console.log('Audio metadata loaded, duration:', audioRef.current?.duration)
                if (audioRef.current) {
                  audioRef.current.volume = volume
                }
              }}
              onError={(e) => {
                console.error('Audio error:', e)
                alert('⚠️ Failed to load audio file')
              }}
              onCanPlay={() => {
                console.log('Audio ready to play')
              }}
            />
          )}
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
      </div>
    </Layout>
  )
}

export default Players
