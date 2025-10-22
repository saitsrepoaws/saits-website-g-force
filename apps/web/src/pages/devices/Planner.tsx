import Layout from '../../components/Layout'

function Planner() {
  return (
    <Layout title="Schedule Planner" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule Planner</h2>
        <p className="text-sm text-gray-600 mb-6">
          Schedule automated playback and events
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Schedule List */}
          <div className="lg:col-span-2 bg-white border border-gray-300 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Scheduled Events</h3>
              <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
                + New Schedule
              </button>
            </div>
            
            <div className="space-y-2">
              {[
                { time: '08:00', name: 'Morning Playlist', days: 'Mon-Fri', active: true },
                { time: '12:00', name: 'Lunch Music', days: 'Daily', active: true },
                { time: '18:00', name: 'Evening Chill', days: 'Daily', active: false },
                { time: '22:00', name: 'Auto Stop', days: 'Daily', active: true },
              ].map((schedule, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{schedule.active ? '✅' : '⏸️'}</span>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{schedule.name}</div>
                      <div className="text-xs text-gray-500">
                        {schedule.time} • {schedule.days}
                      </div>
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

          {/* New Schedule Form */}
          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Schedule</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Schedule name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input 
                  type="time" 
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>Play Playlist</option>
                  <option>Stop Playback</option>
                  <option>Change Volume</option>
                  <option>Switch Zone</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  <option>Daily</option>
                  <option>Weekdays</option>
                  <option>Weekends</option>
                  <option>Custom</option>
                </select>
              </div>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Planner
