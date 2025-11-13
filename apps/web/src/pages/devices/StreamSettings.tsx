import { useState, useEffect } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../../../amplify/data/resource'
import Layout from '../../components/Layout'
import CrossfadeSettings from '../../components/CrossfadeSettings'
import { fetchAuthSession } from 'aws-amplify/auth'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

const client = generateClient<Schema>()

interface StreamMonitoring {
  streamStatus: {
    title: string
    listeners: number
    bitrate: number
    uptime: string
  } | null
  queueStatus: {
    available: number
    inFlight: number
    tracks?: Array<{
      artist?: string
      title?: string
      version?: string
      trackDuration?: number
    }>
  } | null
  lastError: string | null
}

interface Settings {
  settingKey: string
  playlistUpdateTriggerSeconds: number
  playlistUpdateMinTrackDuration: number
  playlistUpdateFallbackInterval: number
  streamServerUrl?: string | null
  streamMountPoint?: string | null
  
  // News Settings
  newsEnabled?: boolean
  
  // Crossfade Settings
  crossfadeEnabled?: boolean
  crossfadeStartNext?: number
  crossfadeFadeIn?: number
  crossfadeFadeOut?: number
  crossfadeNormalize?: boolean
  crossfadePreset?: string
  
  // Smart Crossfade - BPM
  smartCrossfadeEnabled?: boolean
  smartCrossfadeBpmTolerance?: number
  smartCrossfadeAutoAdjust?: boolean
  
  // Smart Crossfade - Harmonic
  harmonicMixingEnabled?: boolean
  harmonicMixingStrict?: boolean
  harmonicMixingBoost?: number
  
  // Smart Crossfade - Energy
  energyMatchingEnabled?: boolean
  energyMatchingTolerance?: number
  energyMatchingSmoothTransitions?: boolean
  
  crossfadeConservative?: boolean
}

