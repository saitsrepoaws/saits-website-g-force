/**
 * SplashFM Homepage - Branded Radio Player
 * Gebaseerd op de originele splashfm-player.html met het echte logo
 */
import { useState, useRef, useEffect } from 'react'

const STREAM_URL = 'https://stream.splashfm.nl/stream.mp3'
const STATUS_URL = 'https://stream.splashfm.nl/status-json.xsl'

interface StreamStatus {
  icestats?: {
    source?: {
      title?: string
      listeners?: number
      server_name?: string
      server_description?: string
    }
  }
}

export default function SplashFMHome() {
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(70)
  const [isLoading, setIsLoading] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({})
  const [error, setError] = useState<string | null>(null)
  
  // Fetch stream status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(STATUS_URL)
        const data = await response.json()
        setStreamStatus(data)
      } catch (err) {
        console.error('Failed to fetch stream status:', err)
      }
    }
    
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000) // Update every 10 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  // Update audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])
  
  const togglePlay = async () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      setIsLoading(true)
      setError(null)
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        console.error('Failed to play stream:', err)
        setError('Could not connect to stream')
      } finally {
        setIsLoading(false)
      }
    }
  }
  
  const source = streamStatus?.icestats?.source
  const currentTrack = source?.title || 'Splash FM - Live'
  const listeners = source?.listeners || 0
  
  return (
    <div className="min-h-screen flex items-center justify-center p-5" 
         style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={STREAM_URL}
        preload="none"
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => {
          setError('Stream connection error')
          setIsPlaying(false)
          setIsLoading(false)
        }}
      />
      
      <div className="max-w-xl w-full">
        {/* Player Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-[30px] p-10 shadow-2xl text-center">
          {/* Logo */}
          <div className="mb-2">
            <h1 className="text-5xl font-black tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-2px'
                }}>
              SPLASH FM
            </h1>
          </div>
          
          {/* Tagline */}
          <p className="text-gray-600 text-sm mb-8">
            Professional • Beat-Matched • WildFM Jingels
          </p>
          
          {/* Now Playing */}
          <div className="mb-8 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' }}>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
              {isPlaying && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
              {isPlaying ? 'Now Playing' : 'Ready to Stream'}
            </div>
            <div className="text-xl font-bold text-gray-900 leading-tight">
              {currentTrack}
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">⚠️ {error}</p>
            </div>
          )}
          
          {/* Play Button */}
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-full py-6 rounded-2xl font-bold text-lg text-white mb-6 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{
              background: isPlaying 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'wait' : 'pointer'
            }}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Connecting...
              </span>
            ) : isPlaying ? (
              <span className="flex items-center justify-center gap-2">
                ⏸️ Stop Stream
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ▶️ Play Live Stream
              </span>
            )}
          </button>
          
          {/* Volume Control */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Volume</span>
              <span className="text-sm font-mono text-gray-600">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #667eea 0%, #764ba2 ${volume}%, #e5e7eb ${volume}%, #e5e7eb 100%)`
              }}
            />
          </div>
          
          {/* Stream Info */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-500 mb-1">Quality</div>
              <div className="font-bold text-gray-900">192 kbps</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Listeners</div>
              <div className="font-bold text-gray-900">{listeners}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className={`font-bold ${isPlaying ? 'text-green-600' : 'text-gray-500'}`}>
                {isPlaying ? 'Live' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-6 text-white/70 text-sm">
          <p>24/7 Professional Dance Radio</p>
          <p className="mt-2 text-xs text-white/50">
            Powered by <a href="/dashboard" className="underline hover:text-white">G-Forge IoT</a>
          </p>
        </div>
      </div>
    </div>
  )
}
