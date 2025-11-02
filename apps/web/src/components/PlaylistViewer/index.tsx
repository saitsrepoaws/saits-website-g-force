import { useState, useEffect } from 'react'
import { getPlaylist, removeTrackFromPlaylist, reorderPlaylistTracks } from '../../services/playlists'
import { listTracks, type Track } from '../../services/tracks'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist, PlaylistTrackItem } from '../../types/playlist'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sortable Track Row Component
interface SortableTrackRowProps {
  track: PlaylistTrackItem
  index: number
  coverArtUrl?: string
  formatDuration: (seconds: number) => string
  playingTrackId: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlay: (trackId: string) => void
  onStop: () => void
  onSeek: (time: number) => void
  onRemove?: (trackId: string) => void
  showDragHandle?: boolean
  showDelete?: boolean
  compact?: boolean
  trackStatus?: 'past' | 'current' | 'future'
  scheduledTime?: { start: string; end: string } | null
  isLoadedInPlayer?: boolean
}

function SortableTrackRow({ 
  track, 
  index, 
  coverArtUrl,
  formatDuration,
  playingTrackId,
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onStop,
  onSeek,
  onRemove,
  showDragHandle = true,
  showDelete = true,
  compact = false,
  trackStatus,
  scheduledTime,
  isLoadedInPlayer = false
}: SortableTrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.trackId, disabled: !showDragHandle })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={`grid ${
          compact 
            ? 'grid-cols-[auto,2fr,1.5fr,80px,60px,60px,auto]' 
            : 'grid-cols-[auto,auto,2fr,2fr,1.5fr,60px,80px,80px,150px,auto,50px]'
        } gap-3 items-center p-3 border rounded-lg ${
          isLoadedInPlayer
            ? 'bg-orange-100 border-orange-400 shadow-md' 
            : trackStatus === 'current'
              ? 'bg-purple-100 border-purple-400 shadow-md' 
              : trackStatus === 'future'
                ? 'bg-green-50 border-green-300'
                : trackStatus === 'past'
                  ? 'bg-gray-100 border-gray-300 opacity-60'
                  : isDragging 
                    ? 'bg-blue-50 border-gray-200 shadow-lg z-10' 
                    : 'border-gray-200 hover:bg-gray-50'
        } transition-colors`}
      >
      {showDragHandle && (
        <div className="text-sm text-gray-500 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          ⋮⋮ {index + 1}
        </div>
      )}
      
      {!compact && (
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
      )}
      
      {/* Artist - Always show */}
      <div className={`text-sm font-semibold truncate ${
        trackStatus === 'past' ? 'text-gray-400' : 'text-gray-700'
      }`}>
        {track.trackArtist || 'Unknown Artist'}
      </div>
      
      {/* Title - Always show */}
      <div className={`text-sm font-medium truncate ${
        trackStatus === 'past' ? 'text-gray-400' : 'text-gray-900'
      }`}>
        {track.trackTitle || 'Unknown'}
      </div>

      {/* Compact mode: BPM, Key, Year */}
      {compact && (
        <>
          <div className="text-center">
            {track.trackBpm ? (
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                trackStatus === 'past' 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {track.trackBpm} BPM
              </span>
            ) : (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
          <div className="text-center">
            {(track as any).trackKey ? (
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                trackStatus === 'past' 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {(track as any).trackKey}
              </span>
            ) : (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
          <div className="text-center">
            {(track as any).trackYear ? (
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                trackStatus === 'past' 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {(track as any).trackYear}
              </span>
            ) : (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
        </>
      )}

      {/* Full mode: Genre, Key, BPM, Duration */}
      {!compact && (
        <>
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
        </>
      )}

      {/* Scheduled Time */}
      {scheduledTime && (
        <div className={`text-xs font-mono whitespace-nowrap ${
          trackStatus === 'past' 
            ? 'text-gray-400' 
            : trackStatus === 'current'
            ? 'text-green-600 font-semibold'
            : 'text-gray-600'
        } ${compact ? '' : 'bg-blue-50 px-2 py-1 rounded border border-blue-200'}`}>
          {compact ? scheduledTime.start : `${scheduledTime.start} - ${scheduledTime.end}`}
        </div>
      )}
      
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
      {showDelete && onRemove && (
        <div className="text-right">
          <button
            onClick={() => onRemove(track.trackId)}
            className="text-red-600 hover:text-red-700 text-sm"
          >
            🗑️
          </button>
        </div>
      )}
    </div>

    {/* Inline Audio Player */}
    {playingTrackId === track.trackId && (
      <div className="border border-gray-200 border-t-0 rounded-b-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 mb-2">
        <div className="flex items-center gap-4">
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

          <div className="flex-shrink-0">
            <div className="text-sm font-semibold text-gray-900">
              {track.trackArtist} - {track.trackTitle}
            </div>
            <div className="text-xs text-gray-600">
              {formatDuration(currentTime)} / {formatDuration(duration || track.trackDuration || 0)}
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

          {!compact && (
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
          )}
        </div>
      </div>
    )}
  </div>
  )
}

export interface PlaylistViewerProps {
  playlistId: string
  
  // Display options
  showHeader?: boolean
  showDragHandle?: boolean
  showDelete?: boolean
  compact?: boolean
  maxHeight?: string
  
  // Feature toggles
  allowReorder?: boolean
  allowRemove?: boolean
  allowPlay?: boolean
  
  // Highlight
  highlightTrackId?: string | null
  currentTrackIndex?: number | null
  scheduleSlot?: { time: string; duration: number } | null
  loadedTrackId?: string | null
  
  // Callbacks
  onTrackSelect?: (track: PlaylistTrackItem) => void
  onTrackRemove?: (trackId: string) => void
  onPlaylistUpdate?: (playlist: Playlist) => void
  onTracksLoaded?: (tracks: PlaylistTrackItem[]) => void
  
  // Styling
  className?: string
  containerClassName?: string
}

export function PlaylistViewer({
  playlistId,
  showHeader = true,
  showDragHandle = true,
  showDelete = true,
  compact = false,
  maxHeight,
  allowReorder = true,
  allowRemove = true,
  allowPlay = true,
  highlightTrackId = null,
  currentTrackIndex = null,
  scheduleSlot = null,
  loadedTrackId = null,
  onTrackSelect,
  onTrackRemove,
  onPlaylistUpdate,
  onTracksLoaded,
  className = '',
  containerClassName = '',
}: PlaylistViewerProps) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [allTracks, setAllTracks] = useState<Track[]>([])
  const [coverArtUrls, setCoverArtUrls] = useState<Record<string, string>>({})
  const [showPastTracks, setShowPastTracks] = useState(false)

  // Audio Player State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    if (playlistId) {
      loadPlaylist()
      loadAllTracks()
    }
  }, [playlistId])

  async function loadPlaylist() {
    setIsLoading(true)
    try {
      const { data } = await getPlaylist(playlistId)
      if (data) {
        setPlaylist(data as Playlist)
        const tracks: PlaylistTrackItem[] = JSON.parse((data as any).tracks || '[]')
        setPlaylistTracks(tracks)
        
        // Notify parent of loaded tracks
        if (onTracksLoaded) {
          onTracksLoaded(tracks)
        }
        
        if (onPlaylistUpdate) {
          onPlaylistUpdate(data as Playlist)
        }
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
      if (data) {
        setAllTracks(data)
        
        // Load cover art URLs
        const urls: Record<string, string> = {}
        await Promise.all(
          data.map(async (track: any) => {
            if (track.coverArtUrl) {
              try {
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
    }
  }

  // Audio Player Functions
  async function handlePlayTrack(trackId: string) {
    try {
      const trackItem = playlistTracks.find(t => t.trackId === trackId)
      if (!trackItem) return
      
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
      
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
      
      const fullTrack = allTracks.find(t => t.id === trackId)
      if (!fullTrack || !fullTrack.fileUrl) {
        console.error('Track not found or missing fileUrl')
        return
      }
      
      let s3Path = fullTrack.fileUrl
      if (s3Path.includes('amazonaws.com')) {
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

  async function handleRemoveTrack(trackId: string) {
    if (!allowRemove) return
    
    if (onTrackRemove) {
      onTrackRemove(trackId)
      return
    }

    if (!confirm('Remove track from playlist?')) return

    try {
      await removeTrackFromPlaylist(playlistId, trackId)
      await loadPlaylist()
    } catch (error) {
      console.error('Failed to remove track:', error)
      alert('Failed to remove track')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!allowReorder) return
    
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = playlistTracks.findIndex((t) => t.trackId === active.id)
    const newIndex = playlistTracks.findIndex((t) => t.trackId === over.id)

    const reordered = [...playlistTracks]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    setPlaylistTracks(reordered)

    try {
      await reorderPlaylistTracks(playlistId, reordered.map(t => t.trackId))
    } catch (error) {
      console.error('Failed to reorder tracks:', error)
      await loadPlaylist()
      alert('Failed to reorder tracks')
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={containerClassName}>
      <div className={`space-y-4 ${className}`}>
        {/* Header */}
        {showHeader && playlist && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-bold text-gray-900">{playlist.name}</h2>
            {playlist.description && (
              <p className="text-sm text-gray-600 mt-1">{playlist.description}</p>
            )}
            <div className="text-sm text-gray-500 mt-2">
              {playlistTracks.length} tracks
            </div>
          </div>
        )}

        {/* Tracks */}
        <div 
          className="bg-white rounded-lg shadow overflow-auto"
          style={{ maxHeight: maxHeight || 'none' }}
        >
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              Loading playlist...
            </div>
          ) : playlistTracks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No tracks in playlist
            </div>
          ) : (
            <div className="p-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={playlistTracks.map(t => t.trackId)}
                  strategy={verticalListSortingStrategy}
                >
                  {/* Split tracks into past, current, and future */}
                  {(() => {
                    const pastTracks: JSX.Element[] = []
                    const currentAndFutureTracks: JSX.Element[] = []

                    // Calculate accumulated time for schedule
                    let accumulatedSeconds = 0
                    
                    // Find the index of the loaded track
                    const loadedTrackIndex = loadedTrackId 
                      ? playlistTracks.findIndex(t => t.trackId === loadedTrackId)
                      : -1
                    
                    playlistTracks.forEach((track, index) => {
                      // Determine track status based on currentTrackIndex
                      let trackStatus: 'past' | 'current' | 'future' | undefined
                      
                      // If a track is loaded, the NEXT track becomes "current" (purple)
                      if (loadedTrackIndex >= 0) {
                        if (index < loadedTrackIndex) {
                          trackStatus = 'past'
                        } else if (index === loadedTrackIndex + 1) {
                          trackStatus = 'current' // Next track after loaded = purple!
                        } else if (index > loadedTrackIndex + 1) {
                          trackStatus = 'future'
                        }
                        // The loaded track itself will be orange (handled by isLoadedInPlayer)
                      } else if (currentTrackIndex !== null && currentTrackIndex !== undefined) {
                        // No loaded track, use schedule-based logic
                        if (index < currentTrackIndex) {
                          trackStatus = 'past'
                        } else if (index === currentTrackIndex) {
                          trackStatus = 'current'
                        } else {
                          trackStatus = 'future'
                        }
                      }

                      // Calculate scheduled time if we have a schedule slot
                      let scheduledTime: { start: string; end: string } | null = null
                      if (scheduleSlot) {
                        const [slotHour, slotMin] = scheduleSlot.time.split(':').map(Number)
                        const trackDuration = track.trackDuration || 180 // Default 3 min
                        
                        // Calculate start time
                        const now = new Date()
                        const currentHour = now.getHours()
                        const startDate = new Date()
                        startDate.setHours(slotHour, slotMin, 0, 0)
                        startDate.setSeconds(startDate.getSeconds() + accumulatedSeconds)
                        
                        // Calculate end time
                        const endDate = new Date(startDate)
                        endDate.setSeconds(endDate.getSeconds() + trackDuration)
                        
                        // Format tijd: binnen hetzelfde uur als MM:SS, anders HH:MM
                        const formatTrackTime = (date: Date) => {
                          if (date.getHours() === currentHour) {
                            // Binnen dit uur: toon MM:SS
                            return `${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
                          } else {
                            // Ander uur: toon HH:MM
                            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                          }
                        }
                        
                        scheduledTime = {
                          start: formatTrackTime(startDate),
                          end: formatTrackTime(endDate)
                        }
                        
                        accumulatedSeconds += trackDuration
                      }

                      const trackElement = (
                        <SortableTrackRow
                          key={track.trackId}
                          track={track}
                          index={index}
                          coverArtUrl={coverArtUrls[track.trackId]}
                          formatDuration={formatDuration}
                          playingTrackId={playingTrackId}
                          isPlaying={isPlaying}
                          currentTime={currentTime}
                          duration={duration}
                          onPlay={handlePlayTrack}
                          onStop={handleStopTrack}
                          onSeek={handleSeek}
                          onRemove={allowRemove ? handleRemoveTrack : undefined}
                          showDragHandle={showDragHandle && allowReorder}
                          showDelete={showDelete && allowRemove}
                          compact={compact}
                          trackStatus={trackStatus}
                          scheduledTime={scheduledTime}
                          isLoadedInPlayer={loadedTrackId === track.trackId}
                        />
                      )

                      if (trackStatus === 'past') {
                        pastTracks.push(trackElement)
                      } else {
                        currentAndFutureTracks.push(trackElement)
                      }
                    })

                    return (
                      <>
                        {/* Past tracks - collapsible */}
                        {pastTracks.length > 0 && (
                          <div className="mb-2">
                            <button
                              onClick={() => setShowPastTracks(!showPastTracks)}
                              className="w-full px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center justify-between transition-colors"
                            >
                              <span>
                                {showPastTracks ? '▼' : '▶'} Already Played ({pastTracks.length})
                              </span>
                              <span className="text-xs text-gray-500">
                                {showPastTracks ? 'Hide' : 'Show'}
                              </span>
                            </button>
                            {showPastTracks && (
                              <div className="mt-2 space-y-2">
                                {pastTracks}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Current and future tracks */}
                        {currentAndFutureTracks}
                      </>
                    )
                  })()}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlaylistViewer
