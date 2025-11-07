/**
 * Live Stream Player Component
 * 
 * Plays the continuous Icecast MP3 stream
 * Features:
 * - One-click play
 * - Volume control
 * - Connection status
 * - Now playing info (via IoT)
 */
import { useState, useRef, useEffect } from 'react'
import { useIoT } from '../contexts/IoTContext'

interface LiveStreamPlayerProps {
  streamUrl: string  // e.g. "http://EC2-IP:8000/stream.mp3"
  title?: string
}

export default function LiveStreamPlayer({ streamUrl, title = "G-Forge Radio" }: LiveStreamPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const iot = useIoT()
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowPlaying, setNowPlaying] = useState<{
    title: string
    artist: string
  } | null>(null)
  
  // Subscribe to now playing updates via IoT
  useEffect(() => {
    if (iot.connectionState !== 'Connected') return
    
    let unsubscribe: (() => void) | undefined
    
    iot.subscribe('radio/stream/nowplaying', (message: any) => {
      console.log('🎵 Now playing update:', message)
      
      if (message.track) {
        setNowPlaying({
          title: message.track.title || 'Unknown',
          artist: message.track.artist || 'Unknown'
        })
      }
    }).then((unsub) => {
      unsubscribe = unsub
    })
    
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [iot.connectionState])
  
  const handlePlay = async () => {
    if (!audioRef.current) return
    
    setIsConnecting(true)
    setError(null)
    
    try {
      await audioRef.current.play()
      setIsPlaying(true)
      console.log('✅ Stream playback started')
    } catch (err) {
      console.error('❌ Failed to play stream:', err)
      setError('Failed to connect to stream')
      setIsPlaying(false)
    } finally {
      setIsConnecting(false)
    }
  }
  
  const handlePause = () => {
    if (!audioRef.current) return
    
    audioRef.current.pause()
    setIsPlaying(false)
    console.log('⏸️ Stream paused')
  }
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }
  
  // Set initial volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])
  
  return (
    <div className="live-stream-player bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 rounded-2xl shadow-2xl p-6 text-white">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="none"
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('❌ Stream error:', e)
          setError('Stream connection lost')
          setIsPlaying(false)
        }}
        onWaiting={() => setIsConnecting(true)}
        onCanPlay={() => setIsConnecting(false)}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-white/70">24/7 Techno Stream</p>
        </div>
        
        {/* Live indicator */}
        {isPlaying && (
          <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span className="text-xs font-bold">LIVE</span>
          </div>
        )}
      </div>
      
      {/* Now Playing */}
      {nowPlaying && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
          <div className="text-xs text-white/50 mb-1">NOW PLAYING</div>
          <div className="text-lg font-bold">{nowPlaying.title}</div>
          <div className="text-sm text-white/70">{nowPlaying.artist}</div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
          <p className="text-sm">⚠️ {error}</p>
        </div>
      )}
      
      {/* Controls */}
      <div className="space-y-4">
        {/* Play/Pause Button */}
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          disabled={isConnecting}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            isConnecting
              ? 'bg-gray-600 cursor-wait'
              : isPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isConnecting ? (
            <>
              <span className="inline-block animate-spin mr-2">⏳</span>
              Connecting...
            </>
          ) : isPlaying ? (
            <>⏸️ Stop Streaming</>
          ) : (
            <>▶️ Start Streaming</>
          )}
        </button>
        
        {/* Volume Control */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Volume</span>
            <span className="text-sm">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer 
                     [&::-webkit-slider-thumb]:appearance-none 
                     [&::-webkit-slider-thumb]:w-4 
                     [&::-webkit-slider-thumb]:h-4 
                     [&::-webkit-slider-thumb]:rounded-full 
                     [&::-webkit-slider-thumb]:bg-white"
          />
        </div>
        
        {/* Stream Info */}
        <div className="bg-white/5 rounded-xl p-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-white/50 mb-1">Quality</div>
              <div className="font-bold">192 kbps</div>
            </div>
            <div>
              <div className="text-white/50 mb-1">Format</div>
              <div className="font-bold">MP3</div>
            </div>
            <div>
              <div className="text-white/50 mb-1">Status</div>
              <div className={`font-bold ${
                isPlaying ? 'text-green-400' : 
                isConnecting ? 'text-yellow-400' : 
                'text-gray-400'
              }`}>
                {isPlaying ? 'Streaming' : isConnecting ? 'Connecting' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Stream URL (for debugging) */}
        <div className="text-xs text-white/30 text-center">
          {streamUrl}
        </div>
      </div>
    </div>
  )
}
