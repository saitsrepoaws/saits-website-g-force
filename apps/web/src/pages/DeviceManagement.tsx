import Layout from '../components/Layout'
import NavigationCard from '../components/NavigationCard'

function DeviceManagement() {
  return (
    <Layout title="Device Management" showBackButton backTo="/">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Configuration</h2>
        <p className="text-sm text-gray-600 mb-6">
          Manage and configure your Libery IoT devices
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NavigationCard
            to="/devices/libery"
            icon="📱"
            title="Libery"
            description="Configure Libery device settings, network, and system preferences."
          />
          
          <NavigationCard
            to="/devices/playlist"
            icon="🎵"
            title="Playlist"
            description="Manage playlists, audio content, and playback sequences."
          />
          
          <NavigationCard
            to="/devices/players"
            icon="🔊"
            title="Players"
            description="Configure audio players, zones, and output settings."
          />
          
          <NavigationCard
            to="/devices/planner"
            icon="📅"
            title="Planner"
            description="Schedule playback times, events, and automated tasks."
          />
          
          <NavigationCard
            to="/devices/audio-settings"
            icon="🎚️"
            title="Audio Settings"
            description="Adjust volume, equalizer, and audio quality settings."
          />
          
          <NavigationCard
            to="/devices/network"
            icon="🌐"
            title="Network"
            description="Configure IoT connection, network settings, and monitor connection status."
          />
          
          <NavigationCard
            to="/devices/stream-settings"
            icon="🎙️"
            title="Stream Settings"
            description="Configure dynamic playlist updates and stream server timing."
          />
        </div>
      </div>
    </Layout>
  )
}

export default DeviceManagement
