import Layout from './components/Layout'
import NavigationCard from './components/NavigationCard'

function App() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome to G-Forge IoT</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <NavigationCard
            to="/devices"
            icon="⚙️"
            title="Device Management"
            description="Manage and configure your Libery IoT devices, playlists, and audio settings."
          />
          
          <NavigationCard
            to="/radio-stats"
            icon="📻"
            title="Radio Statistics"
            description="Live stream monitoring, listener count, and health status of Splash FM."
          />
          
          <NavigationCard
            to="/dj-voice"
            icon="🎤"
            title="DJ Voice"
            description="AI-powered voice synthesis for station IDs, intros, and live announcements."
            disabled
          />
          
          <NavigationCard
            to="/analytics"
            icon="📊"
            title="Analytics"
            description="View real-time analytics and metrics from your IoT devices."
            disabled
          />
        </div>
      </div>
    </Layout>
  )
}

export default App
