import { useState, useRef, useCallback } from 'react'
import type { Track } from '../services/playerService'
import { loadTrackAssets } from '../services/playerService'

export interface UseAudioPlayerReturn {
  // State
  isPlaying: boolean
  isPaused: boolean
  isLoaded: boolean
  volume: number
  autoPlay: boolean
  currentTime: number
  duration: number
  currentTrack: Track | null
  coverArtUrl: string | null
  waveformUrl: string | null
  audioRef: React.RefObject<HTMLAudioElement | null>
  
  // Actions
  play: () => void
  pause: () => void
  stop: () => void
  togglePlay: () => void
  load: (track: Track) => Promise<void>
  unload: () => void
  setVolume: (volume: number) => void
  setAutoPlay: (enabled: boolean) => void
  setCurrentTime: (time: number) => void
  
  // Internal setters for parent coordination
  _setCurrentTrack: (track: Track | null) => void
  _setIsPlaying: (playing: boolean) => void
  _setIsPaused: (paused: boolean) => void
  _setIsLoaded: (loaded: boolean) => void
  _setDuration: (duration: number) => void
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [volume, setVolumeState] = useState(0.7)
  const [autoPlay, setAutoPlay] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null)
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Execute play logic
  const executePlay = useCallback(() => {
    if (!audioRef.current) {
      console.warn('⚠️ Cannot play - no audio element')
      return
    }

    try {
      audioRef.current.play()
      setIsPlaying(true)
      setIsPaused(false)
      console.log('✅ Playing')
    } catch (error) {
      console.error('❌ Play failed:', error)
    }
  }, [])

  // Execute pause logic
  const executePause = useCallback(() => {
    if (!audioRef.current) {
      console.warn('⚠️ Cannot pause - no audio element')
      return
    }

    try {
      audioRef.current.pause()
      setIsPlaying(false)
      setIsPaused(true)
      console.log('✅ Paused')
    } catch (error) {
      console.error('❌ Pause failed:', error)
    }
  }, [])

  // Execute stop logic
  const executeStop = useCallback(() => {
    if (!audioRef.current) {
      console.warn('⚠️ Cannot stop - no audio element')
      return
    }

    try {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setIsPaused(false)
      setCurrentTime(0)
      console.log('✅ Stopped')
    } catch (error) {
      console.error('❌ Stop failed:', error)
    }
  }, [])

  // Public play function
  const play = useCallback(() => {
    console.log('▶️ PLAY button clicked - executing locally...')
    executePlay()
  }, [executePlay])

  // Public pause function
  const pause = useCallback(() => {
    console.log('⏸️ PAUSE button clicked - executing locally...')
    executePause()
  }, [executePause])

  // Public stop function
  const stop = useCallback(() => {
    console.log('⏹️ STOP button clicked - executing locally...')
    executeStop()
  }, [executeStop])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    console.log('🎛️ togglePlay called', {
      hasAudioRef: !!audioRef.current,
      isPlaying,
      isPaused,
      isLoaded
    })

    if (!audioRef.current) {
      console.log('⚠️ No audio element - parent must handle audio creation')
      return
    }

    if (isPlaying) {
      console.log('⏸️ Currently playing → pausing')
      executePause()
    } else {
      console.log('▶️ Currently paused/stopped → playing')
      executePlay()
    }
  }, [isPlaying, isPaused, isLoaded, executePlay, executePause])

  // Load track
  const load = useCallback(async (track: Track) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📥 LOAD TRACK')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Track:', track.title, 'by', track.artist)

    try {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      
      setCurrentTrack(track)
      setIsPlaying(false)
      setIsPaused(false)
      
      // Load assets (cover art and waveform)
      const assets = await loadTrackAssets(track)
      setCoverArtUrl(assets.coverArtUrl)
      setWaveformUrl(assets.waveformUrl)

      // Mark as loaded
      setIsLoaded(true)
      console.log('✅ Track loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load track:', error)
      throw error
    }
  }, [])

  // Unload track
  const unload = useCallback(() => {
    console.log('⏏️ UNLOAD track')
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    
    setCurrentTrack(null)
    setIsPlaying(false)
    setIsPaused(false)
    setIsLoaded(false)
    setCurrentTime(0)
    setDuration(0)
    setCoverArtUrl(null)
    setWaveformUrl(null)
    
    console.log('✅ Track unloaded')
  }, [])

  // Set volume
  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }, [])

  return {
    // State
    isPlaying,
    isPaused,
    isLoaded,
    volume,
    autoPlay,
    currentTime,
    duration,
    currentTrack,
    coverArtUrl,
    waveformUrl,
    audioRef,
    
    // Actions
    play,
    pause,
    stop,
    togglePlay,
    load,
    unload,
    setVolume,
    setAutoPlay,
    setCurrentTime,
    
    // Internal setters
    _setCurrentTrack: setCurrentTrack,
    _setIsPlaying: setIsPlaying,
    _setIsPaused: setIsPaused,
    _setIsLoaded: setIsLoaded,
    _setDuration: setDuration,
  }
}
