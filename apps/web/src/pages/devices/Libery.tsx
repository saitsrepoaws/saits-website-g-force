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

function Libery() {

  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [newTrack, setNewTrack] = useState({
    title: '',
    artist: '',
    album: '',
    duration: 0,
  })
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
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

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAudioFile(file)

    // Auto-extract metadata
    const metadata = await getAudioMetadata(file)
    if (metadata.duration) {
      setNewTrack({ ...newTrack, duration: metadata.duration })
    }

    // Auto-fill title from filename if empty
    if (!newTrack.title) {
      const filename = file.name.replace(/\.[^/.]+$/, '') // remove extension
      setNewTrack({ ...newTrack, title: filename })
    }
  }

  const handleAddTrack = async () => {
    if (!newTrack.title || !audioFile) return

    setIsUploading(true)
    setUploadProgress(null)

    try {
      // Upload audio file
      const audioResult = await uploadAudioFile(audioFile, (progress) => {
        setUploadProgress(progress)
      })

      // Upload cover art if provided
      let coverUrl: string | undefined
      if (coverFile) {
        const coverResult = await uploadCoverArt(coverFile)
        coverUrl = coverResult.url
      }

      // Create track in database
      const { data } = await createTrack({
        title: newTrack.title,
        artist: newTrack.artist || undefined,
        album: newTrack.album || undefined,
        duration: newTrack.duration || undefined,
        fileUrl: audioResult.url,
        fileSize: audioResult.size,
        format: audioResult.format,
        coverArtUrl: coverUrl,
        addedAt: new Date().toISOString(),
      })

      if (data) {
        setTracks([...tracks, data])
        setNewTrack({ title: '', artist: '', album: '', duration: 0 })
        setAudioFile(null)
        setCoverFile(null)
        setShowAddTrack(false)
      }
    } catch (error) {
      console.error('Failed to add track:', error)
      alert('Failed to upload track. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
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

        {/* Track Library */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Track Library</h3>
              <button
                onClick={() => setShowAddTrack(!showAddTrack)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                + Add Track
              </button>
            </div>

            {/* Add Track Form */}
            {showAddTrack && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                {/* File Uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Audio File * (MP3, WAV, FLAC, etc.)
                    </label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileChange}
                      disabled={isUploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    {audioFile && (
                      <div className="text-xs text-gray-600 mt-1">
                        {audioFile.name} ({formatFileSize(audioFile.size)})
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cover Art (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                      disabled={isUploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    {coverFile && (
                      <div className="text-xs text-gray-600 mt-1">
                        {coverFile.name} ({formatFileSize(coverFile.size)})
                      </div>
                    )}
                  </div>
                </div>

                {/* Track Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Title *"
                    value={newTrack.title}
                    onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
                    disabled={isUploading}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Artist"
                    value={newTrack.artist}
                    onChange={(e) => setNewTrack({ ...newTrack, artist: e.target.value })}
                    disabled={isUploading}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Album"
                    value={newTrack.album}
                    onChange={(e) => setNewTrack({ ...newTrack, album: e.target.value })}
                    disabled={isUploading}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Duration (sec)"
                    value={newTrack.duration || ''}
                    onChange={(e) => setNewTrack({ ...newTrack, duration: Number(e.target.value) })}
                    disabled={isUploading}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>

                {/* Upload Progress */}
                {uploadProgress && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTrack}
                    disabled={!newTrack.title || !audioFile || isUploading}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isUploading ? 'Uploading...' : 'Upload & Save Track'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTrack(false)
                      setAudioFile(null)
                      setCoverFile(null)
                      setUploadProgress(null)
                    }}
                    disabled={isUploading}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Track List */}
            {isLoadingTracks ? (
              <div className="text-center py-8 text-gray-500">Loading tracks...</div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tracks yet. Add your first track!
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{track.title}</div>
                        <div className="text-xs text-gray-500">
                          {track.artist && <span>{track.artist}</span>}
                          {track.artist && track.album && <span> • </span>}
                          {track.album && <span>{track.album}</span>}
                          {track.duration && (
                            <span> • {formatDuration(track.duration)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
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
