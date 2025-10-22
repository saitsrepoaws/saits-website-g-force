import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { listTracks, createTrack, deleteTrack, type Track } from '../../services/tracks'
import { 
  uploadAudioFile, 
  uploadCoverArt, 
  getAudioMetadata, 
  formatFileSize,
  type UploadProgress 
} from '../../services/audioUpload'
import { parseFilename } from '../../services/filenameParser'

interface FileUploadItem {
  file: File
  artist: string
  title: string
  version: string
  label: string
  duration: number
  progress: UploadProgress | null
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

function Libery() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  
  // Multi-file upload state
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Load tracks from database
  useEffect(() => {
    loadTracksFromDB()
  }, [])

  const loadTracksFromDB = async () => {
    setIsLoadingTracks(true)
    const { data } = await listTracks()
    setTracks(data)
    setIsLoadingTracks(false)
  }

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Create upload items for each file
    const newItems: FileUploadItem[] = await Promise.all(
      files.map(async (file) => {
        const metadata = await getAudioMetadata(file)
        const parsed = parseFilename(file.name)
        
        return {
          file,
          artist: parsed.artist || '',
          title: parsed.title,
          version: parsed.version || '',
          label: parsed.label || '',
          duration: metadata.duration || 0,
          progress: null,
          status: 'pending' as const,
        }
      })
    )

    setUploadQueue([...uploadQueue, ...newItems])
  }

  const handleStartUpload = async () => {
    setIsUploading(true)

    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i]
      if (item.status !== 'pending') continue

      // Update status to uploading
      setUploadQueue(prev => prev.map((q, idx) => 
        idx === i ? { ...q, status: 'uploading' as const } : q
      ))

      try {
        // Upload audio file
        const audioResult = await uploadAudioFile(item.file, (progress) => {
          setUploadQueue(prev => prev.map((q, idx) => 
            idx === i ? { ...q, progress } : q
          ))
        })

        // Create track in database
        const { data } = await createTrack({
          artist: item.artist || undefined,
          title: item.title,
          version: item.version || undefined,
          label: item.label || undefined,
          duration: item.duration || undefined,
          fileUrl: audioResult.url,
          fileSize: audioResult.size,
          format: audioResult.format,
          addedAt: new Date().toISOString(),
        })

        if (data) {
          setTracks(prev => [...prev, data])
          setUploadQueue(prev => prev.map((q, idx) => 
            idx === i ? { ...q, status: 'success' as const } : q
          ))
        }
      } catch (error) {
        console.error('Failed to upload track:', error)
        setUploadQueue(prev => prev.map((q, idx) => 
          idx === i ? { ...q, status: 'error' as const, error: 'Upload failed' } : q
        ))
      }
    }

    setIsUploading(false)
  }

  const handleRemoveFromQueue = (index: number) => {
    setUploadQueue(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleClearCompleted = () => {
    setUploadQueue(prev => prev.filter(item => item.status === 'pending' || item.status === 'uploading'))
  }

  const handleUpdateQueueItem = (index: number, field: keyof FileUploadItem, value: any) => {
    setUploadQueue(prev => prev.map((item, idx) => 
      idx === index ? { ...item, [field]: value } : item
    ))
  }

  const handleDeleteTrack = async (id: string) => {
    await deleteTrack(id)
    setTracks(tracks.filter((t) => t.id !== id))
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Layout title="Track Library" showBackButton backTo="/devices">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Track Library</h2>
          <p className="text-sm text-gray-600">Manage your audio tracks</p>
        </div>

        {/* Upload Queue */}
        {showAddTrack && (
          <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Tracks</h3>
            
            {/* File Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Audio Files (multiple files supported)
              </label>
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFilesSelected}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>

            {/* Upload Queue */}
            {uploadQueue.length > 0 && (
              <div className="space-y-3">
                {uploadQueue.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      item.status === 'success' ? 'bg-green-50 border-green-200' :
                      item.status === 'error' ? 'bg-red-50 border-red-200' :
                      item.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* File Info & Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {item.status === 'success' && '✅'}
                          {item.status === 'error' && '❌'}
                          {item.status === 'uploading' && '⏳'}
                          {item.status === 'pending' && '⏸️'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {item.file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(item.file.size)})
                        </span>
                      </div>
                      {item.status === 'pending' && !isUploading && (
                        <button
                          onClick={() => handleRemoveFromQueue(index)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Editable Metadata (only for pending) */}
                    {item.status === 'pending' && (
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Artist"
                          value={item.artist}
                          onChange={(e) => handleUpdateQueueItem(index, 'artist', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Title *"
                          value={item.title}
                          onChange={(e) => handleUpdateQueueItem(index, 'title', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Version"
                          value={item.version}
                          onChange={(e) => handleUpdateQueueItem(index, 'version', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Label"
                          value={item.label}
                          onChange={(e) => handleUpdateQueueItem(index, 'label', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </div>
                    )}

                    {/* Progress Bar */}
                    {item.progress && item.status === 'uploading' && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Uploading...</span>
                          <span>{item.progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${item.progress.percentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {item.error && (
                      <div className="text-xs text-red-600 mt-1">{item.error}</div>
                    )}
                  </div>
                ))}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleStartUpload}
                    disabled={isUploading || uploadQueue.every(i => i.status !== 'pending')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isUploading ? 'Uploading...' : `Upload ${uploadQueue.filter(i => i.status === 'pending').length} Track(s)`}
                  </button>
                  <button
                    onClick={handleClearCompleted}
                    disabled={isUploading}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                  >
                    Clear Completed
                  </button>
                  <button
                    onClick={() => setShowAddTrack(false)}
                    disabled={isUploading}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Track Library */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Track Library</h3>
              <button
                onClick={() => setShowAddTrack(!showAddTrack)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                {showAddTrack ? 'Hide Upload' : '+ Add Tracks'}
              </button>
            </div>

            {/* Track List */}
            {isLoadingTracks ? (
              <div className="text-center py-8 text-gray-500">Loading tracks...</div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tracks yet. Add your first track!
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                  <div className="col-span-3">Artist</div>
                  <div className="col-span-3">Title</div>
                  <div className="col-span-2">Version</div>
                  <div className="col-span-2">Label</div>
                  <div className="col-span-1">Duration</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Track Rows */}
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="col-span-3 text-sm font-medium text-gray-900 truncate">
                      {track.artist || '-'}
                    </div>
                    <div className="col-span-3 text-sm text-gray-900 truncate">
                      {track.title}
                    </div>
                    <div className="col-span-2 text-xs text-gray-600 truncate">
                      {track.version || '-'}
                    </div>
                    <div className="col-span-2 text-xs text-gray-600 truncate">
                      {track.label || '-'}
                    </div>
                    <div className="col-span-1 text-xs text-gray-600">
                      {track.duration ? formatDuration(track.duration) : '-'}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => handleDeleteTrack(track.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </Layout>
  )
}

export default Libery
