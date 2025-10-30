import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import './index.css'
import './styles/theme.css'
import App from './App.tsx'
import IoTContextTest from './pages/IoTContextTest'
import MqttTest from './pages/MqttTest'
import DeviceManagement from './pages/DeviceManagement'
import Libery from './pages/devices/Libery'
import Playlist from './pages/devices/Playlist'
import PlaylistDetail from './pages/devices/PlaylistDetail'
import Players from './pages/devices/Players'
import Planner from './pages/devices/Planner'
import AudioSettings from './pages/devices/AudioSettings'
import { configureAmplify } from './amplify-config'
import Login from './pages/Login'
import AuthGate from './routes/AuthGate'
import { IoTProvider } from './contexts/IoTContext'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { 
    path: '/', 
    element: (
      <AuthGate>
        <App />
      </AuthGate>
    )
  },
  { 
    path: '/iot-context-test', 
    element: (
      <AuthGate>
        <IoTContextTest />
      </AuthGate>
    )
  },
  { 
    path: '/mqtt-test', 
    element: (
      <AuthGate>
        <MqttTest />
      </AuthGate>
    )
  },
  { 
    path: '/devices', 
    element: (
      <AuthGate>
        <DeviceManagement />
      </AuthGate>
    )
  },
  { 
    path: '/devices/libery', 
    element: (
      <AuthGate>
        <Libery />
      </AuthGate>
    )
  },
  { 
    path: '/devices/playlist', 
    element: (
      <AuthGate>
        <Playlist />
      </AuthGate>
    )
  },
  { 
    path: '/devices/playlist/:id', 
    element: (
      <AuthGate>
        <PlaylistDetail />
      </AuthGate>
    )
  },
  { 
    path: '/devices/players', 
    element: (
      <AuthGate>
        <Players />
      </AuthGate>
    )
  },
  { 
    path: '/devices/planner', 
    element: (
      <AuthGate>
        <Planner />
      </AuthGate>
    )
  },
  { 
    path: '/devices/audio-settings', 
    element: (
      <AuthGate>
        <AudioSettings />
      </AuthGate>
    )
  },
])

async function boot() {
  const { configured } = await configureAmplify()
  const root = createRoot(document.getElementById('root')!)
  if (!configured) {
    root.render(
      <StrictMode>
        <div style={{ padding: 16, fontFamily: 'system-ui' }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Amplify not configured</h1>
          <p style={{ marginTop: 8, color: '#555' }}>
            Could not load /amplify_outputs.json. Make sure you ran sandbox and copied the outputs.
          </p>
          <pre style={{ background:'#f5f5f5', padding:12, borderRadius:8 }}>
            pnpm --package=@aws-amplify/backend-cli dlx ampx sandbox --once --outputs-format json --outputs-out-dir .{"\n"}
            cp amplify_outputs.json apps/web/public/amplify_outputs.json
          </pre>
        </div>
      </StrictMode>
    )
    return
  }
  root.render(
    <StrictMode>
      <Authenticator.Provider>
        <IoTProvider autoConnect={false}>
          <RouterProvider router={router} />
        </IoTProvider>
      </Authenticator.Provider>
    </StrictMode>
  )
}

boot()
