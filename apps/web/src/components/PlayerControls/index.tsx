interface PlayerControlsProps {
  // State
  isPlaying: boolean
  isPaused: boolean
  isLoaded: boolean
  volume: number
  autoPlay: boolean
  
  // Handlers
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onLoad: () => void
  onUnload: () => void
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAutoPlayToggle: () => void
}

export default function PlayerControls({
  isPlaying,
  isPaused,
  isLoaded,
  volume,
  autoPlay,
  onPlay,
  onPause,
  onStop,
  onLoad,
  onUnload,
  onVolumeChange,
  onAutoPlayToggle,
}: PlayerControlsProps) {
  return (
    <div className="space-y-6">
      {/* Top Controls: Auto, Load/Unload, Pause */}
      <div className="flex items-center gap-3">
        {/* Auto Button */}
        <button
          onClick={onAutoPlayToggle}
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
          onClick={onLoad}
          disabled={isLoaded}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/50 transform hover:scale-105 active:scale-95"
          title="Load track"
        >
          📥 LOAD
        </button>
        <button
          onClick={onUnload}
          disabled={!isLoaded}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-orange-500/50 transform hover:scale-105 active:scale-95"
          title="Unload track"
        >
          ⏏️ UNLOAD
        </button>

        {/* Pause Button */}
        <button
          onClick={onPause}
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
          onClick={onPlay}
          disabled={!isLoaded}
          className="w-20 h-20 bg-gradient-to-br from-white to-gray-200 rounded-full flex items-center justify-center text-4xl hover:scale-110 transition-all shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_40px_-5px_rgba(255,255,255,0.3)] disabled:from-gray-600 disabled:to-gray-700 disabled:scale-100 disabled:cursor-not-allowed transform active:scale-95 border-4 border-white/30"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <button
          onClick={onStop}
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
            onChange={onVolumeChange}
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
  )
}
