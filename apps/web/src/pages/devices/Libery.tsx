import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useLiberyDevice } from '../../hooks/useLiberyDevice'
import { LiberyState } from '../../services/liberyStateMachine'
import { listTracks, createTrack, deleteTrack, type Track } from '../../services/tracks'

const DEVICE_ID = 'libery-001'

function Libery() {
  const {
    state,
    context,
    isConnected,
    connect,
    disconnect,
    loadTrack,
    play,
    pause,
    stop,
    setVolume,
  } = useLiberyDevice({ deviceId: DEVICE_ID, autoConnect: true })

  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [newTrack, setNewTrack] = useState({
    title: '',
    artist: '',
    album: '',
    duration: 0,
  })

  // Load tracks from database
  useEffect(() => {
    loadTracksFromDB()
  }, [])

  const loadTracksFromDB = async () => {
    setIsLoadingTracks(true)
    const { data } = await listTracks()
    setTracks(data)
    setIsLoadingTracks(false)
  }

  const handleAddTrack = async () => {
    if (!newTrack.title) return

    const { data } = await createTrack({
      title: newTrack.title,
      artist: newTrack.artist || undefined,
      album: newTrack.album || undefined,
      duration: newTrack.duration || undefined,
      addedAt: new Date().toISOString(),
    })

    if (data) {
      setTracks([...tracks, data])
      setNewTrack({ title: '', artist: '', album: '', duration: 0 })
      setShowAddTrack(false)
    }
  }

  const handleDeleteTrack = async (id: string) => {
    await deleteTrack(id)
    setTracks(tracks.filter((t) => t.id !== id))
  }

  const handleLoadAndPlay = async (track: Track) => {
    await loadTrack(track.id, track.title)
    setTimeout(() => play(), 500)
  }

  const getStateColor = () => {
    switch (state) {
      case LiberyState.OFFLINE:
        return 'bg-gray-100 text-gray-700'
      case LiberyState.IDLE:
        return 'bg-blue-100 text-blue-700'
      case LiberyState.LOADING:
        return 'bg-yellow-100 text-yellow-700'
      case LiberyState.PLAYING:
        return 'bg-green-100 text-green-700'
      case LiberyState.PAUSED:
        return 'bg-orange-100 text-orange-700'
      case LiberyState.ERROR:
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Layout title="Libery Device" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Libery Device</h2>
            <p className="text-sm text-gray-600">Device ID: {DEVICE_ID}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStateColor()}`}>
              {state}
            </div>
            {isConnected ? (
              <button
                onClick={disconnect}
                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Control */}
          <div className="lg:col-span-2 bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Player Control</h3>
            
            {/* Now Playing */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-xs text-gray-500 mb-1">Now Playing</div>
              <div className="font-medium text-gray-900">
                {context?.currentTrackTitle || 'No track loaded'}
              </div>
              {context?.currentTrackId && (
                <div className="text-xs text-gray-500 mt-1">
                  Track ID: {context.currentTrackId}
                </div>
              )}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={stop}
                disabled={state === LiberyState.OFFLINE || state === LiberyState.IDLE}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                ⏹️ Stop
              </button>
              {state === LiberyState.PLAYING ? (
                <button
                  onClick={pause}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-lg font-medium"
                >
                  ⏸️ Pause
                </button>
              ) : (
                <button
                  onClick={play}
                  disabled={!context?.currentTrackId || state === LiberyState.OFFLINE}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                >
                  ▶️ Play
                </button>
              )}
            </div>

            {/* Volume Control */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <label className="font-medium text-gray-700">Volume</label>
                <span className="text-gray-600">{context?.volume || 0}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={context?.volume || 0}
                onChange={(e) => setVolume(Number(e.target.value))}
                disabled={state === LiberyState.OFFLINE}
                className="w-full"
              />
            </div>

            {/* Position */}
            {context?.position !== undefined && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <label className="font-medium text-gray-700">Position</label>
                  <span className="text-gray-600">{formatDuration(context.position)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(context.position / 180) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Device Info */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">State:</span>
                <span className="font-medium text-gray-900">{state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Connected:</span>
                <span className="font-medium text-gray-900">
                  {isConnected ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Volume:</span>
                <span className="font-medium text-gray-900">{context?.volume || 0}%</span>
              </div>
              {context?.lastUpdated && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Update:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(context.lastUpdated).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Track Library */}
          <div className="lg:col-span-3 bg-white border border-gray-300 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Track Library</h3>
              <button
                onClick={() => setShowAddTrack(!showAddTrack)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                + Add Track
              </button>
            </div>

            {/* Add Track Form */}
            {showAddTrack && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Title *"
                    value={newTrack.title}
                    onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Artist"
                    value={newTrack.artist}
                    onChange={(e) => setNewTrack({ ...newTrack, artist: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Album"
                    value={newTrack.album}
                    onChange={(e) => setNewTrack({ ...newTrack, album: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Duration (sec)"
                    value={newTrack.duration || ''}
                    onChange={(e) => setNewTrack({ ...newTrack, duration: Number(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddTrack}
                    disabled={!newTrack.title}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    Save Track
                  </button>
                  <button
                    onClick={() => setShowAddTrack(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Track List */}
            {isLoadingTracks ? (
              <div className="text-center py-8 text-gray-500">Loading tracks...</div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tracks yet. Add your first track!
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between p-3 border rounded hover:bg-gray-50 ${
                      context?.currentTrackId === track.id
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => handleLoadAndPlay(track)}
                        disabled={state === LiberyState.OFFLINE}
                        className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ▶️
                      </button>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{track.title}</div>
                        <div className="text-xs text-gray-500">
                          {track.artist && <span>{track.artist}</span>}
                          {track.artist && track.album && <span> • </span>}
                          {track.album && <span>{track.album}</span>}
                          {track.duration && (
                            <span> • {formatDuration(track.duration)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Libery
