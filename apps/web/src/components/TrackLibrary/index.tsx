import { useEffect, useState } from 'react'
import { listTracks, createTrack, deleteTrack, type Track } from '../../services/tracks'
import { 
  uploadAudioFile, 
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

export interface TrackLibraryProps {
  // Display options
  showUpload?: boolean
  showFilters?: boolean
  showSearch?: boolean
  compact?: boolean
  maxHeight?: string
  
  // Initial filters
  initialGenre?: string
  initialLabel?: string
  initialSearch?: string
  
  // Feature toggles
  allowDelete?: boolean
  allowPlay?: boolean
  showTrackInfo?: boolean
  
  // Callbacks
  onTrackSelect?: (track: Track) => void
  onTrackDelete?: (trackId: string) => void
  onTrackPlay?: (track: Track) => void
  
  // Styling
  className?: string
  containerClassName?: string
}

export function TrackLibrary({
  showUpload = true,
  showFilters = true,
  showSearch = true,
  compact = false,
  maxHeight,
  initialGenre = 'all',
  initialLabel = 'all',
  initialSearch = '',
  allowDelete = true,
  allowPlay = true,
  showTrackInfo = true,
  onTrackSelect,
  onTrackDelete,
  onTrackPlay,
  className = '',
  containerClassName = '',
}: TrackLibraryProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  
  // Audio Player State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  // Multi-file upload state
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [genreFilter, setGenreFilter] = useState<string>(initialGenre)
  const [labelFilter, setLabelFilter] = useState<string>(initialLabel)
  
  // Track info modal
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [showTrackInfoModal, setShowTrackInfoModal] = useState(false)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  
  // Cover art URLs
  const [coverArtUrls, setCoverArtUrls] = useState<Record<string, string>>({})

  // Load tracks
  useEffect(() => {
    loadTracksFromDB()
  }, [])

  async function loadTracksFromDB() {
    setIsLoadingTracks(true)
    try {
      const { data } = await listTracks()
      console.log('📊 Tracks loaded from DB:', data)
      if (data) {
        setTracks(data)
        
        // Load cover art URLs
        const urls: Record<string, string> = {}
        await Promise.all(
          data.map(async (track: any) => {
            if (track.coverArtUrl) {
              try {
                // Handle legacy URLs
                let s3Path = track.coverArtUrl
                if (s3Path.includes('amazonaws.com')) {
                  const url = new URL(s3Path)
                  s3Path = url.pathname.replace(/^\//, '')
                }
                
                const result = await getUrl({
                  path: s3Path,
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
      }
    } catch (error) {
      console.error('Failed to load tracks:', error)
    } finally {
      setIsLoadingTracks(false)
    }
  }

  // Audio Player Functions
  async function handlePlayTrack(track: Track) {
    if (onTrackPlay) {
      onTrackPlay(track)
      return
    }

    try {
      // Toggle if same track
      if (playingTrackId === track.id && audioElement) {
        if (isPlaying) {
          audioElement.pause()
          setIsPlaying(false)
        } else {
          await audioElement.play()
          setIsPlaying(true)
        }
        return
      }
      
      // Stop current audio
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
      
      console.log('🎵 Loading track:', track.title)
      
      // Handle legacy URLs
      let s3Path = track.fileUrl
      if (s3Path.includes('amazonaws.com')) {
        console.warn('⚠️ Track has old URL format, extracting path...')
        try {
          const url = new URL(s3Path)
          s3Path = url.pathname.replace(/^\//, '')
        } catch (e) {
          console.error('Failed to parse legacy URL:', e)
        }
      }
      
      const result = await getUrl({ path: s3Path })
      const url = result.url.toString()
      console.log('✅ Audio URL generated')
      
      const audio = new Audio(url)
      
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
        console.log(`✅ Loaded: ${track.title} (${audio.duration}s)`)
      })
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })
      
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio error:', e)
        alert('Failed to load audio file')
        setPlayingTrackId(null)
        setIsPlaying(false)
      })
      
      setAudioElement(audio)
      setPlayingTrackId(track.id)
      
      await audio.play()
      setIsPlaying(true)
      
    } catch (error) {
      console.error('❌ Error playing track:', error)
      alert('Failed to play track')
    }
  }

  function handleStopTrack() {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    setPlayingTrackId(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }

  function handleSeek(time: number) {
    if (audioElement) {
      audioElement.currentTime = time
      setCurrentTime(time)
    }
  }

  async function handleDeleteTrack(trackId: string) {
    if (!allowDelete) return
    
    if (onTrackDelete) {
      onTrackDelete(trackId)
      return
    }

    if (!confirm('Are you sure you want to delete this track?')) return

    try {
      await deleteTrack(trackId)
      await loadTracksFromDB()
    } catch (error) {
      console.error('Failed to delete track:', error)
      alert('Failed to delete track')
    }
  }

  function handleTrackInfo(track: Track) {
    if (onTrackSelect) {
      onTrackSelect(track)
      return
    }

    if (!showTrackInfo) return
    
    setSelectedTrack(track)
    setShowTrackInfoModal(true)
  }

  // Upload handling (simplified - full implementation from Libery.tsx)
  async function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!showUpload) return
    
    const files = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('audio/')
    )
    
    const queue: FileUploadItem[] = []
    for (const file of files) {
      const parsed = parseFilename(file.name)
      const metadata = await getAudioMetadata(file)
      
      queue.push({
        file,
        artist: parsed.artist,
        title: parsed.title,
        version: parsed.version,
        label: parsed.label,
        duration: metadata.duration,
        progress: null,
        status: 'pending',
      })
    }
    
    setUploadQueue(queue)
    startUpload(queue)
  }

  async function startUpload(queue: FileUploadItem[]) {
    setIsUploading(true)
    
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      
      setUploadQueue(q => q.map((q, idx) => 
        idx === i ? { ...q, status: 'uploading' as const } : q
      ))
      
      try {
        const audioResult = await uploadAudioFile(item.file, (progress) => {
          setUploadQueue(q => q.map((q, idx) => 
            idx === i ? { ...q, progress } : q
          ))
        })
        
        await createTrack({
          artist: item.artist || undefined,
          title: item.title,
          version: item.version || undefined,
          label: item.label || undefined,
          duration: item.duration || undefined,
          fileUrl: `public/${audioResult.key}`,
          fileSize: audioResult.size,
          format: audioResult.format,
          addedAt: new Date().toISOString(),
        })
        
        setUploadQueue(q => q.map((q, idx) => 
          idx === i ? { ...q, status: 'success' as const } : q
        ))
        
      } catch (error) {
        console.error('Upload failed:', error)
        setUploadQueue(q => q.map((q, idx) => 
          idx === i ? { ...q, status: 'error' as const, error: String(error) } : q
        ))
      }
    }
    
    setIsUploading(false)
    setIsProcessing(true)
    
    setTimeout(async () => {
      await loadTracksFromDB()
      setIsProcessing(false)
      setUploadQueue([])
    }, 6000)
  }

  // Filtering
  const filteredTracks = tracks.filter(track => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || 
      track.artist?.toLowerCase().includes(searchLower) ||
      track.title?.toLowerCase().includes(searchLower) ||
      track.genre?.toLowerCase().includes(searchLower) ||
      track.label?.toLowerCase().includes(searchLower) ||
      track.version?.toLowerCase().includes(searchLower)
    
    const matchesGenre = genreFilter === 'all' || track.genre === genreFilter
    const matchesLabel = labelFilter === 'all' || track.label === labelFilter
    
    return matchesSearch && matchesGenre && matchesLabel
  })

  const uniqueGenres = Array.from(new Set(tracks.map(t => t.genre).filter(Boolean)))
  const uniqueLabels = Array.from(new Set(tracks.map(t => t.label).filter(Boolean)))

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={`${containerClassName}`}>
      <div className={`space-y-4 ${className}`}>
        {/* Upload Section */}
        {showUpload && (
          <div className="bg-white rounded-lg shadow p-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <p className="text-gray-600">
                🎵 Drop audio files here to upload
              </p>
              {uploadQueue.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadQueue.map((item, i) => (
                    <div key={i} className="text-sm">
                      {item.status === 'success' ? '✅' : item.status === 'error' ? '❌' : '⏳'} {item.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search & Filters */}
        {(showSearch || showFilters) && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            {showSearch && (
              <input
                type="text"
                placeholder="🔍 Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
            
            {showFilters && (
              <div className="flex gap-2">
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Genres ({tracks.length})</option>
                  {uniqueGenres.map(genre => (
                    <option key={genre} value={genre}>
                      {genre} ({tracks.filter(t => t.genre === genre).length})
                    </option>
                  ))}
                </select>

                <select
                  value={labelFilter}
                  onChange={(e) => setLabelFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Labels ({tracks.length})</option>
                  {uniqueLabels.map(label => (
                    <option key={label} value={label}>
                      {label} ({tracks.filter(t => t.label === label).length})
                    </option>
                  ))}
                </select>

                {(searchQuery || genreFilter !== 'all' || labelFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setGenreFilter('all')
                      setLabelFilter('all')
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tracks List */}
        <div 
          className="bg-white rounded-lg shadow overflow-auto"
          style={{ maxHeight: maxHeight || (compact ? '400px' : 'none') }}
        >
          {isLoadingTracks ? (
            <div className="p-8 text-center text-gray-500">
              Loading tracks...
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No tracks found
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredTracks.map((track) => (
                <div key={track.id}>
                  <div className={`grid ${compact ? 'grid-cols-[auto,2fr,1fr,auto]' : 'grid-cols-[auto,2fr,2fr,80px,100px,1.5fr,60px,80px,1.5fr,auto]'} gap-2 items-center p-3 border border-gray-200 rounded hover:bg-gray-50`}>
                    {/* Cover Art */}
                    <div>
                      {coverArtUrls[track.id] ? (
                        <img
                          src={coverArtUrls[track.id]}
                          alt={track.title}
                          className={compact ? "w-8 h-8 rounded object-cover" : "w-10 h-10 rounded object-cover"}
                        />
                      ) : (
                        <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} bg-gray-200 rounded flex items-center justify-center`}>
                          <span className="text-gray-400 text-xs">🎵</span>
                        </div>
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {track.artist} - {track.title}
                    </div>

                    {!compact && (
                      <>
                        <div className="text-sm text-gray-600 truncate">{track.genre || '-'}</div>
                        <div className="text-xs text-gray-600">{track.year || '-'}</div>
                        <div className="text-xs text-gray-600 truncate">{track.version || '-'}</div>
                        <div className="text-xs text-gray-600 truncate">{track.label || '-'}</div>
                        <div className="text-xs text-gray-600">
                          {track.bpm && track.bpm > 0 ? track.bpm : '-'}
                        </div>
                        <div className="text-xs text-gray-600">
                          {track.duration ? formatDuration(track.duration) : '-'}
                        </div>
                        <div className="text-xs text-gray-600">
                          {track.format ? track.format.toUpperCase() : '-'}
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="text-right flex gap-1 justify-end">
                      {allowPlay && (
                        <button
                          onClick={() => handlePlayTrack(track)}
                          className={`px-2 py-1 text-xs rounded ${
                            playingTrackId === track.id
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={playingTrackId === track.id ? (isPlaying ? 'Pause' : 'Resume') : 'Play'}
                        >
                          {playingTrackId === track.id ? (isPlaying ? '⏸️' : '▶️') : '▶️'}
                        </button>
                      )}
                      
                      {showTrackInfo && (
                        <button
                          onClick={() => handleTrackInfo(track)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          title="Track Info"
                        >
                          ℹ️
                        </button>
                      )}
                      
                      {allowDelete && (
                        <button
                          onClick={() => handleDeleteTrack(track.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Audio Player */}
                  {allowPlay && playingTrackId === track.id && (
                    <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 bg-gradient-to-r from-green-50 to-blue-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayTrack(track)}
                            className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-md transition-all"
                          >
                            {isPlaying ? <span className="text-lg">⏸️</span> : <span className="text-lg">▶️</span>}
                          </button>
                          <button
                            onClick={handleStopTrack}
                            className="w-8 h-8 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-sm"
                          >
                            <span className="text-sm">⏹️</span>
                          </button>
                        </div>

                        <div className="flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-900">
                            {track.artist} - {track.title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatDuration(currentTime)} / {formatDuration(duration || track.duration || 0)}
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="relative group">
                            <div
                              className="h-2 bg-gray-300 rounded-full overflow-hidden cursor-pointer"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const x = e.clientX - rect.left
                                const percentage = x / rect.width
                                const newTime = percentage * duration
                                handleSeek(newTime)
                              }}
                            >
                              <div
                                className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all"
                                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                              />
                            </div>
                            <div
                              className="absolute top-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow-lg transform -translate-y-1/2 -translate-x-1/2 group-hover:scale-125 transition-transform"
                              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {!compact && track.bpm && (
                          <div className="flex-shrink-0 text-right">
                            <div className="text-sm font-semibold text-blue-700">
                              {track.bpm} BPM
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {!compact && (
          <div className="text-sm text-gray-600 text-center">
            Showing {filteredTracks.length} of {tracks.length} tracks
          </div>
        )}
      </div>
    </div>
  )
}

export default TrackLibrary
