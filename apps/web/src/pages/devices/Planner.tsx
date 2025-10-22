import Layout from '../../components/Layout'

function Planner() {
  return (
    <Layout title="Schedule Planner" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule Planner</h2>
        <p className="text-sm text-gray-600 mb-6">
          Schedule automated playback and events
        </p>
        
        {/* Content wordt samen gebouwd */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <p className="text-gray-500 text-center py-12">
            Content wordt samen gebouwd...
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default Planner
