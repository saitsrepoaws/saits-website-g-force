import { useState } from 'react'

interface CrossfadeSettings {
  // Basic Crossfade
  crossfadeEnabled: boolean
  crossfadeStartNext: number
  crossfadeFadeIn: number
  crossfadeFadeOut: number
  crossfadeNormalize: boolean
  crossfadePreset: string
  
  // Smart Crossfade - BPM
  smartCrossfadeEnabled: boolean
  smartCrossfadeBpmTolerance: number
  smartCrossfadeAutoAdjust: boolean
  
  // Smart Crossfade - Harmonic
  harmonicMixingEnabled: boolean
  harmonicMixingStrict: boolean
  harmonicMixingBoost: number
  
  // Smart Crossfade - Energy
  energyMatchingEnabled: boolean
  energyMatchingTolerance: number
  energyMatchingSmoothTransitions: boolean
  
  crossfadeConservative: boolean
}

interface Props {
  settings: CrossfadeSettings
  onChange: (settings: CrossfadeSettings) => void
}

const PRESETS = {
  techno: {
    name: '⚡ Techno',
    startNext: 3.0,
    fadeIn: 2.0,
    fadeOut: 2.0,
    description: 'Snelle, energieke overgangen'
  },
  progressive: {
    name: '🌊 Progressive',
    startNext: 5.0,
    fadeIn: 4.0,
    fadeOut: 4.0,
    description: 'Langere, vloeiende blends'
  },
  ambient: {
    name: '☁️ Ambient',
    startNext: 8.0,
    fadeIn: 6.0,
    fadeOut: 6.0,
    description: 'Zeer geleidelijke transitions'
  },
  hardcore: {
    name: '💥 Hardcore',
    startNext: 2.0,
    fadeIn: 1.0,
    fadeOut: 1.0,
    description: 'Snelle, krachtige cuts'
  },
  custom: {
    name: '🎛️ Custom',
    startNext: 0,
    fadeIn: 0,
    fadeOut: 0,
    description: 'Maatwerk instellingen'
  }
}

