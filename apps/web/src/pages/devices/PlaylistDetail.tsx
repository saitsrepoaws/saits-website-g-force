import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getPlaylist, addTracksToPlaylist, removeTrackFromPlaylist, deletePlaylist, updatePlaylist, reorderPlaylistTracks } from '../../services/playlists'
import { listTracks } from '../../services/tracks'
import { playlistIoT } from '../../services/playlistIoT'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist, PlaylistTrackItem } from '../../types/playlist'
import type { Track } from '../../services/tracks'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sortable Track Row Component
interface SortableTrackRowProps {
  track: PlaylistTrackItem
  index: number
  coverArtUrl?: string
  trackToggles: Record<string, boolean>
  onToggleArrow: (trackId: string) => void
  onRemove: (trackId: string) => void
  formatDuration: (seconds: number) => string
  playingTrackId: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlay: (trackId: string) => void
  onStop: () => void
  onSeek: (time: number) => void
}

function SortableTrackRow({ 
  track, 
  index, 
  coverArtUrl,
  trackToggles,
  onToggleArrow,
  onRemove,
  formatDuration,
  playingTrackId,
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onStop,
  onSeek
}: SortableTrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.trackId })

  // Check if this is a jingle
  const isJingle = track.trackGenre === 'Station ID' ||
                   track.trackGenre?.toLowerCase().includes('jingle') || 
                   track.trackGenre?.toLowerCase().includes('id') ||
                   track.trackGenre === 'WildFM Jingels' // Legacy support

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Special styling for jingles
  if (isJingle) {
    return (
      <div>
        <div
          ref={setNodeRef}
          style={style}
          className={`grid grid-cols-[auto,auto,1fr,auto,auto] gap-3 items-center p-3 border-2 rounded-lg ${
            isDragging 
              ? 'bg-purple-100 shadow-lg z-10 border-purple-400' 
              : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300 hover:border-purple-400'
          }`}
        >
          <div className="text-sm text-purple-600 font-bold cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
            ⋮⋮ {index + 1}
          </div>
          
          {/* Jingle Icon */}
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full">
            <span className="text-white text-xl">🎤</span>
          </div>
          
          {/* Jingle Info */}
          <div>
            <div className="text-sm font-bold text-purple-900 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-purple-200 text-purple-700 text-xs font-bold rounded-full">JINGLE</span>
              {track.trackTitle || 'Jingle'}
            </div>
            <div className="text-xs text-purple-600 mt-1">
              {track.trackGenre} • {formatDuration(track.trackDuration || 0)}
            </div>
          </div>
          
          {/* Play Button (simplified for jingles) */}
          <button
            onClick={() => playingTrackId === track.trackId ? onStop() : onPlay(track.trackId)}
            className="px-3 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 text-sm font-medium transition-colors"
          >
            {playingTrackId === track.trackId && isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          
          {/* Remove */}
          <button
            onClick={() => onRemove(track.trackId)}
            className="text-purple-400 hover:text-red-500 p-2"
            title="Remove jingle"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Regular track styling
  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={`grid grid-cols-[auto,auto,2fr,2fr,1.5fr,60px,80px,80px,auto,50px] gap-2 items-center p-3 border border-gray-200 rounded ${
          isDragging ? 'bg-blue-50 shadow-lg z-10' : 'hover:bg-gray-50'
        }`}
      >
      <div className="text-sm text-gray-500 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        ⋮⋮ {index + 1}
      </div>
      
      {/* Cover Art */}
      <div>
        {coverArtUrl ? (
          <img
            src={coverArtUrl}
            alt={track.trackTitle}
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-gray-400 text-xs">🎵</span>
          </div>
        )}
      </div>
      
      <div className="text-sm font-medium text-gray-900 truncate">
        {track.trackTitle || 'Unknown'}
      </div>
      <div className="text-sm text-gray-600 truncate">
        {track.trackArtist || '-'}
      </div>
      <div className="text-xs text-gray-600 truncate">
        {track.trackGenre || '-'}
      </div>
      <div className="text-xs text-gray-600 text-center">
        {(track as any).trackKey ? (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
            {(track as any).trackKey}
          </span>
        ) : '-'}
      </div>
      <div className="text-xs text-gray-600">
        {track.trackBpm || '-'}
      </div>
      <div className="text-xs text-gray-600">
        {track.trackDuration ? formatDuration(track.trackDuration) : '-'}
      </div>
      
      {/* Play Button */}
      <div className="text-center flex gap-1">
        <button
          onClick={() => onPlay(track.trackId)}
          className={`text-sm ${
            playingTrackId === track.trackId
              ? 'text-green-700 bg-green-100 px-2 py-1 rounded'
              : 'text-green-600 hover:bg-green-50 px-2 py-1 rounded'
          }`}
          title={playingTrackId === track.trackId ? (isPlaying ? 'Pause' : 'Resume') : 'Play'}
        >
          {playingTrackId === track.trackId ? (isPlaying ? '⏸️' : '▶️') : '▶️'}
        </button>
      </div>
      
      {/* Delete */}
      <div className="text-right">
        <button
          onClick={() => onRemove(track.trackId)}
          className="text-red-600 hover:text-red-700 text-sm"
        >
          🗑️
        </button>
      </div>
    </div>

    {/* Inline Audio Player */}
    {playingTrackId === track.trackId && (
      <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 mb-2">
        <div className="flex items-center gap-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPlay(track.trackId)}
              className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-md transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <span className="text-lg">⏸️</span> : <span className="text-lg">▶️</span>}
            </button>
            <button
              onClick={onStop}
              className="w-8 h-8 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full shadow-sm"
              title="Stop"
            >
              <span className="text-sm">⏹️</span>
            </button>
          </div>

          {/* Track Info */}
          <div className="flex-shrink-0">
            <div className="text-sm font-semibold text-gray-900">
              {track.trackArtist} - {track.trackTitle}
            </div>
            <div className="text-xs text-gray-600">
              {formatDuration(currentTime)} / {formatDuration(duration || track.trackDuration || 0)}
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex-1">
            <div className="relative group">
              <div
                className="h-2 bg-gray-300 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percentage = x / rect.width
                  const newTime = percentage * duration
                  onSeek(newTime)
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

          {/* BPM & Key */}
          <div className="flex-shrink-0 text-right">
            {track.trackBpm && (
              <div className="text-sm font-semibold text-blue-700">
                {track.trackBpm} BPM
              </div>
            )}
            {(track as any).trackKey && (
              <div className="text-xs text-indigo-600">
                {(track as any).trackKey}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
  )
}

function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  )
  
  // Add tracks modal
  const [showAddTracks, setShowAddTracks] = useState(false)
  const [allTracks, setAllTracks] = useState<Track[]>([])
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set())
  const [coverArtUrls, setCoverArtUrls] = useState<Record<string, string>>({})
  
  // Search & filter for add tracks modal
  const [searchQuery, setSearchQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  
  // Track toggles (arrow state per track)
  const [trackToggles, setTrackToggles] = useState<Record<string, boolean>>({})
  
  // Audio Player State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  // Load playlist
  useEffect(() => {
    if (id) {
      loadPlaylist()
      loadAllTracks()
    }
  }, [id])
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (!id) return
    
    const unsubscribe = playlistIoT.subscribeToPlaylist(id, (event) => {
      console.log('📩 Real-time event:', event)
      // Reload playlist when changes occur
      loadPlaylist()
    })
    
    return () => unsubscribe()
  }, [id])
  
  async function loadPlaylist() {
    if (!id) return
    
    setIsLoading(true)
    try {
      const { data } = await getPlaylist(id)
      if (data) {
        setPlaylist(data as Playlist)
        
        // Parse tracks from JSON
        const tracks: PlaylistTrackItem[] = JSON.parse((data as any).tracks || '[]')
        setPlaylistTracks(tracks)
        
        console.log('📊 Playlist loaded:', data)
        console.log('🎵 Tracks:', tracks)
      }
    } catch (error) {
      console.error('Failed to load playlist:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  async function loadAllTracks() {
    try {
      const { data } = await listTracks()
      setAllTracks(data as Track[])
      
      // Load cover art URLs
      const urls: Record<string, string> = {}
      await Promise.all(
        (data as Track[]).map(async (track: any) => {
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
    } catch (error) {
      console.error('Failed to load tracks:', error)
    }
  }
  
  async function handleAddSelectedTracks() {
    if (!id || selectedTrackIds.size === 0) return
    
    // Convert selected track IDs to PlaylistTrackItem[]
    const tracksToAdd: PlaylistTrackItem[] = Array.from(selectedTrackIds).map(trackId => {
      const track = allTracks.find(t => t.id === trackId)
      if (!track) return null
      
      return {
        trackId: track.id,
        order: playlistTracks.length, // Will be recalculated in service
        addedAt: new Date().toISOString(),
        trackTitle: track.title,
        trackArtist: track.artist,
        trackDuration: track.duration,
        trackBpm: track.bpm,
        trackKey: (track as any).key, // Include musical key
        trackGenre: (track as any).genre,
        trackCoverArtUrl: track.coverArtUrl,
      }
    }).filter(Boolean) as PlaylistTrackItem[]
    
    try {
      const result = await addTracksToPlaylist(id, tracksToAdd)
      
      // Check if any tracks were actually added
      const currentPlaylistTracks: PlaylistTrackItem[] = JSON.parse((result.data as any)?.tracks || '[]')
      const addedCount = currentPlaylistTracks.length - playlistTracks.length
      
      if (addedCount === 0) {
        alert('⚠️ No tracks added - all selected tracks are already in this playlist')
        return
      }
      
      console.log(`✅ ${addedCount} track(s) added to playlist`)
      
      // Notify via IoT
      for (const track of tracksToAdd) {
        await playlistIoT.trackAdded(id, track)
      }
      
      // Reload playlist
      await loadPlaylist()
      
      // Close modal
      setShowAddTracks(false)
      setSelectedTrackIds(new Set())
      setSearchQuery('')
      setGenreFilter('all')
      
      // Show success message
      if (addedCount < tracksToAdd.length) {
        alert(`✅ Added ${addedCount} track(s). ${tracksToAdd.length - addedCount} duplicate(s) skipped.`)
      }
    } catch (error: any) {
      console.error('Failed to add tracks:', error)
      // Show specific error message (e.g., duration limit exceeded)
      alert(error?.message || 'Failed to add tracks to playlist')
    }
  }
  
  async function handleRemoveTrack(trackId: string) {
    if (!id) return
    
    if (!confirm('Remove this track from playlist?')) return
    
    try {
      await removeTrackFromPlaylist(id, trackId)
      console.log('✅ Track removed from playlist')
      
      // Notify via IoT
      await playlistIoT.trackRemoved(id, trackId)
      
      // Reload playlist
      await loadPlaylist()
    } catch (error) {
      console.error('Failed to remove track:', error)
      alert('Failed to remove track')
    }
  }
  
  async function handleDeletePlaylist() {
    if (!id || !playlist) return
    
    if (!confirm(`Are you sure you want to delete "${playlist.name}"?\n\nThis action cannot be undone.`)) {
      return
    }
    
    try {
      await deletePlaylist(id)
      console.log('✅ Playlist deleted:', id)
      
      // Notify via IoT
      await playlistIoT.playlistDeleted(id)
      
      // Navigate back to playlist overview
      navigate('/devices/playlist')
    } catch (error) {
      console.error('Failed to delete playlist:', error)
      alert('Failed to delete playlist')
    }
  }
  
  function toggleTrackSelection(trackId: string) {
    const newSelection = new Set(selectedTrackIds)
    if (newSelection.has(trackId)) {
      newSelection.delete(trackId)
    } else {
      newSelection.add(trackId)
    }
    setSelectedTrackIds(newSelection)
  }
  
  function selectAllTracks() {
    const allTrackIds = new Set(filteredAllTracks.map(t => t.id))
    setSelectedTrackIds(allTrackIds)
  }
  
  function deselectAllTracks() {
    setSelectedTrackIds(new Set())
  }
  
  function toggleTrackArrow(trackId: string) {
    setTrackToggles(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }))
  }
  
  function toggleAllTracks() {
    // Check if all are currently toggled
    const allToggled = playlistTracks.every(t => trackToggles[t.trackId])
    
    if (allToggled) {
      // Turn all off
      setTrackToggles({})
    } else {
      // Turn all on
      const newToggles: Record<string, boolean> = {}
      playlistTracks.forEach(t => {
        newToggles[t.trackId] = true
      })
      setTrackToggles(newToggles)
    }
  }
  
  async function handleDeleteAllTracks() {
    if (!id || playlistTracks.length === 0) return
    
    if (!confirm(`Are you sure you want to remove ALL ${playlistTracks.length} tracks from this playlist?\n\nThis cannot be undone.`)) {
      return
    }
    
    try {
      // Remove all tracks by setting empty tracks array
      const { errors } = await updatePlaylist({
        id,
        // @ts-ignore
        tracks: '[]',
        trackCount: 0,
        totalDuration: 0,
      })
      
      if (errors) {
        throw new Error('Failed to clear playlist')
      }
      
      console.log('✅ All tracks removed from playlist')
      
      // Notify via IoT for each track
      for (const track of playlistTracks) {
        await playlistIoT.trackRemoved(id, track.trackId)
      }
      
      // Reload playlist
      await loadPlaylist()
    } catch (error) {
      console.error('Failed to delete all tracks:', error)
      alert('Failed to remove all tracks')
    }
  }
  
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    
    if (!over || active.id === over.id || !id) return
    
    const oldIndex = playlistTracks.findIndex(t => t.trackId === active.id)
    const newIndex = playlistTracks.findIndex(t => t.trackId === over.id)
    
    if (oldIndex === -1 || newIndex === -1) return
    
    // Optimistic UI update
    const newTracks = [...playlistTracks]
    const [movedTrack] = newTracks.splice(oldIndex, 1)
    newTracks.splice(newIndex, 0, movedTrack)
    setPlaylistTracks(newTracks)
    
    try {
      // Update order in database
      const trackIds = newTracks.map(t => t.trackId)
      await reorderPlaylistTracks(id, trackIds)
      
      // Notify via IoT
      await playlistIoT.tracksReordered(id, trackIds)
      
      console.log('✅ Tracks reordered successfully')
    } catch (error) {
      console.error('Failed to reorder tracks:', error)
      // Revert on error
      await loadPlaylist()
      alert('Failed to reorder tracks')
    }
  }
  
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Audio Player Functions
  async function handlePlayTrack(trackId: string) {
    try {
      const trackItem = playlistTracks.find(t => t.trackId === trackId)
      if (!trackItem) return
      
      // Toggle if same track
      if (playingTrackId === trackId && audioElement) {
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
      
      // Find full track for fileUrl
      const fullTrack = allTracks.find(t => t.id === trackId)
      if (!fullTrack || !fullTrack.fileUrl) {
        console.error('Track not found or missing fileUrl')
        return
      }
      
      console.log('🎵 Loading track:', trackItem.trackTitle)
      
      // Handle legacy URLs
      let s3Path = fullTrack.fileUrl
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
      
      const audio = new Audio(url)
      
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
        console.log(`✅ Loaded: ${trackItem.trackTitle} (${audio.duration}s)`)
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
      setPlayingTrackId(trackId)
      
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
  
  // Filter tracks for add modal
  const filteredAllTracks = allTracks.filter(track => {
    // Already in playlist?
    const inPlaylist = playlistTracks.some(pt => pt.trackId === track.id)
    
    // Search filter
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || 
      track.artist?.toLowerCase().includes(searchLower) ||
      track.title?.toLowerCase().includes(searchLower) ||
      (track as any).genre?.toLowerCase().includes(searchLower)
    
    // Genre filter
    const matchesGenre = genreFilter === 'all' || (track as any).genre === genreFilter
    
    return !inPlaylist && matchesSearch && matchesGenre
  })
  
  const uniqueGenres = Array.from(new Set(allTracks.map(t => (t as any).genre).filter(Boolean)))
  
  if (isLoading) {
    return (
      <Layout title="Loading..." showBackButton backTo="/devices/playlist">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading playlist...</p>
        </div>
      </Layout>
    )
  }
  
  if (!playlist) {
    return (
      <Layout title="Not Found" showBackButton backTo="/devices/playlist">
        <div className="text-center py-12">
          <p className="text-gray-500">Playlist not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={playlist.name} showBackButton backTo="/devices/playlist">
      <div className="max-w-7xl mx-auto">
        {/* Playlist Header */}
        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
          <div className="flex gap-6">
            {/* Cover */}
            <div className="w-40 h-40 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-6xl">🎵</span>
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{playlist.name}</h1>
              {playlist.description && (
                <p className="text-gray-600 mb-3">{playlist.description}</p>
              )}
              
              {/* Metadata Tags */}
              {(playlist.genre || playlist.mood || playlist.key || playlist.bpmMin || playlist.tags) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {playlist.genre && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                      🎵 {playlist.genre}
                    </span>
                  )}
                  {playlist.mood && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                      ✨ {playlist.mood}
                    </span>
                  )}
                  {playlist.key && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                      🎹 {playlist.key}
                    </span>
                  )}
                  {playlist.bpmMin && playlist.bpmMax && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
                      ⚡ {playlist.bpmMin}-{playlist.bpmMax} BPM
                    </span>
                  )}
                  {playlist.tags && playlist.tags.split(',').map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      #{tag.trim()}
                    </span>
                  ))}
                </div>
              )}
              
              <div className="text-sm text-gray-500 space-y-1">
                <div>
                  {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                  {playlist.totalDuration > 0 && (
                    <> · {Math.floor(playlist.totalDuration / 60)}:{(playlist.totalDuration % 60).toString().padStart(2, '0')} min</>
                  )}
                </div>
                {/* Duration limit indicator */}
                {(() => {
                  const MAX_DURATION = 59 * 60 // 3540 seconds
                  const remaining = MAX_DURATION - (playlist.totalDuration || 0)
                  const remainingMin = Math.floor(remaining / 60)
                  const remainingSec = remaining % 60
                  const percentUsed = ((playlist.totalDuration || 0) / MAX_DURATION) * 100
                  
                  return (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            percentUsed > 90 ? 'bg-red-500' : 
                            percentUsed > 75 ? 'bg-yellow-500' : 
                            'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(percentUsed, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        percentUsed > 90 ? 'text-red-600' : 
                        percentUsed > 75 ? 'text-yellow-600' : 
                        'text-gray-600'
                      }`}>
                        {remainingMin}:{remainingSec.toString().padStart(2, '0')} left (max 59:00)
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowAddTracks(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <span>+</span>
                Add Tracks
              </button>
              <button
                onClick={handleDeletePlaylist}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2 justify-center"
              >
                <span>🗑️</span>
                Delete Playlist
              </button>
            </div>
          </div>
        </div>
        
        {/* Track List */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tracks</h2>
          
          {playlistTracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No tracks in this playlist yet</p>
              <button
                onClick={() => setShowAddTracks(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Tracks
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[auto,auto,2fr,2fr,1.5fr,60px,80px,80px,50px,50px] gap-2 px-3 py-2 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                <div>#</div>
                <div></div>
                <div>Title</div>
                <div>Artist</div>
                <div>Genre</div>
                <div className="text-center">Key</div>
                <div>BPM</div>
                <div>Duration</div>
                <div className="text-center">
                  <button
                    onClick={toggleAllTracks}
                    className="text-gray-600 hover:text-blue-600 transition-transform inline-block"
                    style={{
                      transform: playlistTracks.length > 0 && playlistTracks.every(t => trackToggles[t.trackId]) 
                        ? 'rotate(90deg)' 
                        : 'rotate(0deg)',
                    }}
                    title="Toggle all tracks"
                  >
                    ▶️
                  </button>
                </div>
                <div className="text-center">
                  <button
                    onClick={handleDeleteAllTracks}
                    disabled={playlistTracks.length === 0}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove all tracks"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              {/* Tracks - Drag and Drop */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={playlistTracks.map(t => t.trackId)}
                  strategy={verticalListSortingStrategy}
                >
                  {playlistTracks.map((track, index) => (
                    <SortableTrackRow
                      key={track.trackId}
                      track={track}
                      index={index}
                      coverArtUrl={coverArtUrls[track.trackId]}
                      trackToggles={trackToggles}
                      onToggleArrow={toggleTrackArrow}
                      onRemove={handleRemoveTrack}
                      formatDuration={formatDuration}
                      playingTrackId={playingTrackId}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      duration={duration}
                      onPlay={handlePlayTrack}
                      onStop={handleStopTrack}
                      onSeek={handleSeek}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
        
        {/* Add Tracks Modal */}
        {showAddTracks && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">Add Tracks to Playlist</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {filteredAllTracks.length} available · {playlistTracks.length} already in playlist
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddTracks(false)
                      setSelectedTrackIds(new Set())
                      setSearchQuery('')
                      setGenreFilter('all')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Search & Filter */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="🔍 Search tracks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Genres</option>
                    {uniqueGenres.map(genre => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                </div>
                
                {/* Selection Controls */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllTracks}
                      disabled={filteredAllTracks.length === 0}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ☑️ Select All ({filteredAllTracks.length})
                    </button>
                    <button
                      onClick={deselectAllTracks}
                      disabled={selectedTrackIds.size === 0}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ☐ Deselect All
                    </button>
                  </div>
                  
                  {selectedTrackIds.size > 0 && (
                    <div className="text-sm text-blue-600 font-medium">
                      {selectedTrackIds.size} {selectedTrackIds.size === 1 ? 'track' : 'tracks'} selected
                    </div>
                  )}
                </div>
              </div>
              
              {/* Track List */}
              <div className="flex-1 overflow-y-auto p-6">
                {filteredAllTracks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchQuery || genreFilter !== 'all' 
                      ? 'No matching tracks found'
                      : 'All tracks are already in this playlist'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAllTracks.map((track) => (
                      <div
                        key={track.id}
                        onClick={() => toggleTrackSelection(track.id)}
                        className={`grid grid-cols-12 gap-2 items-center p-3 border rounded cursor-pointer transition-colors ${
                          selectedTrackIds.has(track.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="col-span-1">
                          <input
                            type="checkbox"
                            checked={selectedTrackIds.has(track.id)}
                            onChange={() => toggleTrackSelection(track.id)}
                            className="w-4 h-4"
                          />
                        </div>
                        <div className="col-span-1">
                          {coverArtUrls[track.id] ? (
                            <img
                              src={coverArtUrls[track.id]}
                              alt={track.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                              <span className="text-gray-400 text-xs">🎵</span>
                            </div>
                          )}
                        </div>
                        <div className="col-span-3 text-sm font-medium text-gray-900 truncate">
                          {track.title}
                        </div>
                        <div className="col-span-2 text-sm text-gray-600 truncate">
                          {track.artist || '-'}
                        </div>
                        <div className="col-span-2 text-xs text-gray-600 truncate">
                          {(track as any).genre || '-'}
                        </div>
                        <div className="col-span-1 text-xs text-gray-600">
                          {track.bpm || '-'}
                        </div>
                        <div className="col-span-2 text-xs text-gray-600">
                          {track.duration ? formatDuration(track.duration) : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => {
                    setShowAddTracks(false)
                    setSelectedTrackIds(new Set())
                    setSearchQuery('')
                    setGenreFilter('all')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSelectedTracks}
                  disabled={selectedTrackIds.size === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {selectedTrackIds.size > 0 && `(${selectedTrackIds.size})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default PlaylistDetail
