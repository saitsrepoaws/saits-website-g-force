import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { listTracks, createTrack, deleteTrack, updateTrack, type Track } from '../../services/tracks'
import { 
  uploadAudioFile, 
  uploadCoverArt, 
  getAudioMetadata, 
  formatFileSize,
  type UploadProgress 
} from '../../services/audioUpload'
import { getUrl } from 'aws-amplify/storage'
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
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [labelFilter, setLabelFilter] = useState<string>('all')
  
  // Track info modal
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [showTrackInfo, setShowTrackInfo] = useState(false)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  const [coverArtUrls, setCoverArtUrls] = useState<Record<string, string>>({})

  // Load tracks from database
  useEffect(() => {
    loadTracksFromDB()
  }, [])

  // Load waveform URL when modal opens
  useEffect(() => {
    const loadWaveformUrl = async () => {
      if (selectedTrack && (selectedTrack as any).waveformUrl) {
        try {
          const result = await getUrl({
            path: (selectedTrack as any).waveformUrl,
            options: {
              expiresIn: 3600, // 1 hour
            },
          })
          setWaveformUrl(result.url.toString())
        } catch (error) {
          console.error('Failed to load waveform URL:', error)
          setWaveformUrl(null)
        }
      } else {
        setWaveformUrl(null)
      }
    }

    if (showTrackInfo) {
      loadWaveformUrl()
    }
  }, [showTrackInfo, selectedTrack])

  const loadTracksFromDB = async () => {
    setIsLoadingTracks(true)
    const { data } = await listTracks()
    console.log('📊 Loaded tracks from DB:', data)
    console.log('📊 First track audio features:', data[0] ? {
      bpm: data[0].bpm,
      key: data[0].key,
      energy: data[0].energy,
      danceability: data[0].danceability,
      valence: data[0].valence
    } : 'No tracks')
    setTracks(data)
    
    // Load cover art URLs for all tracks
    const urls: Record<string, string> = {}
    await Promise.all(
      data.map(async (track: any) => {
        if (track.coverArtUrl) {
          try {
            const result = await getUrl({
              path: (track as any).coverArtUrl,
              options: { expiresIn: 3600 },
            })
            urls[track.id] = result.url.toString()
          } catch (error) {
            console.error(`Failed to load cover art for ${track.id}:`, error)
          }
        }
      })
    )
    setCoverArtUrls(urls)
    
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
          // Don't add to local state immediately - will reload after Lambda
          setUploadQueue(prev => prev.map((q, idx) => 
            idx === i ? { ...q, status: 'success' as const } : q
          ))
          
          // Wait for Lambda to process and update track with audio features
          // Lambda triggers on S3 upload and extracts metadata
          console.log('✅ Track uploaded! Waiting for Lambda to process metadata...')
          setIsProcessing(true)
          
          setTimeout(async () => {
            try {
              // Reload tracks to get Lambda-extracted features
              console.log('🔄 Reloading tracks after Lambda processing...')
              const updated = await listTracks()
              console.log('📊 Reload result:', updated)
              if (updated.data) {
                console.log(`🎵 Got ${updated.data.length} tracks from DB`)
                setTracks(updated.data)
                
                // Load cover art URLs
                const urls: Record<string, string> = {}
                await Promise.all(
                  updated.data.map(async (track: any) => {
                    if (track.coverArtUrl) {
                      try {
                        const result = await getUrl({
                          path: track.coverArtUrl,
                          options: { expiresIn: 3600 },
                        })
                        urls[track.id] = result.url.toString()
                      } catch (error) {
                        console.error(`Failed to load cover art for ${track.id}:`, error)
                      }
                    }
                  })
                )
                setCoverArtUrls(urls)
                console.log('✅ Track list and cover art updated!')
              } else {
                console.warn('⚠️ No data returned from listTracks')
              }
            } catch (error) {
              console.error('❌ Failed to reload tracks after Lambda processing:', error)
            } finally {
              setIsProcessing(false)
            }
          }, 6000) // Wait 6 seconds for Lambda to process
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
    if (!confirm('Are you sure you want to delete this track?')) return
    
    try {
      const result = await deleteTrack(id)
      if (result.data || !result.errors) {
        setTracks(tracks.filter((t) => t.id !== id))
        console.log('Track deleted successfully')
      } else {
        console.error('Failed to delete track:', result.errors)
        alert('Failed to delete track. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting track:', error)
      alert('Failed to delete track. Please try again.')
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Filter and search tracks
  const filteredTracks = tracks.filter(track => {
    // Search filter (artist, title, genre, label, version)
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || 
      track.artist?.toLowerCase().includes(searchLower) ||
      track.title?.toLowerCase().includes(searchLower) ||
      (track as any).genre?.toLowerCase().includes(searchLower) ||
      track.label?.toLowerCase().includes(searchLower) ||
      track.version?.toLowerCase().includes(searchLower)
    
    // Genre filter
    const matchesGenre = genreFilter === 'all' || (track as any).genre === genreFilter
    
    // Label filter
    const matchesLabel = labelFilter === 'all' || track.label === labelFilter
    
    return matchesSearch && matchesGenre && matchesLabel
  })

  // Get unique genres and labels for filter dropdowns
  const uniqueGenres = Array.from(new Set(tracks.map(t => (t as any).genre).filter(Boolean)))
  const uniqueLabels = Array.from(new Set(tracks.map(t => t.label).filter(Boolean)))

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
              <h3 className="text-lg font-semibold text-gray-900">
                Track Library 
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'})
                </span>
              </h3>
              <button
                onClick={() => setShowAddTrack(!showAddTrack)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                {showAddTrack ? 'Hide Upload' : '+ Add Tracks'}
              </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-3">
              {/* Search Input */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="🔍 Search tracks (artist, title, genre, label...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {(searchQuery || genreFilter !== 'all' || labelFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setGenreFilter('all')
                      setLabelFilter('all')
                    }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-white"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Genre:</label>
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Genres ({tracks.length})</option>
                    {uniqueGenres.map(genre => (
                      <option key={genre} value={genre}>
                        {genre} ({tracks.filter(t => (t as any).genre === genre).length})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Label:</label>
                  <select
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Labels ({tracks.length})</option>
                    {uniqueLabels.map(label => (
                      <option key={label} value={label}>
                        {label} ({tracks.filter(t => t.label === label).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm text-blue-700">
                    Processing track... Lambda is extracting metadata, BPM, and generating waveform. Track will appear in ~6 seconds.
                  </span>
                </div>
              </div>
            )}

            {/* Track List */}
            {isLoadingTracks ? (
              <div className="text-center py-8 text-gray-500">Loading tracks...</div>
            ) : filteredTracks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {isProcessing ? 'Processing track...' : 
                 searchQuery || genreFilter !== 'all' || labelFilter !== 'all' ? 
                 'No tracks match your filters. Try adjusting your search.' :
                 'No tracks yet. Add your first track!'}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Artist</div>
                  <div className="col-span-2">Title</div>
                  <div className="col-span-2">Genre</div>
                  <div className="col-span-1">Year</div>
                  <div className="col-span-1">Version</div>
                  <div className="col-span-2">Label</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Track Rows */}
                {filteredTracks.map((track) => (
                  <div
                    key={track.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    {/* Cover Art */}
                    <div className="col-span-1">
                      {coverArtUrls[track.id] ? (
                        <img
                          src={coverArtUrls[track.id]}
                          alt={track.title}
                          className="w-12 h-12 object-cover rounded shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-gray-400 text-xs">🎵</span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-sm font-medium text-gray-900 truncate">
                      {track.artist || '-'}
                    </div>
                    <div className="col-span-2 text-sm text-gray-900 truncate">
                      {track.title}
                    </div>
                    <div className="col-span-2 text-xs text-gray-600 truncate">
                      {(track as any).genre || '-'}
                    </div>
                    <div className="col-span-1 text-xs text-gray-600">
                      {(track as any).year || '-'}
                    </div>
                    <div className="col-span-1 text-xs text-gray-600 truncate">
                      {track.version || '-'}
                    </div>
                    <div className="col-span-2 text-xs text-gray-600 truncate">
                      {track.label || '-'}
                    </div>
                    <div className="col-span-1 text-right flex gap-1 justify-end">
                      <button
                        onClick={() => {
                          console.log('🎵 Opening track info for:', track.title)
                          console.log('🎵 Track audio features:', {
                            bpm: track.bpm,
                            key: (track as any).key,
                            energy: (track as any).energy,
                            danceability: (track as any).danceability,
                            valence: (track as any).valence
                          })
                          setSelectedTrack(track)
                          setShowTrackInfo(true)
                        }}
                        className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        title="Track Info"
                      >
                        ℹ️
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(track.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        title="Delete Track"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>

      {/* Track Info Modal */}
      {showTrackInfo && selectedTrack && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTrackInfo(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">Track Information</h3>
              <button
                onClick={() => setShowTrackInfo(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Basic Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Artist:</span>
                    <span className="ml-2 font-medium">{selectedTrack.artist || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Title:</span>
                    <span className="ml-2 font-medium">{selectedTrack.title}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Version:</span>
                    <span className="ml-2 font-medium">{selectedTrack.version || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Label:</span>
                    <span className="ml-2 font-medium">{selectedTrack.label || '-'}</span>
                  </div>
                </div>
              </div>

              {/* File Info */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">File Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <span className="ml-2 font-medium">
                      {selectedTrack.duration ? formatDuration(selectedTrack.duration) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Format:</span>
                    <span className="ml-2 font-medium">{selectedTrack.format || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">File Size:</span>
                    <span className="ml-2 font-medium">
                      {selectedTrack.fileSize ? formatFileSize(selectedTrack.fileSize) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Added:</span>
                    <span className="ml-2 font-medium">
                      {selectedTrack.addedAt ? new Date(selectedTrack.addedAt).toLocaleString() : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audio Features (Lambda Analysis) */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Audio Features 🎵</h4>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div>
                    <span className="text-gray-500">BPM:</span>
                    <span className="ml-2 font-medium text-blue-600">
                      {(selectedTrack as any).bpm || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Key:</span>
                    <span className="ml-2 font-medium text-indigo-600">
                      {(selectedTrack as any).key || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Energy:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {(selectedTrack as any).energy ? `${((selectedTrack as any).energy * 100).toFixed(0)}%` : '-'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Danceability:</span>
                    <span className="ml-2 font-medium text-purple-600">
                      {(selectedTrack as any).danceability ? `${((selectedTrack as any).danceability * 100).toFixed(0)}%` : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valence:</span>
                    <span className="ml-2 font-medium text-pink-600">
                      {(selectedTrack as any).valence ? `${((selectedTrack as any).valence * 100).toFixed(0)}%` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Waveform */}
              {waveformUrl && (
                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Waveform 🌊</h4>
                  <div className="bg-gray-900 p-2 rounded">
                    <img 
                      src={waveformUrl} 
                      alt="Waveform" 
                      className="w-full h-24 object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    200 sample points • SVG format
                  </p>
                </div>
              )}
              {(selectedTrack as any).waveformUrl && !waveformUrl && (
                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Waveform 🌊</h4>
                  <div className="bg-gray-100 p-4 rounded text-center">
                    <p className="text-sm text-gray-500">Loading waveform...</p>
                  </div>
                </div>
              )}

              {/* Cover Art */}
              {(selectedTrack as any).coverArtUrl && (
                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Cover Art 🎨</h4>
                  <div className="text-sm">
                    <span className="text-gray-500">URL:</span>
                    <span className="ml-2 font-mono text-xs break-all">{(selectedTrack as any).coverArtUrl}</span>
                  </div>
                </div>
              )}

              {/* Technical Details */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Technical Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">File URL:</span>
                    <span className="ml-2 font-mono text-xs break-all">{selectedTrack.fileUrl || '-'}</span>
                  </div>
                </div>
              </div>

              {/* IDs */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Identifiers</h4>
                <div className="text-sm">
                  <div>
                    <span className="text-gray-500">Track ID:</span>
                    <span className="ml-2 font-mono text-xs">{selectedTrack.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTrackInfo(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Libery
