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
  status: 'pending' | 'uploading' | 'success' | 'error' | 'skipped'
  error?: string
  // Jingle & Tags fields
  isJingle: boolean
  jingleCategory: string
  tags: string // Comma-separated: Hot Hits, Oldies, Party, etc.
}

function Libery() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  
  // Audio Player State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Multi-file upload state
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [labelFilter, setLabelFilter] = useState<string>('all')
  
  // Genre grouping state
  const [expandedGenres, setExpandedGenres] = useState<Record<string, boolean>>({})
  const [genreDisplayCounts, setGenreDisplayCounts] = useState<Record<string, number>>({})
  
  // Sorting state
  const [sortField, setSortField] = useState<'artist' | 'title' | 'bpm' | 'key' | 'year' | 'version' | 'label' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
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
          // Handle legacy URLs
          let s3Path = (selectedTrack as any).waveformUrl
          if (s3Path.includes('amazonaws.com')) {
            const url = new URL(s3Path)
            s3Path = url.pathname.replace(/^\//, '')
          }
          
          const result = await getUrl({
            path: s3Path,
            options: {
              expiresIn: 3600, // 1 hour
            },
          })
          setWaveformUrl(result.url.toString())
          console.log('🌊 Waveform URL loaded')
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
    console.log('🔄 Loading tracks from DB...')
    
    const { data, errors } = await listTracks()
    
    console.log('📊 Raw data received:', {
      dataLength: data?.length || 0,
      hasErrors: !!errors,
      firstTrack: data?.[0]
    })
    
    if (errors && errors.length > 0) {
      console.warn('⚠️ GraphQL errors occurred, but got', data.length, 'tracks')
      console.warn('💡 TIP: Try hard refresh (Cmd+Shift+R) to clear cache')
    }
    
    console.log('📊 Loaded tracks from DB:', data)
    console.log('📊 Total tracks loaded:', data?.length || 0)
    console.log('📊 First track audio features:', data[0] ? {
      bpm: data[0].bpm,
      key: data[0].key,
      energy: data[0].energy,
      danceability: data[0].danceability,
      valence: data[0].valence
    } : 'No tracks')
    
    setTracks(data)
    console.log('✅ Tracks set in state')
    
    // Load cover art URLs for all tracks
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
        
        // Auto-detect jingle based on filename
        const isJingle = file.name.toLowerCase().includes('jingle') || 
                        file.name.toLowerCase().includes('id') ||
                        file.name.toLowerCase().includes('sweeper')
        
        return {
          file,
          artist: parsed.artist || '',
          title: parsed.title,
          version: parsed.version || '',
          label: parsed.label || '',
          duration: metadata.duration || 0,
          progress: null,
          status: 'pending' as const,
          // Jingle & Tags defaults
          isJingle,
          jingleCategory: 'Station ID', // Always Station ID for jingles
          tags: '', // Use tags: WildFM, Sweepers, Promos, etc.
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

      // ✅ DUPLICATE CHECK: Check if track already exists
      const isDuplicate = tracks.some(track => {
        const existingArtist = (track.artist || '').toLowerCase().trim()
        const existingTitle = (track.title || '').toLowerCase().trim()
        const newArtist = (item.artist || '').toLowerCase().trim()
        const newTitle = (item.title || '').toLowerCase().trim()
        
        return existingArtist === newArtist && existingTitle === newTitle
      })

      if (isDuplicate) {
        console.log(`⏭️ Skipping duplicate: ${item.artist} - ${item.title}`)
        setUploadQueue(prev => prev.map((q, idx) => 
          idx === i ? { ...q, status: 'skipped' as const } : q
        ))
        continue
      }

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
        // Store S3 key (not presigned URL) so we can generate fresh URLs later
        const { data } = await createTrack({
          artist: item.artist || undefined,
          title: item.title,
          version: item.version || undefined,
          label: item.label || undefined,
          duration: item.duration || undefined,
          fileUrl: `public/${audioResult.key}`, // Store S3 path, not presigned URL
          fileSize: audioResult.size,
          format: audioResult.format,
          addedAt: new Date().toISOString(),
          // Jingle & Tags
          genre: item.isJingle ? item.jingleCategory : undefined,
          tags: item.tags || undefined,
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

  const handleDeleteTrack = async (id: string) => {
    const track = tracks.find(t => t.id === id)
    if (!track) return
    
    const confirmMsg = `Are you sure you want to delete "${track.title}"?\n\nThis will permanently remove:
- Track metadata
- Audio file from S3
- Cover art
- Waveform
    
This action cannot be undone!`
    
    if (!confirm(confirmMsg)) return
    
    console.log(`🗑️ Deleting track: ${track.title} (${id})`)
    
    try {
      // Delete from DynamoDB via GraphQL
      const result = await deleteTrack(id)
      
      // If we have errors AND no data, stop
      if (result.errors && !result.data) {
        console.error('❌ GraphQL delete failed completely:', result.errors)
        alert(`Failed to delete track: ${result.errors[0]?.message || 'Unknown error'}`)
        return
      }
      
      // If we have errors but also data, continue (partial success)
      if (result.errors && result.data) {
        console.warn('⚠️ Delete completed with some errors, continuing with S3 cleanup...')
      }
      
      // Delete S3 files (audio, cover art, waveform)
      console.log('🗑️ Deleting S3 files...')
      const { remove } = await import('aws-amplify/storage')
      
      const deletePromises = []
      
      // Delete audio file
      if (track.fileUrl) {
        const audioPath = track.fileUrl.replace('public/', '')
        deletePromises.push(
          remove({ path: audioPath })
            .then(() => console.log('✅ Deleted audio file'))
            .catch((err) => console.warn('⚠️ Failed to delete audio:', err))
        )
      }
      
      // Delete cover art
      if ((track as any).coverArtUrl) {
        deletePromises.push(
          remove({ path: (track as any).coverArtUrl })
            .then(() => console.log('✅ Deleted cover art'))
            .catch((err) => console.warn('⚠️ Failed to delete cover art:', err))
        )
      }
      
      // Delete waveform
      if ((track as any).waveformUrl) {
        deletePromises.push(
          remove({ path: (track as any).waveformUrl })
            .then(() => console.log('✅ Deleted waveform'))
            .catch((err) => console.warn('⚠️ Failed to delete waveform:', err))
        )
      }
      
      await Promise.allSettled(deletePromises)
      
      // Update local state
      setTracks(tracks.filter((t) => t.id !== id))
      console.log('✅ Track deleted successfully!')
      
    } catch (error) {
      console.error('❌ Error deleting track:', error)
      alert(`Failed to delete track: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDeleteAllTracks = async () => {
    const trackCount = tracks.length
    
    // Double confirmation for safety
    const firstConfirm = confirm(
      `⚠️ DELETE ALL TRACKS?\n\nYou are about to delete ${trackCount} track${trackCount !== 1 ? 's' : ''}.\n\nThis will permanently remove:\n- All track metadata from database\n- All audio files from S3\n- All cover art\n- All waveforms\n\nThis action CANNOT be undone!\n\nClick OK to continue, or Cancel to abort.`
    )
    
    if (!firstConfirm) return
    
    // Second confirmation with type requirement
    const confirmText = `DELETE ${trackCount} TRACKS`
    const secondConfirm = prompt(
      `⚠️ FINAL CONFIRMATION\n\nTo confirm deletion of ALL ${trackCount} tracks, please type:\n\n${confirmText}\n\n(Case sensitive)`
    )
    
    if (secondConfirm !== confirmText) {
      alert('Deletion cancelled - confirmation text did not match.')
      return
    }
    
    console.log(`🗑️ Starting bulk deletion of ${trackCount} tracks...`)
    
    try {
      const { remove } = await import('aws-amplify/storage')
      let successCount = 0
      let failureCount = 0
      
      // Delete each track
      for (const track of tracks) {
        try {
          console.log(`🗑️ Deleting ${successCount + 1}/${trackCount}: ${track.title}`)
          
          // Delete from DynamoDB
          const result = await deleteTrack(track.id)
          
          if (result.errors && !result.data) {
            console.error(`❌ Failed to delete ${track.title} from database`)
            failureCount++
            continue
          }
          
          // Delete S3 files (best effort)
          const deletePromises = []
          
          if (track.fileUrl) {
            const audioPath = track.fileUrl.replace('public/', '')
            deletePromises.push(
              remove({ path: audioPath }).catch(err => 
                console.warn(`⚠️ Failed to delete audio for ${track.title}:`, err)
              )
            )
          }
          
          if ((track as any).coverArtUrl) {
            deletePromises.push(
              remove({ path: (track as any).coverArtUrl }).catch(err => 
                console.warn(`⚠️ Failed to delete cover art for ${track.title}:`, err)
              )
            )
          }
          
          if ((track as any).waveformUrl) {
            deletePromises.push(
              remove({ path: (track as any).waveformUrl }).catch(err => 
                console.warn(`⚠️ Failed to delete waveform for ${track.title}:`, err)
              )
            )
          }
          
          await Promise.allSettled(deletePromises)
          successCount++
          
        } catch (error) {
          console.error(`❌ Error deleting ${track.title}:`, error)
          failureCount++
        }
      }
      
      // Clear local state
      setTracks([])
      
      // Show summary
      console.log(`✅ Bulk deletion complete!`)
      console.log(`   Successful: ${successCount}/${trackCount}`)
      if (failureCount > 0) {
        console.log(`   Failed: ${failureCount}/${trackCount}`)
      }
      
      alert(
        `Deletion complete!\n\n✅ Deleted: ${successCount} tracks\n${failureCount > 0 ? `⚠️ Failed: ${failureCount} tracks\n` : ''}\nCheck console for details.`
      )
      
    } catch (error) {
      console.error('❌ Bulk deletion error:', error)
      alert(`Bulk deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Audio Player Functions
  const handlePlayTrack = async (track: Track) => {
    try {
      // If clicking same track, toggle play/pause
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
      
      // Stop current audio if playing
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
      
      // Get S3 presigned URL for the track
      console.log('🎵 Loading track:', track.title)
      
      // Handle legacy tracks that might have full URLs stored
      let s3Path = track.fileUrl
      if (s3Path.includes('amazonaws.com')) {
        console.warn('⚠️ Track has old URL format, extracting path...')
        try {
          const url = new URL(s3Path)
          s3Path = url.pathname.replace(/^\//, '') // Remove leading slash
        } catch (e) {
          console.error('Failed to parse legacy URL:', e)
        }
      }
      
      const result = await getUrl({ path: s3Path })
      const url = result.url.toString()
      setAudioUrl(url)
      console.log('✅ Audio URL generated:', url.substring(0, 100) + '...')
      
      // Create new audio element
      const audio = new Audio(url)
      
      // Event listeners
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
        console.log(`✅ Loaded from CDN: ${track.title} (${audio.duration}s)`)
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
        console.error('Failed URL:', url)
        alert('Failed to load audio file from CDN')
        setPlayingTrackId(null)
        setIsPlaying(false)
      })
      
      setAudioElement(audio)
      setPlayingTrackId(track.id)
      
      // Start playing
      await audio.play()
      setIsPlaying(true)
      
    } catch (error) {
      console.error('❌ Error playing track:', error)
      alert('Failed to play track')
    }
  }
  
  const handleStopTrack = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    setPlayingTrackId(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }
  
  const handleSeek = (time: number) => {
    if (audioElement) {
      audioElement.currentTime = time
      setCurrentTime(time)
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

  // DEBUG: Log filtering
  console.log('🔍 Filter status:', {
    totalTracks: tracks.length,
    filteredTracks: filteredTracks.length,
    searchQuery,
    genreFilter,
    labelFilter
  })

  // Get unique genres and labels for filter dropdowns
  const uniqueGenres = Array.from(new Set(tracks.map(t => (t as any).genre).filter(Boolean)))
  const uniqueLabels = Array.from(new Set(tracks.map(t => t.label).filter(Boolean)))
  
  // Group filtered tracks by genre
  const tracksByGenre = filteredTracks.reduce((acc, track) => {
    const genre = (track as any).genre || 'Unknown'
    if (!acc[genre]) {
      acc[genre] = []
    }
    acc[genre].push(track)
    return acc
  }, {} as Record<string, Track[]>)
  
  // Sort genres by track count (descending)
  const sortedGenres = Object.keys(tracksByGenre).sort((a, b) => {
    return tracksByGenre[b].length - tracksByGenre[a].length
  })
  
  // Toggle genre expansion (accordion style - only one open at a time)
  const toggleGenre = (genre: string) => {
    setExpandedGenres(prev => {
      const isCurrentlyExpanded = prev[genre]
      
      // If clicking on already expanded genre, close it
      if (isCurrentlyExpanded) {
        return {}
      }
      
      // Otherwise, close all and open only this one
      return { [genre]: true }
    })
  }
  
  // Show more/less tracks for a genre
  const showMoreTracks = (genre: string) => {
    setGenreDisplayCounts(prev => ({
      ...prev,
      [genre]: (prev[genre] || 50) + 50
    }))
  }
  
  const showLessTracks = (genre: string) => {
    setGenreDisplayCounts(prev => ({
      ...prev,
      [genre]: 50
    }))
  }
  
  // Handle column sort
  const handleSort = (field: 'artist' | 'title' | 'bpm' | 'key' | 'year' | 'version' | 'label') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to ascending
      setSortField(field)
      setSortDirection('asc')
    }
  }
  
  // Get visible tracks for a genre (with sorting)
  const getVisibleTracks = (genre: string) => {
    let genreTracks = tracksByGenre[genre] || []
    
    // Apply sorting if a field is selected
    if (sortField) {
      genreTracks = [...genreTracks].sort((a, b) => {
        let aVal: any = sortField === 'bpm' || sortField === 'year' 
          ? ((a as any)[sortField] || 0)
          : ((a as any)[sortField] || '').toString().toLowerCase()
        let bVal: any = sortField === 'bpm' || sortField === 'year'
          ? ((b as any)[sortField] || 0)
          : ((b as any)[sortField] || '').toString().toLowerCase()
        
        // Handle numeric fields
        if (sortField === 'bpm' || sortField === 'year') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // Handle string fields
        if (sortDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        }
      })
    }
    
    const displayCount = genreDisplayCounts[genre] || 50
    return genreTracks.slice(0, displayCount)
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
                      item.status === 'skipped' ? 'bg-yellow-50 border-yellow-200' :
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
                          {item.status === 'skipped' && '⏭️'}
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

                    {/* Jingle & Tags Fields (only for pending items) */}
                    {item.status === 'pending' && (
                      <div className="grid grid-cols-3 gap-3 mb-3 mt-3 p-3 bg-white rounded border border-gray-200">
                        {/* Jingle Toggle */}
                        <div className="col-span-3 flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`jingle-${index}`}
                            checked={item.isJingle}
                            onChange={(e) => {
                              const newQueue = [...uploadQueue]
                              newQueue[index].isJingle = e.target.checked
                              if (e.target.checked && !newQueue[index].jingleCategory) {
                                newQueue[index].jingleCategory = 'WildFM Jingels'
                              }
                              setUploadQueue(newQueue)
                            }}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <label htmlFor={`jingle-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                            🎤 This is a Jingle/Station ID
                          </label>
                        </div>

                        {/* Genre Info (only if isJingle) */}
                        {item.isJingle && (
                          <div className="col-span-3">
                            <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                              <span className="text-xs font-medium text-purple-700">
                                🎤 Genre will be set to: <strong>Station ID</strong>
                              </span>
                              <p className="text-xs text-purple-600 mt-1">
                                Use tags below to categorize: WildFM, SplashFM, Sweepers, Promos, etc.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Tags Field */}
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {item.isJingle ? 'Tags (WildFM, SplashFM, Sweepers, Promos, etc.)' : 'Tags (Hot Hits, Oldies, Party, etc.)'}
                          </label>
                          <input
                            type="text"
                            value={item.tags}
                            onChange={(e) => {
                              const newQueue = [...uploadQueue]
                              newQueue[index].tags = e.target.value
                              setUploadQueue(newQueue)
                            }}
                            placeholder={item.isJingle ? "WildFM, SplashFM, Sweepers, Promos" : "Hot Hits, Oldies, Party"}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            💡 {item.isJingle ? 'Tags categorize jingles for playlist generation' : 'Use tags to categorize tracks for smart playlist generation'}
                          </p>
                        </div>
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

                    {/* Status Messages */}
                    {item.error && (
                      <div className="text-xs text-red-600 mt-1">{item.error}</div>
                    )}
                    {item.status === 'skipped' && (
                      <div className="text-xs text-yellow-700 mt-1">
                        ⏭️ Skipped: Track already exists in library
                      </div>
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
                <div className="flex gap-2">
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
                  
                  {tracks.length > 0 && (
                    <button
                      onClick={handleDeleteAllTracks}
                      className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 border border-red-700 rounded-md font-medium"
                    >
                      🗑️ Delete All Tracks
                    </button>
                  )}
                </div>
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

            {/* Track List - Grouped by Genre */}
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
              <div className="space-y-4">
                {/* Genre Groups */}
                {sortedGenres.map((genre) => {
                  const genreTracks = tracksByGenre[genre]
                  const isExpanded = expandedGenres[genre] === true // Default to collapsed
                  const visibleTracks = getVisibleTracks(genre)
                  const hasMore = genreTracks.length > visibleTracks.length
                  const displayCount = genreDisplayCounts[genre] || 50
                  
                  return (
                    <div key={genre} className="border border-gray-300 rounded-lg overflow-hidden">
                      {/* Genre Header - Clickable */}
                      <button
                        onClick={() => toggleGenre(genre)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{isExpanded ? '▼' : '▶'}</span>
                          <div className="text-left">
                            <h3 className="font-bold text-gray-900 text-lg">{genre}</h3>
                            <p className="text-sm text-gray-600">
                              {genreTracks.length} {genreTracks.length === 1 ? 'track' : 'tracks'}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          Click to {isExpanded ? 'collapse' : 'expand'}
                        </div>
                      </button>
                      
                      {/* Tracks in Genre */}
                      {isExpanded && (
                        <div className="bg-white">
                          {/* Header Row - Sortable */}
                          <div className="grid grid-cols-[auto_2fr_2fr_80px_100px_60px_80px_1.5fr_auto] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 sticky top-0">
                            <div></div>
                            <button 
                              onClick={() => handleSort('artist')}
                              className="text-left hover:text-blue-600 flex items-center gap-1"
                            >
                              Artist
                              {sortField === 'artist' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <button 
                              onClick={() => handleSort('title')}
                              className="text-left hover:text-blue-600 flex items-center gap-1"
                            >
                              Title
                              {sortField === 'title' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <button 
                              onClick={() => handleSort('bpm')}
                              className="text-center hover:text-blue-600 flex items-center justify-center gap-1"
                            >
                              🥁 BPM
                              {sortField === 'bpm' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <button 
                              onClick={() => handleSort('key')}
                              className="text-center hover:text-blue-600 flex items-center justify-center gap-1"
                            >
                              🎹 Key
                              {sortField === 'key' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <button 
                              onClick={() => handleSort('year')}
                              className="text-left hover:text-blue-600 flex items-center gap-1"
                            >
                              Year
                              {sortField === 'year' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <button 
                              onClick={() => handleSort('version')}
                              className="text-left hover:text-blue-600 flex items-center gap-1"
                            >
                              Version
                              {sortField === 'version' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <button 
                              onClick={() => handleSort('label')}
                              className="text-left hover:text-blue-600 flex items-center gap-1"
                            >
                              Label
                              {sortField === 'label' && (
                                <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                              )}
                            </button>
                            <div></div>
                          </div>

                          {/* Track Rows */}
                          {visibleTracks.map((track: Track) => (
                            <div key={track.id}>
                              <div
                                className="grid grid-cols-[auto_2fr_2fr_80px_100px_60px_80px_1.5fr_auto] gap-2 items-center p-3 border-b border-gray-100 hover:bg-gray-50"
                              >
                              {/* Cover Art */}
                              <div>
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
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {track.artist || '-'}
                              </div>
                              <div className="text-sm text-gray-900 truncate">
                                {track.title}
                              </div>
                              {/* BPM */}
                              <div className="text-center">
                                {track.bpm && track.bpm > 0 ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                    {track.bpm}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                              {/* Key */}
                              <div className="text-center">
                                {(track as any).key ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                                    {(track as any).key}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                {(track as any).year || '-'}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {track.version || '-'}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {track.label || '-'}
                              </div>
                    <div className="text-right flex gap-1 justify-end">
                      {/* Play Button */}
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

                  {/* Inline Audio Player */}
                  {playingTrackId === track.id && (
                    <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 animate-slideDown">
                      <div className="flex items-center gap-4">
                        {/* Playback Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayTrack(track)}
                            className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-md transition-all"
                            title={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? (
                              <span className="text-lg">⏸️</span>
                            ) : (
                              <span className="text-lg">▶️</span>
                            )}
                          </button>
                          <button
                            onClick={handleStopTrack}
                            className="w-8 h-8 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-sm"
                            title="Stop"
                          >
                            <span className="text-sm">⏹️</span>
                          </button>
                        </div>

                        {/* Track Info */}
                        <div className="flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-900">
                            {track.artist} - {track.title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatDuration(currentTime)} / {formatDuration(duration || track.duration || 0)}
                          </div>
                        </div>

                        {/* Timeline Scrubber */}
                        <div className="flex-1">
                          <div className="relative group">
                            {/* Progress Bar Background */}
                            <div className="h-2 bg-gray-300 rounded-full overflow-hidden cursor-pointer"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const x = e.clientX - rect.left
                                const percentage = x / rect.width
                                const newTime = percentage * duration
                                handleSeek(newTime)
                              }}
                            >
                              {/* Progress Fill */}
                              <div
                                className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all"
                                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                              />
                            </div>

                            {/* Trim Point Markers */}
                            {(track as any).trimStart !== undefined && (track as any).trimEnd !== undefined && track.duration && (
                              <>
                                {/* Trim Start Marker */}
                                <div
                                  className="absolute top-0 w-0.5 h-4 bg-green-600 shadow-lg"
                                  style={{
                                    left: `${((track as any).trimStart / track.duration) * 100}%`,
                                    transform: 'translateX(-50%)',
                                  }}
                                  title={`Cue In: ${formatDuration((track as any).trimStart)}`}
                                />
                                {/* Trim End Marker */}
                                <div
                                  className="absolute top-0 w-0.5 h-4 bg-red-600 shadow-lg"
                                  style={{
                                    left: `${((track as any).trimEnd / track.duration) * 100}%`,
                                    transform: 'translateX(-50%)',
                                  }}
                                  title={`Cue Out: ${formatDuration((track as any).trimEnd)}`}
                                />
                              </>
                            )}

                            {/* Playhead */}
                            <div
                              className="absolute top-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow-lg transform -translate-y-1/2 -translate-x-1/2 group-hover:scale-125 transition-transform"
                              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            />
                          </div>

                          {/* Time Markers */}
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>0:00</span>
                            {(track as any).trimStart !== undefined && (
                              <span className="text-green-600" title="Cue In">
                                ▼ {formatDuration((track as any).trimStart)}
                              </span>
                            )}
                            {(track as any).trimEnd !== undefined && (
                              <span className="text-red-600" title="Cue Out">
                                {formatDuration((track as any).trimEnd)} ▼
                              </span>
                            )}
                            <span>{formatDuration(track.duration || 0)}</span>
                          </div>
                        </div>

                        {/* BPM & Key Display */}
                        <div className="flex-shrink-0 text-right">
                          {track.bpm && track.bpm > 0 && (
                            <div className="text-sm font-semibold text-blue-700">
                              {track.bpm} BPM
                            </div>
                          )}
                          {(track as any).key && (
                            <div className="text-xs text-indigo-600">
                              {(track as any).key}
                            </div>
                          )}
                        </div>
                      </div>
                              </div>
                            )}
                          </div>
                          ))}
                          
                          {/* Show More/Less Buttons */}
                          {genreTracks.length > 50 && (
                            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-center gap-3">
                              {hasMore ? (
                                <button
                                  onClick={() => showMoreTracks(genre)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                  Show More (+50 tracks)
                                </button>
                              ) : displayCount > 50 && (
                                <button
                                  onClick={() => showLessTracks(genre)}
                                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                                >
                                  Show Less (first 50)
                                </button>
                              )}
                              <span className="px-4 py-2 text-sm text-gray-600">
                                Showing {visibleTracks.length} of {genreTracks.length} tracks
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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

              {/* DJ Cue Points (Trim Detection) */}
              {((selectedTrack as any).trimStart !== undefined || (selectedTrack as any).trimEnd !== undefined) && (
                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">DJ Cue Points ✂️</h4>
                  <div className="space-y-2">
                    {/* Visual Timeline */}
                    <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                      {/* Full duration bar */}
                      <div className="absolute inset-0 flex items-center px-2">
                        <div className="w-full h-2 bg-gray-300 rounded-full relative">
                          {/* Actual audio region (between trim points) */}
                          {(selectedTrack as any).trimStart !== undefined && (selectedTrack as any).trimEnd !== undefined && selectedTrack.duration && (
                            <>
                              {/* Active audio region */}
                              <div
                                className="absolute h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                                style={{
                                  left: `${((selectedTrack as any).trimStart / selectedTrack.duration) * 100}%`,
                                  width: `${(((selectedTrack as any).trimEnd - (selectedTrack as any).trimStart) / selectedTrack.duration) * 100}%`,
                                }}
                              />
                              {/* Trim Start Marker */}
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-green-500 shadow-lg"
                                style={{
                                  left: `${((selectedTrack as any).trimStart / selectedTrack.duration) * 100}%`,
                                }}
                                title={`Start: ${(selectedTrack as any).trimStart?.toFixed(2)}s`}
                              />
                              {/* Trim End Marker */}
                              <div
                                className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-red-500 shadow-lg"
                                style={{
                                  left: `${((selectedTrack as any).trimEnd / selectedTrack.duration) * 100}%`,
                                }}
                                title={`End: ${(selectedTrack as any).trimEnd?.toFixed(2)}s`}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cue Point Details */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="text-green-700 font-semibold mb-1">🎯 Cue In</div>
                        <div className="text-green-900 font-mono">
                          {(selectedTrack as any).trimStart !== undefined 
                            ? `${formatDuration((selectedTrack as any).trimStart)}`
                            : '-'}
                        </div>
                        <div className="text-green-600 text-[10px] mt-1">
                          Intro: {(selectedTrack as any).trimStart 
                            ? `${(selectedTrack as any).trimStart.toFixed(1)}s silence`
                            : '-'}
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <div className="text-blue-700 font-semibold mb-1">🎵 Active</div>
                        <div className="text-blue-900 font-mono">
                          {(selectedTrack as any).trimStart !== undefined && (selectedTrack as any).trimEnd !== undefined
                            ? formatDuration((selectedTrack as any).trimEnd - (selectedTrack as any).trimStart)
                            : '-'}
                        </div>
                        <div className="text-blue-600 text-[10px] mt-1">
                          Actual audio duration
                        </div>
                      </div>

                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <div className="text-red-700 font-semibold mb-1">🏁 Cue Out</div>
                        <div className="text-red-900 font-mono">
                          {(selectedTrack as any).trimEnd !== undefined 
                            ? `${formatDuration((selectedTrack as any).trimEnd)}`
                            : '-'}
                        </div>
                        <div className="text-red-600 text-[10px] mt-1">
                          Outro: {(selectedTrack as any).trimEnd && selectedTrack.duration
                            ? `${(selectedTrack.duration - (selectedTrack as any).trimEnd).toFixed(1)}s silence`
                            : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 italic">
                      💡 Auto-detected using -40dB gate • Perfect for DJ mixing
                    </div>
                  </div>
                </div>
              )}

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
