import { useEffect, useState } from 'react'
import { getCurrentUser } from 'aws-amplify/auth'
import { useAuthenticator } from '@aws-amplify/ui-react'
import { Link } from 'react-router-dom'

function App() {
  const [email, setEmail] = useState<string>('')
  const { signOut } = useAuthenticator()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const user = await getCurrentUser()
        if (mounted) setEmail(user?.username ?? '')
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="w-full bg-white border-b border-gray-300 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900">G-Forge IoT Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-700">
          <span className="font-medium">{email}</span>
          <button
            onClick={() => signOut()}
            className="ml-2 rounded bg-gray-900 px-2 py-1 text-white text-[11px] hover:bg-gray-700"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="w-full p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome to G-Forge IoT</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* IoT Test Card */}
            <Link 
              to="/iot-test"
              className="block bg-white border border-gray-300 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🔌</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">IoT Test</h3>
              </div>
              <p className="text-sm text-gray-600">
                Test AWS IoT Core PubSub functionality. Send and receive messages on configured topics.
              </p>
              <div className="mt-4 text-xs text-blue-600 font-medium">
                Open Test Panel →
              </div>
            </Link>

            {/* Placeholder cards for future features */}
            <div className="bg-white border border-gray-300 rounded-lg p-6 opacity-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
              </div>
              <p className="text-sm text-gray-600">
                View real-time analytics and metrics from your IoT devices.
              </p>
              <div className="mt-4 text-xs text-gray-400 font-medium">
                Coming soon...
              </div>
            </div>

            <div className="bg-white border border-gray-300 rounded-lg p-6 opacity-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Device Management</h3>
              </div>
              <p className="text-sm text-gray-600">
                Manage and configure your connected IoT devices.
              </p>
              <div className="mt-4 text-xs text-gray-400 font-medium">
                Coming soon...
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
