/**
 * SplashFM Homepage - Exact copy van EC2 Nginx player
 * Oranje/blauw gradient met professioneel design
 */
import { useState, useRef, useEffect } from 'react'

const STREAM_URL = 'https://stream.splashfm.nl/stream.mp3'
const STATUS_URL = 'https://stream.splashfm.nl/status-json.xsl'

export default function SplashFMHome() {
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)
  const [status, setStatus] = useState('Click to start streaming')
  const [statusClass, setStatusClass] = useState('')
  const [trackTitle, setTrackTitle] = useState('Loading...')
  const [trackArtist, setTrackArtist] = useState('Getting stream info...')
  const [listeners, setListeners] = useState('-')
  
  // Update stream info
  useEffect(() => {
    const updateStreamInfo = async () => {
      try {
        const response = await fetch(STATUS_URL)
        const data = await response.json()
        
        if (data.icestats && data.icestats.source) {
          const source = data.icestats.source
          
          // Update now playing
          if (source.title) {
            const parts = source.title.split(' - ')
            if (parts.length >= 2) {
              setTrackArtist(parts[0])
              setTrackTitle(parts.slice(1).join(' - '))
            } else {
              setTrackTitle(source.title)
              setTrackArtist(source.server_name || 'Splash FM')
            }
          }
          
          // Update listeners
          if (source.listeners !== undefined) {
            setListeners(String(source.listeners))
          }
        }
      } catch (error) {
        console.error('Error fetching stream info:', error)
      }
    }
    
    updateStreamInfo()
    const interval = setInterval(updateStreamInfo, 10000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])
  
  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const handleWaiting = () => {
      setStatus('Buffering...')
      setStatusClass('loading')
    }
    
    const handleCanPlay = () => {
      if (isPlaying) {
        setStatus('🔴 LIVE')
        setStatusClass('live')
      }
    }
    
    const handleError = () => {
      setStatus('Stream error - retrying...')
      setStatusClass('error')
      setIsPlaying(false)
      
      setTimeout(() => {
        if (!isPlaying) {
          setStatus('Click to start streaming')
          setStatusClass('')
        }
      }, 3000)
    }
    
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('error', handleError)
    
    return () => {
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('error', handleError)
    }
  }, [isPlaying])
  
  const togglePlay = async () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      setStatus('Paused')
      setStatusClass('')
    } else {
      setStatus('Loading stream...')
      setStatusClass('loading')
      
      try {
        await audioRef.current.play()
        setIsPlaying(true)
        setStatus('🔴 LIVE')
        setStatusClass('live')
      } catch (error) {
        console.error('Playback error:', error)
        setStatus('Error: Could not start stream')
        setStatusClass('error')
      }
    }
  }
  
  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .splashfm-body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .splashfm-container {
          max-width: 600px;
          width: 100%;
        }

        .splashfm-player-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 30px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        .splashfm-logo {
          font-size: 48px;
          font-weight: 900;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
          letter-spacing: -2px;
        }

        .splashfm-tagline {
          color: #666;
          font-size: 14px;
          margin-bottom: 30px;
          font-weight: 500;
        }

        .splashfm-now-playing {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 25px;
          margin-bottom: 30px;
          color: white;
        }

        .splashfm-now-playing-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 2px;
          opacity: 0.9;
          margin-bottom: 10px;
        }

        .splashfm-track-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .splashfm-track-artist {
          font-size: 16px;
          opacity: 0.9;
        }

        .splashfm-play-button {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 30px auto;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
          position: relative;
        }

        .splashfm-play-button:hover {
          transform: scale(1.05);
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
        }

        .splashfm-play-button:active {
          transform: scale(0.95);
        }

        .splashfm-play-icon,
        .splashfm-pause-icon {
          position: absolute;
          transition: opacity 0.3s ease;
        }

        .splashfm-play-icon {
          width: 0;
          height: 0;
          border-left: 30px solid white;
          border-top: 20px solid transparent;
          border-bottom: 20px solid transparent;
          margin-left: 5px;
          opacity: 1;
        }

        .splashfm-play-button.playing .splashfm-play-icon {
          opacity: 0;
        }

        .splashfm-pause-icon {
          display: flex;
          gap: 8px;
          opacity: 0;
        }

        .splashfm-pause-icon::before,
        .splashfm-pause-icon::after {
          content: '';
          width: 10px;
          height: 40px;
          background: white;
          border-radius: 3px;
        }

        .splashfm-play-button.playing .splashfm-pause-icon {
          opacity: 1;
        }

        .splashfm-status {
          font-size: 16px;
          margin-bottom: 20px;
          color: #666;
          min-height: 24px;
        }

        .splashfm-status.loading {
          color: #f59e0b;
          font-weight: 600;
        }

        .splashfm-status.live {
          color: #10b981;
          font-weight: 600;
        }

        .splashfm-status.error {
          color: #ef4444;
          font-weight: 600;
        }

        .splashfm-volume-control {
          margin-bottom: 30px;
        }

        .splashfm-volume-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #e5e7eb;
          outline: none;
          appearance: none;
          cursor: pointer;
        }

        .splashfm-volume-slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        }

        .splashfm-volume-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        }

        .splashfm-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          padding: 20px 0;
          border-top: 2px solid #e5e7eb;
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 20px;
        }

        .splashfm-stat {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .splashfm-stat-value {
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .splashfm-stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .splashfm-links {
          display: flex;
          justify-content: center;
          gap: 20px;
        }

        .splashfm-link {
          color: #667eea;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: color 0.3s ease;
        }

        .splashfm-link:hover {
          color: #764ba2;
        }

        @media (max-width: 640px) {
          .splashfm-player-card {
            padding: 30px 20px;
          }

          .splashfm-logo {
            font-size: 36px;
          }

          .splashfm-track-title {
            font-size: 20px;
          }

          .splashfm-stats {
            grid-template-columns: 1fr;
            gap: 15px;
          }
        }
      `}</style>
      
      <div className="splashfm-body">
        <audio ref={audioRef} preload="none">
          <source src={STREAM_URL} type="audio/mpeg" />
        </audio>
        
        <div className="splashfm-container">
          <div className="splashfm-player-card">
            <div className="splashfm-logo">SPLASH FM</div>
            <div className="splashfm-tagline">🎵 Professional Beat-Matched Radio</div>
            
            <div className="splashfm-now-playing">
              <div className="splashfm-now-playing-label">Now Playing</div>
              <div className="splashfm-track-title">{trackTitle}</div>
              <div className="splashfm-track-artist">{trackArtist}</div>
            </div>
            
            <button 
              className={`splashfm-play-button ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
            >
              <div className="splashfm-play-icon"></div>
              <div className="splashfm-pause-icon"></div>
            </button>
            
            <div className={`splashfm-status ${statusClass}`}>{status}</div>
            
            <div className="splashfm-volume-control">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="splashfm-volume-slider"
              />
            </div>
            
            <div className="splashfm-stats">
              <div className="splashfm-stat">
                <span className="splashfm-stat-value">192</span>
                <span className="splashfm-stat-label">kbps</span>
              </div>
              <div className="splashfm-stat">
                <span className="splashfm-stat-value">{listeners}</span>
                <span className="splashfm-stat-label">Listeners</span>
              </div>
              <div className="splashfm-stat">
                <span className="splashfm-stat-value">24/7</span>
                <span className="splashfm-stat-label">Live</span>
              </div>
            </div>
            
            <div className="splashfm-links">
              <a href="/status-json.xsl" className="splashfm-link" target="_blank" rel="noopener noreferrer">
                📊 Stats
              </a>
              <a href={STREAM_URL} className="splashfm-link">
                🔗 Direct Stream
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
