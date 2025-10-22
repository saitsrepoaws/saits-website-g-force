import Layout from '../../components/Layout'

function AudioSettings() {
  return (
    <Layout title="Audio Settings" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Audio Settings</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure audio quality and equalizer settings
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audio Quality */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Audio Quality</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sample Rate</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>44.1 kHz (CD Quality)</option>
                  <option>48 kHz (Studio)</option>
                  <option>96 kHz (High-Res)</option>
                  <option>192 kHz (Ultra High-Res)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bit Depth</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>16-bit</option>
                  <option>24-bit</option>
                  <option>32-bit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audio Format</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>MP3</option>
                  <option>AAC</option>
                  <option>FLAC</option>
                  <option>WAV</option>
                </select>
              </div>
            </div>
          </div>

          {/* Equalizer */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Equalizer</h3>
            <div className="space-y-4">
              {['60Hz', '250Hz', '1kHz', '4kHz', '16kHz'].map((freq, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <label className="font-medium text-gray-700">{freq}</label>
                    <span className="text-gray-500">0 dB</span>
                  </div>
                  <input 
                    type="range" 
                    min="-12" 
                    max="12" 
                    defaultValue="0"
                    className="w-full"
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <button className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                  Reset
                </button>
                <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume Control</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Master Volume</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  defaultValue="70"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>70%</span>
                  <span>100%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Volume Limit</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  defaultValue="85"
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Maximum volume: 85%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="normalize" className="rounded" />
                <label htmlFor="normalize" className="text-sm text-gray-700">
                  Normalize volume across tracks
                </label>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="crossfade" className="rounded" />
                <label htmlFor="crossfade" className="text-sm text-gray-700">
                  Enable crossfade (3 seconds)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="gapless" className="rounded" />
                <label htmlFor="gapless" className="text-sm text-gray-700">
                  Gapless playback
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="replaygain" className="rounded" />
                <label htmlFor="replaygain" className="text-sm text-gray-700">
                  ReplayGain normalization
                </label>
              </div>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium mt-4">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default AudioSettings
