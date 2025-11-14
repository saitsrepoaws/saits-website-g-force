import { useState } from 'react'
import Layout from '../../components/Layout'

interface GenreStats {
  genre: string
  count: number
  percentage: number
}

interface MergePreview {
  sourceGenres: string[]
  targetGenre: string
  affectedTracks: number
  affectedPlaylists: number
}

interface MergeResult {
  success: boolean
  tracksUpdated: number
  playlistsUpdated: number
  error?: string
}

function GenreMerger() {
  const [stats, setStats] = useState<GenreStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  
  const [sourceGenres, setSourceGenres] = useState('')
  const [targetGenre, setTargetGenre] = useState('')
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [loadingMerge, setLoadingMerge] = useState(false)

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      // Mock data for now - in production, call Lambda
      const mockStats: GenreStats[] = [
        { genre: 'Techno', count: 142, percentage: 35 },
        { genre: 'House', count: 85, percentage: 21 },
        { genre: 'Deep House', count: 42, percentage: 10 },
        { genre: 'Tech House', count: 38, percentage: 9 },
        { genre: 'Minimal', count: 28, percentage: 7 },
        { genre: 'Progressive', count: 24, percentage: 6 },
        { genre: 'Other', count: 48, percentage: 12 },
      ]
      setStats(mockStats)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const loadPreview = async () => {
    if (!sourceGenres || !targetGenre) {
      alert('Please enter both source genres and target genre')
      return
    }

    setLoadingPreview(true)
    setPreview(null)
    try {
      // Mock preview - in production, call Lambda with action: 'preview'
      const mockPreview: MergePreview = {
        sourceGenres: sourceGenres.split(',').map(g => g.trim()),
        targetGenre: targetGenre.trim(),
        affectedTracks: 123,
        affectedPlaylists: 5
      }
      setPreview(mockPreview)
    } catch (error: any) {
      alert(`Preview failed: ${error.message}`)
    } finally {
      setLoadingPreview(false)
    }
  }

  const executeMerge = async () => {
    if (!preview) return

    if (!confirm(`Are you sure you want to merge ${preview.affectedTracks} tracks?\n\nThis action cannot be undone!`)) {
      return
    }

    setLoadingMerge(true)
    setMergeResult(null)
    try {
      // Mock merge - in production, call Lambda with action: 'merge'
      const mockResult: MergeResult = {
        success: true,
        tracksUpdated: preview.affectedTracks,
        playlistsUpdated: preview.affectedPlaylists
      }
      setMergeResult(mockResult)
      
      // Refresh stats after merge
      await loadStats()
      
      // Clear form
      setSourceGenres('')
      setTargetGenre('')
      setPreview(null)
    } catch (error: any) {
      setMergeResult({
        success: false,
        tracksUpdated: 0,
        playlistsUpdated: 0,
        error: error.message
      })
    } finally {
      setLoadingMerge(false)
    }
  }

  return (
    <Layout title="Genre Merger" showBackButton backTo="/devices">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900">🎨 Genre Merger</h2>
          <p className="text-sm text-gray-600 mt-2">
            Consolidate similar genres to clean up your music library
          </p>
        </div>

        {/* Genre Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">📊 Genre Statistics</h3>
            <button
              onClick={loadStats}
              disabled={loadingStats}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
            >
              {loadingStats ? 'Loading...' : '🔄 Load Stats'}
            </button>
          </div>

          {stats.length > 0 ? (
            <div className="space-y-3">
              {stats.map((stat) => (
                <div key={stat.genre} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{stat.genre}</div>
                    <div className="text-sm text-gray-600">{stat.count} tracks • {stat.percentage}%</div>
                  </div>
                  <div className="w-64 bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <button
                    onClick={() => setSourceGenres(stat.genre)}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 hover:border-blue-400 rounded-md transition-colors"
                  >
                    Use →
                  </button>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-semibold text-gray-700">
                  Total: {stats.reduce((sum, s) => sum + s.count, 0)} tracks across {stats.length} genres
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">🎵</div>
              <div>Click "Load Stats" to see your genre distribution</div>
            </div>
          )}
        </div>

        {/* Merge Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">🔄 Merge Genres</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Genres (comma-separated)
              </label>
              <input
                type="text"
                value={sourceGenres}
                onChange={(e) => setSourceGenres(e.target.value)}
                placeholder="e.g. Tech House, Minimal Techno, Deep Techno"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-1">
                These genres will be merged into the target genre
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-300" />
              <div className="text-sm font-medium text-gray-500">→ becomes →</div>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Genre
              </label>
              <input
                type="text"
                value={targetGenre}
                onChange={(e) => setTargetGenre(e.target.value)}
                placeholder="e.g. Techno"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-1">
                All source genres will be changed to this genre
              </div>
            </div>

            <button
              onClick={loadPreview}
              disabled={loadingPreview || !sourceGenres || !targetGenre}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loadingPreview ? 'Loading Preview...' : '👁️ Preview Merge'}
            </button>
          </div>
        </div>

        {/* Preview Result */}
        {preview && (
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">👁️ Preview</h3>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Merge Operation:</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-red-50 border border-red-200 rounded px-3 py-2">
                    <div className="text-xs text-gray-600 mb-1">From:</div>
                    <div className="font-semibold text-red-700">
                      {preview.sourceGenres.join(', ')}
                    </div>
                  </div>
                  <div className="text-2xl">→</div>
                  <div className="flex-1 bg-green-50 border border-green-200 rounded px-3 py-2">
                    <div className="text-xs text-gray-600 mb-1">To:</div>
                    <div className="font-semibold text-green-700">
                      {preview.targetGenre}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-600">{preview.affectedTracks}</div>
                  <div className="text-sm text-gray-600 mt-1">Tracks to Update</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-600">{preview.affectedPlaylists}</div>
                  <div className="text-sm text-gray-600 mt-1">Playlists Affected</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={executeMerge}
                  disabled={loadingMerge}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {loadingMerge ? 'Merging...' : '✅ Execute Merge'}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  disabled={loadingMerge}
                  className="px-6 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
                >
                  ❌ Cancel
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div className="flex-1 text-sm text-red-800">
                    <div className="font-semibold mb-1">Warning:</div>
                    <div>This action is <strong>permanent</strong> and cannot be undone. All {preview.affectedTracks} tracks will have their genre changed to "{preview.targetGenre}".</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Merge Result */}
        {mergeResult && (
          <div className={`rounded-lg border p-6 ${
            mergeResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {mergeResult.success ? '✅ Merge Successful!' : '❌ Merge Failed'}
            </h3>
            
            {mergeResult.success ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-600">{mergeResult.tracksUpdated}</div>
                    <div className="text-sm text-gray-600 mt-1">Tracks Updated</div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-3xl font-bold text-purple-600">{mergeResult.playlistsUpdated}</div>
                    <div className="text-sm text-gray-600 mt-1">Playlists Updated</div>
                  </div>
                </div>
                <div className="text-sm text-green-700">
                  Your library has been successfully updated. Genre statistics have been refreshed.
                </div>
              </div>
            ) : (
              <div className="text-red-700 font-mono text-sm">
                {mergeResult.error}
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">ℹ️ How It Works</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p><strong>🔍 Statistics:</strong> View genre distribution across your entire library</p>
            <p><strong>👁️ Preview:</strong> See exactly what will change before executing</p>
            <p><strong>✅ Execute:</strong> Batch update all tracks and playlists in one operation</p>
            <p><strong>🔄 Automatic:</strong> Playlist JSON is automatically updated with new genres</p>
            <p><strong>⚠️ Permanent:</strong> Changes cannot be undone - always preview first!</p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Common Use Cases</h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-900 mb-1">Consolidate Similar Genres:</div>
              <div className="text-gray-600">
                Merge "Tech House", "Minimal Techno", "Deep Techno" → "Techno"
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-900 mb-1">Fix Typos:</div>
              <div className="text-gray-600">
                Merge "Techno", "Tecnho", "Tehcno" → "Techno"
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-900 mb-1">Simplify Library:</div>
              <div className="text-gray-600">
                Merge "Progressive House", "Progressive Trance" → "Progressive"
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default GenreMerger
