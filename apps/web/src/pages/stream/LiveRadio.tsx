/**
 * Live Radio Page
 * 
 * Public page for listening to the live stream
 */
import Layout from '../../components/Layout'
import LiveStreamPlayer from '../../components/LiveStreamPlayer'
import { useState, useEffect } from 'react'

export default function LiveRadio() {
  const [streamUrl, setStreamUrl] = useState<string>('')
  
  // Get stream URL from environment or backend
  useEffect(() => {
    // In production, fetch this from Lambda or env var
    // For now, hardcode (will be replaced after EC2 deployment)
    const url = import.meta.env.VITE_STREAM_URL || 'http://YOUR-EC2-IP:8000/stream.mp3'
    setStreamUrl(url)
  }, [])
  
  return (
    <Layout title="Live Radio">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">🎙️ Live Radio Stream</h1>
          <p className="text-gray-600">
            Listen to our 24/7 continuous techno stream
          </p>
        </div>
        
        {streamUrl ? (
          <LiveStreamPlayer 
            streamUrl={streamUrl}
            title="G-Forge Radio"
          />
        ) : (
          <div className="bg-gray-100 rounded-2xl p-12 text-center">
            <p className="text-gray-500">Loading stream...</p>
          </div>
        )}
        
        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-2">📻 About the Stream</h3>
            <p className="text-sm text-gray-600">
              High-quality 192kbps MP3 stream with automatic crossfading between tracks.
              Powered by Icecast and Liquidsoap.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-2">🎵 Playlist</h3>
            <p className="text-sm text-gray-600">
              Automatically updated based on our 24/7 schedule.
              Fresh tracks added regularly.
            </p>
          </div>
        </div>
        
        {/* External Players */}
        <div className="mt-8 bg-gray-50 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4">📱 Listen on Other Players</h3>
          <p className="text-sm text-gray-600 mb-4">
            Use this URL in your favorite media player:
          </p>
          <div className="bg-white rounded-lg p-4 font-mono text-sm break-all border">
            {streamUrl}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Compatible with VLC, Winamp, iTunes, and most media players
          </p>
        </div>
      </div>
    </Layout>
  )
}
