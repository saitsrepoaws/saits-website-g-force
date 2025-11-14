import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'

interface QueueStatus {
  queueSize: number
  visible: number
  processing: number
  lastChecked: string
}

interface InvokeResult {
  success: boolean
  tracksAdded?: number
  currentPosition?: number
  queueSize?: number
  playlistName?: string
  slot?: {
    name: string
    day: string
    time: string
  }
  message?: string
  error?: string
}

function TrackQueueManager() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [invokeResult, setInvokeResult] = useState<InvokeResult | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadQueueStatus = async () => {
    try {
      // Mock for now - in production, call Lambda or API to get real status
      const status: QueueStatus = {
        queueSize: 2,
        visible: 2,
        processing: 0,
        lastChecked: new Date().toLocaleTimeString()
      }
      setQueueStatus(status)
    } catch (error) {
      console.error('Failed to load queue status:', error)
    }
  }

  const invokeLambda = async (action: 'refill' | 'purge') => {
    setLoading(true)
    setInvokeResult(null)

    try {
      // In production, call your Lambda via API Gateway or direct invoke
      // For now, mock the response
      const result: InvokeResult = {
        success: true,
        tracksAdded: action === 'purge' ? 2 : 1,
        currentPosition: 5,
        queueSize: 2,
        playlistName: 'Evening Mix',
        slot: {
          name: 'Evening Show',
          day: 'Wed',
          time: '19:00-20:00'
        }
      }
      
      setInvokeResult(result)
      await loadQueueStatus()
    } catch (error: any) {
      setInvokeResult({
        success: false,
        error: error.message || 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueueStatus()
    
    if (autoRefresh) {
      const interval = setInterval(loadQueueStatus, 10000) // Refresh every 10s
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  return (
    <Layout title="Track Queue Manager" showBackButton backTo="/devices">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900">🎵 Track Queue Manager</h2>
          <p className="text-sm text-gray-600 mt-2">
            Hybrid SQS Streaming - Monitor and control the 2-track buffer system
          </p>
        </div>

        {/* Queue Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">📊 Queue Status</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-refresh</span>
              </label>
              <button
                onClick={loadQueueStatus}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {queueStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-600">{queueStatus.queueSize}</div>
                <div className="text-sm text-gray-600 mt-1">Total Messages</div>
                <div className="text-xs text-gray-500 mt-2">Target: 2 tracks</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-600">{queueStatus.visible}</div>
                <div className="text-sm text-gray-600 mt-1">Visible (Ready)</div>
                <div className="text-xs text-gray-500 mt-2">Available for playback</div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-600">{queueStatus.processing}</div>
                <div className="text-sm text-gray-600 mt-1">In-Flight</div>
                <div className="text-xs text-gray-500 mt-2">Currently being processed</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              Loading queue status...
            </div>
          )}

          {queueStatus && (
            <div className="mt-4 text-xs text-gray-500">
              Last checked: {queueStatus.lastChecked}
            </div>
          )}
        </div>

        {/* Actions Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">⚡ Actions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => invokeLambda('refill')}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Processing...
                </>
              ) : (
                <>
                  🔄 Refill Queue
                </>
              )}
            </button>

            <button
              onClick={() => invokeLambda('purge')}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              🧹 Purge & Reload
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-600 space-y-1">
            <p>• <strong>Refill Queue:</strong> Add tracks if queue &lt; 2 (normal operation)</p>
            <p>• <strong>Purge & Reload:</strong> Clear queue and add 2 fresh tracks (playlist change)</p>
          </div>
        </div>

        {/* Result Card */}
        {invokeResult && (
          <div className={`rounded-lg shadow-sm border p-6 ${
            invokeResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {invokeResult.success ? '✅ Success' : '❌ Error'}
            </h3>
            
            {invokeResult.success ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Tracks Added</div>
                    <div className="text-2xl font-bold text-green-600">{invokeResult.tracksAdded}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Queue Size</div>
                    <div className="text-2xl font-bold text-blue-600">{invokeResult.queueSize}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Position</div>
                    <div className="text-2xl font-bold text-purple-600">{invokeResult.currentPosition}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Playlist</div>
                    <div className="text-lg font-semibold text-gray-900">{invokeResult.playlistName}</div>
                  </div>
                </div>
                
                {invokeResult.slot && (
                  <div className="mt-4 bg-white rounded-lg p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">📅 Active Schedule Slot:</div>
                    <div className="text-base text-gray-900">
                      {invokeResult.slot.name} • {invokeResult.slot.day} {invokeResult.slot.time}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-700 font-mono text-sm">
                {invokeResult.error || invokeResult.message}
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">ℹ️ How It Works</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p><strong>🎯 2-Track Buffer:</strong> System maintains exactly 2 tracks in queue</p>
            <p><strong>🎵 Track 1:</strong> Currently playing on Liquidsoap</p>
            <p><strong>⏸️ Track 2:</strong> Buffered and ready (next up)</p>
            <p><strong>🔄 Auto-refill:</strong> When track finishes, Liquidsoap triggers Lambda to add next track</p>
            <p><strong>♾️ Continuous:</strong> Playlist loops automatically, position tracked in DynamoDB</p>
            <p><strong>⏰ Hourly Trigger:</strong> EventBridge ensures queue is always initialized</p>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🏗️ Architecture</h3>
          <pre className="bg-gray-50 p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`┌─────────────────────────────────────────┐
│  TRACK QUEUE MANAGER LAMBDA             │
│  • Check queue size                     │
│  • Load current schedule & playlist     │
│  • Calculate tracks to add (2 - size)   │
│  • Send to SQS FIFO queue              │
│  • Update playlist position             │
└─────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  SQS FIFO QUEUE                         │
│  [Track 1] 🎵 ← Playing                │
│  [Track 2] ⏸️  ← Buffered               │
└─────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  LIQUIDSOAP (EC2)                       │
│  • Poll queue every 10s                 │
│  • If size < 2 → Invoke Lambda         │
│  • Play tracks from S3                  │
│  • Delete after playback                │
└─────────────────────────────────────────┘`}
          </pre>
        </div>
      </div>
    </Layout>
  )
}

export default TrackQueueManager
