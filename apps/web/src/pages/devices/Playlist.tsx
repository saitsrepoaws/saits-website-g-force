import Layout from '../../components/Layout'

function Playlist() {
  return (
    <Layout title="Playlist Management" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Playlist Management</h2>
        <p className="text-sm text-gray-600 mb-6">
          Create and manage your audio playlists
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Playlist List */}
          <div className="lg:col-span-2 bg-white border border-gray-300 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Playlists</h3>
              <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
                + New Playlist
              </button>
            </div>
            
            <div className="space-y-2">
              {['Morning Mix', 'Afternoon Vibes', 'Evening Chill', 'Background Music'].map((name, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎵</span>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{name}</div>
                      <div className="text-xs text-gray-500">{Math.floor(Math.random() * 20) + 5} tracks</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                    <button className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Playlist Details */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Playlist Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Playlist name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                  rows={3}
                  placeholder="Playlist description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shuffle</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>Off</option>
                  <option>On</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>Off</option>
                  <option>Repeat All</option>
                  <option>Repeat One</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Playlist
