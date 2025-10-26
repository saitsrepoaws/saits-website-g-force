/**
 * Player Display Component
 * 
 * Shows track info, cover art, and waveform
 */

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
}

interface PlayerDisplayProps {
  currentTrack: Track | null
  coverArtUrl: string | null
  waveformUrl: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export default function PlayerDisplay({
  currentTrack,
  coverArtUrl,
  waveformUrl,
  isPlaying,
  currentTime,
  duration,
  onSeek
}: PlayerDisplayProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="px-8 py-6">
      <div className="grid grid-cols-3 gap-8">
        {/* Cover Art */}
        <div>
          {coverArtUrl ? (
            <img
              src={coverArtUrl}
              alt={currentTrack?.title || 'Track'}
              className="w-full aspect-square rounded-xl shadow-2xl object-cover"
            />
          ) : (
            <div className="w-full aspect-square bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-2xl flex items-center justify-center">
              <span className="text-6xl">🎵</span>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-3xl font-bold text-white mb-2">
              {currentTrack?.title || 'No Track Loaded'}
            </h3>
            <p className="text-xl text-blue-200 mb-4">
              {currentTrack?.artist || 'Unknown Artist'}
            </p>
            
            {currentTrack && (
              <div className="grid grid-cols-5 gap-3 mb-6">
                {currentTrack.album && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Album</div>
                    <div className="text-sm text-white font-medium truncate">{currentTrack.album}</div>
                  </div>
                )}
                {currentTrack.genre && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Genre</div>
                    <div className="text-sm text-white font-medium">{currentTrack.genre}</div>
                  </div>
                )}
                {currentTrack.bpm && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">BPM</div>
                    <div className="text-sm text-white font-medium">{currentTrack.bpm}</div>
                  </div>
                )}
                {currentTrack.key && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Key</div>
                    <div className="text-sm text-white font-medium">{currentTrack.key}</div>
                  </div>
                )}
                {currentTrack.year && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Year</div>
                    <div className="text-sm text-white font-medium">{currentTrack.year}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Waveform */}
          <div>
            {waveformUrl ? (
              <div className="relative">
                <img
                  src={waveformUrl}
                  alt="Waveform"
                  className="w-full h-24 object-cover rounded-lg"
                />
                {isPlaying && (
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-500/30 pointer-events-none"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-24 bg-white/5 rounded-lg flex items-center justify-center">
                <span className="text-gray-500 text-sm">No waveform available</span>
              </div>
            )}

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div
                className="w-full h-2 bg-white/10 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percentage = x / rect.width
                  onSeek(percentage * duration)
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
