import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { listPlaylists, createPlaylist, deletePlaylist } from '../../services/playlists'
import { playlistIoT } from '../../services/playlistIoT'
import type { Playlist as PlaylistType } from '../../types/playlist'

function Playlist() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<PlaylistType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Create playlist form
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('')
  const [newPlaylistGenre, setNewPlaylistGenre] = useState('')
  const [newPlaylistMood, setNewPlaylistMood] = useState('')
  const [newPlaylistBpmMin, setNewPlaylistBpmMin] = useState('')
  const [newPlaylistBpmMax, setNewPlaylistBpmMax] = useState('')
  const [newPlaylistTags, setNewPlaylistTags] = useState('')
  const [newPlaylistOccasion, setNewPlaylistOccasion] = useState('')
  
  // Load playlists
  useEffect(() => {
    loadPlaylists()
    
    // Connect to IoT
    playlistIoT.connect()
    
    return () => {
      playlistIoT.unsubscribeAll()
    }
  }, [])
  
  async function loadPlaylists() {
    setIsLoading(true)
    try {
      const { data } = await listPlaylists()
      console.log('📊 Loaded playlists:', data)
      setPlaylists(data as PlaylistType[])
    } catch (error) {
      console.error('Failed to load playlists:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) {
      alert('Please enter a playlist name')
      return
    }
    
    try {
      const { data } = await createPlaylist({
        name: newPlaylistName,
        description: newPlaylistDescription || undefined,
        genre: newPlaylistGenre || undefined,
        mood: newPlaylistMood || undefined,
        bpmMin: newPlaylistBpmMin ? parseInt(newPlaylistBpmMin) : undefined,
        bpmMax: newPlaylistBpmMax ? parseInt(newPlaylistBpmMax) : undefined,
        tags: newPlaylistTags || undefined,
        occasion: newPlaylistOccasion || undefined,
      })
      
      if (data) {
        console.log('✅ Playlist created:', data)
        setPlaylists(prev => [...prev, data as PlaylistType])
        setShowCreateModal(false)
        // Reset form
        setNewPlaylistName('')
        setNewPlaylistDescription('')
        setNewPlaylistGenre('')
        setNewPlaylistMood('')
        setNewPlaylistBpmMin('')
        setNewPlaylistBpmMax('')
        setNewPlaylistTags('')
        setNewPlaylistOccasion('')
      }
    } catch (error) {
      console.error('Failed to create playlist:', error)
      alert('Failed to create playlist')
    }
  }
  
  async function handleDeletePlaylist(id: string) {
    if (!confirm('Are you sure you want to delete this playlist?')) {
      return
    }
    
    try {
      await deletePlaylist(id)
      console.log('✅ Playlist deleted:', id)
      setPlaylists(prev => prev.filter(p => p.id !== id))
      
      // Notify via IoT
      await playlistIoT.playlistDeleted(id)
    } catch (error) {
      console.error('Failed to delete playlist:', error)
      alert('Failed to delete playlist')
    }
  }
  
  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes}min`
  }

  return (
    <Layout title="Playlist Management" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Playlists</h2>
            <p className="text-sm text-gray-600">
              Create and manage your audio playlists
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <span>+</span>
            New Playlist
          </button>
        </div>
        
        {/* Playlists Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading playlists...</p>
          </div>
        ) : playlists.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-lg p-12 text-center">
            <p className="text-gray-500 mb-4">No playlists yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create your first playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-white border border-gray-300 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/devices/playlist/${playlist.id}`)}
              >
                {/* Playlist Cover */}
                <div className="w-full h-40 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-6xl">🎵</span>
                </div>
                
                {/* Playlist Info */}
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
                  {playlist.name}
                </h3>
                {playlist.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {playlist.description}
                  </p>
                )}
                
                {/* Stats */}
                <div className="text-xs text-gray-500 mb-4">
                  {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                  {playlist.totalDuration > 0 && (
                    <> · {formatDuration(playlist.totalDuration)}</>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/devices/playlist/${playlist.id}`)
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    ▶️ Open
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePlaylist(playlist.id)
                    }}
                    className="px-3 py-2 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Create Playlist Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Create New Playlist</h3>
              
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Playlist Name *
                    </label>
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="My Awesome Playlist"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newPlaylistDescription}
                      onChange={(e) => setNewPlaylistDescription(e.target.value)}
                      placeholder="What's this playlist about?"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Metadata */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Metadata</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Genre
                      </label>
                      <select
                        value={newPlaylistGenre}
                        onChange={(e) => setNewPlaylistGenre(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select genre...</option>
                        <option value="Techno">Techno</option>
                        <option value="House">House</option>
                        <option value="Tech House">Tech House</option>
                        <option value="Deep House">Deep House</option>
                        <option value="Minimal">Minimal</option>
                        <option value="Progressive">Progressive</option>
                        <option value="Trance">Trance</option>
                        <option value="Drum & Bass">Drum & Bass</option>
                        <option value="Dubstep">Dubstep</option>
                        <option value="Ambient">Ambient</option>
                        <option value="Electronica">Electronica</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mood/Vibe
                      </label>
                      <select
                        value={newPlaylistMood}
                        onChange={(e) => setNewPlaylistMood(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select mood...</option>
                        <option value="Energetic">Energetic</option>
                        <option value="Chill">Chill</option>
                        <option value="Dark">Dark</option>
                        <option value="Uplifting">Uplifting</option>
                        <option value="Groovy">Groovy</option>
                        <option value="Melodic">Melodic</option>
                        <option value="Driving">Driving</option>
                        <option value="Atmospheric">Atmospheric</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* BPM Range */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">BPM Range</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Min BPM
                      </label>
                      <input
                        type="number"
                        value={newPlaylistBpmMin}
                        onChange={(e) => setNewPlaylistBpmMin(e.target.value)}
                        placeholder="120"
                        min="60"
                        max="200"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max BPM
                      </label>
                      <input
                        type="number"
                        value={newPlaylistBpmMax}
                        onChange={(e) => setNewPlaylistBpmMax(e.target.value)}
                        placeholder="135"
                        min="60"
                        max="200"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Tags & Occasion */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tags
                      </label>
                      <input
                        type="text"
                        value={newPlaylistTags}
                        onChange={(e) => setNewPlaylistTags(e.target.value)}
                        placeholder="summer, peak-time, warm-up (comma separated)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Occasion
                      </label>
                      <select
                        value={newPlaylistOccasion}
                        onChange={(e) => setNewPlaylistOccasion(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select occasion...</option>
                        <option value="Club Set">Club Set</option>
                        <option value="Radio Show">Radio Show</option>
                        <option value="Live Stream">Live Stream</option>
                        <option value="Festival">Festival</option>
                        <option value="Warm-up">Warm-up</option>
                        <option value="Peak Time">Peak Time</option>
                        <option value="Closing">Closing</option>
                        <option value="Mix/Recording">Mix/Recording</option>
                        <option value="Practice">Practice</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewPlaylistName('')
                    setNewPlaylistDescription('')
                    setNewPlaylistGenre('')
                    setNewPlaylistMood('')
                    setNewPlaylistBpmMin('')
                    setNewPlaylistBpmMax('')
                    setNewPlaylistTags('')
                    setNewPlaylistOccasion('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Playlist
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Playlist
