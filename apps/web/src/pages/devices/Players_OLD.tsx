import Layout from '../../components/Layout'

// Clean Players page - No IoT, No functionality yet
// Will be rebuilt step by step with IoT commands

function Players() {
  // Empty for now - will add functionality via IoT later
  
  return (
    <Layout title="Player" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        {/* Grid Layout: Player left, Logs right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Player - Takes 2 columns */}
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
              autoPlay={autoPlay}
              onPlay={togglePlay}
              onPause={handlePause}
              onStop={handleStop}
              onAutoPlayToggle={toggleAuto}
            />
          </div>
        </div>
          </div>

          {/* IoT Log Window - Takes 1 column */}
          <div className="lg:col-span-1">
            <IoTLogWindow maxHeight="calc(100vh - 200px)" />
          </div>
        </div>

        {/* Audio is created dynamically via new Audio() in handlePlay */}
      </div>

  </Layout>
  )
}

export default Players
