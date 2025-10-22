import Layout from '../../components/Layout'

function Libery() {
  return (
    <Layout title="Libery Configuration" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Libery Device</h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure your Libery device settings
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Device Info */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Device Name:</span>
                <span className="font-medium text-gray-900">Libery-001</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Online</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Firmware:</span>
                <span className="font-medium text-gray-900">v2.1.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IP Address:</span>
                <span className="font-mono text-gray-900">192.168.1.100</span>
              </div>
            </div>
          </div>

          {/* Network Settings */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WiFi SSID</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Network name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="password" 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
                Update Network
              </button>
            </div>
          </div>

          {/* System Settings */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  defaultValue="Libery-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>Europe/Amsterdam</option>
                  <option>Europe/Brussels</option>
                  <option>UTC</option>
                </select>
              </div>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
                Save Settings
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Actions</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium">
                Restart Device
              </button>
              <button className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 text-sm font-medium">
                Factory Reset
              </button>
              <button className="w-full px-4 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200 text-sm font-medium">
                Check for Updates
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Libery
