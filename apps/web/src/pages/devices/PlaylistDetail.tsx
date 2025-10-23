import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getPlaylist, addTracksToPlaylist, removeTrackFromPlaylist } from '../../services/playlists'
import { listTracks } from '../../services/tracks'
import { playlistIoT } from '../../services/playlistIoT'
import { getUrl } from 'aws-amplify/storage'
import type { Playlist, PlaylistTrackItem } from '../../types/playlist'
import type { Track } from '../../services/tracks'

function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Add tracks modal
  const [showAddTracks, setShowAddTracks] = useState(false)
  const [allTracks, setAllTracks] = useState<Track[]>([])
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set())
  const [coverArtUrls, setCoverArtUrls] = useState<Record<string, string>>({})
  
  // Search & filter for add tracks modal
  const [searchQuery, setSearchQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  
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
    } catch (error) {
      console.error('Failed to add tracks:', error)
      alert('Failed to add tracks to playlist')
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
  
  function toggleTrackSelection(trackId: string) {
    const newSelection = new Set(selectedTrackIds)
    if (newSelection.has(trackId)) {
      newSelection.delete(trackId)
    } else {
      newSelection.add(trackId)
    }
    setSelectedTrackIds(newSelection)
  }
  
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
                <p className="text-gray-600 mb-4">{playlist.description}</p>
              )}
              <div className="text-sm text-gray-500">
                {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                {playlist.totalDuration > 0 && (
                  <> · {Math.floor(playlist.totalDuration / 60)} min</>
                )}
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
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                <div className="col-span-1">#</div>
                <div className="col-span-1"></div>
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Artist</div>
                <div className="col-span-2">Genre</div>
                <div className="col-span-1">BPM</div>
                <div className="col-span-1">Duration</div>
                <div className="col-span-1"></div>
              </div>
              
              {/* Tracks */}
              {playlistTracks.map((track, index) => (
                <div
                  key={track.trackId}
                  className="grid grid-cols-12 gap-2 items-center p-3 border border-gray-200 rounded hover:bg-gray-50"
                >
                  <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                  
                  {/* Cover Art */}
                  <div className="col-span-1">
                    {coverArtUrls[track.trackId] ? (
                      <img
                        src={coverArtUrls[track.trackId]}
                        alt={track.trackTitle}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">🎵</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-3 text-sm font-medium text-gray-900 truncate">
                    {track.trackTitle || 'Unknown'}
                  </div>
                  <div className="col-span-2 text-sm text-gray-600 truncate">
                    {track.trackArtist || '-'}
                  </div>
                  <div className="col-span-2 text-xs text-gray-600 truncate">
                    {track.trackGenre || '-'}
                  </div>
                  <div className="col-span-1 text-xs text-gray-600">
                    {track.trackBpm || '-'}
                  </div>
                  <div className="col-span-1 text-xs text-gray-600">
                    {track.trackDuration ? formatDuration(track.trackDuration) : '-'}
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => handleRemoveTrack(track.trackId)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
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
                  <h3 className="text-lg font-bold">Add Tracks to Playlist</h3>
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
                
                {selectedTrackIds.size > 0 && (
                  <div className="mt-3 text-sm text-blue-600">
                    {selectedTrackIds.size} {selectedTrackIds.size === 1 ? 'track' : 'tracks'} selected
                  </div>
                )}
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