function CrossfadeSettings({ settings, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<'basic' | 'smart' | 'advanced'>('basic')

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const presetData = PRESETS[preset]
    onChange({
      ...settings,
      crossfadePreset: preset,
      crossfadeStartNext: presetData.startNext,
      crossfadeFadeIn: presetData.fadeIn,
      crossfadeFadeOut: presetData.fadeOut
    })
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">🎚️ Crossfade & Smart Mixing</h3>
        <p className="text-sm text-gray-600">
          Configureer vloeiende overgangen met BPM-matching, harmonic mixing en energy analysis
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Crossfade Enabled</p>
          <p className="text-sm text-gray-600">Schakel crossfade in/uit</p>
        </div>
        <button
          onClick={() => onChange({ ...settings, crossfadeEnabled: !settings.crossfadeEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.crossfadeEnabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.crossfadeEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {settings.crossfadeEnabled && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('basic')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'basic'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Basic Crossfade
              </button>
              <button
                onClick={() => setActiveTab('smart')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'smart'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🧠 Smart Mixing
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'advanced'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Advanced
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* BASIC TAB */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                {/* Presets */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Presets
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key as keyof typeof PRESETS)}
                        className={`p-3 border-2 rounded-lg text-left transition-colors ${
                          settings.crossfadePreset === key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{preset.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{preset.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Next */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Next Track (seconden voor einde)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={settings.crossfadeStartNext}
                      onChange={(e) => onChange({ ...settings, crossfadeStartNext: parseFloat(e.target.value), crossfadePreset: 'custom' })}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="w-16 text-right">
                      <span className="text-xl font-bold text-blue-600">
                        {settings.crossfadeStartNext.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ⏱️ Wanneer de volgende track begint te laden
                  </p>
                </div>

                {/* Fade Out */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fade Out Duration
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={settings.crossfadeFadeOut}
                      onChange={(e) => onChange({ ...settings, crossfadeFadeOut: parseFloat(e.target.value), crossfadePreset: 'custom' })}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="w-16 text-right">
                      <span className="text-xl font-bold text-purple-600">
                        {settings.crossfadeFadeOut.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    📉 Hoe lang huidige track uitfadet
                  </p>
                </div>

                {/* Fade In */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fade In Duration
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={settings.crossfadeFadeIn}
                      onChange={(e) => onChange({ ...settings, crossfadeFadeIn: parseFloat(e.target.value), crossfadePreset: 'custom' })}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="w-16 text-right">
                      <span className="text-xl font-bold text-green-600">
                        {settings.crossfadeFadeIn.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    📈 Hoe lang nieuwe track infadet
                  </p>
                </div>

                {/* Normalize */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Audio Normalization</p>
                    <p className="text-sm text-gray-600">Voorkomt volume jumps tussen tracks</p>
                  </div>
                  <button
                    onClick={() => onChange({ ...settings, crossfadeNormalize: !settings.crossfadeNormalize })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.crossfadeNormalize ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.crossfadeNormalize ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Visual Preview */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-600 mb-3">Crossfade Preview:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-600 w-16">Track 1:</div>
                      <div className="flex-1 h-6 bg-gradient-to-r from-blue-500 to-blue-200 rounded"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-600 w-16">Track 2:</div>
                      <div className="flex-1 h-6 flex">
                        <div style={{ width: `${(settings.crossfadeStartNext / 10) * 100}%` }} className="bg-transparent"></div>
                        <div className="flex-1 bg-gradient-to-r from-green-200 to-green-500 rounded"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Overlap: ~{settings.crossfadeStartNext.toFixed(1)}s | 
                    Fade Out: {settings.crossfadeFadeOut.toFixed(1)}s | 
                    Fade In: {settings.crossfadeFadeIn.toFixed(1)}s
                  </p>
                </div>
              </div>
            )}

            {/* SMART MIXING TAB */}
            {activeTab === 'smart' && (
              <div className="space-y-6">
                {/* BPM Matching */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">🎵 BPM Matching</h4>
                      <p className="text-sm text-gray-600">Match tracks met vergelijkbare BPM</p>
                    </div>
                    <button
                      onClick={() => onChange({ ...settings, smartCrossfadeEnabled: !settings.smartCrossfadeEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.smartCrossfadeEnabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.smartCrossfadeEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {settings.smartCrossfadeEnabled && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          BPM Tolerance (verschil toegestaan)
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={settings.smartCrossfadeBpmTolerance}
                            onChange={(e) => onChange({ ...settings, smartCrossfadeBpmTolerance: parseInt(e.target.value) })}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="w-16 text-right">
                            <span className="text-xl font-bold text-purple-600">
                              ±{settings.smartCrossfadeBpmTolerance}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Track 128 BPM → Matches 123-133 BPM (bij ±5)
                        </p>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Auto-Adjust Duration</p>
                          <p className="text-xs text-gray-600">Pas crossfade aan op BPM verschil</p>
                        </div>
                        <button
                          onClick={() => onChange({ ...settings, smartCrossfadeAutoAdjust: !settings.smartCrossfadeAutoAdjust })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            settings.smartCrossfadeAutoAdjust ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              settings.smartCrossfadeAutoAdjust ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Harmonic Mixing */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">🎹 Harmonic Mixing</h4>
                      <p className="text-sm text-gray-600">Key-aware transitions (Camelot wheel)</p>
                    </div>
                    <button
                      onClick={() => onChange({ ...settings, harmonicMixingEnabled: !settings.harmonicMixingEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.harmonicMixingEnabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.harmonicMixingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {settings.harmonicMixingEnabled && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Strict Mode</p>
                          <p className="text-xs text-gray-600">Alleen compatibele keys mixen</p>
                        </div>
                        <button
                          onClick={() => onChange({ ...settings, harmonicMixingStrict: !settings.harmonicMixingStrict })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            settings.harmonicMixingStrict ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              settings.harmonicMixingStrict ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Compatible Key Boost
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={settings.harmonicMixingBoost}
                            onChange={(e) => onChange({ ...settings, harmonicMixingBoost: parseFloat(e.target.value) })}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="w-16 text-right">
                            <span className="text-xl font-bold text-green-600">
                              {settings.harmonicMixingBoost.toFixed(1)}x
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Boost crossfade quality voor compatibele keys
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Energy Matching */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">⚡ Energy Matching</h4>
                      <p className="text-sm text-gray-600">Match tracks op energy level</p>
                    </div>
                    <button
                      onClick={() => onChange({ ...settings, energyMatchingEnabled: !settings.energyMatchingEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.energyMatchingEnabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.energyMatchingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {settings.energyMatchingEnabled && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Energy Tolerance
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={settings.energyMatchingTolerance}
                            onChange={(e) => onChange({ ...settings, energyMatchingTolerance: parseFloat(e.target.value) })}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="w-16 text-right">
                            <span className="text-xl font-bold text-orange-600">
                              {(settings.energyMatchingTolerance * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Maximaal verschil in energy tussen tracks
                        </p>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Smooth Transitions</p>
                          <p className="text-xs text-gray-600">Gladde energy curves tussen tracks</p>
                        </div>
                        <button
                          onClick={() => onChange({ ...settings, energyMatchingSmoothTransitions: !settings.energyMatchingSmoothTransitions })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            settings.energyMatchingSmoothTransitions ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              settings.energyMatchingSmoothTransitions ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ADVANCED TAB */}
            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Advanced Settings</h4>
                  <p className="text-sm text-yellow-800">
                    Deze instellingen zijn voor ervaren gebruikers. Wijzig alleen als je weet wat je doet.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Conservative Mode</p>
                    <p className="text-sm text-gray-600">
                      Langere, veiligere crossfades (voor live situations)
                    </p>
                  </div>
                  <button
                    onClick={() => onChange({ ...settings, crossfadeConservative: !settings.crossfadeConservative })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.crossfadeConservative ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.crossfadeConservative ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Pro Tips</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• BPM matching werkt best bij electronic music (techno, house, trance)</li>
                    <li>• Harmonic mixing volgt de Camelot Wheel voor perfecte key transitions</li>
                    <li>• Energy matching voorkomt grote jumps in intensiteit</li>
                    <li>• Conservative mode adds +1s tot alle fade durations</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default CrossfadeSettings
