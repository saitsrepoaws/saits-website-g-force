import Layout from '../../components/Layout'

function Players() {
  return (
    <Layout title="Audio Players" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Audio Players</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure audio zones and player settings
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Player Zones */}
          {['Zone 1 - Main', 'Zone 2 - Lounge', 'Zone 3 - Outdoor'].map((zone, idx) => (
            <div key={idx} className="bg-white border border-gray-300 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{zone}</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  Active
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    defaultValue="50"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Output</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                    <option>Built-in Speaker</option>
                    <option>HDMI Audio</option>
                    <option>Bluetooth</option>
                    <option>Analog Out</option>
                  </select>
                </div>
                
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                    ▶️ Play
                  </button>
                  <button className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                    ⏸️ Pause
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {/* Add New Zone */}
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-center">
            <button className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">➕</span>
              </div>
              <div className="text-sm font-medium text-gray-700">Add New Zone</div>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Players
