import type { Track } from '../../services/playerService'

interface TrackDisplayProps {
  track: Track | null
  coverArtUrl: string | null
  waveformUrl: string | null
  isPlaying: boolean
}

export default function TrackDisplay({ 
  track, 
  coverArtUrl, 
  waveformUrl, 
  isPlaying 
}: TrackDisplayProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
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
              {!track && (
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

      {/* Middle & Right: Track Info */}
      <div className="col-span-2 flex flex-col justify-between">
        {/* Track Info */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {track?.title || 'No Track Loaded'}
          </h3>
          <p className="text-lg text-blue-200 mb-2">
            {track?.artist || (track ? 'Unknown Artist' : 'Click LOAD to start')}
          </p>
          <div className="flex items-center gap-3 text-xs text-blue-300 mb-3">
            {track?.album && <span>💿 {track.album}</span>}
            {track?.year && <span>📅 {track.year}</span>}
            {track?.genre && (
              <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px]">
                {track.genre}
              </span>
            )}
          </div>

          {/* Audio Features */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {track?.bpm && (
              <div className="bg-white/10 backdrop-blur-sm rounded p-2 text-center">
                <div className="text-[10px] text-blue-300 mb-0.5">BPM</div>
                <div className="text-sm font-bold text-white">{track.bpm}</div>
              </div>
            )}
            {track?.key && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-blue-300 mb-1">Key</div>
                <div className="text-lg font-bold text-white">{track.key}</div>
              </div>
            )}
            {track?.energy !== null && track?.energy !== undefined && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-blue-300 mb-1">Energy</div>
                <div className="text-lg font-bold text-white">
                  {Math.round(track.energy * 100)}%
                </div>
              </div>
            )}
            {track?.danceability !== null && track?.danceability !== undefined && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-blue-300 mb-1">Dance</div>
                <div className="text-lg font-bold text-white">
                  {Math.round(track.danceability * 100)}%
                </div>
              </div>
            )}
            {track?.valence !== null && track?.valence !== undefined && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-blue-300 mb-1">Mood</div>
                <div className="text-lg font-bold text-white">
                  {Math.round(track.valence * 100)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Waveform */}
        {waveformUrl && (
          <div className="p-4 bg-white/5 rounded-lg">
            <img 
              src={waveformUrl} 
              alt="Waveform" 
              className="w-full h-16 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