function StreamSettings() {
  const [settings, setSettings] = useState<Settings>({
    settingKey: 'playlist_update_timing',
    playlistUpdateTriggerSeconds: 60,
    playlistUpdateMinTrackDuration: 60,
    playlistUpdateFallbackInterval: 300,
    streamServerUrl: 'http://46.137.184.91:8000',
    streamMountPoint: '/stream.mp3',
    
    // Crossfade defaults
    crossfadeEnabled: true,
    crossfadeStartNext: 3.0,
    crossfadeFadeIn: 2.0,
    crossfadeFadeOut: 2.0,
    crossfadeNormalize: true,
    crossfadePreset: 'techno',
    
    // Smart defaults (disabled by default)
    smartCrossfadeEnabled: false,
    smartCrossfadeBpmTolerance: 5,
    smartCrossfadeAutoAdjust: true,
    
    harmonicMixingEnabled: false,
    harmonicMixingStrict: false,
    harmonicMixingBoost: 1.0,
    
    energyMatchingEnabled: false,
    energyMatchingTolerance: 0.2,
    energyMatchingSmoothTransitions: true,
    
    crossfadeConservative: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [monitoring, setMonitoring] = useState<StreamMonitoring>({
    streamStatus: null,
    queueStatus: null,
    lastError: null
  })
  const [showMonitoring, setShowMonitoring] = useState(false)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Auto-refresh monitoring when visible
  useEffect(() => {
    if (showMonitoring) {
      loadMonitoring()
      const interval = setInterval(loadMonitoring, 10000) // Refresh every 10s
      return () => clearInterval(interval)
    }
  }, [showMonitoring])

  const loadMonitoring = async () => {
    try {
      // Fetch stream status from Icecast via Nginx proxy (port 80, not 8000!)
      // Remove :8000 port to go through Nginx which has CORS headers
      const streamUrl = (settings.streamServerUrl || 'http://46.137.184.91').replace(':8000', '')
      const statusResponse = await fetch(`${streamUrl}/status-json.xsl`)
      const statusData = await statusResponse.json()
      
      const source = statusData?.icestats?.source
      
      // Fetch queue status from stream-monitor Lambda
      let queueData = null
      try {
        const session = await fetchAuthSession()
        const credentials = session.credentials
        
        if (credentials) {
          const lambdaClient = new LambdaClient({
            region: 'eu-west-1',
            credentials: {
              accessKeyId: credentials.accessKeyId,
              secretAccessKey: credentials.secretAccessKey,
              sessionToken: credentials.sessionToken
            }
          })
          
          const command = new InvokeCommand({
            FunctionName: 'amplify-gforgeiot-gerard--streammonitorlambdaE421A-EeH4r9IuglyE',
            Payload: new TextEncoder().encode(JSON.stringify({}))
          })
          
          const response = await lambdaClient.send(command)
          
          if (response.Payload) {
            const lambdaResponse = JSON.parse(new TextDecoder().decode(response.Payload))
            console.log('📊 Lambda response:', lambdaResponse)
            
            // Lambda returns { statusCode, body: "JSON string" }
            if (lambdaResponse.body) {
              const result = JSON.parse(lambdaResponse.body)
              console.log('📋 Queue data:', result.queue)
              
              if (result.queue) {
                queueData = {
                  available: result.queue.available || 0,
                  inFlight: result.queue.inFlight || 0
                }
              }
            }
          }
        } else {
          console.log('⚠️ No credentials available for Lambda invocation')
        }
      } catch (queueError) {
        console.error('❌ Queue data error:', queueError)
        // Fallback gracefully - just don't show queue data
      }
      
      setMonitoring(prev => ({
        ...prev,
        streamStatus: source ? {
          title: source.title || 'Unknown',
          listeners: source.listeners || 0,
          bitrate: source.bitrate || 0,
          uptime: source.stream_start_iso8601 || 'Unknown'
        } : null,
        queueStatus: queueData,
        lastError: null
      }))
    } catch (error) {
      console.error('Failed to load monitoring data:', error)
      setMonitoring(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Failed to load monitoring data'
      }))
    }
  }

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
          streamMountPoint: result.data.streamMountPoint || '/stream.mp3',
          
          // Crossfade
          crossfadeEnabled: result.data.crossfadeEnabled ?? true,
          crossfadeStartNext: result.data.crossfadeStartNext || 3.0,
          crossfadeFadeIn: result.data.crossfadeFadeIn || 2.0,
          crossfadeFadeOut: result.data.crossfadeFadeOut || 2.0,
          crossfadeNormalize: result.data.crossfadeNormalize ?? true,
          crossfadePreset: result.data.crossfadePreset || 'techno',
          
          // Smart - BPM
          smartCrossfadeEnabled: result.data.smartCrossfadeEnabled ?? false,
          smartCrossfadeBpmTolerance: result.data.smartCrossfadeBpmTolerance || 5,
          smartCrossfadeAutoAdjust: result.data.smartCrossfadeAutoAdjust ?? true,
          
          // Smart - Harmonic
          harmonicMixingEnabled: result.data.harmonicMixingEnabled ?? false,
          harmonicMixingStrict: result.data.harmonicMixingStrict ?? false,
          harmonicMixingBoost: result.data.harmonicMixingBoost || 1.0,
          
          // Smart - Energy
          energyMatchingEnabled: result.data.energyMatchingEnabled ?? false,
          energyMatchingTolerance: result.data.energyMatchingTolerance || 0.2,
          energyMatchingSmoothTransitions: result.data.energyMatchingSmoothTransitions ?? true,
          
          crossfadeConservative: result.data.crossfadeConservative ?? false
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
      const updateData = {
        settingKey: 'playlist_update_timing',
        playlistUpdateTriggerSeconds: settings.playlistUpdateTriggerSeconds,
        playlistUpdateMinTrackDuration: settings.playlistUpdateMinTrackDuration,
        playlistUpdateFallbackInterval: settings.playlistUpdateFallbackInterval,
        streamServerUrl: settings.streamServerUrl,
        streamMountPoint: settings.streamMountPoint,
        
        // News
        newsEnabled: settings.newsEnabled,
        
        // Crossfade
        crossfadeEnabled: settings.crossfadeEnabled,
        crossfadeStartNext: settings.crossfadeStartNext,
        crossfadeFadeIn: settings.crossfadeFadeIn,
        crossfadeFadeOut: settings.crossfadeFadeOut,
        crossfadeNormalize: settings.crossfadeNormalize,
        crossfadePreset: settings.crossfadePreset,
        
        // Smart - BPM
        smartCrossfadeEnabled: settings.smartCrossfadeEnabled,
        smartCrossfadeBpmTolerance: settings.smartCrossfadeBpmTolerance,
        smartCrossfadeAutoAdjust: settings.smartCrossfadeAutoAdjust,
        
        // Smart - Harmonic
        harmonicMixingEnabled: settings.harmonicMixingEnabled,
        harmonicMixingStrict: settings.harmonicMixingStrict,
        harmonicMixingBoost: settings.harmonicMixingBoost,
        
        // Smart - Energy
        energyMatchingEnabled: settings.energyMatchingEnabled,
        energyMatchingTolerance: settings.energyMatchingTolerance,
        energyMatchingSmoothTransitions: settings.energyMatchingSmoothTransitions,
        
        crossfadeConservative: settings.crossfadeConservative
      }
      
      const result = await client.models.StreamSettings.update(updateData)

      if (!result.data) {
        // Create if update failed
        await client.models.StreamSettings.create(updateData)
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

          {/* News Settings */}
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📰 Nieuws Bulletin</h3>
            <p className="text-sm text-gray-600 mb-4">
              Schakel automatisch nieuws aan/uit aan het begin van elk uur
            </p>
            
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div>
                <p className="font-medium text-gray-900">Nieuws Enabled</p>
                <p className="text-sm text-gray-600">Download en speel nieuws bulletin elk uur</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, newsEnabled: !settings.newsEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.newsEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.newsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Info:</strong> Nieuws wordt automatisch gedownload en afgespeeld aan het begin van elk uur (volgende keer om 
                <strong> {new Date(Date.now() + 3600000).getHours().toString().padStart(2, '0')}:00</strong>)
              </p>
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

        {/* Crossfade Settings Component */}
        <div className="mt-6">
          <CrossfadeSettings
            settings={{
              crossfadeEnabled: settings.crossfadeEnabled ?? true,
              crossfadeStartNext: settings.crossfadeStartNext ?? 3.0,
              crossfadeFadeIn: settings.crossfadeFadeIn ?? 2.0,
              crossfadeFadeOut: settings.crossfadeFadeOut ?? 2.0,
              crossfadeNormalize: settings.crossfadeNormalize ?? true,
              crossfadePreset: settings.crossfadePreset ?? 'techno',
              smartCrossfadeEnabled: settings.smartCrossfadeEnabled ?? false,
              smartCrossfadeBpmTolerance: settings.smartCrossfadeBpmTolerance ?? 5,
              smartCrossfadeAutoAdjust: settings.smartCrossfadeAutoAdjust ?? true,
              harmonicMixingEnabled: settings.harmonicMixingEnabled ?? false,
              harmonicMixingStrict: settings.harmonicMixingStrict ?? false,
              harmonicMixingBoost: settings.harmonicMixingBoost ?? 1.0,
              energyMatchingEnabled: settings.energyMatchingEnabled ?? false,
              energyMatchingTolerance: settings.energyMatchingTolerance ?? 0.2,
              energyMatchingSmoothTransitions: settings.energyMatchingSmoothTransitions ?? true,
              crossfadeConservative: settings.crossfadeConservative ?? false
            }}
            onChange={(crossfadeSettings) => {
              setSettings({
                ...settings,
                ...crossfadeSettings
              })
            }}
          />
        </div>

        {/* External Sources / Autonomous Players Info */}
        <div className="mt-6 bg-white border border-gray-300 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📡</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Externe Bronnen & Autonome Players</h3>
                <p className="text-sm text-gray-600">Aansluiting voor remote players en externe audio bronnen</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🎛️</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-indigo-900 mb-3">Toekomstige Functionaliteit</h4>
                  
                  <div className="space-y-3 text-sm text-indigo-800">
                    <div>
                      <p className="font-medium mb-1">📡 Icecast Server Integratie:</p>
                      <ul className="ml-4 space-y-1 list-disc">
                        <li>Direct connectie met bestaande Icecast server</li>
                        <li>Remote playlist & track management</li>
                        <li>Autonome players kunnen koppelen</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-1">🎵 Remote Player Capabilities:</p>
                      <ul className="ml-4 space-y-1 list-disc">
                        <li>Push playlists naar externe players</li>
                        <li>Real-time track synchronisatie</li>
                        <li>Multi-location audio streaming</li>
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium mb-1">⚙️ Server Details:</p>
                      <ul className="ml-4 space-y-1 list-disc">
                        <li><strong>Icecast Server:</strong> http://46.137.184.91:8000</li>
                        <li><strong>Mount Point:</strong> {settings.streamMountPoint || '/stream.mp3'}</li>
                        <li><strong>Status:</strong> <span className="text-green-700 font-semibold">Operationeel ✅</span></li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-indigo-200">
                    <p className="text-xs text-indigo-700 italic">
                      💡 <strong>Info:</strong> Deze feature is in voorbereiding. Externe bronnen kunnen straks via API worden gekoppeld 
                      voor gedistribueerde audio streaming en remote playlist management.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>🔌</span>
                  <span className="text-xs font-semibold text-blue-900">Source Types</span>
                </div>
                <p className="text-xs text-blue-700">
                  Hardware players, software clients, mobile apps
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>🌐</span>
                  <span className="text-xs font-semibold text-green-900">Remote Control</span>
                </div>
                <p className="text-xs text-green-700">
                  API endpoints voor playlist & track pushing
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>🎛️</span>
                  <span className="text-xs font-semibold text-purple-900">Autonomous</span>
                </div>
                <p className="text-xs text-purple-700">
                  Self-managing players met queue sync
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Monitoring Section */}
        <div className="mt-6 bg-white border border-gray-300 rounded-lg shadow-sm">
          <button
            onClick={() => setShowMonitoring(!showMonitoring)}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900">Live Stream Monitoring</h3>
                <p className="text-sm text-gray-600">Real-time stream status, queue info en logs</p>
              </div>
            </div>
            <span className="text-2xl text-gray-400">{showMonitoring ? '▼' : '▶'}</span>
          </button>

          {showMonitoring && (
            <div className="p-6 pt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stream Status */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>🎵</span>
                    <span>Current Stream</span>
                  </h4>
                  {monitoring.streamStatus ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Now Playing:</span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]" title={monitoring.streamStatus.title}>
                          {monitoring.streamStatus.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Listeners:</span>
                        <span className="text-sm font-medium text-green-600">{monitoring.streamStatus.listeners}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Bitrate:</span>
                        <span className="text-sm font-medium text-blue-600">{monitoring.streamStatus.bitrate} kbps</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          Live
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">Loading stream status...</div>
                  )}
                </div>

                {/* Queue Status */}
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>📋</span>
                    <span>Track Queue</span>
                  </h4>
                  {monitoring.queueStatus ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Available:</span>
                        <span className="text-sm font-medium text-orange-600">{monitoring.queueStatus.available} tracks</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">In-flight:</span>
                        <span className="text-sm font-medium text-yellow-600">{monitoring.queueStatus.inFlight} tracks</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {monitoring.queueStatus.available + monitoring.queueStatus.inFlight} tracks
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Buffer:</span>
                        <span className={`text-sm font-medium ${
                          (monitoring.queueStatus.available + monitoring.queueStatus.inFlight) >= 2 ? 'text-green-600' : 
                          (monitoring.queueStatus.available + monitoring.queueStatus.inFlight) === 1 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {(monitoring.queueStatus.available + monitoring.queueStatus.inFlight) >= 2 ? '🟢 Healthy' : 
                           (monitoring.queueStatus.available + monitoring.queueStatus.inFlight) === 1 ? '🟡 Low' : 
                           '🔴 Critical'}
                        </span>
                      </div>
                      
                      {/* Upcoming Tracks */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-xs font-medium text-gray-700 mb-2">📋 Queue Details</h5>
                        
                        {/* In-Flight Info */}
                        {monitoring.queueStatus.inFlight > 0 && (
                          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="flex items-start gap-2">
                              <span className="text-blue-600 text-xs">🎵</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-blue-900">
                                  {monitoring.queueStatus.inFlight} track{monitoring.queueStatus.inFlight !== 1 ? 's' : ''} bij Liquidsoap
                                </div>
                                <div className="text-xs text-blue-700 mt-0.5">
                                  (1 speelt nu, {monitoring.queueStatus.inFlight - 1} buffer{monitoring.queueStatus.inFlight !== 2 ? 's' : ''})
                                </div>
                                <div className="text-xs text-blue-600 mt-1 italic">
                                  Track details niet zichtbaar vanwege SQS visibility timeout (600s)
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Available Tracks */}
                        {monitoring.queueStatus.tracks && monitoring.queueStatus.tracks.length > 0 ? (
                          <div>
                            <div className="text-xs text-gray-600 mb-2">🎵 Wachtend in queue:</div>
                            <div className="space-y-1.5">
                              {monitoring.queueStatus.tracks.map((track, idx) => (
                                <div key={idx} className="text-xs bg-gray-50 rounded px-2 py-1.5">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-gray-400 font-medium">{idx + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-gray-900 font-medium truncate">
                                        {track.artist || 'Unknown Artist'}
                                      </div>
                                      <div className="text-gray-600 truncate">
                                        {track.title || 'Unknown Title'}
                                        {track.version && ` (${track.version})`}
                                      </div>
                                      {track.trackDuration && (
                                        <div className="text-gray-400 text-xs mt-0.5">
                                          {Math.floor(track.trackDuration / 60)}:{String(track.trackDuration % 60).padStart(2, '0')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          monitoring.queueStatus.available === 0 && monitoring.queueStatus.inFlight > 0 && (
                            <div className="text-xs text-gray-500 italic">
                              Geen tracks wachtend - alle tracks zijn bij Liquidsoap
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      Queue monitoring available after deploying stream-monitor Lambda
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`${(settings.streamServerUrl || 'http://46.137.184.91').replace(':8000', '')}${settings.streamMountPoint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🎧</span>
                  <span>Open Stream</span>
                </a>
                <a
                  href="http://46.137.184.91"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🌐</span>
                  <span>Player Page</span>
                </a>
              </div>

              {/* Error Display */}
              {monitoring.lastError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Error:</strong> {monitoring.lastError}
                  </p>
                </div>
              )}

              {/* Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-600">
                  💡 <strong>Tip:</strong> Monitoring refresht automatisch elke 10 seconden wanneer deze sectie open staat.
                </p>
              </div>
            </div>
          )}
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
            <li>• 🎚️ <strong>Crossfade & Smart Mixing:</strong> Configureer intelligente overgangen met BPM/Key/Energy matching</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default StreamSettings
