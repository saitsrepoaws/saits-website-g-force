import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { listPlaylists, createPlaylist, deletePlaylist, generatePlaylist } from '../../services/playlists'
import { playlistIoT } from '../../services/playlistIoT'
import { listTracks } from '../../services/tracks'
import type { Playlist as PlaylistType } from '../../types/playlist'

function Playlist() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<PlaylistType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  
  // Create playlist form
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('')
  const [newPlaylistGenre, setNewPlaylistGenre] = useState('')
  const [newPlaylistMood, setNewPlaylistMood] = useState('')
  const [newPlaylistBpmMin, setNewPlaylistBpmMin] = useState('')
  const [newPlaylistBpmMax, setNewPlaylistBpmMax] = useState('')
  const [newPlaylistKey, setNewPlaylistKey] = useState('')
  const [newPlaylistKeys, setNewPlaylistKeys] = useState<string[]>([]) // Multi-select keys
  const [newPlaylistTags, setNewPlaylistTags] = useState('')
  
  // Load playlists and genres
  useEffect(() => {
    loadPlaylists()
    loadGenres()
    
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
  
  async function loadGenres() {
    try {
      const { data } = await listTracks()
      if (data) {
        // Extract unique genres from tracks
        const genres = Array.from(
          new Set(
            data
              .map((track: any) => track.genre)
              .filter((genre: any): genre is string => Boolean(genre))
          )
        ).sort() as string[]
        
        setAvailableGenres(genres)
        console.log('🎵 Loaded genres from tracks:', genres)
      }
    } catch (error) {
      console.error('Failed to load genres:', error)
      // Fallback to hardcoded genres if track loading fails
      setAvailableGenres([
        'Techno', 'House', 'Tech House', 'Deep House', 'Minimal', 
        'Progressive', 'Trance', 'Drum & Bass', 'Dubstep', 'Ambient', 
        'Electronica'
      ])
    }
  }
  
  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) {
      alert('Please enter a playlist name')
      return
    }
    
    try {
      const playlistData = {
        name: newPlaylistName,
        description: newPlaylistDescription || undefined,
        genre: newPlaylistGenre || undefined,
        mood: newPlaylistMood || undefined,
        bpmMin: newPlaylistBpmMin ? parseInt(newPlaylistBpmMin) : undefined,
        bpmMax: newPlaylistBpmMax ? parseInt(newPlaylistBpmMax) : undefined,
        key: newPlaylistKey || undefined,
        tags: newPlaylistTags || undefined,
      }
      
      console.log('🎵 Creating playlist with data:', playlistData)
      
      const { data, errors } = await createPlaylist(playlistData)
      
      if (errors) {
        console.error('❌ GraphQL errors:', errors)
        alert(`Failed to create playlist: ${JSON.stringify(errors)}`)
        return
      }
      
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
        setNewPlaylistKey('')
        setNewPlaylistTags('')
      }
    } catch (error: any) {
      console.error('❌ Error creating playlist:', error)
      console.error('Error details:', error?.errors || error?.message || error)
      alert(`Failed to create playlist: ${error?.message || 'Unknown error'}`)
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
  
  async function handleAutoGeneratePlaylist() {
    if (!newPlaylistName.trim()) {
      alert('Please enter a playlist name')
      return
    }
    
    setIsGenerating(true)
    
    try {
      const { data, errors } = await generatePlaylist({
        name: newPlaylistName,
        description: newPlaylistDescription || undefined,
        genre: newPlaylistGenre || undefined,
        mood: newPlaylistMood || undefined,
        bpmMin: newPlaylistBpmMin ? parseInt(newPlaylistBpmMin) : undefined,
        bpmMax: newPlaylistBpmMax ? parseInt(newPlaylistBpmMax) : undefined,
        keys: newPlaylistKeys.length > 0 ? newPlaylistKeys : undefined, // Multi-select keys
        tags: newPlaylistTags || undefined,
        maxTracks: 20,
        maxDuration: 59 * 60, // 59 minutes
      })
      
      if (errors) {
        console.error('❌ Error generating playlist:', errors)
        alert(`Failed to generate playlist: ${JSON.stringify(errors)}`)
        return
      }
      
      if (data && data.success && data.playlist) {
        console.log('✅ Playlist auto-generated:', data)
        alert(`✅ Playlist Generated!\n\n📊 ${data.tracksMatched} tracks matched your criteria\n🎵 ${data.tracksSelected} tracks selected\n⏱️ Total duration: ${Math.floor(data.playlist.totalDuration / 60)}:${(data.playlist.totalDuration % 60).toString().padStart(2, '0')}`)
        
        // Reload playlists
        await loadPlaylists()
        
        setShowAutoGenerateModal(false)
        // Reset form
        setNewPlaylistName('')
        setNewPlaylistDescription('')
        setNewPlaylistGenre('')
        setNewPlaylistMood('')
        setNewPlaylistBpmMin('')
        setNewPlaylistBpmMax('')
        setNewPlaylistKeys([])
        setNewPlaylistTags('')
      } else {
        // Show specific error message
        const errorMsg = data?.error || 'Failed to generate playlist'
        
        if (errorMsg.includes('No tracks match')) {
          alert(`❌ No Tracks Found\n\nNo tracks in your library match the criteria:\n\n${newPlaylistGenre ? `• Genre: ${newPlaylistGenre}\n` : ''}${newPlaylistMood ? `• Mood: ${newPlaylistMood}\n` : ''}${newPlaylistBpmMin || newPlaylistBpmMax ? `• BPM: ${newPlaylistBpmMin || '?'}-${newPlaylistBpmMax || '?'}\n` : ''}${newPlaylistKeys.length > 0 ? `• Keys: ${newPlaylistKeys.join(', ')}\n` : ''}\n💡 Try:\n• Removing some filters\n• Using broader criteria\n• Adding more tracks to your library`)
        } else if (errorMsg.includes('No tracks found in library')) {
          alert(`❌ Empty Track Library\n\nYour track library is empty!\n\n💡 Please upload some tracks first:\n1. Go to Libery\n2. Upload audio files\n3. Come back and generate playlist`)
        } else {
          alert(`❌ Generation Failed\n\n${errorMsg}`)
        }
      }
    } catch (error: any) {
      console.error('❌ Error generating playlist:', error)
      alert(`Failed to generate playlist: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowAutoGenerateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
            >
              <span>🤖</span>
              Auto Generate
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <span>+</span>
              New Playlist
            </button>
          </div>
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
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {playlist.description}
                  </p>
                )}
                
                {/* Metadata Tags */}
                {(playlist.genre || playlist.mood || playlist.key) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {playlist.genre && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {playlist.genre}
                      </span>
                    )}
                    {playlist.mood && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        {playlist.mood}
                      </span>
                    )}
                    {playlist.key && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        🎹 {playlist.key}
                      </span>
                    )}
                  </div>
                )}
                
                <div className="text-sm text-gray-500 mb-4">
                  {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                  {playlist.totalDuration > 0 && (
                    <> · {formatDuration(playlist.totalDuration)}</>
                  )}
                  {playlist.bpmMin && playlist.bpmMax && (
                    <> · {playlist.bpmMin}-{playlist.bpmMax} BPM</>
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
                        {availableGenres.map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
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
                
                {/* Musical Key Selector */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Musical Key</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Key (Camelot Wheel / Standard Notation)
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {[
                          'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 
                          'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'
                        ].map(key => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNewPlaylistKey(key)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              newPlaylistKey === key
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                      {newPlaylistKey && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm text-gray-600">Selected:</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                            🎹 {newPlaylistKey}
                          </span>
                          <button
                            type="button"
                            onClick={() => setNewPlaylistKey('')}
                            className="text-xs text-gray-500 hover:text-red-600"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Tags */}
                <div className="border-t pt-4">
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
                    setNewPlaylistKey('')
                    setNewPlaylistTags('')
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
        
        {/* Auto Generate Playlist Modal */}
        {showAutoGenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🤖</span>
                <h3 className="text-lg font-bold">Auto Generate Playlist</h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Let AI create a playlist for you based on your criteria! Tracks will be automatically selected from your library.
              </p>
              
              {/* Use same form as create modal */}
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
                      placeholder="Dark Techno Mix"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
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
                      placeholder="Auto-generated based on criteria"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                {/* Metadata (Criteria) */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">🎯 Selection Criteria</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Genre
                      </label>
                      <select
                        value={newPlaylistGenre}
                        onChange={(e) => setNewPlaylistGenre(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">All genres...</option>
                        {availableGenres.map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Any mood...</option>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Musical Keys (Multi-Select) */}
                <div className="border-t pt-4">
                  <div className="mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">🎹 Musical Keys (Multi-Select)</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Select multiple keys for harmonic mixing. Tracks will be sorted using Camelot Wheel logic.
                    </p>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 
                      'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'
                    ].map(key => {
                      const isSelected = newPlaylistKeys.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setNewPlaylistKeys(newPlaylistKeys.filter(k => k !== key))
                            } else {
                              setNewPlaylistKeys([...newPlaylistKeys, key])
                            }
                          }}
                          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                            isSelected
                              ? 'bg-green-600 text-white ring-2 ring-green-400'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {key}
                        </button>
                      )
                    })}
                  </div>
                  {newPlaylistKeys.length > 0 && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-800">
                          Selected Keys ({newPlaylistKeys.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => setNewPlaylistKeys([])}
                          className="text-xs text-green-600 hover:text-red-600 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {newPlaylistKeys.map(key => (
                          <span 
                            key={key}
                            className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full flex items-center gap-1"
                          >
                            🎹 {key}
                            <button
                              type="button"
                              onClick={() => setNewPlaylistKeys(newPlaylistKeys.filter(k => k !== key))}
                              className="ml-1 hover:text-red-200"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-green-700 mt-2">
                        💡 Tracks will be ordered for smooth harmonic transitions
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Tags */}
                <div className="border-t pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags (Optional)
                    </label>
                    <input
                      type="text"
                      value={newPlaylistTags}
                      onChange={(e) => setNewPlaylistTags(e.target.value)}
                      placeholder="summer, peak-time, warm-up"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                
                {/* Info Box */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>🤖 Auto Generation:</strong> AI will scan your track library, filter by criteria, 
                    and create a harmonic mix using Camelot Wheel logic for smooth key transitions. 
                    Selects up to 20 tracks within 59 minutes.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowAutoGenerateModal(false)
                    setNewPlaylistName('')
                    setNewPlaylistDescription('')
                    setNewPlaylistGenre('')
                    setNewPlaylistMood('')
                    setNewPlaylistBpmMin('')
                    setNewPlaylistBpmMax('')
                    setNewPlaylistKeys([])
                    setNewPlaylistTags('')
                  }}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAutoGeneratePlaylist}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      Generate Playlist
                    </>
                  )}
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
