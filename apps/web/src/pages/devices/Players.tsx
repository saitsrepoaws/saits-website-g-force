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
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadPlaylists()
    loadSampleTrack()
    determineCurrentPlaylist()
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
        setCurrentTrack(track as Track)
        
        // Load cover art
        if (track.coverArtUrl) {
          try {
            const url = await getUrl({ path: track.coverArtUrl })
            setCoverArtUrl(url.url.toString())
          } catch (e) {
            console.log('Cover art not found')
          }
        }

        // Load waveform
        if (track.waveformUrl) {
          try {
            const url = await getUrl({ path: track.waveformUrl })
            setWaveformUrl(url.url.toString())
          } catch (e) {
            console.log('Waveform not found')
          }
        }
      }
    } catch (error) {
      console.error('Failed to load tracks:', error)
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

  function togglePlay() {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleStop() {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
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
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full">
                  <span className="text-white font-mono text-sm">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
                {isPlaying && (
                  <div className="flex items-center gap-2">
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
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-8xl">🎵</span>
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
                    {currentTrack?.artist || 'Unknown Artist'}
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

                {/* Controls */}
                <div className="flex items-center gap-6">
                  <button
                    onClick={togglePlay}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl hover:scale-110 transition-transform shadow-lg"
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
              onEnded={() => setIsPlaying(false)}
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
              allowReorder={false}
              allowRemove={false}
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
