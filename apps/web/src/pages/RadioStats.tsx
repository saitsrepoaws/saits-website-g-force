/**
 * Radio Statistics Page
 * 
 * Full-page view of stream statistics and monitoring
 */
import RadioDashboard from '../components/RadioDashboard'

export default function RadioStats() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Splash FM</h1>
          <p className="mt-2 text-gray-600">Real-time stream monitoring & analytics</p>
        </div>

        {/* Dashboard */}
        <RadioDashboard />
      </div>
    </div>
  )
}
