import { useState, useEffect } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../../../amplify/data/resource'
import Layout from '../../components/Layout'

const client = generateClient<Schema>()

interface Settings {
  settingKey: string
  playlistUpdateTriggerSeconds: number
  playlistUpdateMinTrackDuration: number
  playlistUpdateFallbackInterval: number
  streamServerUrl?: string | null
  streamMountPoint?: string | null
}

function StreamSettings() {
  const [settings, setSettings] = useState<Settings>({
    settingKey: 'playlist_update_timing',
    playlistUpdateTriggerSeconds: 60,
    playlistUpdateMinTrackDuration: 60,
    playlistUpdateFallbackInterval: 300,
    streamServerUrl: 'http://46.137.184.91:8000',
    streamMountPoint: '/stream.mp3'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      
      const result = await client.models.StreamSettings.get({
        settingKey: 'playlist_update_timing'
      })

      if (result.data) {
        setSettings({
          settingKey: result.data.settingKey,
          playlistUpdateTriggerSeconds: result.data.playlistUpdateTriggerSeconds || 60,
          playlistUpdateMinTrackDuration: result.data.playlistUpdateMinTrackDuration || 60,
          playlistUpdateFallbackInterval: result.data.playlistUpdateFallbackInterval || 300,
          streamServerUrl: result.data.streamServerUrl || 'http://46.137.184.91:8000',
          streamMountPoint: result.data.streamMountPoint || '/stream.mp3'
        })
        console.log('✅ Settings loaded:', result.data)
      } else {
        console.log('ℹ️ No settings found, using defaults')
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error)
      showMessage('error', 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setIsSaving(true)
      setMessage(null)

      // Validation
      if (settings.playlistUpdateTriggerSeconds < 10 || settings.playlistUpdateTriggerSeconds > 300) {
        showMessage('error', 'Trigger seconds moet tussen 10 en 300 zijn')
        return
      }
      if (settings.playlistUpdateMinTrackDuration < 30 || settings.playlistUpdateMinTrackDuration > 600) {
        showMessage('error', 'Min track duration moet tussen 30 en 600 seconden zijn')
        return
      }

      // Try to update first, if not exists then create
      const result = await client.models.StreamSettings.update({
        settingKey: 'playlist_update_timing',
        playlistUpdateTriggerSeconds: settings.playlistUpdateTriggerSeconds,
        playlistUpdateMinTrackDuration: settings.playlistUpdateMinTrackDuration,
        playlistUpdateFallbackInterval: settings.playlistUpdateFallbackInterval,
        streamServerUrl: settings.streamServerUrl,
        streamMountPoint: settings.streamMountPoint,
      })

      if (!result.data) {
        // Create if update failed
        await client.models.StreamSettings.create({
          settingKey: 'playlist_update_timing',
          playlistUpdateTriggerSeconds: settings.playlistUpdateTriggerSeconds,
          playlistUpdateMinTrackDuration: settings.playlistUpdateMinTrackDuration,
          playlistUpdateFallbackInterval: settings.playlistUpdateFallbackInterval,
          streamServerUrl: settings.streamServerUrl,
          streamMountPoint: settings.streamMountPoint,
        })
      }

      showMessage('success', '✅ Settings opgeslagen!')
      console.log('✅ Settings saved')
    } catch (error) {
      console.error('❌ Error saving settings:', error)
      showMessage('error', 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  if (isLoading) {
    return (
      <Layout title="Stream Settings" showBackButton backTo="/devices">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Laden...</span>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Stream Settings" showBackButton backTo="/devices">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🎙️ Stream Settings</h2>
          <p className="text-sm text-gray-600">
            Configureer dynamische playlist updates en stream server instellingen
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
          {/* Playlist Update Settings */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Playlist Update Timing</h3>
            <p className="text-sm text-gray-600 mb-6">
              Dynamische playlist updates: triggert automatisch N seconden voor het einde van elke track.
            </p>

            <div className="space-y-6">
              {/* Trigger Seconds */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Timing (seconden voor track einde)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={settings.playlistUpdateTriggerSeconds}
                    onChange={(e) => setSettings({ ...settings, playlistUpdateTriggerSeconds: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="w-20 text-right">
                    <span className="text-2xl font-bold text-blue-600">
                      {settings.playlistUpdateTriggerSeconds}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">sec</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ✨ Aanbevolen: 60 seconden (1 minuut voor einde track)
                </p>
              </div>

              {/* Min Track Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimale Track Duration (alleen triggeren bij tracks langer dan)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="30"
                    max="300"
                    step="10"
                    value={settings.playlistUpdateMinTrackDuration}
                    onChange={(e) => setSettings({ ...settings, playlistUpdateMinTrackDuration: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="w-20 text-right">
                    <span className="text-2xl font-bold text-purple-600">
                      {settings.playlistUpdateMinTrackDuration}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">sec</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ⏱️ Tracks korter dan deze duur triggeren geen playlist update
                </p>
              </div>

              {/* Fallback Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fallback Update Interval (voor backup/veiligheid)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="60"
                    max="600"
                    step="30"
                    value={settings.playlistUpdateFallbackInterval}
                    onChange={(e) => setSettings({ ...settings, playlistUpdateFallbackInterval: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="w-20 text-right">
                    <span className="text-2xl font-bold text-orange-600">
                      {Math.floor(settings.playlistUpdateFallbackInterval / 60)}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">min</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  🔄 Maximum tijd tussen updates als fallback (default: 5 min)
                </p>
              </div>
            </div>
          </div>

          {/* Stream Server Settings */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🌐 Stream Server</h3>
            
            <div className="space-y-4">
              {/* Stream URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icecast Server URL
                </label>
                <input
                  type="text"
                  value={settings.streamServerUrl || ''}
                  onChange={(e) => setSettings({ ...settings, streamServerUrl: e.target.value })}
                  placeholder="http://46.137.184.91:8000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Mount Point */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stream Mount Point
                </label>
                <input
                  type="text"
                  value={settings.streamMountPoint || ''}
                  onChange={(e) => setSettings({ ...settings, streamMountPoint: e.target.value })}
                  placeholder="/stream.mp3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Full URL Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-600 mb-1">Stream URL Preview:</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {settings.streamServerUrl}{settings.streamMountPoint}
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              💡 Changes take effect immediately after saving
            </div>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Opslaan...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Opslaan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Hoe werkt het?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• De stream status checker draait elke minuut</li>
            <li>• Als een track nog N seconden heeft (jouw trigger timing), wordt de playlist automatisch bijgewerkt</li>
            <li>• Tracks korter dan de minimale duration worden geskipt (geen trigger)</li>
            <li>• Dit zorgt voor vloeiende overgangen zonder interruptions</li>
            <li>• De fallback interval is een backup die altijd checkt (max 10 min)</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default StreamSettings
