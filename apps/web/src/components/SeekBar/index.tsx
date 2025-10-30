import { useState, useRef } from 'react'

interface SeekBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  className?: string
}

export default function SeekBar({ currentTime, duration, onSeek, className = '' }: SeekBarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const seekbarRef = useRef<HTMLDivElement>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!seekbarRef.current) return
    
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percent = Math.max(0, Math.min(100, (x / bounds.width) * 100))
    const time = (percent / 100) * duration
    
    onSeek(time)
  }
  
  function handleSeekMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    setIsDragging(true)
    handleSeek(e)
  }
  
  function handleSeekMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    // Show hover preview
    const bounds = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - bounds.left
    const percent = Math.max(0, Math.min(100, (x / bounds.width) * 100))
    const time = (percent / 100) * duration
    
    setHoverTime(time)
    setHoverPosition(x)
    
    // Update position if dragging
    if (isDragging) {
      handleSeek(e)
    }
  }
  
  function handleSeekMouseUp() {
    if (isDragging) {
      setIsDragging(false)
    }
  }
  
  function handleSeekMouseLeave() {
    setHoverTime(null)
    setHoverPosition(null)
  }

  return (
    <div className={className}>
      <div className="relative">
        <div 
          ref={seekbarRef}
          className={`h-3 bg-white/10 rounded-full cursor-pointer overflow-visible mb-2 relative ${isDragging ? 'scale-y-125' : ''} transition-transform`}
          onMouseDown={handleSeekMouseDown}
          onMouseMove={handleSeekMouseMove}
          onMouseUp={handleSeekMouseUp}
          onMouseLeave={handleSeekMouseLeave}
        >
          {/* Progress */}
          <div 
            className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all rounded-full"
            style={{ width: `${progress}%`, transitionDuration: isDragging ? '0ms' : '100ms' }}
          />
          
          {/* Thumb */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-all"
            style={{ 
              left: `${progress}%`,
              transform: `translate(-50%, -50%) scale(${isDragging ? 1.3 : 1})`,
              boxShadow: isDragging ? '0 0 0 4px rgba(255,255,255,0.3)' : '0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
          
          {/* Hover Preview */}
          {hoverTime !== null && hoverPosition !== null && !isDragging && (
            <div 
              className="absolute bottom-full mb-2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between text-sm text-blue-300">
        <span>{formatTime(currentTime)}</span>
        <span className="text-xs opacity-75">⌨️ ←/→: ±5s | Shift+←/→: ±30s</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
